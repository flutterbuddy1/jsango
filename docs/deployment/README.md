# jsango Production Deployment Guide

This guide covers best practices for deploying `jsango` applications to production environments.

## Production mode

jsango runs in **production mode unless `NODE_ENV` is `development` or `test`**. A server started
without `NODE_ENV` (common with Docker, PM2 or a plain `node dist/index.js`) is safe by default:

- 500 responses say "An internal error occurred." (no SQL, stack traces or provider errors);
- auth cookies are `Secure`;
- the built-in admin account refuses to sign in without a `JSANGO_ADMIN_PASSWORD` of 12+ characters.

Set `NODE_ENV=development` on your machine (projects from `jsango new` have it in `.env`). Server
errors (5xx) are logged with their stack: JSON lines in production, readable text in development.
Pass `createApp({ logger })` to use your own logger.

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

### Trusting the proxy

Behind a proxy or load balancer (Nginx, Caddy, AWS ALB, Heroku, Fly.io, Kubernetes ingress), tell
jsango how many proxies sit in front of it:

```typescript
import { createApp } from 'jsango';

const app = createApp({ trustProxy: true }); // one proxy; use a number for a chain (e.g. CDN + LB)
```

Then `ctx.request.ip`, `ctx.request.protocol` (`https`) and the host come from `X-Forwarded-For`,
`X-Forwarded-Proto` and `X-Forwarded-Host`. This is what makes login rate limits count real client
IPs and cookie sessions accept `https://` origins. Without `trustProxy` these headers are ignored,
because anyone can send them; never enable it when clients can reach the app directly.

The keep-alive timeout defaults to 65 seconds, longer than common load balancer idle timeouts (60s),
which avoids sporadic 502s.

### Security headers and rate limits

```typescript
import { createApp, securityHeaders, rateLimit, DatabaseAuthStore } from 'jsango';

const app = createApp({ trustProxy: true });
app.use(securityHeaders());
// Several instances: share the counters through the database (or any store with increment()).
app.use(rateLimit({ max: 300, store: new DatabaseAuthStore({ connection: db }) }));
```

---

## 3. Graceful Shutdown & Process Management

Handle `SIGTERM` and `SIGINT` in your entry point to shut down gracefully. Projects scaffolded with `jsango create` already do this for the database; extend the handler for the HTTP server and other subsystems:

```typescript
import { createApp, getDatabaseManager } from 'jsango';

const app = createApp();
const server = await app.listen(3000);

const shutdown = async () => {
  await server.close(10_000); // stop accepting connections, wait for in-flight requests, close WebSockets
  await getDatabaseManager().close(); // drain database connection pools
  process.exit(0);
};
process.once('SIGINT', shutdown);
process.once('SIGTERM', shutdown);
```

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

Register these endpoints with `HealthRegistry` and `createHealthHandler()` from `@jsango/observability` (see the [Observability architecture](../architecture/observability/README.md)); they are not mounted automatically:

- **Liveness Probe (`/health/live`)**: Returns HTTP `200` if the Node.js event loop is operational.
- **Readiness Probe (`/health/ready`)**: Returns HTTP `200` if all critical subsystem checks (database pools, cache, queue drivers) are connected and ready to accept traffic.
