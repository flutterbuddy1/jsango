# jsango Production Deployment Guide

This guide covers best practices for deploying `jsango` applications to production environments.

---

## 1. Production Dockerfile

```dockerfile
# Build Stage
FROM node:20-alpine AS builder
WORKDIR /app
RUN npm install -g pnpm@12.5.1
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml* ./
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm build

# Production Stage
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN npm install -g pnpm@12.5.1
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml* ./
COPY --from=builder /app/dist ./dist
RUN pnpm install --prod --frozen-lockfile

USER node
EXPOSE 3000

HEALTHCHECK --interval=15s --timeout=3s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://localhost:3000/health/live || exit 1

CMD ["node", "dist/index.js"]
```

---

## 2. Reverse Proxy (Nginx / Caddy)

Always run `jsango` behind a high-performance reverse proxy (e.g. Nginx or Caddy) to handle TLS termination, static asset caching, and request rate limiting.

### Nginx Example

```nginx
upstream jsango_backend {
    server 127.0.0.1:3000;
    keepalive 64;
}

server {
    listen 80;
    server_name api.example.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name api.example.com;

    ssl_certificate /etc/letsencrypt/live/example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/example.com/privkey.pem;

    location / {
        proxy_pass http://jsango_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

---

## 3. Graceful Shutdown & Process Management

`jsango` applications listen for `SIGTERM` and `SIGINT` signals to gracefully close active HTTP sockets, drain database connection pools, acknowledge active queue worker leases, and notify WebSocket clients before process termination.

### PM2 Ecosystem Example (`ecosystem.config.cjs`)

```javascript
module.exports = {
  apps: [
    {
      name: 'jsango-api',
      script: 'dist/index.js',
      instances: 'max',
      exec_mode: 'cluster',
      kill_timeout: 10000,
      env_production: {
        NODE_ENV: 'production',
        PORT: 3000,
      },
    },
  ],
};
```

---

## 4. Health Checks & Kubernetes Probes

`jsango` provides standardized endpoints for orchestrators:

- **Liveness Probe (`/health/live`)**: Returns HTTP `200` if the Node.js event loop is operational.
- **Readiness Probe (`/health/ready`)**: Returns HTTP `200` if all critical subsystem checks (database pools, cache, queue drivers) are connected and ready to accept traffic.
