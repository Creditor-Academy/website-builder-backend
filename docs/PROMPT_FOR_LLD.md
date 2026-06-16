# Prompt: Generate Low-Level Design (LLD) Document for Athena Website Builder

> Copy everything below the line and paste it into Claude to generate your LLD document.

---

## PROMPT START

You are a senior software engineer and system designer. I need you to produce a comprehensive **Low-Level Design (LLD)** document for my project called **"Athena Website Builder"** — a multi-tenant SaaS website builder platform.

Use the detailed project context below. Be precise — reference actual file paths, actual model fields, actual API routes, and actual code patterns that exist. Mark anything not yet implemented as "Planned".

---

### PROJECT CONTEXT

**Product Name:** Athena Website Builder  
**Architecture:** Monolithic Express.js backend + React SPA frontend  
**Language:** TypeScript (both frontend and backend)

#### Tech Stack Details

| Component | Technology | Version/Details |
|---|---|---|
| Runtime | Node.js | with tsx for dev, tsc for build |
| Backend Framework | Express.js | Port 5000 |
| Frontend Framework | React 18 | Vite dev server, Port 8080 |
| ORM | Prisma | PostgreSQL provider |
| Database | PostgreSQL 16 | Docker container |
| Cache | Redis 7 | Upstash (HTTP) in cloud, standard (TCP) locally |
| State Management | Zustand | Persistent store with localStorage |
| UI Components | Radix UI + shadcn/ui | Custom themed |
| CSS | Tailwind CSS | With PostCSS |
| Drag & Drop | dnd-kit | Canvas editor |
| Data Fetching | TanStack React Query | Cached queries |
| Animations | Framer Motion | Page transitions, UI animations |
| Forms | react-hook-form + zod | Validation |
| Charts | Recharts | Dashboard analytics |
| Object Storage | @aws-sdk/client-s3 | MinIO (local), S3/R2 (prod) |
| Auth | jsonwebtoken + bcrypt | JWT with cookies |
| Containerization | Docker Compose | PostgreSQL, Redis, MinIO services |

#### Backend Project Structure

```
backend/
├── src/
│   ├── main.ts                          # Express server entry point
│   ├── config/
│   │   ├── prisma.ts                    # Prisma client singleton
│   │   ├── redis-client.ts             # Redis client (auto-detects Upstash vs standard)
│   │   └── s3-client.ts                # S3 client configuration
│   ├── middlewares/
│   │   ├── auth.middleware.ts           # JWT verification + cookie extraction
│   │   ├── domain-router.middleware.ts  # Domain-based routing for published sites
│   │   ├── error.middleware.ts          # Global error handler
│   │   ├── metrics.middleware.ts        # Request metrics
│   │   ├── rate-limiting.middleware.ts  # Redis-based rate limiting
│   │   └── request-id.middleware.ts     # Request ID generation
│   ├── modules/
│   │   ├── api.routes.ts               # Central route registry
│   │   ├── auth/
│   │   │   ├── auth.routes.ts
│   │   │   ├── auth.controller.ts
│   │   │   ├── auth.service.ts
│   │   │   ├── auth.dao.ts
│   │   │   └── auth.validation.ts
│   │   ├── website/
│   │   │   ├── website.routes.ts
│   │   │   ├── website.controller.ts
│   │   │   ├── website.service.ts
│   │   │   ├── website.dao.ts
│   │   │   └── website.validation.ts
│   │   ├── template/
│   │   │   ├── template.routes.ts
│   │   │   ├── template.controller.ts
│   │   │   ├── template.service.ts
│   │   │   ├── template.dao.ts
│   │   │   └── template.validation.ts
│   │   ├── institution/
│   │   │   ├── institution.routes.ts
│   │   │   ├── institution.controller.ts
│   │   │   ├── institution.service.ts
│   │   │   └── institution.dao.ts
│   │   └── stats/
│   │       ├── stats.routes.ts
│   │       ├── stats.controller.ts
│   │       └── stats.service.ts
│   ├── services/
│   │   ├── cache.service.ts             # Redis cache operations
│   │   ├── email.service.ts             # Email sending (currently logs only)
│   │   ├── deployment.service.ts        # Static site generation + S3 upload
│   │   └── static-site-generator.ts     # HTML generation from website JSON
│   ├── builders/
│   │   ├── email-template.builder.ts    # Email HTML template builder
│   │   ├── payload.builder.ts           # API response payload builder
│   │   └── redis-key.builder.ts         # Redis key namespace builder
│   ├── constants/
│   │   ├── auth.constants.ts            # JWT expiry, cookie names
│   │   ├── user.constants.ts            # Role definitions
│   │   ├── website.constants.ts         # Status enums
│   │   └── assets.constants.ts          # Asset type definitions
│   ├── types/                           # TypeScript type definitions
│   └── utils/                           # Utility functions
├── prisma/
│   └── schema.prisma                    # Full database schema
└── storage/
    ├── assets/                          # Local asset storage fallback
    └── sites/                           # Local generated site storage fallback
```

#### Frontend Project Structure

```
frontend/src/
├── App.tsx                              # Route definitions (React Router)
├── main.tsx                             # App entry point
├── api/                                 # API client functions
│   ├── auth.js                          # Auth API calls
│   ├── website.js                       # Website CRUD API calls
│   └── templates.js                     # Template API calls
├── components/
│   ├── editor/
│   │   ├── WebsiteEditor.tsx            # Main editor container
│   │   ├── CanvasPreview.tsx            # Live preview canvas
│   │   ├── SectionLibrary.tsx           # Draggable section palette
│   │   ├── PropertiesPanel.tsx          # Section property editor
│   │   └── PageManager.tsx              # Page list and management
│   ├── dashboard/
│   │   ├── DeploymentMonitoring.tsx     # Deployment status and logs
│   │   └── ...                          # Other dashboard components
│   ├── sections/                        # 15+ section type renderers
│   └── ui/                              # shadcn/ui components
├── contexts/
│   └── BuilderContext.tsx               # Editor context provider
├── hooks/                               # Custom React hooks
├── lib/
│   └── defaultPageData.ts              # Template definitions for pages
├── pages/
│   ├── Dashboard.tsx                    # Dashboard overview
│   ├── DashboardWebsites.tsx            # Website management
│   ├── DashboardTemplates.tsx           # Template management
│   ├── DashboardAssets.tsx              # Asset library
│   └── ...                              # Marketing and other pages
├── services/
│   └── publishService.ts               # Publish workflow orchestration
├── store/
│   └── useBuilderStore.ts              # Zustand state (pages, sections, assets, history)
└── utils/                               # Utility functions
```

#### Complete Prisma Schema (All Models with Fields)

```prisma
model User {
  id, name, email (unique), password_hash?, auth_provider (default "email"),
  role (UserRole, default USER), institution_id?, isActive, isVerified,
  lastLoginAt?, lastPasswordChangeAt?, created_at, updated_at, deleted_at?
  Relations: emailVerificationTokens[], passwordResetTokens[], refreshTokens[],
             institution?, ownedWebsites[], assets[]
}

model Institution {
  id, name, email (unique), status (default "PENDING"), created_at, updated_at
  Relations: users[], websites[], templates[], sectionTemplates[], assets[]
}

model Website {
  id, name, owner_id, source_template_id?, status (DRAFT/PUBLISHED/DELETED),
  thumbnail_url?, currentDraftVersionId?, currentPublishedVersionId?,
  published_url?, created_at, updated_at, deleted_at?, institution_id?,
  content (Json?), settings_id? (unique)
  Relations: institution?, owner, sourceTemplate?, settings?, assets[],
             versions[], deployments[], domains[], formSubmissions[]
}

model Settings { id, seo (Json?), contact (Json?), social_links (Json?), timestamps }
model WebsiteVersion { id, website_id, kind, label, snapshot (Json), timestamps }
model Deployment { id, website_id, version_id?, status, url?, domain, artifact_prefix?,
                   deployed_by, error_message?, file_count, total_size, ssl_enabled,
                   logs (Json?), started_at, finished_at?, created_at }
model Domain { id, website_id, domain (unique), type, status, ssl_enabled,
               is_primary, dns_records (Json?), timestamps }
model Asset { id, name, type, url, size?, scope, objectKey?, owner_id,
              institution_id?, website_id?, timestamps }
model WebsiteTemplate { id, name, description, category, scope, institution_id?,
                        image?, global_styles, navbar, footer, home_layout, timestamps }
model SectionTemplate { id, name, category, scope, institution_id?, props (Json), timestamps }
model FormSubmission { id, website_id, page_slug?, form_name?, data (Json),
                       ip_address?, user_agent?, is_spam, is_read, created_at }
model AuditLog { id, user_id?, action, resource_type, resource_id?, metadata (Json?),
                 ip_address?, created_at }

Enums: UserRole (USER/ADMIN/STUDENT/INSTRUCTOR/INSTITUTION_ADMIN/SUPER_ADMIN),
       WebsiteStatus (DRAFT/PUBLISHED/DELETED), TemplateScope (GLOBAL/INSTITUTION),
       AssetScope (GLOBAL/WEBSITE), AssetType (image/video/file),
       DeploymentStatus (PENDING/BUILDING/UPLOADING/ACTIVE/FAILED/ROLLED_BACK),
       DomainType (SUBDOMAIN/CUSTOM), DomainStatus (PENDING/ACTIVE/ERROR/DELETED)
```

#### Implemented API Endpoints

**Auth Routes** (prefix: /api/auth)
- POST /register — Register new user
- POST /login — Login with email/password
- POST /logout — Logout (revoke session)
- POST /forgot-password — Request password reset email
- POST /reset-password — Reset password with token
- GET /verify-email/:token — Verify email
- POST /refresh-token — Refresh access token

**Website Routes** (prefix: /api/websites)
- POST / — Create website
- GET / — List websites (scoped by role)
- GET /:id — Get single website
- PUT /:id — Update website
- DELETE /:id — Soft-delete website
- POST /:id/restore — Restore deleted website
- PUT /:id/settings — Update website settings
- GET /:id/deployments — List deployments
- POST /:id/deployments/rollback — Rollback deployment

**Template Routes** (prefix: /api/templates)
- POST /website — Create website template (admin)
- GET /website — List website templates
- GET /website/:id — Get website template
- PUT /website/:id — Update website template
- DELETE /website/:id — Delete website template
- POST /section — Create section template (admin)
- GET /section — List section templates
- GET /section/:id — Get section template
- PUT /section/:id — Update section template
- DELETE /section/:id — Delete section template

**Institution Routes** (prefix: /api/institutions)
- GET / — List institutions (super admin)
- GET /:id — Get institution details
- POST / — Create institution
- PUT /:id — Update institution

**Stats Routes** (prefix: /api/stats)
- GET /platform — Platform-wide stats (super admin)
- GET /tenant — Tenant stats (institution admin)
- GET /user — User-level stats

#### Backend Code Patterns

- **Module pattern**: Each module has routes → controller → service → dao layers
- **Controller pattern**: Extract params, call service, return standardized payload via PayloadBuilder
- **Service pattern**: Business logic, calls DAO, throws typed errors
- **DAO pattern**: Direct Prisma queries, returns raw data
- **Validation**: Zod schemas in validation files, validated in routes/controller
- **Error handling**: Global error middleware catches typed errors, returns structured JSON
- **Auth middleware**: Extracts JWT from cookies, verifies, attaches user to req
- **Role middleware**: Checks req.user.role against allowed roles array

#### Frontend State Management (Zustand Store)

The main store (`useBuilderStore`) manages:
- `pages`: Array of page objects (each containing sections array)
- `activePageId`: Currently selected page
- `activeSection`: Currently selected section for editing
- `globalSections`: Navbar and footer shared across pages
- `designSystem`: Theme colors, typography, spacing
- `assets`: Media library (images, videos)
- `history`: Undo/redo stack
- `websiteId`: Current website being edited
- `templateId`: Template used to create the website
- Actions: addPage, removePage, addSection, removeSection, moveSection, updateSectionProps, saveActiveWebsite, loadWebsite, etc.

#### Section Types Available in Editor

hero, features, services, cta, testimonials, pricing, gallery, contact, faq, team, blog, stats, logoCloud, masonry, about

Each section type has:
- A React component for rendering
- Default props/content
- A properties schema for the PropertiesPanel editor
- Drag & drop support via dnd-kit

---

### DOCUMENT REQUIREMENTS

Produce the LLD with the following sections. Be extremely detailed — this is the implementation-level design document.

1. **Document Header** — Title, version, date, authors, status
2. **Table of Contents**
3. **Introduction**
   - Purpose (implementation-level design reference)
   - Scope
   - Relationship to HLD
4. **Module-Level Detailed Design**
   For EACH module below, provide:
   - Class/file structure diagram
   - Detailed function signatures (input params, return types)
   - Internal logic flow (step-by-step pseudocode for key functions)
   - Error handling strategy
   - Validation rules (Zod schemas)
   - Database queries (Prisma operations used)
   - Current implementation status

   **Modules to cover:**
   a. **Auth Module**
      - Registration flow (hash password, create user, generate verification token, send email)
      - Login flow (verify credentials, generate JWT pair, store session in Redis, set cookies)
      - Token refresh flow
      - Password reset flow
      - Middleware chain (cookie extraction → JWT verify → user lookup → role check)

   b. **Website Module**
      - Create website (with/without template, default content generation)
      - List websites (multi-tenant scoping logic for each role)
      - Update website (content JSON merge strategy)
      - Soft delete / restore
      - Settings CRUD

   c. **Template Module**
      - Website template CRUD with admin authorization
      - Section template CRUD
      - Template application to new website (content generation from template)

   d. **Deployment Module**
      - Static site generation pipeline (JSON → HTML conversion)
      - S3 upload flow (versioned + latest alias)
      - Deployment status state machine (PENDING → BUILDING → UPLOADING → ACTIVE / FAILED)
      - Rollback logic
      - Local filesystem fallback

   e. **Asset Module**
      - Upload flow (multipart → S3, metadata to DB)
      - Scoping (global vs website-specific)
      - Manifest management

   f. **Institution Module**
      - CRUD operations
      - User/website aggregation queries

   g. **Stats Module**
      - Platform, tenant, and user stat queries
      - Data aggregation approach

   h. **Domain Module** (Planned)
      - Domain verification flow
      - DNS record management
      - SSL provisioning

   i. **Form Submission Module** (Planned)
      - Public submission endpoint
      - Spam detection
      - Dashboard inbox

   j. **Email Service**
      - Template generation
      - Current mock behavior
      - Planned SMTP integration

5. **Frontend Detailed Design**
   a. **Application Architecture**
      - Route structure (React Router configuration)
      - Layout hierarchy
      - Auth guard implementation
      - API client layer design

   b. **State Management Design**
      - Zustand store structure (detailed slice breakdown)
      - State persistence strategy (localStorage)
      - State sync with backend (save flow)
      - Undo/redo implementation

   c. **Visual Editor Design**
      - Component hierarchy (WebsiteEditor → Canvas, SectionLibrary, PropertiesPanel, PageManager)
      - Drag & drop implementation (dnd-kit sensors, collision detection, drop handling)
      - Section rendering pipeline (type → component mapping → props injection)
      - Canvas preview rendering (zoom, grid, responsive mode)
      - Properties panel (dynamic form generation from section schema)

   d. **Section System Design**
      - Section type registry
      - Default props structure for each of the 15+ types
      - Props editing schema
      - Section lifecycle (add → configure → reorder → remove)

   e. **Dashboard Design**
      - Page component structure
      - Data fetching patterns (React Query keys, cache invalidation)
      - CRUD workflow for websites
      - Deployment monitoring UI flow

6. **Database Detailed Design**
   - Complete ER diagram with all fields, types, constraints, and indexes
   - Query patterns for each module (list the actual Prisma queries)
   - JSON field schemas (content, seo, social_links, contact, snapshot, data, logs, dns_records, metadata)
   - Migration strategy
   - Index justification

7. **API Detailed Design**
   - Full endpoint specification for every route:
     - HTTP method + path
     - Request headers (auth requirements)
     - Request body schema (Zod)
     - Response body schema
     - Error responses
     - Example request/response
   - Middleware pipeline per route

8. **Security Detailed Design**
   - JWT token structure (payload fields, expiry)
   - Cookie configuration (httpOnly, secure, sameSite, path)
   - Password hashing (bcrypt rounds)
   - Rate limiting configuration
   - Input validation (Zod schemas)
   - SQL injection prevention (Prisma parameterized queries)
   - XSS prevention
   - CSRF considerations

9. **Caching Design**
   - Redis key structure (namespace patterns from redis-key.builder.ts)
   - Session storage format
   - Cache TTLs
   - Cache invalidation triggers

10. **Error Handling Design**
    - Error class hierarchy
    - HTTP status code mapping
    - Error response format
    - Frontend error handling (toast notifications, error boundaries)

11. **Build & Development Setup**
    - Development workflow (Docker Compose up → backend dev → frontend dev)
    - Build commands and outputs
    - Environment variable reference (.env fields)
    - TypeScript configuration

12. **Testing Strategy** (Current + Planned)
    - Existing test files and coverage
    - Planned test approach per module
    - Integration testing strategy

13. **Appendices**
    - Full Prisma schema
    - Environment variable reference
    - API endpoint summary table
    - Section type reference with default props

Format the output as a clean Markdown document ready to be saved as `LLD_DOCUMENT.md`.

## PROMPT END
