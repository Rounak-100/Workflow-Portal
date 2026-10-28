from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import model_validator

class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file='.env', extra='ignore')
    env: str = 'development'
    camunda_url: str = 'http://localhost:8080/engine-rest'
    camunda_auth_type: str = 'none'
    camunda_username: str = ''
    camunda_password: str = ''
    auth_mode: str = 'dev'
    dev_users_file: str = 'dev_users.json'
    login_url: str = ''
    jwt_algorithm: str = 'RS256'
    jwt_secret: str = ''
    jwks_url: str = ''
    jwt_audience: str = ''
    jwt_issuer: str = ''
    jwt_claim_employee_id: str = 'employee_id'
    jwt_claim_groups: str = 'groups'
    trusted_header_shared_secret: str = ''
    allowed_workflows: str = '*'
    workflow_meta_file: str = ''
    display_timezone: str = 'Asia/Kolkata'
    attachments_dir: str = './data/attachments'
    max_upload_mb: int = 10
    allowed_upload_types: str = '.pdf,.png,.jpg,.jpeg,.txt'

    @model_validator(mode='after')
    def validate_config(self):
        if not self.camunda_url.startswith(('http://', 'https://')):
            raise ValueError('CAMUNDA_URL must be HTTP(S)')
        if self.env == 'production' and self.auth_mode == 'dev':
            raise ValueError('Development authentication forbidden in production')
        if self.auth_mode == 'jwt' and (not (self.jwt_secret or self.jwks_url)):
            raise ValueError('JWT key configuration required')
        if self.env == 'production' and self.auth_mode == 'header' and (not self.trusted_header_shared_secret):
            raise ValueError('Trusted header secret required')
        return self
