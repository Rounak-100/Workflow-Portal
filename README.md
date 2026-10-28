# Workflow Portal

Standalone employee-facing workflow portal, designed to visually match the supplied Workflow Studio. React 18 + TypeScript + Tailwind frontend; FastAPI backend; Camunda 7 REST integration.

## Features implemented
- Startable workflows read dynamically from Camunda; category and search
- Deployed form-js start forms and task forms
- Start process with server-authenticated `initiator` and form key filtering
- Assigned/team task lists; task claim and submit
- My Requests history, progress timeline, and withdraw endpoint
- Development identity switcher, JWT, trusted-header authentication
- Backend task and request access control, Camunda error sanitization
- Attachment upload and owner download
- Single-container Docker build and separate dev compose overlay

## Run
1. `cp .env.example .env`
2. Set `CAMUNDA_URL` to the reachable Camunda REST base URL, such as `http://camunda:8080/engine-rest` when attached to the Studio's Docker network. Do **not** use `localhost` from a Docker container to refer to a different host/container.
3. `docker compose up --build`
4. Open `http://localhost:8081`. Select a development user to begin.

To attach to the Studio Docker network: `docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build`. Ensure the network name in `docker-compose.dev.yml` matches your actual network.

### Local frontend development
- Backend: `cd backend && pip install -r requirements-dev.txt && uvicorn app.main:app --reload --port 8081`
- Frontend: `cd frontend && npm install && npm run dev`
- Open `http://localhost:5173`; Vite proxies `/api` to port 8081.
- The dev user file is `backend/dev_users.json` when running backend from `backend/`.

### Test
- Backend: `cd backend && pytest -q`
- Frontend: `cd frontend && npm run build`
- Real Camunda end-to-end integration must be verified separately before production deployment.

## Authentication
`AUTH_MODE=dev` uses test users from `DEV_USERS_FILE`; production forbids it. `AUTH_MODE=jwt` verifies JWT via `JWKS_URL` or `JWT_SECRET`, mapping employee identity via `JWT_CLAIM_EMPLOYEE_ID` and roles via `JWT_CLAIM_GROUPS`. `AUTH_MODE=header` expects trusted reverse-proxy headers and `X-Portal-Secret`. Only allow the proxy to set these headers and restrict direct backend access.

## Required Camunda service-account permissions
Read deployed process definitions/BPMN/forms, start process instances, read/claim/complete tasks, read historic process instances/variables/activities/tasks, correlate withdraw messages. Restrict the service account to the intended process definitions where possible. Backend must enforce employee permissions because Camunda sees a service account.

## Configuration
See `.env.example`. The portal does not install Camunda, alter Workflow Studio, or connect to the Main Website. See `docs/ASSUMPTIONS.md` for unverified API details and remaining acceptance gaps.

## Status
**Initial implementation, not production-ready.** Frontend package installation and build, full integration/E2E tests, attachment task-participant permissions, and some Camunda-specific REST assumptions still need verification. Do not deploy to company production without completing these checks.
