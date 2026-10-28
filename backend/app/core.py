import json
import re
from datetime import date, datetime
from typing import Any
from lxml import etree
from fastapi import HTTPException
SAFE_ID = re.compile('^[A-Za-z0-9_:.-]{1,100}$')
RESERVED = {'initiator', 'request_id', 'wf_title', 'wf_status'}

def valid_id(value: str) -> str:
    if not SAFE_ID.fullmatch(value) or '..' in value:
        raise HTTPException(400, detail={'code': 'INVALID_INPUT', 'message': 'Invalid identifier.'})
    return value

def encode(value: Any) -> dict:
    if value is None:
        return {'value': None, 'type': 'Null'}
    if isinstance(value, bool):
        return {'value': value, 'type': 'Boolean'}
    if isinstance(value, int):
        return {'value': value, 'type': 'Integer' if -2 ** 31 <= value < 2 ** 31 else 'Long'}
    if isinstance(value, float):
        return {'value': value, 'type': 'Double'}
    if isinstance(value, datetime):
        if value.tzinfo is None:
            raise ValueError('Timezone required')
        return {'value': value.strftime('%Y-%m-%dT%H:%M:%S.%f')[:23] + value.strftime('%z'), 'type': 'Date'}
    if isinstance(value, date):
        return {'value': value.isoformat(), 'type': 'String'}
    if isinstance(value, (list, dict)):
        return {'value': json.dumps(value, ensure_ascii=False), 'type': 'Json'}
    return {'value': str(value), 'type': 'String'}

def decode(item: dict) -> Any:
    if item.get('type') == 'Null':
        return None
    if item.get('type') == 'Json' and isinstance(item.get('value'), str):
        try:
            return json.loads(item['value'])
        except ValueError:
            pass
    return item.get('value')

def form_keys(schema: dict) -> set[str]:
    keys = set()

    def visit(items):
        for component in items or []:
            key = component.get('key')
            if key and component.get('type') not in ('text', 'spacer', 'button', 'separator', 'html', 'image'):
                keys.add(key)
            visit(component.get('components'))
    visit(schema.get('components'))
    return keys

def clean_values(schema: dict, values: dict) -> dict:
    allowed = form_keys(schema)
    return {k: v for k, v in values.items() if k in allowed and k not in RESERVED and (not k.startswith('wf_'))}

def starter_groups(xml: str) -> set[str] | None:
    try:
        root = etree.fromstring(xml.encode(), parser=etree.XMLParser(resolve_entities=False, no_network=True))
        process = root.find('.//{http://www.omg.org/spec/BPMN/20100524/MODEL}process')
        if process is None:
            return None
        attr = process.get('{http://camunda.org/schema/1.0/bpmn}candidateStarterGroups')
        return set((x.strip() for x in attr.split(',') if x.strip())) if attr else set()
    except (etree.XMLSyntaxError, ValueError):
        return None
