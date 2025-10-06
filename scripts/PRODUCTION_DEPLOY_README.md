# Production Deployment Guide

Complete guide for deploying Matrix Chat Support to a production server with your current configuration (3 departments, 9 users, Telegram integration).

## 📋 Overview

The production deployment script (`production-deploy.sh`) automates the complete setup of Matrix Chat Support on a fresh server with:

- ✅ **3 Departments**: Support, Commerce, Account Verification
- ✅ **9 Department Users** + 1 Admin (10 total)
- ✅ **Telegram Integration** with @QWMatrixTestBot
- ✅ **Systemd Services** for auto-start on boot
- ✅ **Web Server Configuration** (Nginx/Apache2)
- ✅ **SSL Certificates** (Let's Encrypt)
- ✅ **Firewall Setup** (UFW)

**Estimated Time**: 60-75 minutes for complete deployment

## 🚀 Quick Start

### Prerequisites

Before running the deployment script, ensure your server has:

- **Operating System**: Ubuntu 20.04+ or Debian 11+
- **Resources**:
  - 2+ CPU cores
  - 4GB+ RAM
  - 10GB+ disk space
- **Network**: Public IP address and domain name (optional but recommended)
- **Access**: SSH access with sudo privileges

### Step 1: Prepare Your Server

```bash
# Update system packages
sudo apt update && sudo apt upgrade -y

# Install required tools
sudo apt install -y git curl wget jq

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Install Node.js 18+
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs
```

### Step 2: Copy Project to Server

**Option A: From your local machine (recommended)**

```bash
# On your local machine (where the project is working)
cd /path/to/matrix-chat-support

# Build the widget before transferring
npm run build:widget

# Create deployment archive
tar -czf matrix-chat-deploy.tar.gz \
  config/ \
  server/ \
  scripts/ \
  docker/ \
  dist/ \
  docker-compose.yml \
  package.json \
  package-lock.json

# Transfer to server
scp matrix-chat-deploy.tar.gz user@your-server:/tmp/

# On the server
cd /tmp
tar -xzf matrix-chat-deploy.tar.gz
cd matrix-chat-support
```

**Option B: Clone from repository**

```bash
# On the server
cd /tmp
git clone <your-repo-url> matrix-chat-support
cd matrix-chat-support

# Build widget
npm install
npm run build:widget
```

### Step 3: Run Deployment Script

```bash
# Make script executable
chmod +x scripts/production-deploy.sh scripts/lib/production-utils.sh

# Run deployment
sudo ./scripts/production-deploy.sh
```

## 📝 Interactive Configuration

The script will prompt you for the following information:

### 1. Domain Configuration
```
Enter production domain: chat.company.com
```
- Use your actual domain name for production
- Or use `localhost` for testing (no SSL/web server setup)

### 2. Admin Email
```
Enter admin email for SSL certificates: admin@company.com
```
- Used for Let's Encrypt SSL certificate registration
- Only required if using a real domain

### 3. Admin Password
```
Auto-generate secure admin password? [Y/n]: y
```
- Choose to auto-generate a secure password
- Or manually enter a password (min 8 characters)
- **IMPORTANT**: Save this password securely!

### 4. Telegram Configuration
```
Use existing Telegram bot token (QWMatrixTestBot)? [Y/n]: y
```
- Default uses your current bot: `8497512931:AAG...`
- Or enter a new bot token if needed

### 5. CORS Origins
```
Enter CORS origins (comma-separated): https://company.com,https://www.company.com
```
- List all domains where the widget will be embedded
- Comma-separated list

### 6. Optional Components

During deployment, you'll be asked about:
- **Systemd Services**: Auto-start on boot (recommended: yes)
- **Web Server**: Nginx, Apache2, or skip (recommended: Nginx)
- **SSL Certificate**: Let's Encrypt setup (recommended: yes if using domain)
- **Firewall**: UFW configuration (recommended: yes)

## 🎯 Deployment Phases

The script executes 12 phases automatically:

| Phase | Description | Duration |
|-------|-------------|----------|
| 1 | Pre-flight checks (OS, Docker, Node.js, ports) | 2 min |
| 2 | System preparation (user, directories) | 1 min |
| 3 | Application installation (files, dependencies) | 5 min |
| 4 | Configuration setup (interactive prompts) | 3 min |
| 5 | Docker services (PostgreSQL, Synapse, Element) | 10 min |
| 6 | User creation & tokens (10 users + tokens) | 5 min |
| 7 | Telegram integration (router startup) | 2 min |
| 8 | Systemd service installation | 3 min |
| 9 | Web server configuration (Nginx/Apache) | 5 min |
| 10 | Firewall setup (UFW rules) | 2 min |
| 11 | Verification & testing | 3 min |
| 12 | Documentation generation | 1 min |

**Total**: ~40 minutes automated + ~20 minutes for prompts and SSL

## 📊 What Gets Installed

### System Structure

```
/opt/matrix-chat-support/
├── config/              # Configuration files
│   ├── config.yaml      # Main config with tokens
│   ├── systemd/         # Service files
│   ├── nginx.conf       # Web server configs
│   └── apache2.conf
├── server/              # Express API server
├── scripts/             # Deployment & management scripts
│   └── telegram-department-router.js
├── dist/                # Built widget files
├── docker/              # Docker templates
├── data/                # Runtime data (owned by UID 991)
│   ├── homeserver.yaml  # Synapse configuration
│   ├── user-credentials.txt  # ALL CREDENTIALS ⚠️
│   └── chat-room-mappings.json
├── logs/                # Application logs
└── docker-compose.yml   # Docker stack definition
```

### Users Created

| Department | Username | Default Password | Role |
|------------|----------|------------------|------|
| Admin | admin | (auto-generated) | Administrator |
| Support | support_agent1 | support1123 | Agent |
| Support | support_agent2 | support2123 | Agent |
| Support | support_agent3 | support3123 | Agent |
| Commerce | commerce_agent1 | commerce1123 | Agent |
| Commerce | commerce_agent2 | commerce2123 | Agent |
| Commerce | commerce_agent3 | commerce3123 | Agent |
| Commerce | commerce_agent4 | commerce4123 | Agent |
| Identification | identify_agent1 | identify1123 | Agent |
| Identification | identify_agent2 | identify2123 | Agent |

**⚠️ IMPORTANT**: All credentials and tokens are saved in `/opt/matrix-chat-support/data/user-credentials.txt` (chmod 600)

### Systemd Services

| Service | Purpose | Port |
|---------|---------|------|
| matrix-chat-docker.service | Docker stack (Synapse, PostgreSQL, etc.) | 8008, 8080, 8081 |
| matrix-chat-widget.service | Widget API server | 3001 |
| matrix-chat-telegram.service | Telegram department router | - |
| matrix-chat.target | Master control (all services) | - |

## 🌐 Post-Deployment

### 1. Verify Installation

```bash
# Check all services are running
sudo systemctl status matrix-chat-*

# Test widget server
curl http://localhost:3001/health

# Test Synapse
curl http://localhost:8008/health

# View deployment summary
cat /opt/matrix-chat-support/DEPLOYMENT_SUMMARY.md
```

### 2. Secure Credentials

```bash
# Backup credentials
sudo cp /opt/matrix-chat-support/data/user-credentials.txt ~/matrix-credentials-backup.txt

# Secure the backup
chmod 600 ~/matrix-credentials-backup.txt

# Store in password manager or secure location
```

### 3. Integrate Widget on Website

Add this code to your website where you want the chat widget:

```html
<!DOCTYPE html>
<html>
<head>
    <title>Your Website</title>
</head>
<body>
    <!-- Your website content -->

    <!-- Matrix Chat Widget -->
    <script src="https://your-domain.com/embed.js"></script>
</body>
</html>
```

### 4. Test Telegram Integration

```bash
# Message the bot on Telegram
# Search for: @QWMatrixTestBot

# Send a message or use commands:
/start_support    # General Support
/start_commerce   # Commerce Support
/start_id         # Account Verification
```

### 5. Train Support Team

Your support agents can access conversations through:

1. **Element Web**: http://your-domain.com:8081
   - Login with their credentials (e.g., support_agent1 / support1123)
   - They'll see customer conversations in their department spaces

2. **Desktop/Mobile Clients**: Download Element
   - Android: Google Play Store
   - iOS: App Store
   - Desktop: https://element.io/get-started

## ⚙️ Service Management

### Start/Stop All Services

```bash
# Start everything
sudo systemctl start matrix-chat.target

# Stop everything
sudo systemctl stop matrix-chat.target

# Restart everything
sudo systemctl restart matrix-chat.target

# Check status
sudo systemctl status matrix-chat.target
```

### Individual Service Control

```bash
# Widget server
sudo systemctl restart matrix-chat-widget
sudo journalctl -u matrix-chat-widget -f

# Telegram router
sudo systemctl restart matrix-chat-telegram
sudo journalctl -u matrix-chat-telegram -f

# Docker services
cd /opt/matrix-chat-support
sudo docker compose restart synapse
sudo docker compose logs synapse -f
```

### View Logs

```bash
# All services
sudo journalctl -u 'matrix-chat-*' -f

# Widget server logs
sudo journalctl -u matrix-chat-widget -f -n 100

# Telegram router logs
sudo journalctl -u matrix-chat-telegram -f -n 100

# Synapse logs
cd /opt/matrix-chat-support
sudo docker compose logs synapse -f
```

## 🔧 Troubleshooting

### Widget Not Loading on Website

1. **Check widget server is running**:
   ```bash
   sudo systemctl status matrix-chat-widget
   curl http://localhost:3001/health
   ```

2. **Check CORS configuration**:
   ```bash
   grep cors_origins /opt/matrix-chat-support/config/config.yaml
   ```

3. **Check web server logs** (if using Nginx/Apache):
   ```bash
   sudo tail -f /var/log/nginx/error.log
   # or
   sudo tail -f /var/log/apache2/error.log
   ```

### Telegram Bot Not Responding

1. **Check Telegram router**:
   ```bash
   sudo systemctl status matrix-chat-telegram
   sudo journalctl -u matrix-chat-telegram -n 50
   ```

2. **Verify bot token**:
   ```bash
   grep bot_token /opt/matrix-chat-support/config/config.yaml
   ```

3. **Restart Telegram router**:
   ```bash
   sudo systemctl restart matrix-chat-telegram
   ```

### Synapse Not Starting

1. **Check Docker**:
   ```bash
   cd /opt/matrix-chat-support
   sudo docker compose ps
   sudo docker compose logs synapse --tail=100
   ```

2. **Check configuration**:
   ```bash
   sudo cat /opt/matrix-chat-support/data/homeserver.yaml | grep server_name
   ```

3. **Restart Synapse**:
   ```bash
   sudo systemctl restart matrix-chat-docker
   ```

### Port Already in Use

```bash
# Check what's using a port
sudo lsof -i :3001
sudo lsof -i :8008

# Kill process if needed
sudo kill -9 <PID>

# Or change port in configuration
sudo nano /opt/matrix-chat-support/config/config.yaml
```

## 🔒 Security Best Practices

### 1. Secure Credentials

```bash
# Credentials file should be 600
sudo chmod 600 /opt/matrix-chat-support/data/user-credentials.txt

# Only accessible by matrix-chat user
sudo chown matrix-chat:matrix-chat /opt/matrix-chat-support/data/user-credentials.txt
```

### 2. Change Default Passwords

```bash
# Login to Synapse Admin Panel
# http://your-domain.com:8080

# Change passwords for all department users
# Especially if you kept the default passwords
```

### 3. Regular Updates

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Update Docker images
cd /opt/matrix-chat-support
sudo docker compose pull
sudo docker compose up -d
```

### 4. Regular Backups

```bash
# Create backup
sudo tar -czf /backup/matrix-chat-$(date +%Y%m%d).tar.gz \
  -C /opt/matrix-chat-support \
  config/ data/ docker-compose.yml

# Set up automated backups with cron
sudo crontab -e
# Add: 0 2 * * * /path/to/backup-script.sh
```

## 📈 Monitoring

### Health Checks

```bash
# Widget server
curl http://localhost:3001/health

# Synapse
curl http://localhost:8008/health

# All services active
sudo systemctl is-active matrix-chat-*
```

### Resource Usage

```bash
# Service resource usage
sudo systemctl status matrix-chat-widget
sudo systemd-cgtop

# Docker container stats
sudo docker stats
```

## 🆘 Getting Help

If you encounter issues:

1. **Check logs**: See troubleshooting section above
2. **Review documentation**:
   - `/opt/matrix-chat-support/DEPLOYMENT_SUMMARY.md`
   - `/opt/matrix-chat-support/CLAUDE.md`
   - `/opt/matrix-chat-support/config/systemd/README.md`
3. **Check service status**: All matrix-chat-* services should be active
4. **Verify configuration**: Ensure tokens and domains are correct

## 📚 Additional Resources

- **Matrix Documentation**: https://matrix.org/docs/
- **Synapse Docs**: https://element-hq.github.io/synapse/latest/
- **Element Docs**: https://element.io/help
- **Docker Compose**: https://docs.docker.com/compose/

---

**Deployment Script Version**: 1.0
**Last Updated**: 2025-10-04
**Support**: See CLAUDE.md for project documentation
