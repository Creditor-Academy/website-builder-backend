# 🚀 Buildora - Full AWS Production Deployment Guide (Docker + Jenkins)

This document is for the **AWS Infrastructure Team**. It outlines the complete 3-Tier deployment architecture for the Buildora platform, using Docker and Jenkins.

It specifically covers the routing rules required for our **Multi-tenant Subdomain and Custom Domain** features.

---

## 🏗️ 1. Infrastructure Architecture

```text
User (Browser)
     │
     ├─► Traffic to `buildora.lmsathena.com` ────► [Frontend EC2] ──► Frontend React Docker Container
     │
     └─► Traffic to `*.buildora.lmsathena.com` ──► [Frontend EC2 Nginx] ──► Proxies to [Backend EC2 (Port 5000)]
                                                                               │
                                                                               ▼
                                                                 AWS RDS PostgreSQL (Private)
```

---

## 🖥️ 2. Backend EC2 Setup (Private Server: `10.x.x.x`)

The backend is completely containerized. It handles the API *and* dynamically serves the user-published websites.

### Jenkins Pipeline Instructions:
1. **Repository:** `website-builder-backend`
2. **Environment File (`.env`):**
   Inject the following into the root of the repo:
   ```env
   DATABASE_URL=postgresql://user:password@rds-endpoint:5432/db?sslmode=require
   PORT=5000
   ```
3. **Deploy:**
   ```bash
   docker-compose up --build -d
   ```
4. **Database Migrations:**
   Run Prisma migrations *inside* the running container to sync the RDS schema.
   ```bash
   docker-compose exec backend npx prisma migrate deploy
   ```

*Security Group:* Allow `TCP 5000` strictly from the Frontend EC2 Security Group.

---

## 🌐 3. Frontend EC2 Setup (Public Server / Bastion)

The Frontend EC2 acts as both the host for the React Application AND the primary traffic router for custom domains.

### Step 3A: Deploy the React App
1. **Repository:** `website-builder` (Frontend)
2. **Pre-build Config:**
   The frontend Docker container runs its own Nginx. You must inject the Backend's private IP so it can proxy `/api` calls.
   ```bash
   # In Jenkins before docker build:
   sed -i "s/<BACKEND_PRIVATE_IP>/[INSERT_BACKEND_PRIVATE_IP]/g" nginx.conf
   ```
3. **Deploy Container:**
   ```bash
   # Expose React container on port 8080 (so host Nginx can use port 80/443)
   docker-compose up --build -d
   ```

### Step 3B: Host Nginx Configuration (CRITICAL FOR DOMAINS)
Because Buildora allows users to publish websites to subdomains (e.g., `user1.buildora.lmsathena.com`) and custom domains, the **Frontend EC2 must run a host-level Nginx reverse proxy** to route traffic.

Install Nginx directly on the Frontend EC2:
```bash
sudo apt update && sudo apt install nginx -y
```

**File 1: `/etc/nginx/sites-available/buildora.lmsathena.com`**
*(Routes dashboard traffic to the Docker container)*
```nginx
server {
    listen 80;
    server_name buildora.lmsathena.com;

    location / {
        proxy_pass http://127.0.0.1:8080; # Points to the React Docker container
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

**File 2: `/etc/nginx/sites-available/wildcard.buildora.lmsathena.com`**
*(Catches all published user sites and custom domains, routing them to the Backend EC2)*
```nginx
server {
    listen 80 default_server; # Catch-all for custom domains and subdomains
    server_name *.buildora.lmsathena.com;

    location / {
        proxy_pass http://[INSERT_BACKEND_PRIVATE_IP]:5000; # Points to Private Backend EC2
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Enable both sites:
```bash
sudo ln -s /etc/nginx/sites-available/buildora.lmsathena.com /etc/nginx/sites-enabled/
sudo ln -s /etc/nginx/sites-available/wildcard.buildora.lmsathena.com /etc/nginx/sites-enabled/
sudo systemctl restart nginx
```

---

## 🔐 4. Custom Domain & DNS Instructions

To support custom domains for your users:
1. **Wildcard DNS:** Set up an A Record in Route53 for `*.buildora.lmsathena.com` pointing to the Frontend EC2 Public IP.
2. **App DNS:** Set up an A Record for `buildora.lmsathena.com` pointing to the Frontend EC2 Public IP.
3. **SSL/TLS:** The AWS team should configure a Wildcard SSL certificate (e.g., via AWS Certificate Manager or Certbot) on the Frontend EC2's Host Nginx.

When a user links `customdomain.com`, they will create a CNAME record pointing to `cname.buildora.lmsathena.com`. The Host Nginx `default_server` block on the Frontend EC2 will catch this traffic and pipe it to the Backend EC2, where the Buildora API will dynamically look up and serve the correct website!
