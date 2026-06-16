# AGENTS.md — Buildora Website Builder

> This file provides context for AI coding assistants (Antigravity, Gemini, Copilot, Cursor, etc.)
> working on this codebase. Read this before making any changes.

---

## Project Overview

**Product:** Buildora (codename Athena) — A multi-tenant SaaS website builder platform
**Stage:** Alpha — core editor and dashboard functional, several backend subsystems incomplete
**Focus Area:** Backend development (Express.js + TypeScript + Prisma + PostgreSQL)

Buildora lets institutions (universities, colleges) and individuals build, publish, and manage professional websites without code. Think of it as a multi-tenant Wix/Squarespace specifically designed for educational institutions with role-based access control.

---

## Tech Stack

| Layer | Technology | Notes |
|---|---|---|
| **Runtime** | Node.js 20+ | ESM modules (`"type": "module"` in package.json) |
| **Framework** | Express.js 5 | Latest version with native async error handling |
| **Language** | TypeScript 5.9 | Strict mode, `nodenext` module resolution |
| **ORM** | Prisma 7.4 | With `@prisma/adapter-pg` (driver adapter pattern) |
| **Database** | PostgreSQL 16 | Via Docker or cloud-hosted |
| **Cache/Sessions** | Redis (Upstash) | HTTP-based `@upstash/redis`, NOT standard `redis` client |
| **Object Storage** | S3-compatible | MinIO (local), AWS S3 or Cloudflare R2 (prod) |
| **Auth** | JWT + bcrypt | Cookie-based auth, NOT Bearer tokens |
| **Validation** | Zod 4 | Request validation via middleware |
| **Logging** | Pino + pino-http | Structured JSON logging |
| **Email** | Resend SDK | Transactional email provider |
| **Dev Server** | tsx | `tsx watch src/main.ts` for hot reload |
| **Build** | tsc | Compiles to `dist/` |

### Key Dependencies

```
express@5, prisma@7, zod@4, @upstash/redis, @aws-sdk/client-s3,
jsonwebtoken, bcrypt, pino, resend, archiver, multer, helmet, cors, compression
```

---

## Repository Structure

```
website-builder/
├── backend/                          # ← YOU ARE WORKING HERE
│   ├── src/
│   │   ├── main.ts                   # Express server entry point
│   │   ├── config/                   # Prisma, Redis, S3 clients
│   │   ├── middlewares/              # Auth, validation, error, rate-limiting, RBAC
│   │   ├── modules/                  # Feature modules (routes → controller → service → dao)
│   │   │   ├── api.routes.ts         # Central route registry
│   │   │   ├── auth/                 # Authentication & authorization
│   │   │   ├── website/              # Website CRUD, publish, deploy, domains
│   │   │   ├── template/             # Website & section templates
│   │   │   ├── user/                 # User management
│   │   │   ├── institution/          # Organization/tenant management
│   │   │   ├── assets/               # File upload & media management
│   │   │   ├── stats/                # Dashboard statistics
│   │   │   ├── contact/              # Contact form submissions
│   │   │   ├── forms/                # Form submission handling
│   │   │   ├── analytics/            # Page view tracking
│   │   │   └── deployments/          # Deployment management
│   │   ├── services/                 # Shared services (cache, email, deployment, SSG)
│   │   ├── builders/                 # Payload builders (JWT, session, Redis keys)
│   │   ├── constants/                # Enums, config constants
│   │   ├── types/                    # TypeScript type definitions
│   │   ├── utils/                    # Error classes, JWT utils, password hashing
│   │   ├── scripts/                  # One-off migration and setup scripts
│   │   └── __tests__/                # Test files
│   ├── prisma/
│   │   └── schema.prisma             # Database schema (source of truth)
│   ├── storage/                      # Local file storage fallback (dev only)
│   └── tsconfig.json                 # TypeScript config (strict, ESM, nodenext)
├── frontend/                         # React SPA (Vite + TypeScript + Tailwind)
├── deploy/                           # Nginx configs, VPS setup scripts
├── docker-compose.yml                # Backend + frontend containers
└── PROJECT_AUDIT_AND_IMPLEMENTATION_PLAN.md  # Full project audit & roadmap
```

---

## Architecture Patterns

### Module Pattern (CRITICAL — Follow This Exactly)

Every backend feature is organized as a **module** with a strict 4-layer architecture:

```
modules/<feature>/
├── <feature>.routes.ts       # Route definitions, middleware chain
├── <feature>.controller.ts   # Request handling, calls service, returns response
├── <feature>.service.ts      # Business logic, calls DAO, throws typed errors
├── <feature>.dao.ts          # Data access, Prisma queries only
└── <feature>.validation.ts   # Zod schemas for request validation
```

**Layer responsibilities:**

| Layer | Knows About | Returns | Throws |
|---|---|---|---|
| **Routes** | Express, middleware, validation schemas | N/A (wires middleware chain) | N/A |
| **Controller** | Request/Response, Service | JSON response via `res.json()` | Passes errors to `next()` |
| **Service** | DAO, business rules, other services | Domain objects | `AppError` subclasses |
| **DAO** | Prisma Client only | Raw Prisma results | Prisma errors (caught by service) |
| **Validation** | Zod only | Zod schemas + inferred types | N/A |

### Creating a New Module

1. Create `modules/<name>/` directory with all 5 files
2. Follow the website module as the canonical example
3. Register routes in `modules/api.routes.ts`
4. Add Prisma models to `prisma/schema.prisma` if needed

### Route Registration Pattern

```typescript
// In modules/api.routes.ts
import featureRoutes from './feature/feature.routes.js';
router.use('/feature', featureRoutes);
```

### Route Definition Pattern

```typescript
// In modules/feature/feature.routes.ts
import express from 'express';
import FeatureController from './feature.controller.js';
import { authenticate, authorize } from '../../middlewares/auth.middleware.js';
import { validateRequest } from '../../middlewares/validation.middleware.js';
import { createFeatureSchema, featureIdParamsSchema } from './feature.validation.js';

const router = express.Router();
const controller = new FeatureController();

// Apply auth to all routes in this module
router.use(authenticate);

router.post('/',
  validateRequest(createFeatureSchema),       // Validate body
  controller.createFeature
);

router.get('/:id',
  validateRequest(featureIdParamsSchema, 'params'),  // Validate params
  controller.getFeature
);

export default router;
```

### Controller Pattern

```typescript
class FeatureController {
  private featureService: FeatureService;

  constructor() {
    this.featureService = new FeatureService();
  }

  createFeature = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.context.user.id;
      const result = await this.featureService.create(userId, req.validated.body);
      res.status(201).json({ message: 'Created successfully', data: result });
    } catch (error: any) {
      next(error);  // Always pass to error middleware
    }
  }
}
```

### Service Pattern

```typescript
class FeatureService {
  private featureDao: FeatureDao;

  constructor() {
    this.featureDao = new FeatureDao();
  }

  async create(userId: string, data: CreateFeatureInput) {
    // Business logic here
    const existing = await this.featureDao.findByName(data.name);
    if (existing) throw new ConflictError('Feature already exists');

    return this.featureDao.create({ ...data, owner_id: userId });
  }
}
```

### DAO Pattern

```typescript
import prismaClient from '../../config/prisma.js';

class FeatureDao {
  async findByName(name: string) {
    return prismaClient.feature.findFirst({ where: { name } });
  }

  async create(data: any) {
    return prismaClient.feature.create({ data });
  }
}
```

---

## Error Handling

### Error Classes (use these, don't create new ones)

All defined in `src/utils/error.utils.ts`:

```typescript
BadRequestError(msg)          // 400 - Invalid input, malformed tokens
UnauthorizedError(msg)        // 401 - Wrong credentials, invalid auth
ForbiddenError(msg)           // 403 - Authenticated but not allowed
NotFoundError(msg)            // 404 - Resource doesn't exist
ConflictError(msg)            // 409 - Duplicate resource
UnprocessableEntityError(msg) // 422 - Valid request but violates business rules
TooManyRequestsError(msg)     // 429 - Rate limit exceeded
InternalServerError(msg)      // 500 - Server error
```

### Usage in Services

```typescript
import { NotFoundError, ConflictError } from '../../utils/error.utils.js';

// Throw typed errors — global error middleware handles the response
if (!user) throw new NotFoundError('User not found');
if (duplicate) throw new ConflictError('Email already in use');
```

### Error Middleware Flow

1. Controller catches error → passes to `next(error)`
2. `errorHandler` middleware in `middlewares/error.middleware.ts` catches it
3. If `AppError` → returns structured JSON with correct status code
4. If unknown error → returns 500 with generic message

---

## Authentication & Authorization

### How Auth Works

1. **Login** → Server creates JWT pair (access + refresh) → Sets as **httpOnly cookies**
2. **Every request** → `authenticate` middleware reads `accessToken` cookie → Verifies JWT → Checks Redis session → Attaches `req.context.user`
3. **Authorization** → `authorize(roles[])` middleware checks `req.context.user.role`

### Request Context (available after `authenticate` middleware)

```typescript
req.context.user.id              // User CUID
req.context.user.role            // UserRole enum value
req.context.user.institution_id  // Optional institution scope
req.context.sessionId            // Redis session ID
req.context.website              // Set by requireWebsiteOwnership middleware
```

### Role Hierarchy

```
SUPER_ADMIN → Has access to EVERYTHING (bypasses all role checks)
ADMIN → Platform admin
INSTITUTION_ADMIN → Manages their institution's users and websites
INSTRUCTOR → Can manage course-related websites
STUDENT → Can create personal websites
USER → Basic user, can create and manage own websites
```

### Resource Access Pattern

For routes that operate on a specific website, use:
```typescript
router.patch('/:id',
  validateRequest(websiteIdParamsSchema, 'params'),  // Validates :id exists
  requireWebsiteOwnership,                            // Loads website, checks ownership/role
  controller.updateWebsite                             // req.context.website is now available
);
```

---

## Validation

### Zod Schema Pattern

```typescript
import { z } from 'zod';

export const createFeatureSchema = z.object({
  name: z.string().min(2).max(100),
  description: z.string().optional(),
  status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
});

export type CreateFeatureInput = z.infer<typeof createFeatureSchema>;
```

### Validation Middleware Usage

```typescript
validateRequest(schema)            // Validates req.body (default)
validateRequest(schema, 'query')   // Validates req.query
validateRequest(schema, 'params')  // Validates req.params
```

After validation, data is available at:
```typescript
req.validated.body    // Parsed & validated body
req.validated.query   // Parsed & validated query params
req.validated.params  // Parsed & validated URL params
```

---

## Database (Prisma)

### Key Models

| Model | Purpose | Key Fields |
|---|---|---|
| `User` | User accounts | email, role, institution_id, isActive, isVerified |
| `Institution` | Tenant/organization | name, email, status |
| `Website` | User's websites | name, owner_id, institution_id, content (JSON), status |
| `Settings` | Website SEO/contact/social | seo, contact, social_links (all JSON) |
| `WebsiteVersion` | Version snapshots | website_id, kind (draft/published), snapshot (JSON) |
| `Deployment` | Deployment records | website_id, status (state machine), domain, url |
| `Domain` | Custom domains | website_id, domain, type, status, dns_records (JSON) |
| `Asset` | Uploaded files | name, type, url, objectKey, owner_id, scope |
| `WebsiteTemplate` | Website templates | name, category, scope, global_styles, navbar, footer |
| `SectionTemplate` | Section templates | name, category, scope, props (JSON) |
| `FormSubmission` | Form data from published sites | website_id, data (JSON), is_spam, is_read |
| `AuditLog` | Activity audit trail | user_id, action, entity_type, entity_id, metadata |
| `ContactSubmission` | Contact form entries | websiteId, name, email, message, status |
| `PageView` | Analytics page views | website_id, path, referrer, user_agent, country |

### Prisma Client Access

```typescript
import prismaClient from '../../config/prisma.js';
// Use in DAO layer only
```

### Important: Prisma uses Driver Adapter

The project uses `@prisma/adapter-pg` (driver adapter pattern), NOT the default Prisma connection. This is configured in `config/prisma.ts`. The connection string env var is `POSTGRESQL_URL` (not `DATABASE_URL`).

### Schema Change Workflow

1. Edit `prisma/schema.prisma`
2. Run `npx prisma migrate dev --name <migration_name>` (dev)
3. Run `npx prisma generate` to regenerate client
4. Run `npx prisma migrate deploy` (production)

---

## Redis (Upstash)

### Client Type

The project uses **Upstash Redis** (HTTP-based), NOT the standard `redis` npm package.

```typescript
import { getRedisClient } from '../../config/redis-client.js';
const redis = getRedisClient();

// Upstash Redis API (slightly different from standard redis)
await redis.set('key', value);
await redis.get('key');
await redis.del('key');
```

### Key Naming Convention

Use the builder: `src/builders/redis-key.builder.ts`
```typescript
// Pattern: session:{userId}:{sessionId}
generateAuthSessionKey(userId, sessionId)
```

For new features, add key builders to `redis-key.builder.ts` following the same pattern.

---

## S3 / Object Storage

### Configuration

```typescript
import { s3Client } from '../../config/s3-client.js';
```

### Buckets

- `S3_BUCKET` — Asset uploads (images, videos, files)
- `S3_SITES_BUCKET` — Published static sites

### Environment Variables

```
S3_BUCKET, S3_REGION, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY,
S3_ENDPOINT, S3_FORCE_PATH_STYLE, S3_PUBLIC_BASE_URL,
S3_SITES_BUCKET, PUBLISHED_SITES_BASE_URL
```

---

## Environment Variables

All env vars are documented in `backend/.env.example`. Key ones:

```
# Required
JWT_SECRET              # JWT signing secret
POSTGRESQL_URL          # PostgreSQL connection string

# Redis (Upstash)
REDIS_URL               # Upstash REST URL
REDIS_TOKEN             # Upstash REST token

# S3
S3_BUCKET, S3_REGION, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY

# Email
RESEND_API_KEY          # Resend transactional email

# App Config
PORT=5000
NODE_ENV=development
FRONTEND_ORIGINS        # Comma-separated allowed CORS origins
FRONTEND_URL            # Frontend URL for email links
API_BASE_URL            # Backend API base URL
PUBLIC_SITE_HOST        # Domain for published sites (e.g., buildora.app)
```

---

## TypeScript Conventions

### Module System

- **ESM only** (`"type": "module"` in package.json)
- **All imports must use `.js` extension**: `import x from './module.js'` (even for `.ts` files)
- This is required by Node.js ESM + TypeScript `nodenext` module resolution

### Strict Settings

```json
{
  "strict": true,
  "noUncheckedIndexedAccess": true,
  "exactOptionalPropertyTypes": true,
  "verbatimModuleSyntax": true,
  "isolatedModules": true
}
```

### Type Import Convention

```typescript
import type { Request, Response, NextFunction } from 'express';
import type { Website } from '@prisma/client';
```

### Express Type Augmentation

Custom request properties are defined in `src/types/express.d.ts`:
```typescript
req.id           // Request ID (string)
req.validated    // { body?, query?, params? } — validated data
req.context      // { user: AuthUser, sessionId: string, website?: Website }
```

---

## File Import Conventions

⚠️ **CRITICAL**: Always use `.js` extensions in imports, even when the source file is `.ts`:

```typescript
// ✅ Correct
import { authenticate } from '../../middlewares/auth.middleware.js';
import prismaClient from '../../config/prisma.js';

// ❌ Wrong — will fail at runtime
import { authenticate } from '../../middlewares/auth.middleware';
import { authenticate } from '../../middlewares/auth.middleware.ts';
```

---

## API Response Patterns

### Success Responses

```typescript
// Single item
res.status(200).json({ data: website });
res.status(200).json({ message: 'Updated successfully', website: updatedWebsite });

// List
res.status(200).json({ websites: [...] });

// Create
res.status(201).json({ message: 'Created successfully', website });

// Delete
res.status(200).json({ message: 'Deleted successfully' });

// No content
res.status(204).end();
```

### Error Responses

```json
// Validation error (400)
{ "error": "Invalid data", "errors": ["name: Name must be at least 2 characters"] }

// App error (4xx)
{ "error": "Website not found", "message": "Website not found" }

// Server error (500)
{ "error": "Internal server error", "message": "Internal server error" }
```

---

## Middleware Pipeline

The typical request flows through:

```
Request
 → helmet()                    # Security headers
 → compression()               # Gzip
 → requestId                   # Generates req.id
 → metricsMiddleware           # Request timing
 → pinoHttp                    # Structured logging
 → cors()                      # CORS checking
 → express.json()              # Body parsing
 → cookieParser()              # Cookie parsing
 → domainRouter                # Routes published site requests
 → authenticate                # JWT verification (per-route)
 → authorize([roles])          # Role checking (per-route)
 → validateRequest(schema)     # Zod validation (per-route)
 → requireWebsiteOwnership     # Resource access (per-route)
 → controller.method           # Business logic
 → errorHandler                # Global error catch
```

---

## Deployment Architecture

### Local Development

```bash
cd backend
cp .env.example .env          # Configure environment
npm install
npx prisma generate           # Generate Prisma client
npx prisma migrate dev         # Apply migrations
npm run dev                    # tsx watch src/main.ts
```

### Docker Compose (Production-like)

```bash
docker compose up --build -d
```

### Production

- VPS with Docker Compose
- Nginx reverse proxy (configs in `deploy/nginx/`)
- Certbot for SSL
- Setup script: `deploy/setup.sh`

---

## Multi-Tenancy Model

### Scoping Rules

| Role | Sees | Can Modify |
|---|---|---|
| USER/STUDENT/INSTRUCTOR | Own websites only | Own websites |
| INSTITUTION_ADMIN | All websites in their institution | Institution websites |
| ADMIN/SUPER_ADMIN | All websites platform-wide | Everything |

### Implementation

- `website.owner_id` → User who created it
- `website.institution_id` → Institution scope (nullable)
- `requireWebsiteOwnership` middleware enforces access based on role + ownership

---

## What's Implemented vs. Missing

### ✅ Implemented

- Full auth flow (register, login, logout, password reset, email verification, refresh tokens)
- Website CRUD with multi-tenant scoping
- Website publishing pipeline (static site generation → S3 upload)
- Template management (website + section templates)
- Asset upload to S3
- Deployment tracking with rollback
- Domain management (add, remove, verify)
- Basic analytics tracking (page views)
- Contact form submissions
- Dashboard statistics
- Rate limiting (Redis-based)
- Structured logging (Pino)
- Health check endpoint
- Docker deployment

### 🚧 Partially Implemented

- Email service (Resend SDK installed, basic integration)
- Google OAuth (started, incomplete)
- Audit logging (model exists, no service layer)
- Form submission handling (routes exist, needs completion)

### ❌ Not Yet Implemented

- CI/CD pipeline (GitHub Actions file exists but not tested)
- Automated test suite (placeholder only)
- CSRF protection
- Image optimization pipeline
- Webhook/integration support
- Blog post management
- Real-time collaboration
- E-commerce features
- Accessibility checker

---

## Common Gotchas

1. **Import extensions**: Always use `.js` in imports. TypeScript compiles `.ts` → `.js`, and Node ESM requires the extension.

2. **Prisma connection**: Uses `POSTGRESQL_URL`, not `DATABASE_URL`. Uses driver adapter (`@prisma/adapter-pg`), not default connection.

3. **Redis client**: Uses Upstash HTTP client (`@upstash/redis`), NOT the standard `redis` npm package. API is slightly different.

4. **Express 5**: This uses Express 5 (not 4). Async error handling works differently — errors in async handlers automatically propagate.

5. **Cookie auth**: Auth tokens are in httpOnly cookies, NOT Authorization headers. The middleware reads `req.cookies.accessToken`.

6. **`req.context` vs `req.user`**: This project uses `req.context.user` (not `req.user`).

7. **`req.validated` vs `req.body`**: After validation middleware, use `req.validated.body` instead of `req.body`.

8. **Zod v4**: The project uses Zod v4 which has some API differences from Zod v3 (e.g., `z.json()` is available).

9. **Top-level await**: `main.ts` uses top-level `await` (e.g., `await initRedis()`). This works because the project is ESM.

10. **Class-based controllers**: Controllers are classes (not plain functions). Methods use arrow functions to preserve `this` binding.

---

## Testing

### Current Setup

```bash
npm test  # Runs: node --import tsx --test src/**/*.test.ts
```

Test files follow the pattern: `src/modules/<module>/<module>.test.ts` or `src/__tests__/<name>.test.ts`.

### Writing Tests

Use Node.js built-in test runner (not Jest):
```typescript
import { describe, it, assert } from 'node:test';
import assert from 'node:assert';
```

---

## Quick Reference: Adding a New Feature

1. **Schema**: Add model to `prisma/schema.prisma`, run `npx prisma migrate dev`
2. **Validation**: Create `modules/<name>/<name>.validation.ts` with Zod schemas
3. **DAO**: Create `modules/<name>/<name>.dao.ts` with Prisma queries
4. **Service**: Create `modules/<name>/<name>.service.ts` with business logic
5. **Controller**: Create `modules/<name>/<name>.controller.ts` with request handlers
6. **Routes**: Create `modules/<name>/<name>.routes.ts` with route definitions
7. **Register**: Add to `modules/api.routes.ts`
8. **Test**: Add tests in the module or `__tests__/` directory
