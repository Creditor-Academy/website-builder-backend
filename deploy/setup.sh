#!/bin/bash
# =============================================================================
# Buildora - VPS Deployment Script
# =============================================================================
# Usage: SSH into your VPS, then run:
#   curl -sSL https://raw.githubusercontent.com/YOUR_REPO/main/deploy/setup.sh | bash
#   OR copy this file to your VPS and run: bash setup.sh
#
# Prerequisites:
#   - Ubuntu/Debian VPS with root or sudo access
#   - A domain pointed to this VPS IP (A record + wildcard *.domain)
# =============================================================================

set -e

# ─── Colors ──────────────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  Buildora - Production Deployment      ${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""

# ─── 1. Check if running as root ─────────────────────────────────────────────
if [ "$EUID" -ne 0 ]; then
    echo -e "${RED}Please run as root (sudo bash setup.sh)${NC}"
    exit 1
fi

# ─── 2. Ask for domain ──────────────────────────────────────────────────────
read -p "Enter your domain (e.g., buildora.app): " DOMAIN
if [ -z "$DOMAIN" ]; then
    echo -e "${RED}Domain is required${NC}"
    exit 1
fi

SERVER_IP=$(curl -s ifconfig.me)
echo -e "${YELLOW}VPS IP: ${SERVER_IP}${NC}"
echo -e "${YELLOW}Domain: ${DOMAIN}${NC}"
echo ""

# ─── 3. Install Docker ──────────────────────────────────────────────────────
echo -e "${GREEN}[1/6] Installing Docker...${NC}"
if ! command -v docker &> /dev/null; then
    curl -fsSL https://get.docker.com | sh
    systemctl enable docker
    systemctl start docker
    echo -e "${GREEN}Docker installed!${NC}"
else
    echo -e "${YELLOW}Docker already installed.${NC}"
fi

# ─── 4. Install Certbot ─────────────────────────────────────────────────────
echo -e "${GREEN}[2/6] Installing Certbot...${NC}"
if ! command -v certbot &> /dev/null; then
    apt update -qq
    apt install -y -qq certbot python3-certbot-nginx
    echo -e "${GREEN}Certbot installed!${NC}"
else
    echo -e "${YELLOW}Certbot already installed.${NC}"
fi

# ─── 5. Clone repo ──────────────────────────────────────────────────────────
echo -e "${GREEN}[3/6] Setting up Buildora...${NC}"
APP_DIR="/opt/buildora"
if [ -d "$APP_DIR" ]; then
    echo -e "${YELLOW}$APP_DIR already exists. Pulling latest...${NC}"
    cd "$APP_DIR"
    git pull
else
    read -p "Enter GitHub repo URL: " REPO_URL
    git clone "$REPO_URL" "$APP_DIR"
    cd "$APP_DIR"
fi

# ─── 6. Setup Nginx ─────────────────────────────────────────────────────────
echo -e "${GREEN}[4/6] Configuring Nginx...${NC}"

# Main app config
sed "s/YOUR_DOMAIN/$DOMAIN/g" deploy/nginx/buildora.conf > /etc/nginx/sites-available/buildora.conf
ln -sf /etc/nginx/sites-available/buildora.conf /etc/nginx/sites-enabled/

# Wildcard subdomain config
sed "s/YOUR_DOMAIN/$DOMAIN/g" deploy/nginx/buildora-sites.conf > /etc/nginx/sites-available/buildora-sites.conf
ln -sf /etc/nginx/sites-available/buildora-sites.conf /etc/nginx/sites-enabled/

# Test nginx config (ignore SSL errors for now — certbot will fix them)
nginx -t 2>/dev/null || echo -e "${YELLOW}Nginx config has SSL refs — will be fixed after certbot${NC}"

# ─── 7. SSL Certificate ─────────────────────────────────────────────────────
echo -e "${GREEN}[5/6] Getting SSL certificate...${NC}"
echo -e "${YELLOW}For wildcard cert you need DNS challenge.${NC}"
echo -e "${YELLOW}Option 1: Get cert for app.$DOMAIN only (easy):${NC}"
echo -e "  certbot --nginx -d app.$DOMAIN"
echo ""
echo -e "${YELLOW}Option 2: Wildcard cert (requires DNS provider plugin):${NC}"
echo -e "  certbot certonly --manual --preferred-challenges dns -d '$DOMAIN' -d '*.$DOMAIN'"
echo ""

read -p "Get cert for app.$DOMAIN now? (y/n): " GET_CERT
if [ "$GET_CERT" = "y" ]; then
    # Temporarily create a simple nginx config without SSL for certbot
    cat > /etc/nginx/sites-available/buildora-temp.conf << EOF
server {
    listen 80;
    server_name app.$DOMAIN;
    location / {
        proxy_pass http://127.0.0.1:8080;
    }
}
EOF
    ln -sf /etc/nginx/sites-available/buildora-temp.conf /etc/nginx/sites-enabled/
    rm -f /etc/nginx/sites-enabled/buildora.conf
    rm -f /etc/nginx/sites-enabled/buildora-sites.conf
    nginx -t && systemctl reload nginx

    certbot --nginx -d "app.$DOMAIN" --non-interactive --agree-tos --register-unsafely-without-email

    # Re-enable full configs
    rm -f /etc/nginx/sites-enabled/buildora-temp.conf
    rm -f /etc/nginx/sites-available/buildora-temp.conf

    # Update SSL paths in configs to use the app subdomain cert
    sed -i "s|/etc/letsencrypt/live/$DOMAIN/|/etc/letsencrypt/live/app.$DOMAIN/|g" /etc/nginx/sites-available/buildora.conf
    ln -sf /etc/nginx/sites-available/buildora.conf /etc/nginx/sites-enabled/
    nginx -t && systemctl reload nginx
fi

# ─── 8. Environment setup ───────────────────────────────────────────────────
echo -e "${GREEN}[6/6] Setting up environment...${NC}"
ENV_FILE="$APP_DIR/backend/.env"
if [ ! -f "$ENV_FILE" ]; then
    cp deploy/.env.backend.production "$ENV_FILE"
    sed -i "s/YOUR_DOMAIN/$DOMAIN/g" "$ENV_FILE"
    sed -i "s/YOUR_VPS_IP/$SERVER_IP/g" "$ENV_FILE"
    echo ""
    echo -e "${RED}============================================${NC}"
    echo -e "${RED}  IMPORTANT: Edit backend/.env with your    ${NC}"
    echo -e "${RED}  actual API keys before starting!          ${NC}"
    echo -e "${RED}============================================${NC}"
    echo -e "  nano $ENV_FILE"
    echo ""
else
    echo -e "${YELLOW}backend/.env already exists. Skipping.${NC}"
fi

# ─── 9. Create .env for docker-compose (frontend build args) ────────────────
cat > "$APP_DIR/.env" << EOF
VITE_API_BASE_URL=/api/v1
VITE_SITE_HOST=https://$DOMAIN
VITE_GOOGLE_CLIENT_ID=your-google-client-id
EOF

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  Setup complete!                       ${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo "Next steps:"
echo "  1. Edit backend/.env with your actual API keys:"
echo "     nano $APP_DIR/backend/.env"
echo ""
echo "  2. Edit .env with your Google Client ID:"
echo "     nano $APP_DIR/.env"
echo ""
echo "  3. Start Buildora:"
echo "     cd $APP_DIR"
echo "     docker compose up --build -d"
echo ""
echo "  4. Check logs:"
echo "     docker compose logs -f"
echo ""
echo "  5. Your app will be at: https://app.$DOMAIN"
echo ""
