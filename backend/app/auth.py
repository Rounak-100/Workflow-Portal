import json
from pathlib import Path
import jwt
from jwt import PyJWKClient
from fastapi import Request, HTTPException
from pydantic import BaseModel, Field
from .config import Settings

class CurrentUser(BaseModel):
    employee_id: str
    name: str
    email: str | None = None
    groups: list[str] = Field(default_factory=list)

class Authentication:

    def __init__(self, settings: Settings):
        self.settings = settings

    async def __call__(self, request: Request) -> CurrentUser:
        s = self.settings
        data = None
        if s.auth_mode == 'dev':
            user_id = request.cookies.get('portal_dev_user') or request.headers.get('X-Dev-User')
            path = Path(s.dev_users_file)
            if user_id and path.exists():
                data = next((u for u in json.loads(path.read_text()) if u['employee_id'] == user_id), None)
        elif s.auth_mode == 'jwt':
            bearer = request.headers.get('Authorization', '')
            token = bearer.removeprefix('Bearer ').strip() if bearer.startswith('Bearer ') else request.cookies.get('portal_token')
            if token:
                try:
                    key = PyJWKClient(s.jwks_url).get_signing_key_from_jwt(token).key if s.jwks_url else s.jwt_secret
                    claims = jwt.decode(token, key, algorithms=[s.jwt_algorithm], audience=s.jwt_audience or None, issuer=s.jwt_issuer or None, options={'verify_aud': bool(s.jwt_audience)})
                    data = {'employee_id': claims[s.jwt_claim_employee_id], 'name': claims.get('name', claims[s.jwt_claim_employee_id]), 'email': claims.get('email'), 'groups': claims.get(s.jwt_claim_groups, [])}
                except (jwt.PyJWTError, KeyError, ValueError):
                    pass
        elif s.auth_mode == 'header':
            import secrets
            if s.trusted_header_shared_secret and secrets.compare_digest(request.headers.get('X-Portal-Secret', ''), s.trusted_header_shared_secret):
                emp = request.headers.get('X-Employee-Id')
                if emp:
                    data = {'employee_id': emp, 'name': request.headers.get('X-Employee-Name', emp), 'groups': [x.strip() for x in request.headers.get('X-Employee-Groups', '').split(',') if x.strip()]}
        if not data:
            raise HTTPException(401, detail={'code': 'NOT_LOGGED_IN', 'message': 'Please sign in to continue.'})
        return CurrentUser.model_validate(data)
