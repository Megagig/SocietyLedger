# Local Subdomain Setup

Use subdomain-style hosts locally so tenant resolution works in both Next.js middleware and the Express API.

## Host file entries
Add entries to `/etc/hosts` (requires sudo):
```
127.0.0.1 demo.localhost
127.0.0.1 assoc1.localhost
127.0.0.1 assoc2.localhost
```

## Running the stack
- Frontend: `pnpm dev --filter web` (defaults to port 3000)
- API: `pnpm dev --filter api` (defaults to port 4000)

## How requests are resolved
- The Next.js middleware reads the request host and sets `x-tenant` to the subdomain (e.g., `demo`).
- The Express `tenantMiddleware` reads the same header (or host) and fetches the matching association record.
- Suspended or cancelled associations are blocked with 403 responses.

## Seeding
Run `pnpm db:seed --filter api` to create the default plans and a demo association (`demo.localhost`).

## Testing multiple tenants
Open different subdomains in the browser:
- `http://demo.localhost:3000`
- `http://assoc1.localhost:3000`

Each request will carry its subdomain to the API for tenant-scoped queries.
