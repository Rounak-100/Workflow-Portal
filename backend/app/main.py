import json
import logging
import re
from pathlib import Path
from contextlib import asynccontextmanager
from datetime import datetime
from fastapi import FastAPI, Depends, HTTPException, Request, UploadFile, File
from fastapi.responses import JSONResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field
from .config import Settings
from .auth import Authentication, CurrentUser
from .camunda import Camunda
from .core import encode, decode, clean_values, starter_groups, valid_id
s = Settings()
auth = Authentication(s)
cam = Camunda(s)
logging.basicConfig(level=logging.INFO)
log = logging.getLogger('portal')

@asynccontextmanager
async def lifespan(app: FastAPI):
    yield
    await cam.client.aclose()
app = FastAPI(title='Workflow Portal', lifespan=lifespan)

@app.exception_handler(HTTPException)
async def http_error(request: Request, exc: HTTPException):
    detail = exc.detail if isinstance(exc.detail, dict) else {'code': 'ERROR', 'message': str(exc.detail)}
    return JSONResponse({'error': detail}, status_code=exc.status_code)

@app.middleware('http')
async def security_headers(request: Request, call_next):
    if request.method in ('POST', 'PUT', 'PATCH', 'DELETE') and request.url.path.startswith('/api/') and (not request.url.path.startswith('/api/attachments')):
        if request.headers.get('content-type', '').split(';')[0] != 'application/json':
            return JSONResponse({'error': {'code': 'INVALID_INPUT', 'message': 'JSON content type required.'}}, status_code=400)
        if s.auth_mode == 'dev' and request.cookies.get('portal_dev_user') or (s.auth_mode == 'jwt' and request.cookies.get('portal_token')):
            if request.headers.get('X-Requested-With') != 'portal':
                return JSONResponse({'error': {'code': 'INVALID_INPUT', 'message': 'Request verification header required.'}}, status_code=403)
    response = await call_next(request)
    response.headers['X-Content-Type-Options'] = 'nosniff'
    response.headers['Referrer-Policy'] = 'same-origin'
    response.headers['X-Frame-Options'] = 'DENY'
    return response

class Values(BaseModel):
    values: dict = Field(default_factory=dict)

def allow_key(key: str):
    valid_id(key)
    if s.allowed_workflows != '*' and key not in {x.strip() for x in s.allowed_workflows.split(',')}:
        raise HTTPException(404, detail={'code': 'NOT_FOUND', 'message': 'Workflow not found.'})

def schema_from_result(result):
    if isinstance(result, dict) and 'components' in result:
        return result
    if isinstance(result, dict) and 'form' in result:
        value = result['form']
        return json.loads(value) if isinstance(value, str) else value
    if isinstance(result, str):
        return json.loads(result)
    raise HTTPException(502, detail={'code': 'CAMUNDA_ERROR', 'message': 'The form could not be shown.'})

async def allowed_definition(definition: dict, user: CurrentUser) -> bool:
    key = definition.get('key', '')
    if s.allowed_workflows != '*' and key not in {x.strip() for x in s.allowed_workflows.split(',')}:
        return False
    xml_data = await cam.call('GET', f"process-definition/{valid_id(definition['id'])}/xml")
    groups = starter_groups(xml_data.get('bpmn20Xml', '') if isinstance(xml_data, dict) else '')
    return groups is not None and (not groups or bool(groups.intersection(user.groups)))

async def get_definition(key: str, user: CurrentUser):
    allow_key(key)
    definition = await cam.call('GET', f'process-definition/key/{key}')
    if not await allowed_definition(definition, user):
        raise HTTPException(403, detail={'code': 'NOT_ALLOWED_TO_START', 'message': 'You cannot start this workflow.'})
    return definition

@app.get('/healthz')
async def health():
    return {'status': 'ok'}

@app.get('/readyz')
async def ready():
    try:
        await cam.call('GET', 'version')
        return {'status': 'ok'}
    except HTTPException:
        return JSONResponse({'status': 'camunda_unreachable'}, status_code=503)

@app.get('/api/me')
async def me(user: CurrentUser=Depends(auth)):
    return {'user': user.model_dump(), 'auth_mode': s.auth_mode, 'login_url': s.login_url}

@app.get('/api/workflows')
async def workflows(user: CurrentUser=Depends(auth)):
    defs = await cam.call('GET', 'process-definition', params={'latestVersion': 'true', 'active': 'true', 'sortBy': 'name', 'sortOrder': 'asc'})
    output = []
    meta = {}
    if s.workflow_meta_file and Path(s.workflow_meta_file).exists():
        meta = json.loads(Path(s.workflow_meta_file).read_text())
    for d in defs:
        if await allowed_definition(d, user):
            info = meta.get(d['key'], {})
            output.append({'key': d['key'], 'name': d.get('name') or d['key'].replace('_', ' ').title(), 'description': info.get('description', ''), 'category': info.get('category', 'General'), 'icon': info.get('icon', 'file')})
    return output

@app.get('/api/workflows/{key}/form')
async def workflow_form(key: str, user: CurrentUser=Depends(auth)):
    definition = await get_definition(key, user)
    schema = schema_from_result(await cam.call('GET', f'process-definition/key/{key}/deployed-start-form'))
    return {'workflow': {'key': key, 'name': definition.get('name') or key}, 'schema': schema, 'attachment_fields': [c.get('key') for c in schema.get('components', []) if c.get('properties', {}).get('wf:attachment') == 'true']}

@app.post('/api/workflows/{key}/start', status_code=201)
async def start(key: str, body: Values, user: CurrentUser=Depends(auth)):
    await get_definition(key, user)
    schema = schema_from_result(await cam.call('GET', f'process-definition/key/{key}/deployed-start-form'))
    values = clean_values(schema, body.values)
    values['initiator'] = user.employee_id
    result = await cam.call('POST', f'process-definition/key/{key}/submit-form', json={'variables': {k: encode(v) for k, v in values.items()}})
    log.info('audit start employee=%s workflow=%s', user.employee_id, key)
    return {'request_id': result['id']}

async def task_access(task_id: str, user: CurrentUser):
    task = await cam.call('GET', f'task/{valid_id(task_id)}')
    assignee = task.get('assignee')
    if assignee == user.employee_id:
        return (task, False)
    if assignee:
        raise HTTPException(404, detail={'code': 'NOT_FOUND', 'message': 'We could not find this task.'})
    links = await cam.call('GET', f'task/{task_id}/identity-links')
    candidate = any((l.get('type') == 'candidate' and (l.get('groupId') in user.groups or l.get('userId') == user.employee_id) for l in links))
    if not candidate:
        raise HTTPException(404, detail={'code': 'NOT_FOUND', 'message': 'We could not find this task.'})
    return (task, True)

@app.get('/api/tasks')
async def tasks(scope: str='all', user: CurrentUser=Depends(auth)):
    result = []
    if scope in ('all', 'mine'):
        mine = await cam.call('GET', 'task', params={'assignee': user.employee_id, 'active': 'true', 'sortBy': 'created', 'sortOrder': 'desc'})
        result += [{**t, 'is_team_task': False, 'request_id': t.get('processInstanceId'), 'workflow_key': t.get('processDefinitionId', '').split(':')[0]} for t in mine]
    if scope in ('all', 'team') and user.groups:
        team = await cam.call('GET', 'task', params={'candidateGroups': ','.join(user.groups), 'unassigned': 'true', 'active': 'true', 'sortBy': 'created', 'sortOrder': 'desc'})
        result += [{**t, 'is_team_task': True, 'request_id': t.get('processInstanceId'), 'workflow_key': t.get('processDefinitionId', '').split(':')[0]} for t in team if t.get('id') not in {x['id'] for x in result}]
    return result

@app.get('/api/tasks/{task_id}')
async def task_detail(task_id: str, user: CurrentUser=Depends(auth)):
    task, needs_claim = await task_access(task_id, user)
    schema = schema_from_result(await cam.call('GET', f'task/{task_id}/deployed-form'))
    raw = await cam.call('GET', f'task/{task_id}/form-variables', params={'deserializeValues': 'false'})
    data = {k: decode(v) for k, v in raw.items()}
    return {'task': task, 'schema': schema, 'data': data, 'can_act': not needs_claim, 'needs_claim': needs_claim, 'attachment_fields': []}

@app.post('/api/tasks/{task_id}/claim')
async def claim(task_id: str, user: CurrentUser=Depends(auth)):
    _, needs_claim = await task_access(task_id, user)
    if not needs_claim:
        raise HTTPException(409, detail={'code': 'ALREADY_CLAIMED', 'message': 'This task has already been taken.'})
    await cam.call('POST', f'task/{task_id}/claim', json={'userId': user.employee_id})
    log.info('audit claim employee=%s task=%s', user.employee_id, task_id)
    return {'ok': True}

@app.post('/api/tasks/{task_id}/submit')
async def submit(task_id: str, body: Values, user: CurrentUser=Depends(auth)):
    _, needs_claim = await task_access(task_id, user)
    if needs_claim:
        raise HTTPException(409, detail={'code': 'ALREADY_CLAIMED', 'message': 'Take this task before submitting.'})
    schema = schema_from_result(await cam.call('GET', f'task/{task_id}/deployed-form'))
    values = clean_values(schema, body.values)
    if 'decision' in {c.get('key') for c in schema.get('components', [])} and (not values.get('decision')):
        raise HTTPException(400, detail={'code': 'NO_DECISION', 'message': 'Please choose a decision.'})
    await cam.call('POST', f'task/{task_id}/submit-form', json={'variables': {k: encode(v) for k, v in values.items()}})
    log.info('audit submit employee=%s task=%s', user.employee_id, task_id)
    return {'ok': True}

async def historic_variables(instance_ids: list[str]):
    if not instance_ids:
        return {}
    rows = await cam.call('GET', 'history/variable-instance', params={'processInstanceIdIn': ','.join(instance_ids), 'deserializeValues': 'false'})
    result = {}
    for row in rows:
        result.setdefault(row['processInstanceId'], {})[row['name']] = decode(row)
    return result

@app.get('/api/requests')
async def requests(state: str='all', page: int=1, page_size: int=20, user: CurrentUser=Depends(auth)):
    page = max(1, page)
    page_size = max(1, min(100, page_size))
    query = {'variables': [{'name': 'initiator', 'operator': 'eq', 'value': user.employee_id}], 'sortBy': 'startTime', 'sortOrder': 'desc', 'firstResult': (page - 1) * page_size, 'maxResults': page_size}
    if s.allowed_workflows != '*':
        query['processDefinitionKeyIn'] = [x.strip() for x in s.allowed_workflows.split(',')]
    if state == 'running':
        query['unfinished'] = True
    if state == 'finished':
        query['finished'] = True
    rows = await cam.call('POST', 'history/process-instance', json=query)
    vars = await historic_variables([x['id'] for x in rows])
    items = []
    for r in rows:
        v = vars.get(r['id'], {})
        status = v.get('wf_status') or ('completed' if r.get('endTime') else 'running')
        items.append({'id': r['id'], 'title': v.get('wf_title') or r.get('processDefinitionKey', 'Request'), 'workflow_key': r.get('processDefinitionKey'), 'workflow_name': r.get('processDefinitionKey', '').replace('_', ' ').title(), 'status': status, 'status_label': status.replace('_', ' ').title(), 'started': r.get('startTime'), 'ended': r.get('endTime')})
    return {'items': items, 'total': len(items), 'page': page, 'page_size': page_size}

async def request_access(instance_id: str, user: CurrentUser):
    valid_id(instance_id)
    row = await cam.call('GET', f'history/process-instance/{instance_id}')
    vars = await historic_variables([instance_id])
    initiator = vars.get(instance_id, {}).get('initiator')
    if initiator != user.employee_id:
        tasks = await cam.call('GET', 'history/task', params={'processInstanceId': instance_id, 'taskAssignee': user.employee_id})
        if not tasks:
            raise HTTPException(404, detail={'code': 'NOT_FOUND', 'message': 'Request not found.'})
    return (row, vars.get(instance_id, {}))

@app.get('/api/requests/{instance_id}')
async def request_detail(instance_id: str, user: CurrentUser=Depends(auth)):
    row, v = await request_access(instance_id, user)
    steps = await cam.call('GET', 'history/activity-instance', params={'processInstanceId': instance_id, 'sortBy': 'startTime', 'sortOrder': 'asc'})
    waiting = []
    if not row.get('endTime'):
        waiting = await cam.call('GET', 'task', params={'processInstanceId': instance_id})
    status = v.get('wf_status') or ('completed' if row.get('endTime') else 'running')
    return {'id': instance_id, 'title': v.get('wf_title') or row.get('processDefinitionKey'), 'workflow_key': row.get('processDefinitionKey'), 'status': status, 'status_label': status.title(), 'started': row.get('startTime'), 'ended': row.get('endTime'), 'steps': [{'name': x.get('activityName') or x.get('activityId'), 'kind': x.get('activityType'), 'started': x.get('startTime'), 'ended': x.get('endTime'), 'state': 'completed' if x.get('endTime') else 'running'} for x in steps], 'waiting_on': [{'task_name': x.get('name'), 'person_name_or_id': x.get('assignee'), 'since': x.get('created')} for x in waiting], 'can_withdraw': v.get('initiator') == user.employee_id and (not row.get('endTime'))}

@app.post('/api/requests/{instance_id}/withdraw')
async def withdraw(instance_id: str, user: CurrentUser=Depends(auth)):
    row, v = await request_access(instance_id, user)
    if row.get('endTime') or v.get('initiator') != user.employee_id:
        raise HTTPException(409, detail={'code': 'CANNOT_WITHDRAW', 'message': 'This request cannot be withdrawn.'})
    await cam.call('POST', 'message', json={'messageName': 'wf_withdraw', 'processInstanceId': instance_id})
    log.info('audit withdraw employee=%s request=%s', user.employee_id, instance_id)
    return {'ok': True}

@app.post('/api/attachments', status_code=201)
async def upload(file: UploadFile=File(...), user: CurrentUser=Depends(auth)):
    import uuid
    allowed = {x.strip().lower() for x in s.allowed_upload_types.split(',')}
    name = Path(file.filename or 'file').name.lstrip('.')[:120]
    ext = Path(name).suffix.lower()
    if ext not in allowed:
        raise HTTPException(415, detail={'code': 'FILE_TYPE_NOT_ALLOWED', 'message': 'This file type is not allowed.'})
    data = await file.read(s.max_upload_mb * 1024 * 1024 + 1)
    if len(data) > s.max_upload_mb * 1024 * 1024:
        raise HTTPException(413, detail={'code': 'FILE_TOO_LARGE', 'message': 'This file is too large.'})
    signatures = {'.pdf': data.startswith(b'%PDF-'), '.png': data.startswith(b'\x89PNG\r\n\x1a\n'), '.jpg': data.startswith(b'\xff\xd8'), '.jpeg': data.startswith(b'\xff\xd8'), '.txt': b'\x00' not in data}
    if not signatures.get(ext, False):
        raise HTTPException(415, detail={'code': 'FILE_TYPE_NOT_ALLOWED', 'message': 'The file content does not match its type.'})
    uid = str(uuid.uuid4())
    directory = Path(s.attachments_dir) / uid
    directory.mkdir(parents=True, exist_ok=True)
    (directory / name).write_bytes(data)
    (directory / 'meta.json').write_text(json.dumps({'owner': user.employee_id, 'name': name, 'size': len(data), 'created': datetime.now().isoformat()}))
    return {'id': uid, 'name': name, 'size': len(data)}

@app.get('/api/attachments/{attachment_id}')
async def download(attachment_id: str, user: CurrentUser=Depends(auth)):
    valid_id(attachment_id)
    directory = Path(s.attachments_dir) / attachment_id
    meta_file = directory / 'meta.json'
    if not meta_file.exists():
        raise HTTPException(404, detail={'code': 'NOT_FOUND', 'message': 'File not found.'})
    meta = json.loads(meta_file.read_text())
    if meta['owner'] != user.employee_id:
        raise HTTPException(404, detail={'code': 'NOT_FOUND', 'message': 'File not found.'})
    return FileResponse(directory / meta['name'], filename=meta['name'], media_type='application/octet-stream')
static = Path(__file__).parent / 'static'
if static.exists():
    app.mount('/assets', StaticFiles(directory=static / 'assets'), name='assets')

    @app.get('/{path:path}', include_in_schema=False)
    async def spa(path: str):
        requested = static / path
        if requested.is_file() and static in requested.resolve().parents:
            return FileResponse(requested)
        return FileResponse(static / 'index.html')
