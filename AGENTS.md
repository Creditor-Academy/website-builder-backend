# Backend AGENTS.md — Buildora API Server

> Backend-specific context for AI assistants. See also `../AGENTS.md` for full project overview.

---

## Quick Start

```bash
npm install                    # Install dependencies
cp .env.example .env           # Setup environment (fill in secrets)
npx prisma generate            # Generate Prisma client
npx prisma migrate dev         # Apply migrations
npm run dev                    # Start dev server (tsx watch)
```

## Scripts

| Command | Purpose |
|---|---|
| `npm run dev` | Start dev server with hot reload (`tsx watch src/main.ts`) |
| `npm run build` | TypeScript compile to `dist/` |
| `npm start` | Run compiled production build (`node dist/main.js`) |
| `npm test` | Run tests (`node --import tsx --test src/**/*.test.ts`) |

---

## Module Development Checklist

When creating or modifying a module:

- [ ] Validation schemas defined in `<module>.validation.ts` using Zod v4
- [ ] DAO uses `prismaClient` directly — no business logic in DAO
- [ ] Service contains ALL business logic and throws `AppError` subclasses
- [ ] Controller only extracts request data, calls service, and returns JSON
- [ ] Routes define middleware chain: `authenticate → authorize? → validateRequest → requireOwnership? → controller`
- [ ] Module registered in `modules/api.routes.ts`
- [ ] All imports use `.js` extension
- [ ] All type imports use `import type` syntax

---

## Existing API Endpoints (Current State)

### Auth (`/api/v1/auth`)
- `POST /register` — Register new user
- `POST /login` — Login with email/password
- `POST /logout` — Logout (revoke session)
- `POST /forgot-password` — Request password reset
- `POST /reset-password` — Reset with token
- `GET /verify-email/:token` — Email verification
- `POST /refresh-token` — Refresh access token

### Websites (`/api/v1/websites`)
- `POST /` — Create website
- `GET /` — List my websites
- `GET /all` — List all (admin)
- `GET /:id` — Get single website
- `PATCH /:id` — Update website
- `DELETE /:id` — Soft delete
- `POST /:id/restore` — Restore
- `POST /:id/duplicate` — Duplicate
- `PATCH /:id/settings` — Update settings
- `GET /:id/versions` — Version history
- `POST /:id/publish` — Publish website
- `GET /:id/deployments` — List deployments
- `POST /:id/deployments/rollback` — Rollback
- `GET /:id/domains` — List domains
- `POST /:id/domains` — Add domain
- `DELETE /:id/domains` — Remove domain
- `POST /:id/domains/verify` — Verify domain
- `GET /:id/export` — Export as ZIP

### Templates (`/api/v1/templates`)
- `POST /website` — Create website template (admin)
- `GET /website` — List website templates
- `GET /website/:id` — Get template
- `PUT /website/:id` — Update template
- `DELETE /website/:id` — Delete template
- `POST /section` — Create section template (admin)
- `GET /section` — List section templates
- `GET /section/:id` — Get section template
- `PUT /section/:id` — Update section template
- `DELETE /section/:id` — Delete section template

### Other Routes
- `GET /api/v1/health` — Health check
- `GET /api/v1/metrics` — Request metrics
- `POST /api/v1/client-errors` — Client error reporting
- `/api/v1/users` — User management
- `/api/v1/organizations` — Institution management
- `/api/v1/stats` — Dashboard statistics
- `/api/v1/contact` — Contact submissions
- `/api/v1/assets` — Asset management
- `/api/v1/forms` — Form submissions
- `/api/v1/analytics` — Page view tracking
- `/api/v1/deployments` — Deployment management

---

## Database Schema Quick Reference

### Enums

```
UserRole: USER | ADMIN | STUDENT | INSTRUCTOR | INSTITUTION_ADMIN | SUPER_ADMIN
WebsiteStatus: DRAFT | PUBLISHED | DELETED
TemplateScope: GLOBAL | INSTITUTION
AssetScope: GLOBAL | WEBSITE
AssetType: image | video | file
DeploymentStatus: PENDING | BUILDING | UPLOADING | ACTIVE | FAILED | ROLLED_BACK
DomainType: SUBDOMAIN | CUSTOM
DomainStatus: PENDING | ACTIVE | ERROR | DELETED
```

### Key Relationships

```
User → Institution (belongs to)
User → Website[] (one-to-many, via owner_id)
Website → Institution (optional, scoped)
Website → Settings (one-to-one)
Website → WebsiteVersion[] (one-to-many)
Website → Deployment[] (one-to-many)
Website → Domain[] (one-to-many)
Website → Asset[] (one-to-many)
Website → FormSubmission[] (one-to-many)
Website → PageView[] (one-to-many)
Website → ContactSubmission[] (one-to-many)
Institution → WebsiteTemplate[] (scoped templates)
Institution → SectionTemplate[] (scoped templates)
```

---

## Code Quality Rules

1. **Never** put business logic in controllers or DAOs
2. **Never** import Prisma client outside of DAO layer (except config)
3. **Never** return raw Prisma errors to the client — catch and throw AppError
4. **Always** validate all external input with Zod schemas
5. **Always** use `req.validated.body/query/params` instead of raw `req.body/query/params`
6. **Always** scope queries by user/institution unless explicitly public
7. **Always** add `@@index` in Prisma for fields used in WHERE/ORDER BY
8. **Always** use `import type` for type-only imports
