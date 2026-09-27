#!/usr/bin/env bash
# =============================================================================
# scripts/setup-vps.sh — Oracle Cloud Ubuntu 22.04 initial VPS setup
#
# Provisions:
#   - 2 GB swap space (fallocate /swapfile)
#   - Node.js 20 LTS (via NodeSource)
#   - pnpm (global)
#   - pm2  (global)
#   - pm2 startup on boot
#
# Usage:
#   chmod +x scripts/setup-vps.sh
#   sudo bash scripts/setup-vps.sh
# =============================================================================
set -euo pipefail

echo "============================================"
echo "  Sentinel Bot — VPS Setup Script"
echo "  Oracle Cloud Ubuntu 22.04"
echo "============================================"

# ── 1. Create 2 GB swap ────────────────────────────────────────────────────
echo ""
echo "[1/5] Configuring 2GB swap..."
if [ -f /swapfile ]; then
  echo "      /swapfile already exists — skipping creation."
else
  fallocate -l 2G /swapfile
  chmod 600 /swapfile
  mkswap /swapfile
  swapon /swapfile
  # Persist across reboots
  echo '/swapfile none swap sw 0 0' >> /etc/fstab
  # Reduce swappiness for a long-running Node.js process
  sysctl vm.swappiness=10
  echo 'vm.swappiness=10' >> /etc/sysctl.conf
  echo "      2GB swap created and activated."
fi

# ── 2. Install Node.js 20 via NodeSource ───────────────────────────────────
echo ""
echo "[2/5] Installing Node.js 20 LTS..."
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs
node --version
npm --version

# ── 3. Install pnpm ────────────────────────────────────────────────────────
echo ""
echo "[3/5] Installing pnpm..."
npm install -g pnpm
pnpm --version

# ── 4. Install PM2 ─────────────────────────────────────────────────────────
echo ""
echo "[4/5] Installing PM2..."
npm install -g pm2
pm2 --version

# ── 5. Configure PM2 startup ───────────────────────────────────────────────
echo ""
echo "[5/5] Configuring PM2 startup on boot..."
pm2 startup systemd -u "$(whoami)" --hp "$HOME" || true
echo "      Run the command printed above to complete startup setup."

# ── Done ────────────────────────────────────────────────────────────────────
echo ""
echo "============================================"
echo "  Setup complete!"
echo "============================================"
echo ""
echo "Next steps:"
echo "  1. Clone the repository:"
echo "       git clone https://github.com/ThienHN0910/sentinel-bot.git /opt/sentinel-bot"
echo "  2. Navigate to the project:"
echo "       cd /opt/sentinel-bot"
echo "  3. Copy and fill in your environment file:"
echo "       cp .env.example .env && nano .env"
echo "  4. Install dependencies and build:"
echo "       pnpm install --frozen-lockfile"
echo "       pnpm build"
echo "  5. Start the bot with PM2:"
echo "       pm2 start ecosystem.config.js --env production"
echo "       pm2 save"
echo ""
