# Buildora Backend API

![Buildora Banner](https://img.shields.io/badge/Status-Production%20Ready-success) ![Node.js](https://img.shields.io/badge/Node.js-Express-green) ![TypeScript](https://img.shields.io/badge/TypeScript-Strict-blue) ![Database](https://img.shields.io/badge/PostgreSQL-Prisma-blueviolet)

This is the core backend service for **Buildora**, a modern, multi-tenant website builder platform. It provides the RESTful API for the builder dashboard, handles user authentication, manages website deployments to AWS S3, and dynamically routes custom domains and subdomains directly to static S3 assets.

---

## 🚀 Key Features & Architecture

* **Multi-tenant Website Builder Engine**: Create, edit, duplicate, and publish websites. Complete support for drafting, version history, and rollbacks.
* **Native Domain Router**: Built-in Express middleware that intercepts `Host` headers for custom domains (e.g. `www.mybakery.com`) and subdomains (`test.buildora.lmsathena.com`), serving raw HTML via direct streaming from AWS S3. 
* **Dynamic S3 Deployments**: Extremely fast parallel file uploading (`Promise.all`) using `@aws-sdk/client-s3`. 
* **Custom Domain Provisioning**: Automated AWS ACM certificate polling and CloudFront provisioning for user-attached custom domains via distributed background cron jobs.
* **Security First**: 
  * Strict JWT Access & Refresh token rotation
  * Double Submit Cookie (DSC) CSRF Protection
  * IP-based rate-limiting & IP blocking (via Upstash Redis)
  * Smart CORS splitting (strict for dashboard API, completely open for published site analytics/forms)
* **Real-time Analytics**: Tracks and aggregates page views, referrers, and unique visitors for published websites.

---

## 🛠️ Tech Stack

* **Runtime:** Node.js + Express (v5)
* **Language:** TypeScript (Strict mode)
* **Database ORM:** Prisma + PostgreSQL (Neon/Supabase)
* **Caching & Locks:** Redis (via `@upstash/redis`)
* **AWS Integration:** AWS SDK v3 (S3, ACM, CloudFront)
* **Image Processing:** Sharp
* **Email:** Resend
* **Validation:** Zod v4
* **Testing:** Native `node:test` runner

---

## 💻 Local Development Setup

### 1. Prerequisites
* Node.js (v20+ recommended)
* PostgreSQL database (Local or Cloud)
* Redis instance (Upstash or Local)

### 2. Installation
Clone the repository and install the dependencies:
```bash
git clone <repo-url>
cd website-builder-backend
npm install
```

### 3. Environment Variables
Create a `.env` file based on `.env.example` (or refer to the list below) and fill in your secrets.
```bash
# Database connection strings
POSTGRESQL_URL="postgresql://user:pass@host:5432/dbname"

# Redis Configuration (TCP or Upstash REST)
REDIS_URL=https://...
REDIS_TOKEN=...

# JWT & CSRF
JWT_SECRET=super_secret_key
CSRF_SECRET=csrf_super_secret

# AWS Config (Used for deployments and domain router)
S3_ACCESS_KEY_ID=...
S3_SECRET_ACCESS_KEY=...
S3_REGION=us-east-1
S3_BUCKET=my-buildora-assets

# App Config
FRONTEND_ORIGINS=http://localhost:8080,http://localhost:8081
SITE_HOST=buildora.lmsathena.com
```

### 4. Database Setup
Generate the Prisma client and push the schema to your database:
```bash
npx prisma generate
npx prisma db push
```

### 5. Start the Server
Start the development server with live-reloading (`tsx watch`):
```bash
npm run dev
```
The server will start on `http://localhost:5000`.

---

## 🧪 Testing

The backend is fully unit-tested using Node's native test runner (`node:test`). Tests run against a dedicated test database to ensure isolation.

```bash
# Run all tests
npm test
```

*Note: S3 integration tests will gracefully skip if your test environment `.env` lacks valid AWS credentials.*

---

## ☁️ Production Deployment

The platform is containerized and designed for a 3-tier AWS architecture. 

### Docker Build
```bash
docker build -t buildora-backend .
docker run -p 5000:5000 --env-file .env buildora-backend
```

### Cron Jobs in Production
The backend utilizes `node-cron` for periodic tasks (certificate polling, token cleanup). To prevent cron job collision across multiple Docker containers in AWS, all cron jobs are protected by **Redis Distributed Locks** (NX keys). You can safely scale the backend horizontally across multiple EC2 instances or ECS Tasks.

### S3 & CloudFront Architecture
Published websites are stored in S3 at `sites/{websiteId}/latest/`.
1. **Subdomains:** Handled natively by the Node.js `domain-router` streaming directly from S3.
2. **Custom Domains:** Triggers an automated AWS pipeline that generates an ACM certificate and creates a dedicated CloudFront distribution mapping to the S3 Origin.

---

## 📁 Project Structure

```text
src/
├── config/             # DB, Redis, and AWS clients
├── middlewares/        # Auth, CORS, CSRF, Rate Limiting, Domain Router
├── modules/            # Core business logic (Controllers, Services, DAOs)
│   ├── auth/           # Authentication & Google OAuth
│   ├── website/        # Builder state & Publishing engine
│   ├── domain/         # Custom Domains & ACM provisioning
│   ├── assets/         # S3 Media Asset Management
│   ├── analytics/      # Pageview tracking for published sites
│   ├── contact/        # Form submissions for published sites
│   └── ...
├── services/           # Reusable generic services (Deployment, Cache, Cleanup)
├── utils/              # Error classes, helpers
├── main.ts             # Express application entry point
└── __tests__/          # Integration and Unit tests
```
