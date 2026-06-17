# 🚀 Buildora — AWS Production Deployment Guide

**Stack:** Docker · Jenkins CI/CD · Nginx · AWS RDS · AWS ACM · AWS CloudFront · AWS S3

---

## 🏗️ 1. Architecture Overview

```text
                              ┌────────────────────────────────────┐
                              │        Frontend EC2 (Public)        │
User (Browser)                │                                     │
      │                       │  ┌──────────────────────────────┐  │
      ├──buildora.lmsathena.com──►│  Nginx Host (port 80/443)    │  │
      │                       │  │  → React Docker (port 8080)   │  │
      │                       │  │  → /api/* → Backend EC2:5000  │  │
      │                       │  └──────────────────────────────┘  │
      └──────────────────────────────────────────────────────────────┘
                                              │ port 5000 (private VPC)
                              ┌───────────────▼────────────────────┐
                              │        Backend EC2 (Private)        │
                              │  Node.js API Docker Container       │
                              │  ├── /api/*  → REST API routes      │
                              └───────────────┬────────────────────┘
                                              │ ssl
                              ┌───────────────▼────────────────────┐
                              │     AWS RDS PostgreSQL (Private)    │
                              └────────────────────────────────────┘

━━━━ Domain Routing ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

slug.buildora.lmsathena.com  ──► CloudFront (Primary Distribution)
                                       │ KeyValueStore (slug → websiteId)
                                       ▼
                                  S3 Sites Bucket (/sites/{websiteId}/latest/)

customdomain.com             ──► CloudFront (Per-domain Distribution)
                                  [Auto-provisioned by backend via ACM + CF API]
                                       ▼
                                  S3 Sites Bucket (/sites/{websiteId}/latest/)
```

---

## 🔐 2. Security Groups

| Security Group | Inbound Rules |
|---|---|
| **Frontend SG** (Public) | SSH (22) → Your office IP only · HTTP (80) → Public · HTTPS (443) → Public |
| **Backend SG** (Private) | SSH (22) → Frontend SG (Bastion) · TCP (5000) → Frontend SG |
| **RDS SG** (Private) | PostgreSQL (5432) → Backend SG · PostgreSQL (5432) → Frontend SG (for SSH tunnel) |

---

## 🖥️ 3. Backend EC2 Setup (Private)

### 3A. One-Time Server Prep
```bash
sudo apt update
sudo apt install docker.io docker-compose-v2 -y
sudo usermod -aG docker ubuntu
newgrp docker
```

### 3B. Environment File
Create the file **once** manually on the server at `/home/ubuntu/.env`:

```env
# ─── Required ───────────────────────────────────────────
JWT_SECRET=<generate-a-long-random-string>
POSTGRESQL_URL=postgresql://user:pass@<rds-endpoint>:5432/buildora?sslmode=require

# ─── Server ─────────────────────────────────────────────
PORT=5000
NODE_ENV=production
FRONTEND_ORIGINS=https://buildora.lmsathena.com
FRONTEND_URL=https://buildora.lmsathena.com
API_BASE_URL=https://buildora.lmsathena.com/api/v1
PUBLIC_SITE_HOST=buildora.lmsathena.com

# ─── Redis (Upstash) ────────────────────────────────────
REDIS_URL=<upstash-redis-url>
REDIS_TOKEN=<upstash-redis-token>

# ─── S3 (Asset Uploads) ─────────────────────────────────
S3_REGION=us-east-1
S3_ACCESS_KEY_ID=<iam-access-key>
S3_SECRET_ACCESS_KEY=<iam-secret-key>
S3_BUCKET=<assets-bucket-name>

# ─── S3 (Published Sites) ───────────────────────────────
S3_SITES_BUCKET=<sites-bucket-name>
PUBLISHED_SITES_BASE_URL=https://<primary-cloudfront-domain>

# ─── CloudFront (Published Sites) ───────────────────────
# Required for subdomain routing + custom domain auto-provisioning
CLOUDFRONT_PRIMARY_DISTRIBUTION_ID=<distribution-id>
CLOUDFRONT_KVS_ARN=<key-value-store-arn>

# ─── Email ──────────────────────────────────────────────
RESEND_API_KEY=<resend-api-key>
EMAIL_FROM=Buildora <noreply@lmsathena.com>

# ─── Google OAuth ───────────────────────────────────────
GOOGLE_CLIENT_ID=<google-client-id>
```

> [!IMPORTANT]
> The Backend EC2's **IAM Role** must have permissions for: `s3:*` on both S3 buckets, `cloudfront:*`, `acm:*` (in `us-east-1`). These are required for the subdomain and custom domain features to work.

### 3C. Jenkins Pipeline (Auto-Deploy)
The repository contains a ready-to-use `Jenkinsfile`. Jenkins will:
1. Run tests (`npm test`)
2. Build a Docker image
3. Transfer it via SSH to the Backend EC2
4. Run `docker compose up -d`
5. Prisma migrations run automatically on container start

**Jenkins setup requires:**
- Add SSH private key as a Jenkins credential named `backend-ssh-key`
- The corresponding public key must be in `/home/ubuntu/.ssh/authorized_keys` on the Backend EC2

---

## 🌐 4. Frontend EC2 Setup (Public / Bastion)

### 4A. One-Time Server Prep
```bash
sudo apt update
sudo apt install docker.io docker-compose-v2 nginx -y
sudo usermod -aG docker ubuntu
newgrp docker
```

### 4B. Deploy React App (Docker — port 8080)
```bash
cd /home/ubuntu/website-builder

# Inject backend private IP into nginx.conf before building
sed -i "s/<BACKEND_PRIVATE_IP>/<actual-backend-ip>/g" nginx.conf

# Set frontend env vars and deploy
export VITE_API_BASE_URL=/api/v1
export VITE_SITE_HOST=https://buildora.lmsathena.com
export VITE_GOOGLE_CLIENT_ID=<google-client-id>

docker compose up --build -d
```

The React container listens on host port `8080`.

### 4C. Host Nginx Configuration
Nginx on the host machine handles SSL termination and routes traffic.

**File: `/etc/nginx/sites-available/buildora`**
```nginx
# Redirect HTTP → HTTPS
server {
    listen 80;
    server_name buildora.lmsathena.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name buildora.lmsathena.com;

    # SSL — use AWS ACM cert via AWS Certificate Manager
    # (attach via AWS Load Balancer, or use Certbot for direct EC2 setup)
    ssl_certificate /etc/letsencrypt/live/buildora.lmsathena.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/buildora.lmsathena.com/privkey.pem;

    # API requests → Backend EC2 (private IP)
    location /api/ {
        proxy_pass http://<BACKEND_PRIVATE_IP>:5000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_http_version 1.1;
        proxy_set_header Connection "";
    }

    # All other traffic → React Docker container
    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

Enable the site:
```bash
sudo ln -s /etc/nginx/sites-available/buildora /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

### 4D. SSL Certificate for Main Domain
```bash
sudo apt install certbot python3-certbot-nginx -y
sudo certbot --nginx -d buildora.lmsathena.com
```

---

## 🌍 5. Domain & Subdomain Routing

This is where Buildora's architecture is unique. Published sites and custom domains are **not** served by the Backend EC2 directly. They are served by **AWS CloudFront**, which reads static HTML/CSS/JS files from the **S3 Sites Bucket**.

### How Published Subdomains Work (`slug.buildora.lmsathena.com`)
1. DNS: `*.buildora.lmsathena.com` A record → Frontend EC2 IP (all subdomain traffic hits the Frontend EC2 first).
2. Nginx on the Frontend EC2 proxies `*.buildora.lmsathena.com` traffic to the Backend EC2.
3. The Backend's domain-router middleware reads the `Host` header, looks up the website in the database, and streams the site files from S3.

**Add Nginx wildcard block to the host Nginx config:**
```nginx
# Catch all *.buildora.lmsathena.com → Backend for site serving
server {
    listen 80;
    server_name *.buildora.lmsathena.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name *.buildora.lmsathena.com;

    # Wildcard SSL cert (issued via Certbot DNS challenge or ACM)
    ssl_certificate /etc/letsencrypt/live/buildora.lmsathena.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/buildora.lmsathena.com/privkey.pem;

    location / {
        proxy_pass http://<BACKEND_PRIVATE_IP>:5000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

> [!NOTE]
> For the wildcard SSL cert (`*.buildora.lmsathena.com`), Certbot requires a **DNS challenge**:
> `sudo certbot certonly --manual --preferred-challenges dns -d "*.buildora.lmsathena.com"`
> The AWS team must add the TXT record shown in Route53 to complete the challenge.

### How Custom Domains Work (`joesbakery.com`)
When a user adds a custom domain in the Buildora dashboard:
1. The backend automatically requests an **ACM certificate** for `joesbakery.com`.
2. It shows the user a CNAME DNS record to add (for ACM DNS validation).
3. Once validated, the backend automatically creates a **CloudFront distribution** for `joesbakery.com` pointed at the S3 Sites Bucket.
4. The user adds a final CNAME pointing their domain to the CloudFront domain name.

**No manual AWS team action is required for custom domains.** It is fully automated.

---

## 🗄️ 6. Database Management

Migrations run **automatically** on every container start via the backend `Dockerfile`:
```bash
npx prisma migrate deploy && node dist/main.js
```

### Secure Local DB Access (for developers)
Create an SSH tunnel through the Frontend EC2 Bastion:
```bash
ssh -i key.pem -L 5432:<rds-endpoint>:5432 ubuntu@<frontend-public-ip>
```
Then locally connect with any Postgres client to `localhost:5432`.

---

## ☁️ 7. AWS Pre-Requisite: Primary CloudFront Distribution Setup

> [!IMPORTANT]
> This section must be completed by the AWS team **before the first deployment**. The backend application reads `CLOUDFRONT_PRIMARY_DISTRIBUTION_ID` and `CLOUDFRONT_KVS_ARN` from the `.env` file. Without these, subdomain publishing (`slug.buildora.lmsathena.com`) will fail silently.

This is a **one-time manual setup**. Once done, everything else (subdomain registration, custom domain provisioning) is fully automated by the backend API.

### Step 1: Request a Wildcard ACM Certificate (us-east-1)

> ACM certificates used with CloudFront **must** be in the `us-east-1` region, regardless of where your EC2 instances are.

1. Go to **AWS Certificate Manager → us-east-1 region**
2. Click **Request certificate** → Public certificate
3. Add domain names:
   - `buildora.lmsathena.com`
   - `*.buildora.lmsathena.com`
4. Choose **DNS validation**
5. Click **Create records in Route53** (AWS will auto-add the required CNAME records)
6. Wait ~5 minutes for status to show **Issued**
7. Copy the **Certificate ARN** — you'll need it in Step 3

### Step 2: Create a CloudFront KeyValueStore (KVS)

The KVS is a fast key-value store that maps `{slug}` → `{websiteId}`. The backend writes to it every time a user claims a subdomain. A CloudFront Function reads from it on every request to route traffic.

1. Go to **CloudFront → KeyValueStores**
2. Click **Create KeyValueStore**
   - Name: `buildora-sites-kvs`
   - Leave initial data empty
3. Once created, copy the **KVS ARN** → this goes in `CLOUDFRONT_KVS_ARN`

### Step 3: Create a CloudFront Function for Subdomain Routing

This function runs on every request to the Primary Distribution and routes `{slug}.buildora.lmsathena.com` to the correct S3 path.

1. Go to **CloudFront → Functions**
2. Click **Create function**
   - Name: `buildora-subdomain-router`
   - Runtime: `cloudfront-js-2.0`
3. Paste this code:

```javascript
import cf from 'cloudfront';

const kvsHandle = cf.kvs(); // Automatically bound to the attached KVS

async function handler(event) {
    const request = event.request;
    const host = request.headers.host?.value || '';

    // Extract slug from subdomain (e.g. "myschool" from "myschool.buildora.lmsathena.com")
    const slug = host.split('.')[0];

    try {
        const websiteId = await kvsHandle.get(slug);
        if (websiteId) {
            // Rewrite request path to S3 sites prefix
            const uri = request.uri === '/' ? '/index.html' : request.uri;
            request.uri = `/sites/${websiteId}/latest${uri}`;
        }
    } catch (err) {
        // Key not found — fall through with original URI (will 404 from S3)
    }

    return request;
}
```

4. Click **Save changes**
5. Click **Publish** to make it live

### Step 4: Create the Primary CloudFront Distribution

1. Go to **CloudFront → Distributions → Create distribution**
2. **Origin:**
   - Origin domain: your **S3 Sites Bucket**
   - Origin access: **Origin access control (OAC)** — create a new OAC if needed
   - Update the S3 bucket policy when prompted by CloudFront
3. **Default cache behavior:**
   - Viewer protocol policy: Redirect HTTP to HTTPS
   - Allowed HTTP methods: GET, HEAD
   - Associate Function: attach the `buildora-subdomain-router` function to the **Viewer Request** event
   - Associate KeyValueStore: attach `buildora-sites-kvs` to the function
4. **Settings:**
   - Alternate domain names (CNAMEs): `*.buildora.lmsathena.com`
   - Custom SSL certificate: select the wildcard cert you created in Step 1
5. Click **Create distribution**
6. Wait ~5 minutes for deployment (Status: `Enabled`)
7. Copy the **Distribution ID** → goes in `CLOUDFRONT_PRIMARY_DISTRIBUTION_ID`
8. Copy the **Distribution Domain Name** (e.g. `d1abc123.cloudfront.net`) → goes in `PUBLISHED_SITES_BASE_URL` as `https://d1abc123.cloudfront.net`

### Step 5: Add DNS Record for Subdomains

In **Route53**, add:

| Type | Name | Value |
|------|------|-------|
| `CNAME` | `*.buildora.lmsathena.com` | `d1abc123.cloudfront.net` (the distribution domain) |

> [!NOTE]
> The wildcard subdomain DNS should point to **CloudFront**, not the Frontend EC2. CloudFront handles all subdomain traffic directly from S3. Only the main dashboard domain `buildora.lmsathena.com` points to the Frontend EC2.

### Step 6: Update Backend `.env`

Fill in the values collected in the steps above:
```env
CLOUDFRONT_PRIMARY_DISTRIBUTION_ID=<from Step 4>
CLOUDFRONT_KVS_ARN=<from Step 2>
PUBLISHED_SITES_BASE_URL=https://<cloudfront-domain-from-step-4>
```

---

## ✅ 8. DNS Records Summary (Route53)

| Type | Name | Value |
|------|------|-------|
| `A` | `buildora.lmsathena.com` | Frontend EC2 Public IP |
| `CNAME` | `*.buildora.lmsathena.com` | CloudFront Primary Distribution domain (e.g. `d1abc.cloudfront.net`) |

---

## 🔒 9. Security Checklist

- [x] RDS in private subnet — no public access
- [x] Backend EC2 has no public IP
- [x] All traffic between Frontend ↔ Backend uses private VPC IPs
- [x] JWT auth via HttpOnly cookies (same-origin, no CORS issues)
- [x] S3 buckets are private — only accessible via CloudFront OAC or backend IAM role
- [x] `sslmode=require` on all database connections
- [x] SSL termination at Nginx (Frontend EC2)
- [x] Custom domain SSL auto-managed by ACM + CloudFront

