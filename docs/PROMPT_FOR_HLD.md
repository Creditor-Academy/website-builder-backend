# Prompt: Generate High-Level Design (HLD) Document for Athena Website Builder

> Copy everything below the line and paste it into Claude to generate your HLD document.

---

## PROMPT START

You are a senior solutions architect. I need you to produce a comprehensive **High-Level Design (HLD)** document for my project called **"Athena Website Builder"** — a multi-tenant, SaaS website builder platform (similar in concept to Wix/WordPress/Framer but for institutional and individual use).

Use the project context below to produce the HLD. Do NOT invent features that are not listed. Mark features as "Implemented", "Partially Implemented", or "Planned" based on the status information provided.

---

### PROJECT CONTEXT

**Product Name:** Athena Website Builder  
**Type:** Multi-tenant SaaS Website Builder  
**Target Users:** Individuals, students, instructors, institutions (universities, organizations)  
**Stage:** Alpha — core editor and dashboard functional, publishing pipeline recently added, several subsystems still incomplete.

#### Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, TypeScript, Vite, Tailwind CSS, Zustand (state), TanStack React Query, Radix UI / shadcn/ui, dnd-kit (drag & drop), Framer Motion |
| Backend | Node.js, Express.js, TypeScript |
| Database | PostgreSQL via Prisma ORM |
| Cache / Sessions | Redis (Upstash HTTP in cloud, standard TCP locally) |
| Object Storage | S3-compatible (MinIO locally, AWS S3 or Cloudflare R2 in production) |
| Containerization | Docker Compose (PostgreSQL 16, Redis 7, MinIO with auto-bucket init) |
| Auth | JWT (access + refresh tokens), cookie-based, bcrypt password hashing |
| Planned CDN/Hosting | Cloudflare (R2 for artifacts, DNS/CDN/SSL for published sites) |

#### Database Models (PostgreSQL / Prisma)

1. **User** — id, name, email, password_hash, auth_provider, role (USER/ADMIN/STUDENT/INSTRUCTOR/INSTITUTION_ADMIN/SUPER_ADMIN), institution_id, isActive, isVerified, timestamps, soft-delete
2. **Institution** — id, name, email, status, timestamps; has many Users, Websites, Templates
3. **Website** — id, name, owner_id, source_template_id, status (DRAFT/PUBLISHED/DELETED), content (JSON blob), settings_id, thumbnail_url, currentDraftVersionId, currentPublishedVersionId, published_url, institution_id, timestamps, soft-delete
4. **Settings** — id, seo (JSON), contact (JSON), social_links (JSON); one-to-one with Website
5. **WebsiteVersion** — id, website_id, kind (draft/published), label, snapshot (JSON), timestamps
6. **Deployment** — id, website_id, version_id, status (PENDING/BUILDING/UPLOADING/ACTIVE/FAILED/ROLLED_BACK), url, domain, artifact_prefix, deployed_by, error_message, file_count, total_size, ssl_enabled, logs (JSON), timestamps
7. **Domain** — id, website_id, domain (unique), type (SUBDOMAIN/CUSTOM), status (PENDING/ACTIVE/ERROR/DELETED), ssl_enabled, is_primary, dns_records (JSON), timestamps
8. **Asset** — id, name, type (image/video/file), url, size, scope (GLOBAL/WEBSITE), objectKey, owner_id, institution_id, website_id, timestamps
9. **WebsiteTemplate** — id, name, description, category, scope (GLOBAL/INSTITUTION), institution_id, image, global_styles, navbar, footer, home_layout, timestamps
10. **SectionTemplate** — id, name, category, scope, institution_id, props (JSON), timestamps
11. **FormSubmission** — id, website_id, page_slug, form_name, data (JSON), ip_address, user_agent, is_spam, is_read, timestamps
12. **AuditLog** — id, user_id, action, resource_type, resource_id, metadata (JSON), ip_address, timestamps
13. **PasswordResetToken**, **EmailVerificationToken**, **RefreshToken** — standard auth token tables

#### Implemented Backend Modules

1. **Auth Module** — Register, login, logout, forgot/reset password, email verification, refresh token, cookie-based JWT middleware, role-based authorization middleware, Redis-backed session validation
2. **Website Module** — Full CRUD (create, list, get, update, soft-delete, restore), multi-tenant scoping (owner/institution/super-admin views), website settings management
3. **Template Module** — Website template CRUD and section template CRUD (admin-only)
4. **Institution Module** — Org management (SUPER_ADMIN/INSTITUTION_ADMIN), user/website counts per institution
5. **Stats Module** — Platform stats (super admin), tenant stats (institution admin), user-level stats
6. **Deployment Service** — Static site generation → S3 upload → deployment record; routes: GET /websites/:id/deployments, POST /websites/:id/deployments/rollback
7. **Asset Upload** — S3-compatible upload via @aws-sdk/client-s3; manifest metadata in local storage

#### Implemented Frontend Features

1. **Visual Editor** — Drag & drop canvas, resizable panels, 15+ section types (hero, features, services, CTA, testimonials, pricing, gallery, contact, FAQ, team, blog, stats, logo cloud, masonry, about), page manager, navbar/footer global sections, design system panel, properties panel, preview mode, zoom controls, grid toggle, guided tour, section visibility toggle, responsive preview
2. **Dashboard** — Overview stats, website management (CRUD), template management, deployment monitoring (now real data), asset library, settings interface, user management (admin)
3. **Marketing Site** — Home, Features, Services, Pricing, Testimonials, Terms, Privacy, Blog, Help, Contact, Status, Careers, About pages

#### Known Gaps / Not Yet Implemented

- No real CDN/hosting infrastructure yet (Cloudflare integration planned)
- No custom domain verification/DNS management endpoints
- No SSL provisioning automation
- Email service logs instead of sending (no SMTP/transactional provider)
- No form submission handling endpoints
- No real analytics/tracking (counts only)
- No real-time collaboration
- No blog post management system
- No e-commerce features
- No accessibility checker
- Frontend bundle is ~2.2 MB (needs code splitting)
- Website content stored as one coarse JSON blob (scaling concern)

---

### DOCUMENT REQUIREMENTS

Produce the HLD with the following sections. Use diagrams described in text/ASCII where appropriate. Be thorough but grounded in reality — only describe what exists or is concretely planned.

1. **Document Header** — Title, version, date, authors, reviewers, approval status
2. **Table of Contents**
3. **Introduction**
   - Purpose of the document
   - Scope (what this HLD covers)
   - Intended audience
   - References to related documents
4. **System Overview**
   - Product description (what Athena is and who it serves)
   - Key business goals
   - System context diagram (show users, the platform, external systems)
5. **Architecture Overview**
   - Architecture style (monolithic backend + SPA frontend, planned evolution)
   - High-level component diagram (Frontend, Backend API, Database, Cache, Object Storage, CDN)
   - Technology stack summary table
   - Deployment topology (Docker Compose for dev, cloud for production)
6. **Component Design**
   - For each major component/module, provide:
     - Purpose and responsibilities
     - Key interfaces (API endpoints or internal contracts)
     - Dependencies on other components
     - Current implementation status
   - Components to cover:
     a. Authentication & Authorization Service
     b. Website Management Service
     c. Visual Editor (Frontend)
     d. Template Management Service
     e. Presentation & Content Service
     f. Versioning Service
     g. Deployment & Publishing Service
     h. Asset Management Service
     i. Domain Management Service
     j. Institution & Multi-Tenancy Service
     k. Stats & Analytics Service
     l. Form Submission Service
     m. Audit Logging Service
     n. Email Service
7. **Data Architecture**
   - ER diagram (text-based) showing all 13+ models and their relationships
   - Data flow diagram (how data moves from editor → save → publish → CDN)
   - Caching strategy (Redis usage for sessions, rate limiting)
   - Storage strategy (PostgreSQL for structured data, S3 for assets/artifacts, JSON fields for flexible content)
8. **Integration Architecture**
   - External system integrations (S3/R2, Redis/Upstash, Cloudflare planned)
   - API design principles (RESTful, JSON, JWT auth)
   - API route summary table with all implemented endpoints
9. **Security Architecture**
   - Authentication flow (JWT access + refresh tokens, cookie-based)
   - Authorization model (RBAC with 6 roles)
   - Data isolation (multi-tenant by institution_id and owner_id)
   - Known security gaps and planned mitigations
10. **Scalability & Performance**
    - Current bottlenecks (JSON blob content, large frontend bundle)
    - Planned improvements (code splitting, content model normalization)
    - Caching approach
    - CDN strategy (Cloudflare)
11. **Deployment Architecture**
    - Development environment (Docker Compose)
    - Production environment (planned cloud architecture)
    - CI/CD considerations
    - Environment configuration (.env, .env.docker)
12. **Non-Functional Requirements**
    - Availability targets
    - Performance targets (page load, API response times)
    - Security compliance
    - Monitoring & observability (planned)
13. **Risks & Mitigations**
    - Technical risks with current architecture
    - Data model risks
    - Scaling risks
    - Dependency risks
14. **Appendices**
    - Glossary of terms
    - Full API endpoint list
    - Technology version matrix

Format the output as a clean Markdown document ready to be saved as `HLD_DOCUMENT.md`.

## PROMPT END
