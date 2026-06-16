# Website Builder Audit and Implementation Plan

Date: April 6, 2026

## 1. Executive Summary

This project is a solid alpha-stage website builder, not yet a production-ready WordPress, Wix, or Framer competitor.

What is already strong:

- The frontend editor experience is substantial.
- The backend has real authentication, tenant-aware website CRUD, templates, organizations, and dashboard stats scaffolding.
- The visual builder already supports multiple section types, multi-page websites, themes, and dashboard management flows.

What is still blocking production use:

- Publishing and domains are mocked in the frontend and not backed by a real deployment system.
- Assets are managed in client state instead of persistent storage.
- Website content is stored as one JSON blob, which will become hard to scale, version, validate, and collaborate on.
- The backend currently fails TypeScript build due to auth typing inconsistencies.
- Important product areas are still missing: public rendering pipeline, asset storage, form submissions, email delivery, analytics, audit logs, and proper deployment operations.

Current readiness assessment:

- Editor and dashboard UX: good alpha quality
- Core data/API reliability: partial
- Public publishing platform: not ready
- Operational readiness: not ready
- Production release readiness: low

## 2. Verified Current State

### Frontend

The frontend is the most mature part of the product.

Verified from code:

- App routing and a large product surface exist in [frontend/src/App.tsx](frontend/src/App.tsx).
- The builder state is extensive and includes pages, sections, assets, history, and save actions in [frontend/src/store/useBuilderStore.ts](frontend/src/store/useBuilderStore.ts).
- Template-driven website creation is implemented through page factories and template mapping in [frontend/src/store/useBuilderStore.ts](frontend/src/store/useBuilderStore.ts) and [frontend/src/lib/defaultPageData.ts](frontend/src/lib/defaultPageData.ts).
- Template management is wired to the backend in [frontend/src/pages/DashboardTemplates.tsx](frontend/src/pages/DashboardTemplates.tsx) and [frontend/src/api/templates.js](frontend/src/api/templates.js).
- Dashboard website management is real but partially incomplete in [frontend/src/pages/DashboardWebsites.tsx](frontend/src/pages/DashboardWebsites.tsx).
- The frontend production build succeeds, but the output includes a very large main JavaScript bundle of roughly 2.2 MB before gzip.

### Backend

The backend has good modular intent, but not all modules are equally complete.

Verified from code:

- Express entrypoint, middleware, CORS, cookie auth, and route registration exist in [backend/src/main.ts](backend/src/main.ts) and [backend/src/modules/api.routes.ts](backend/src/modules/api.routes.ts).
- Auth routes are implemented in [backend/src/modules/auth/auth.routes.ts](backend/src/modules/auth/auth.routes.ts).
- Website CRUD routes are implemented in [backend/src/modules/website/website.routes.ts](backend/src/modules/website/website.routes.ts).
- Template CRUD routes are implemented in [backend/src/modules/template/template.routes.ts](backend/src/modules/template/template.routes.ts).
- Dashboard stats are implemented in simplified form in [backend/src/modules/stats/stats.service.ts](backend/src/modules/stats/stats.service.ts).
- The Prisma schema includes users, institutions, websites, settings, tokens, website templates, and section templates in [backend/prisma/schema.prisma](backend/prisma/schema.prisma).
- The backend build currently fails in [backend/src/modules/auth/auth.service.ts](backend/src/modules/auth/auth.service.ts).

### Build and Script Health

- Frontend build: passes
- Backend build: fails
- Root scripts only proxy frontend commands from [package.json](package.json)
- Backend has no real test suite because [backend/package.json](backend/package.json) still uses a placeholder test script
- Backend start command appears incorrect because TypeScript compiles to `dist`, but the script points to `dist/main.ts` instead of the generated JavaScript entry in [backend/package.json](backend/package.json)

## 3. What Has Actually Been Implemented So Far

### 3.1 Authentication and Access Control

Implemented:

- Register
- Login
- Logout
- Forgot password
- Reset password
- Email verification route
- Refresh token route
- Cookie-based authentication middleware
- Role-based authorization middleware
- Redis-backed session validation

Evidence:

- [backend/src/modules/auth/auth.routes.ts](backend/src/modules/auth/auth.routes.ts)
- [backend/src/middlewares/auth.middleware.ts](backend/src/middlewares/auth.middleware.ts)
- [backend/src/services/cache.service.ts](backend/src/services/cache.service.ts)

Assessment:

- This is one of the better-implemented backend areas.
- It still has schema/type drift around OAuth provider support.

### 3.2 Multi-Tenancy and Organization Scoping

Implemented:

- Institutions exist in Prisma.
- Users can belong to institutions.
- Websites can belong to institutions.
- Website list endpoints scope results differently for user, institution admin, and super admin.

Evidence:

- [backend/prisma/schema.prisma](backend/prisma/schema.prisma)
- [backend/src/modules/website/website.service.ts](backend/src/modules/website/website.service.ts)
- [backend/src/modules/stats/stats.service.ts](backend/src/modules/stats/stats.service.ts)

Assessment:

- The tenancy model exists.
- It is still fairly lightweight and needs stronger auditing, permissions coverage, and admin boundaries.

### 3.3 Website CRUD and Editor Persistence

Implemented:

- Create website
- List websites
- Get one website
- Update website
- Soft delete website
- Restore website route
- Update website settings route
- Save website content from frontend into backend JSON content

Evidence:

- [backend/src/modules/website/website.routes.ts](backend/src/modules/website/website.routes.ts)
- [backend/src/modules/website/website.controller.ts](backend/src/modules/website/website.controller.ts)
- [backend/src/modules/website/website.dao.ts](backend/src/modules/website/website.dao.ts)
- [frontend/src/store/useBuilderStore.ts](frontend/src/store/useBuilderStore.ts)

Assessment:

- The project can persist websites.
- Persistence is coarse-grained because pages and sections are stored inside one `content` JSON object.
- This works for alpha, but it is the wrong long-term model for versioning, collaboration, high scale, and content analytics.

### 3.4 Templates

Implemented:

- Website template API
- Section template API
- Frontend template browsing
- Admin create/edit flows for templates
- Local template-driven website generation

Evidence:

- [backend/src/modules/template/template.routes.ts](backend/src/modules/template/template.routes.ts)
- [backend/src/modules/template/template.controller.ts](backend/src/modules/template/template.controller.ts)
- [backend/prisma/schema.prisma](backend/prisma/schema.prisma)
- [frontend/src/pages/DashboardTemplates.tsx](frontend/src/pages/DashboardTemplates.tsx)

Assessment:

- Templates are meaningfully implemented.
- The product still needs a stronger separation between marketing demo templates, backend-sourced templates, and reusable section/component presets.

### 3.5 Dashboard, Admin, and Stats

Implemented:

- Dashboard shell
- Website management UI
- Template management UI
- Deployment monitoring UI shell
- Assets management UI shell
- Stats API

Evidence:

- [frontend/src/pages/Dashboard.tsx](frontend/src/pages/Dashboard.tsx)
- [frontend/src/pages/DashboardWebsites.tsx](frontend/src/pages/DashboardWebsites.tsx)
- [frontend/src/pages/DashboardTemplates.tsx](frontend/src/pages/DashboardTemplates.tsx)
- [frontend/src/pages/DashboardAssets.tsx](frontend/src/pages/DashboardAssets.tsx)
- [backend/src/modules/stats/stats.routes.ts](backend/src/modules/stats/stats.routes.ts)
- [backend/src/modules/stats/stats.service.ts](backend/src/modules/stats/stats.service.ts)

Assessment:

- The dashboard looks broad, but not all panels are backed by real platform services.
- Deployment and asset management are especially UI-heavy compared to backend reality.

## 4. What Is Not Really Implemented Yet

This section is the most important part of the audit.

### 4.1 Real Publishing and Deployment

Not really implemented.

Evidence:

- The entire publish/domain service is explicitly mock-based in [frontend/src/services/publishService.ts](frontend/src/services/publishService.ts).
- Deployment monitoring uses `initialDummyDeployments`, generated logs, and simulated rollback state in [frontend/src/components/dashboard/DeploymentMonitoring.tsx](frontend/src/components/dashboard/DeploymentMonitoring.tsx).

What is missing:

- Public site renderer
- Deployment job orchestration
- Build pipeline for exported sites
- Static asset hosting
- CDN integration
- Domain verification
- SSL provisioning
- Deployment history backed by database
- Rollback backed by real versions

Conclusion:

- The product currently markets deployment features more than it actually delivers them.

### 4.2 Real Asset Storage

Not really implemented.

Evidence:

- Assets are stored in frontend Zustand state in [frontend/src/store/useBuilderStore.ts](frontend/src/store/useBuilderStore.ts).
- The asset manager imports files into browser object URLs or external URLs in [frontend/src/pages/DashboardAssets.tsx](frontend/src/pages/DashboardAssets.tsx).
- No backend asset module is registered in [backend/src/modules/api.routes.ts](backend/src/modules/api.routes.ts).

What is missing:

- Persistent upload API
- S3, Cloudinary, R2, or equivalent storage
- Image optimization pipeline
- File metadata persistence
- Access control for assets
- Asset usage tracking

Conclusion:

- Current media management is a frontend convenience, not a real media platform.

### 4.3 Website Versioning and Rollbacks

Only partially implemented in naming, not in data architecture.

Evidence:

- The architecture document promises drafts, published versions, and rollback, but the Prisma schema has only `currentDraftVersionId` and `currentPublishedVersionId` fields on `Website` without an actual version model in [frontend/architecture.md](frontend/architecture.md) and [backend/prisma/schema.prisma](backend/prisma/schema.prisma).
- No version entity or deployment entity exists in Prisma.

What is missing:

- `WebsiteVersion` table
- Draft snapshots
- Publish snapshots
- Diffing
- Rollback workflow
- Editor lock strategy

Conclusion:

- Versioning is currently a planned concept, not a finished subsystem.

### 4.4 Email Delivery

Not really implemented.

Evidence:

- Email sending currently just logs to the console in [backend/src/services/email.service.ts](backend/src/services/email.service.ts).

What is missing:

- SMTP or transactional email provider integration
- Delivery retries
- bounce/error logging
- email templates with tracking and localization

Conclusion:

- Password reset and verification flows exist logically, but not operationally.

### 4.5 Forms, Leads, and Contact Submission Handling

Not implemented.

Evidence:

- There is no meaningful backend form submission or lead capture path discovered in the backend module set.
- Contact in website settings exists as JSON only in [backend/src/modules/website/website.validation.ts](backend/src/modules/website/website.validation.ts).

What is missing:

- Form submission API
- spam prevention
- storage for submissions
- notifications
- dashboard inbox or export
- webhook forwarding

Conclusion:

- Sites can visually contain forms, but the platform does not yet behave like a site builder with lead collection.

### 4.6 Real Analytics

Only simplified counts are implemented.

Evidence:

- Stats only count users, organizations, and websites in [backend/src/modules/stats/stats.service.ts](backend/src/modules/stats/stats.service.ts).

What is missing:

- page views
- unique visitors
- referrers
- device breakdown
- conversion metrics
- per-site analytics
- uptime and incident monitoring

Conclusion:

- Current stats are admin counts, not website analytics.

### 4.7 Collaboration, Audit Logs, and Team Workflows

Not implemented.

What is missing:

- editor presence
- locking or conflict handling
- comments
- mentions
- activity stream
- publish approvals
- audit trail

Conclusion:

- This is still a single-editor product from a data model standpoint.

## 5. What Is Wrong in the Current Structure

### 5.1 The Content Model Is Too Coarse

Current approach:

- Website pages and sections are stored inside one `content` JSON field in [backend/prisma/schema.prisma](backend/prisma/schema.prisma) and written through [backend/src/modules/website/website.dao.ts](backend/src/modules/website/website.dao.ts).

Why this is a problem:

- Hard to version correctly
- Hard to query by page or section
- Hard to diff changes
- Hard to enforce schema at scale
- Hard to collaborate safely
- Hard to optimize partial saves

Recommendation:

- Keep JSON only for alpha or export snapshots.
- Move toward normalized persistence for websites, pages, sections, and versions.

### 5.2 Frontend and Backend API Surface Are Not Fully Aligned

Evidence:

- Backend exposes restore, duplicate, and settings update routes in [backend/src/modules/website/website.routes.ts](backend/src/modules/website/website.routes.ts).
- Frontend website API client now includes restore, duplicate, settings, versions, publish, and domain actions in [frontend/src/api/website.js](frontend/src/api/website.js).
- The website management screen still marks some actions as coming soon in [frontend/src/pages/DashboardWebsites.tsx](frontend/src/pages/DashboardWebsites.tsx).
- The publish and domain UI flows are wired, but the backend implementation is still metadata-oriented rather than backed by real deployment infrastructure in [backend/src/modules/website/website.service.ts](backend/src/modules/website/website.service.ts).

Why this is a problem:

- The UI suggests more operational capability than the backend platform actually provides.
- Product flows become inconsistent and harder to maintain.

Recommendation:

- Create domain-based API contracts and ensure the frontend only advertises fully wired actions.

### 5.3 Publish, Domain, and Deployment Logic Are Not Production-Backed

Evidence:

- Publishing updates website metadata and returns success responses from [backend/src/modules/website/website.service.ts](backend/src/modules/website/website.service.ts).
- Domain records and deployment records are stored inside `website.content.builderMeta` in [backend/src/modules/website/website-content.utils.ts](backend/src/modules/website/website-content.utils.ts).
- The frontend export flow still generates a mock HTML blob in [frontend/src/services/publishService.ts](frontend/src/services/publishService.ts).
- Deployment monitoring remains UI-driven rather than tied to an external build or hosting platform in [frontend/src/components/dashboard/DeploymentMonitoring.tsx](frontend/src/components/dashboard/DeploymentMonitoring.tsx).

Why this is a problem:

- There is still no real build artifact generation, DNS verification, SSL provisioning, CDN delivery, or rollback execution.
- Operational status in the UI can drift from reality because there is no external deployment system behind it.

Recommendation:

- Introduce first-class `Deployment` and `Domain` persistence plus a real publish pipeline backed by storage and hosting infrastructure.

### 5.4 Hardcoded Environment and Localhost Assumptions

Evidence:

- Frontend API URLs are hardcoded to `http://localhost:5000` in [frontend/src/api/auth.js](frontend/src/api/auth.js), [frontend/src/api/website.js](frontend/src/api/website.js), [frontend/src/api/templates.js](frontend/src/api/templates.js), and [frontend/src/api/stats.js](frontend/src/api/stats.js).
- Backend CORS only allows `http://localhost:8080` and `http://localhost:8081` in [backend/src/main.ts](backend/src/main.ts).

Why this is a problem:

- This complicates staging, preview environments, and production deployment.

Recommendation:

- Move API base URLs and allowed origins fully into environment configuration.

### 5.5 Build and Runtime Scripts Need Cleanup

Evidence:

- Root package scripts only proxy frontend commands in [package.json](package.json).
- Backend now has a real Node test command in [backend/package.json](backend/package.json).
- Backend start script now targets the compiled JavaScript entry in [backend/package.json](backend/package.json).
- There is an accidental-looking root file named `et --hard b3484f57730c3bbc33c9351dab9f6da5854a1033` shown in the workspace root.

Why this is a problem:

- It signals weak release hygiene.
- Local developer experience is inconsistent.

Recommendation:

- Standardize scripts, add workspace-level commands, and remove stray repository artifacts.

## 6. Planned Architecture vs Actual Implementation

The architecture document in [frontend/architecture.md](frontend/architecture.md) describes a stronger platform than the current codebase actually delivers.

### Areas where the plan matches reality

- Auth exists
- Roles exist
- Tenant-aware website ownership exists
- Template management exists
- Basic website CRUD exists
- Editor UX is substantial

### Areas where the plan is ahead of reality

- Versioning and rollback
- Dynamic rendering service
- publishing pipeline
- domain mapping
- post-publish analytics
- uptime tracking
- public viewer delivery model
- full admin deployment management

This is not a problem by itself. It becomes a problem only if product messaging, deadlines, or team assumptions start treating planned architecture as finished implementation.

## 7. API Coverage Audit

### Existing backend API areas

- Auth
- Users
- Organizations
- Websites
- Templates
- Stats
- Assets

Evidence:

- [backend/src/modules/api.routes.ts](backend/src/modules/api.routes.ts)

### Missing or incomplete API areas for a real website builder

- Public site render API
- Publish and deploy API
- Domains and DNS verification API
- Website version history API
- Page-level CRUD API
- Section-level CRUD API
- Form submission API
- Analytics events API
- Audit/activity API
- Collaboration/presence API
- Webhooks/integrations API
- Billing/subscription API if you plan SaaS monetization

### Recommendation

Stop treating the website as one giant save payload for everything. Define domain APIs around:

- websites
- pages
- sections
- assets
- versions
- deployments
- domains
- submissions
- analytics

## 8. Detailed Implementation Plan

This is the part you can use as a real roadmap.

### Phase 0: Stabilize the Current Codebase

Priority: immediate

Tasks:

1. Move API base URLs and CORS origins fully to environment variables.
2. Add staging and production env templates for backend and frontend.
3. Remove stray files and historical patch scripts that are no longer needed.
4. Add backend smoke tests for auth, website CRUD, publish metadata flow, and assets.
5. Add frontend smoke tests for auth and dashboard-critical flows.
6. Introduce structured logging and centralized error handling for production diagnostics.

Expected outcome:

- The backend becomes releasable for internal testing.

### Phase 1: Make Builder Data Reliable

Priority: highest product priority after stabilization

Tasks:

1. Decide whether to keep JSON content temporarily or begin normalization now.
2. If keeping JSON for the short term:
   - add JSON schema validation for pages and sections
   - add optimistic concurrency version numbers
   - add autosave debouncing and last-saved timestamps
   - add change history snapshots
3. If normalizing now, introduce these models:
   - `Website`
   - `WebsiteVersion`
   - `Page`
   - `Section`
   - `Domain`
   - `Deployment`
   - `Asset`
   - `FormSubmission`
4. Add explicit page CRUD endpoints.
5. Add section CRUD or batch update endpoints.

Recommended direction:

- If you want to ship a controlled alpha quickly, keep JSON short term and add `WebsiteVersion` plus structured validation.
- If you want serious scale and team collaboration, normalize sooner.

### Phase 2: Build the Real Publishing Pipeline

Priority: core product differentiator

Tasks:

1. Add a `Deployment` model.
2. Add a `Domain` model.
3. Create backend endpoints:
   - `POST /websites/:id/publish`
   - `GET /websites/:id/deployments`
   - `POST /websites/:id/rollback/:deploymentId`
   - `POST /websites/:id/domains`
   - `POST /domains/:id/verify`
4. Decide publish architecture:
   - static export to object storage + CDN
   - SSR/edge rendering
   - hybrid pre-rendered pages
5. Add queue jobs for build and deploy.
6. Persist deployment logs and statuses.
7. Replace the mock frontend publish service.

Recommended MVP publish architecture:

- Generate a static site artifact from the latest published website version.
- Store it in S3 or Cloudflare R2.
- Serve through CloudFront or Cloudflare.
- Map subdomains through a reverse proxy or CDN rules.
- Persist deployment logs, deployment status, source version, and active domain separately from `website.content`.

Why this is the right first step:

- It is much simpler than full SSR.
- It matches the current mostly-static section builder well.

### Phase 3: Asset System

Priority: very high

Tasks:

1. Replace the current local manifest/file storage with cloud object storage.
2. Add signed upload flow.
3. Persist asset metadata in database.
4. Add image optimization and thumbnail generation.
5. Track asset ownership by website or workspace.
6. Replace local-only dashboard asset behavior with persistent uploads and retrieval.

Suggested stack:

- Storage: S3, Cloudflare R2, or Cloudinary
- Metadata: Prisma table
- Delivery: CDN URL transformation

### Phase 4: Real Forms and Lead Collection

Priority: high for actual customer value

Tasks:

1. Add a `FormSubmission` table.
2. Add public form submission endpoints.
3. Add CAPTCHA or anti-spam throttling.
4. Add notifications and inbox/export UI.
5. Add webhook forwarding to CRM or email tools.

### Phase 5: Email and Notification Delivery

Priority: high

Tasks:

1. Replace console email service with a real provider.
2. Add email delivery status logging.
3. Add resend flows for verification.
4. Add notification preferences.

Suggested providers:

- Resend
- SendGrid
- Postmark

### Phase 6: Analytics and Monitoring

Priority: medium-high

Tasks:

1. Add page view event ingestion.
2. Add per-site dashboard analytics.
3. Add device, referrer, and top-page reports.
4. Add uptime checks for published sites.
5. Add deployment success/failure analytics.

### Phase 7: Collaboration and Enterprise Features

Priority: after MVP

Tasks:

1. Team invitations
2. Site-level roles
3. Activity logs
4. Comments
5. Presence indicators
6. Conflict resolution or soft locking
7. Approval workflow for publish

## 9. Suggested Data Model for the Next Stage

If you want a serious builder platform, this is the minimum clean model direction.

### Core entities

- `Website`
  - id
  - owner_id
  - institution_id
  - currentDraftVersionId
  - currentPublishedVersionId
  - status

- `WebsiteVersion`
  - id
  - website_id
  - kind: draft or published
  - created_by
  - snapshot_json
  - created_at

- `Page`
  - id
  - website_version_id
  - name
  - slug
  - seo_json
  - sort_order

- `Section`
  - id
  - page_id
  - type
  - props_json
  - styles_json
  - sort_order
  - is_global

- `Asset`
  - id
  - owner_id
  - website_id
  - storage_key
  - public_url
  - mime_type
  - width
  - height
  - size_bytes

- `Domain`
  - id
  - website_id
  - hostname
  - type
  - verification_status
  - ssl_status

- `Deployment`
  - id
  - website_version_id
  - status
  - log_url or log_text
  - deployed_at

- `FormSubmission`
  - id
  - website_id
  - page_id
  - form_name
  - payload_json
  - submitted_at

## 10. Suggested API Design for the Next Stage

### Website and editor APIs

- `GET /websites`
- `POST /websites`
- `GET /websites/:id`
- `PATCH /websites/:id`
- `POST /websites/:id/duplicate`
- `POST /websites/:id/restore`
- `GET /websites/:id/versions`
- `POST /websites/:id/versions`
- `POST /websites/:id/publish`

### Page APIs

- `POST /websites/:id/pages`
- `PATCH /pages/:pageId`
- `DELETE /pages/:pageId`
- `PATCH /pages/:pageId/reorder-sections`

### Asset APIs

- `POST /assets/upload-url`
- `POST /assets`
- `GET /assets`
- `DELETE /assets/:id`

### Domain APIs

- `POST /websites/:id/domains`
- `GET /websites/:id/domains`
- `POST /domains/:id/verify`
- `DELETE /domains/:id`

### Submission APIs

- `POST /public/sites/:domain/forms/:formKey/submissions`
- `GET /websites/:id/submissions`

## 11. What You Should Push Next

If the question is what should be prioritized for the next serious push, the answer is:

### Push 1: Production Baseline

- lock staging and production env configuration
- add smoke tests
- add structured logging and health checks
- clean repository artifacts and scripts

### Push 2: Real Persistence and Versioning

- choose data model path
- implement version snapshots
- add page and section API structure
- improve save reliability

### Push 3: Real Publish System

- deployment model
- publish endpoint
- static artifact generation
- subdomain serving
- deployment log persistence

### Push 4: Assets, Forms, Email

- real media library
- real contact form handling
- real transactional email

### Push 5: Analytics and Collaboration

- site analytics
- activity log
- team workflows

## 12. Risk Register

### High risk

- No real publish platform
- No production asset persistence
- Coarse JSON content model

### Medium risk

- Hardcoded environment URLs
- large frontend main bundle
- incomplete UI to API alignment
- missing operational logs

### Lower risk but important

- tsconfig deprecation warning at the workspace root/frontend setup
- leftover utility and fix scripts need cleanup and consolidation

## 13. Final Product Positioning Assessment

Compared with WordPress, Wix, or Framer, your product currently behaves most like this:

- A strong visual builder prototype
- A decent multi-tenant admin dashboard alpha
- An incomplete publishing platform

It is closest to being:

- an internal alpha for building static-style marketing sites

It is not yet close to being:

- a reliable public hosting and website operations platform

## 14. Recommended Immediate 30-Day Plan

## 14A. Prioritized 2-Week Execution Plan

If you want the fastest useful progress, this is the order.

### Days 1 to 3

- lock backend and frontend environment configuration
- create staging/prod env templates
- add health checks and structured logging
- clean root/package scripts for full-stack workflows

Target result:

- the project can be deployed repeatedly into staging without manual patching

### Days 4 to 6

- finish website duplicate logic
- wire restore and settings flows fully in frontend API clients
- add smoke tests for auth, website CRUD, assets, and publish metadata flow
- add basic operational logging around auth, websites, templates, and assets

Target result:

- current implemented features become stable instead of fragile

### Days 7 to 10

- add `WebsiteVersion` model or version snapshot strategy
- introduce publish-ready saved snapshots
- add deployment model design
- define public rendering path for published websites

Target result:

- product moves from editor-only to platform-ready architecture

### Days 11 to 14

- move assets to production storage
- replace frontend mock asset behavior with persistent uploads
- implement real email delivery
- define publish endpoint contract and deployment queue flow

Target result:

- most visible fake platform features start becoming real

### Week 1

- Fix backend compile
- align Prisma schema and migrations
- clean scripts and env handling
- add backend smoke tests

### Week 2

- implement `WebsiteVersion`
- add proper save and restore flows
- finish duplicate website logic
- align frontend website API client with backend routes

### Week 3

- implement asset upload backend
- connect dashboard assets to real storage
- implement real email sending
- add form submission pipeline

### Week 4

- implement publish endpoint
- implement deployment records
- serve generated public sites from staging infrastructure
- replace mock publish UI

## 15. Bottom Line

The project is not bad. It is actually ahead in UI and product ambition compared with many early builders. The main issue is that the platform layer underneath the UI is still incomplete.

If you want this to become a real website builder business, the next step is not adding more beautiful frontend screens. The next step is making the backend and infrastructure match the promise already visible in the UI.

That means your next serious work should focus on:

- backend correctness
- content/version architecture
- publishing infrastructure
- assets/forms/email
- operational and analytics features

Once those are in place, the editor you already built becomes much more valuable.

## 16. Production Platform Decision

Chosen direction:

- Cloudflare-first production architecture

Reason for the decision:

- This project is primarily a website publishing platform, so CDN delivery, custom domains, SSL, static artifact hosting, and edge routing matter more than general-purpose cloud breadth.
- Cloudflare is the best fit for low-friction multi-site publishing, custom hostname handling, and cost-effective asset and site artifact storage.
- It keeps the operational surface smaller than an AWS-first setup while providing a better platform backbone than a frontend-hosting-only approach.

## 17. Target Cloudflare Architecture

### Core platform services

- Backend API: existing Node/Express backend remains the control plane for auth, editor persistence, templates, domains, deployments, and assets
- Primary database: PostgreSQL for app data
- Cache/session store: Upstash Redis or Cloudflare-compatible Redis-equivalent session strategy
- Site artifact storage: Cloudflare R2
- Public delivery: Cloudflare CDN
- DNS and SSL: Cloudflare DNS with automatic certificate handling
- Edge routing: Cloudflare Workers or Cloudflare hostname/domain routing rules
- Email: Resend, Postmark, or SendGrid

### Recommended request flow

1. User edits site in the React app.
2. Frontend saves builder state to backend.
3. Backend creates or updates a publishable version snapshot.
4. On publish, backend generates a static artifact for the selected version.
5. Backend uploads the artifact and static assets to R2.
6. Cloudflare serves the published site through CDN caching and custom hostname routing.
7. Domain verification and SSL status are persisted in the backend and surfaced in the dashboard.

### Production data responsibilities

- PostgreSQL stores websites, versions, deployments, domains, assets metadata, submissions, and audit logs.
- R2 stores generated site artifacts, uploaded media, and derivative assets.
- Redis stores sessions, throttling state, and short-lived publish orchestration state.

### Production publishing model

Recommended first production model:

- Static site artifact generation from the latest published version
- Upload artifact to R2 under versioned keys
- Store deployment metadata and active artifact pointer in PostgreSQL
- Serve customer subdomains and custom domains through Cloudflare

This is the correct first production target because it matches the current builder, which is mostly static-content oriented and does not yet need full SSR complexity.

## 18. Immediate Cloudflare Implementation Sequence

### Step 1: Production baseline

- add backend and frontend production env templates
- move API origins and site host configuration fully to environment variables
- add health check and readiness endpoints
- add structured logs around auth, assets, publish, and domains

### Step 2: Assets on R2

- replace local file storage in [backend/src/modules/assets/assets.service.ts](backend/src/modules/assets/assets.service.ts)
- introduce R2 upload/delete service abstraction
- store asset metadata in PostgreSQL instead of manifest-only storage

### Step 3: Real deployments

- add `WebsiteVersion`, `Deployment`, and `Domain` persistence
- replace metadata-only publish logic in [backend/src/modules/website/website.service.ts](backend/src/modules/website/website.service.ts)
- replace mock export generation in [frontend/src/services/publishService.ts](frontend/src/services/publishService.ts)

### Step 4: Public site delivery

- generate static site bundles from published versions
- upload bundles to R2
- serve published sites through Cloudflare domain routing
- add rollback by switching the active deployment pointer

### Step 5: Complete production platform features

- real email delivery
- form submissions
- analytics and uptime monitoring
- audit logs and operational dashboards