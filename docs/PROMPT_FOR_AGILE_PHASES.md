# Prompt: Generate Agile Phase-Wise Documentation (Excel-Ready) for Athena Website Builder

> Copy everything below the line and paste it into Claude to generate your Agile phase plan. The output will be in table format — copy-paste directly into Excel/Google Sheets.

---

## PROMPT START

You are a senior project manager and Agile coach. I need you to produce a **complete Agile phase-wise project plan** for my project called **"Athena Website Builder"** — a multi-tenant SaaS website builder platform.

Generate the output as **Excel-ready tables** (Markdown tables that I can copy-paste into Excel or Google Sheets). Each table should be clearly labeled so I can put them in separate Excel sheets/tabs.

Use the project context below. Be realistic — base effort estimates on the actual current state of the codebase (what's done, what's partial, what's missing).

---

### PROJECT CONTEXT

**Product:** Athena Website Builder — Multi-tenant SaaS website builder  
**Team Size Assumption:** 2-3 full-stack developers, 1 designer (part-time)  
**Sprint Duration:** 2 weeks  
**Current State:** Alpha — core editor and dashboard functional, publishing pipeline recently added, several subsystems incomplete

#### What Is Already Implemented (DO NOT plan these as new work)
1. **Auth Module** — Register, login, logout, forgot/reset password, email verification, refresh token, JWT middleware, role-based authorization, Redis sessions
2. **Website CRUD** — Create, list, get, update, soft-delete, restore, settings management, multi-tenant scoping
3. **Template Module** — Website template CRUD, section template CRUD (admin-only)
4. **Visual Editor** — Drag & drop canvas, 15+ section types (hero, features, services, CTA, testimonials, pricing, gallery, contact, FAQ, team, blog, stats, logo cloud, masonry, about), page manager, navbar/footer, design system panel, properties panel, preview mode, zoom, grid, guided tour, responsive preview
5. **Dashboard** — Overview stats, website management, template management, deployment monitoring (real data), asset library (UI shell), settings, user management (admin)
6. **Institution Module** — Org management, user/website counts
7. **Stats Module** — Platform/tenant/user stats
8. **Deployment Service** — Static site generation → S3 upload → deployment record, rollback endpoint
9. **Asset Upload** — S3-compatible upload, manifest metadata
10. **Marketing Site** — Home, Features, Services, Pricing, Testimonials, Terms, Privacy, Blog, Help, Contact, Status, Careers, About pages
11. **Database Models** — User, Institution, Website, Settings, WebsiteVersion, Deployment, Domain, Asset, WebsiteTemplate, SectionTemplate, FormSubmission, AuditLog, auth tokens
12. **Docker Setup** — PostgreSQL 16, Redis 7, MinIO with auto-bucket-creation

#### What Needs to Be Built / Fixed / Completed
- Fix all TypeScript build errors (backend ~50, frontend ~30)
- Email service is mocked (logs instead of sending)
- No custom domain verification/DNS management
- No SSL provisioning automation
- No form submission handling endpoints
- No real analytics/tracking
- No real-time collaboration
- No blog post management system
- No e-commerce features
- No accessibility checker
- Frontend bundle ~2.2 MB (needs code splitting)
- Website content stored as coarse JSON blob (scaling concern)
- No CSRF protection
- No audit logging implementation (model exists, no service)
- Google OAuth started but incomplete
- No CI/CD pipeline
- No automated testing (placeholder test script)
- No monitoring/observability
- No rate limiting tuning
- No sitemap/robots.txt generation for published sites
- No image optimization pipeline
- No webhook/integration support
- Published site SEO meta tags not generated
- No user invitation system
- No activity/changelog
- API docs not generated (no Swagger/OpenAPI)
- No error tracking (Sentry etc.)
- No backup strategy
- Frontend API base URLs hardcoded to localhost

#### Tech Stack
- **Backend:** Node.js, Express.js, TypeScript, Prisma, PostgreSQL, Redis
- **Frontend:** React 18, TypeScript, Vite, Tailwind CSS, Zustand, TanStack React Query, Radix UI/shadcn
- **Storage:** S3-compatible (MinIO local, S3/R2 production)
- **Planned CDN:** Cloudflare (R2 + DNS + CDN + SSL)
- **Containerization:** Docker Compose

---

### OUTPUT REQUIREMENTS

Generate **ONE single comprehensive table** that I can copy-paste into a single Excel sheet. Use `|` pipe-delimited Markdown table format.

**The single table must have these columns:**

| Phase | Phase Name | Sprint # | Story ID | Epic ID | Epic Name | User Story / Task Title | Description | Priority (P0/P1/P2/P3) | Story Points | Assignee Role | Dependencies (Story IDs) | Acceptance Criteria | Status | Category (Frontend/Backend/DevOps/Design/QA) | Risk Level (High/Medium/Low) | Risk Description | Mitigation | Release Version | Release Type (Internal/Alpha/Beta/GA) | DoD Checklist Items | Critical Path (Yes/No) |

Every row is one user story/task. Phase-level info (phase name, risk level, release version, release type) repeats on each row belonging to that phase. This way the entire project plan lives in ONE sheet and can be filtered/grouped by any column in Excel.

Include these phases:
- **Phase 1:** Stabilization & Bug Fixes
- **Phase 2:** Core Infrastructure Completion
- **Phase 3:** Publishing & Domain Management
- **Phase 4:** Content & Media Platform
- **Phase 5:** Analytics, SEO & Forms
- **Phase 6:** Collaboration & Advanced Features
- **Phase 7:** Scale, Performance & Production Hardening
- **Phase 8:** Launch Preparation & Go-Live

**Phase 1 — Stabilization & Bug Fixes** should include:
- Fix all backend TypeScript errors (~50 errors)
- Fix all frontend TypeScript errors (~30 errors)
- Fix backend start script (dist/main.ts → dist/main.js)
- Remove hardcoded localhost URLs (make configurable via env)
- Fix auth_provider schema drift
- Add environment variable validation on startup
- Set up proper .env.example files
- Fix any broken API endpoint responses
- Verify all existing CRUD flows work end-to-end (auth, websites, templates, institutions)
- Add basic health check endpoint
- Set up ESLint + Prettier for both projects
- Configure proper CORS for production

**Phase 2 — Core Infrastructure Completion** should include:
- Integrate real email provider (Resend/SendGrid/SES)
- Implement Google OAuth login (complete the started work)
- Implement audit logging service (model exists, needs service + middleware)
- Set up CI/CD pipeline (GitHub Actions)
- Add automated test suite (unit + integration)
- Set up error tracking (Sentry)
- Configure rate limiting properly
- Add CSRF protection
- Add request logging and monitoring
- Set up database backup strategy
- Generate API documentation (Swagger/OpenAPI)
- Add input sanitization for XSS prevention

**Phase 3 — Publishing & Domain Management** should include:
- Cloudflare R2 integration for static site hosting
- Cloudflare CDN configuration for published sites
- Subdomain assignment system (yoursite.athena.app)
- Custom domain verification flow
- DNS record management
- Automated SSL provisioning via Cloudflare
- Published site SEO meta tags generation
- Sitemap.xml generation for published sites
- Robots.txt generation
- Published site performance optimization
- Deployment preview URLs
- Domain status dashboard in admin panel

**Phase 4 — Content & Media Platform** should include:
- Image optimization pipeline (resize, compress, WebP conversion)
- Asset CDN delivery
- Complete asset management dashboard (currently UI shell only)
- Asset usage tracking (which websites use which assets)
- Website content model refactoring (break JSON blob into normalized pages/sections — or add validation)
- Implement website versioning fully (draft snapshots, publish snapshots, version history UI)
- One-click rollback from version history
- Blog post management system
- Rich text / Markdown editor for blog posts
- Blog listing page template
- Media library with folders/tags

**Phase 5 — Analytics, SEO & Forms** should include:
- Form submission handling (public endpoint for published site forms)
- Form submission storage and spam detection
- Form submission dashboard inbox (list, read, mark spam, export)
- Webhook forwarding for form submissions
- Basic analytics tracking for published sites (page views, unique visitors)
- Analytics dashboard with charts
- Traffic source tracking
- SEO analysis tool (title length, meta description, heading structure)
- Open Graph / social preview tags
- Google Analytics integration option
- Email notification for form submissions

**Phase 6 — Collaboration & Advanced Features** should include:
- User invitation system (invite by email to institution)
- Activity log / changelog per website
- Website duplication (complete implementation)
- Custom code injection (HTML/CSS/JS blocks per page)
- Accessibility checker (WCAG basic compliance)
- Additional section types (newsletter signup, countdown, video hero, etc.)
- Responsive design fine-tuning per breakpoint
- Global search across dashboard
- Keyboard shortcuts for editor
- Template marketplace (institutions share templates)

**Phase 7 — Scale, Performance & Production Hardening** should include:
- Frontend code splitting (reduce 2.2 MB bundle)
- Lazy loading for dashboard pages
- Image lazy loading in editor
- Database query optimization (add missing indexes, optimize JSON queries)
- Redis caching strategy for templates and published sites
- Load testing
- Security audit
- Penetration testing
- Database connection pooling optimization
- CDN cache invalidation strategy
- Horizontal scaling preparation
- Rate limiting per-tenant

**Phase 8 — Launch Preparation & Go-Live** should include:
- Production environment setup (cloud infrastructure)
- Production database migration
- DNS configuration for platform domain
- SSL for platform
- Monitoring dashboards (Grafana/Datadog)
- Alerting rules
- Runbook / incident response documentation
- User documentation / help center
- Onboarding tutorial updates
- Beta user testing
- Performance benchmarking
- Go-live checklist execution
- Post-launch monitoring plan

---

### FORMATTING RULES

1. Output must be **ONE single Markdown pipe table** — no separate sheets, no separate tables. Everything in one table.
2. Use consistent IDs: Stories as `S-001`, `S-002`..., Epics as `E-001`, `E-002`...
3. Story points: use Fibonacci (1, 2, 3, 5, 8, 13).
4. Priority: P0 = critical blocker, P1 = must-have this phase, P2 = should-have, P3 = nice-to-have.
5. Include at least **80-100 rows** (one per user story/task) across all 8 phases.
6. Be realistic with estimates — this is a 2-3 person team.
7. Each sprint should have 20-30 story points max (for 2-3 devs).
8. Phase-level data (phase name, risk level, release version, release type) should repeat on every row in that phase so Excel filtering/grouping works.
9. The "DoD Checklist Items" column should list the applicable checklist items for that specific story (e.g., "Code reviewed, TS compiles, tests pass, deployed to staging").
10. The "Risk Description" and "Mitigation" columns can be empty for low-risk stories — only fill them for stories that carry meaningful risk.

---

### ADDITIONAL INSTRUCTIONS

- After the single table, add a **Summary Section** with:
  - Total estimated effort (sprints, weeks, months)
  - Total story points
  - Critical path summary
  - Top 5 risks
  - Recommended team composition per phase
  - Epic summary (Epic ID, name, phase, total stories, total points)
- Make sure Phase 1 is achievable in 1-2 sprints (it's mostly fixing what exists).
- Phase 3 (Publishing & Domains) is the highest business-value phase — flag it accordingly.
- The plan should be executable — not aspirational. Every story should be concrete enough to start working on.
- Remember: ONE table only. No separate sheets. Everything filterable by columns in Excel.
- The plan should be executable — not aspirational. Every story should be concrete enough to start working on.

## PROMPT END
