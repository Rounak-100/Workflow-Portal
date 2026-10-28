import httpx
from fastapi import HTTPException
from .config import Settings

class Camunda:

    def __init__(self, settings: Settings, transport=None):
        auth = (settings.camunda_username, settings.camunda_password) if settings.camunda_auth_type == 'basic' else None
        self.client = httpx.AsyncClient(base_url=settings.camunda_url.rstrip('/') + '/', auth=auth, timeout=15, transport=transport)

    async def call(self, method: str, path: str, **kwargs):
        try:
            res = await self.client.request(method, path.lstrip('/'), headers={'Accept': 'application/json'}, **kwargs)
        except httpx.RequestError:
            raise HTTPException(503, detail={'code': 'CAMUNDA_UNREACHABLE', 'message': 'The workflow service is not reachable right now. Please try again in a few minutes.'})
        if res.status_code >= 400:
            code = 'NOT_FOUND' if res.status_code == 404 else 'CAMUNDA_ERROR'
            message = 'We could not find that item.' if res.status_code == 404 else 'The workflow service could not complete your request.'
            raise HTTPException(404 if res.status_code == 404 else 502, detail={'code': code, 'message': message})
        if not res.content:
            return None
        try:
            return res.json()
        except ValueError:
            return res.text
