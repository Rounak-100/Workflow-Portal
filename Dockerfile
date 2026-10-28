FROM node:20-slim AS frontend
WORKDIR /ui
COPY frontend/package*.json ./
RUN npm install --no-audit --no-fund
COPY frontend/ ./
RUN npm run build
FROM python:3.12-slim
WORKDIR /srv
COPY backend/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt && useradd -m portal
COPY backend/app ./app
COPY backend/dev_users.json ./dev_users.json
COPY --from=frontend /ui/dist ./app/static
RUN mkdir -p /srv/data/attachments && chown -R portal:portal /srv
USER portal
EXPOSE 8081
CMD ["uvicorn","app.main:app","--host","0.0.0.0","--port","8081","--proxy-headers"]
