# Matrix Chat Support Widget - Installation & Configuration Guide

> **Complete step-by-step instructions for installing, configuring, and deploying the Matrix Chat Support Widget with Telegram integration.**

## Table of Contents

1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [Quick Start](#quick-start)
4. [Detailed Installation](#detailed-installation)
5. [Matrix/Synapse Configuration](#matrixsynapse-configuration)
6. [Widget Configuration](#widget-configuration)
7. [Telegram Integration Setup](#telegram-integration-setup)
8. [Building the Widget](#building-the-widget)
9. [Running the Server](#running-the-server)
10. [Testing](#testing)
11. [Production Deployment](#production-deployment)
12. [Troubleshooting](#troubleshooting)
13. [Advanced Configuration](#advanced-configuration)

---

## Overview

The Matrix Chat Support Widget is a dual-channel customer support system that provides:

- **Web Widget**: Embeddable chat widget for websites with department selection
- **Telegram Integration**: Professional Telegram bot for customer conversations
- **Matrix Backend**: Unified Matrix/Synapse server for both channels
- **Space Organization**: Hierarchical room organization for support teams
- **Multi-Department**: Route conversations to specialized support teams

**Architecture:**
```
Customer → Widget/Telegram → Matrix Rooms → Support Team
                                ↓
                    Organized in Matrix Spaces
                                ↓
         Web-Chat Space          Telegram Space
                ↓                      ↓
        Department Spaces      Department Spaces
                ↓                      ↓
          Customer Rooms         Customer Rooms
```

---

## Prerequisites

### Required Software

#### 1. **Node.js 18+**
```bash
# Check version
node --version  # Should be v18.0.0 or higher
npm --version   # Should be v9.0.0 or higher

# Install on macOS
brew install node

# Install on Ubuntu/Debian
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs
```

#### 2. **Docker & Docker Compose**
```bash
# Check Docker version
docker --version        # Should be 20.10.0 or higher
docker compose version  # Should be v2.0.0 or higher

# Install on macOS
brew install docker docker-compose

# Install on Ubuntu/Debian
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
```

#### 3. **Git**
```bash
# Check version
git --version

# Install on macOS
brew install git

# Install on Ubuntu/Debian
sudo apt-get install git
```

### Optional (for Telegram Bridge)

#### 4. **Python 3.9+** (for mautrix-telegram bridge)
```bash
# Check version
python3 --version

# Install on macOS
brew install python3

# Install on Ubuntu/Debian
sudo apt-get install python3 python3-pip
```

### System Requirements

- **RAM**: Minimum 2GB, recommended 4GB+
- **Disk Space**: 5GB free space (for Docker images and data)
- **Network**: Ports 3001 (widget server), 8008 (Synapse), 8080 (admin), 8081 (Element)

---

## Quick Start

**For impatient users - get running in 5 minutes:**

```bash
# 1. Clone repository
git clone <repository-url> matrix-chat-support
cd matrix-chat-support

# 2. Install dependencies
npm install

# 3. Setup Docker environment (Matrix/Synapse)
chmod +x scripts/docker-setup.sh
./scripts/docker-setup.sh

# 4. Build widget
npm run build:widget

# 5. Start widget server
npm run serve

# 6. (Optional) Start Telegram bot
cd scripts
node telegram-department-router.js
```

**Access points:**
- Widget Server: http://localhost:3001
- Synapse: http://localhost:8008
- Element Web: http://localhost:8081
- Admin Panel: http://localhost:8080

---

## Detailed Installation

### Step 1: Clone Repository

```bash
# Clone the repository
git clone <repository-url> matrix-chat-support
cd matrix-chat-support

# Verify directory structure
ls -la
# Should see: config/, scripts/, src/, server/, docker-compose.yml, etc.
```

### Step 2: Install Node Dependencies

```bash
# Install all npm packages
npm install

# Verify installation
npm list --depth=0
# Should show: axios, cors, express, matrix-js-sdk, node-telegram-bot-api, react, etc.
```

**Key Dependencies:**
- `matrix-js-sdk@38.3.0` - Matrix client library
- `node-telegram-bot-api@0.66.0` - Telegram bot integration
- `express@5.1.0` - Widget server
- `react@19.1.1` - Widget UI framework
- `vite@7.1.7` - Build tool

### Step 3: Setup Docker Environment

The Docker environment provides a complete Matrix/Synapse server with:
- PostgreSQL database
- Synapse homeserver
- Admin panel (Synapse Admin)
- Element web client
- mautrix-telegram bridge

#### Automated Setup (Recommended)

```bash
# Make script executable
chmod +x scripts/docker-setup.sh

# Run automated setup
./scripts/docker-setup.sh
```

**What the script does:**
1. Starts Docker Compose services
2. Waits for Synapse to be ready
3. Creates admin user: `admin` / `admin123`
4. Creates support bot user: `support` / `support123`
5. Obtains access tokens automatically
6. Updates `config/config.yaml` with tokens

**Expected output:**
```
🐳 Matrix Synapse Docker Setup
================================
[INFO] Starting Matrix Synapse services...
[SUCCESS] Services are running!
[SUCCESS] Synapse is ready!
[SUCCESS] Users created!
[SUCCESS] Support bot access token obtained!

=== CONFIGURATION ===
Homeserver: http://localhost:8008
Support Bot Token: syt_c3VwcG9ydA_...
Bot User ID: @support:localhost

=== MATRIX SYNAPSE SETUP COMPLETE ===
```

#### Manual Setup (Alternative)

```bash
# Start services
docker compose up -d

# Wait for services (30-60 seconds)
docker compose ps

# Check Synapse health
curl http://localhost:8008/health
# Should return: {"status": "OK"}

# Create admin user manually
docker exec -it matrix-synapse register_new_matrix_user \
  -c /data/homeserver.yaml \
  -u admin \
  -p admin123 \
  --admin \
  http://localhost:8008

# Create support bot user
docker exec -it matrix-synapse register_new_matrix_user \
  -c /data/homeserver.yaml \
  -u support \
  -p support123 \
  http://localhost:8008

# Get access token
curl -X POST http://localhost:8008/_matrix/client/r0/login \
  -H 'Content-Type: application/json' \
  -d '{"type":"m.login.password","user":"support","password":"support123"}'
# Copy the "access_token" from response
```

### Step 4: Verify Docker Services

```bash
# Check all services are running
docker compose ps

# Should show:
# NAME                  STATUS              PORTS
# matrix-synapse        Up                  0.0.0.0:8008->8008/tcp
# postgres              Up                  5432/tcp
# synapse-admin         Up                  0.0.0.0:8080->80/tcp
# element               Up                  0.0.0.0:8081->80/tcp
# mautrix-telegram      Up                  29317/tcp

# View logs (if needed)
docker compose logs -f synapse
docker compose logs -f mautrix-telegram
```

**Test Matrix Server:**
```bash
# Test homeserver
curl http://localhost:8008/_matrix/client/versions
# Should return supported Matrix versions

# Test authentication
curl -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  http://localhost:8008/_matrix/client/r0/account/whoami
# Should return: {"user_id":"@support:localhost"}
```

---

## Matrix/Synapse Configuration

### Understanding the Configuration

The system uses `config/config.yaml` as the central configuration file.

**Configuration structure:**
```yaml
departments:          # Multi-department setup
  - id: "support"     # Department identifier
    name: "General Support"
    matrix:           # Matrix config per department
      homeserver: "http://localhost:8008"
      access_token: "syt_..."  # Bot access token
      bot_user_id: "@support:localhost"
    widget:           # Widget appearance per department
      greeting: "Hi! How can we help?"

widget:               # Global widget settings
  title: "Customer Support"
  brand_color: "#667eea"

social_media:         # Telegram integration
  - id: "telegram_support"
    platform: "telegram"
    config:
      bot_token: "TELEGRAM_BOT_TOKEN"
```

### Creating Additional Department Users

For multi-department setup, create separate Matrix users:

```bash
# Create tech support user
docker exec -it matrix-synapse register_new_matrix_user \
  -c /data/homeserver.yaml \
  -u tech_support \
  -p tech_support123 \
  http://localhost:8008

# Create identification user
docker exec -it matrix-synapse register_new_matrix_user \
  -c /data/homeserver.yaml \
  -u identification \
  -p identification123 \
  http://localhost:8008

# Create commerce user
docker exec -it matrix-synapse register_new_matrix_user \
  -c /data/homeserver.yaml \
  -u commerce \
  -p commerce123 \
  http://localhost:8008
```

### Getting Access Tokens for Each Department

**Method 1: Via API**
```bash
# Tech support token
curl -X POST http://localhost:8008/_matrix/client/r0/login \
  -H 'Content-Type: application/json' \
  -d '{"type":"m.login.password","user":"tech_support","password":"tech_support123"}' \
  | grep -o '"access_token":"[^"]*"'

# Identification token
curl -X POST http://localhost:8008/_matrix/client/r0/login \
  -H 'Content-Type: application/json' \
  -d '{"type":"m.login.password","user":"identification","password":"identification123"}' \
  | grep -o '"access_token":"[^"]*"'

# Commerce token
curl -X POST http://localhost:8008/_matrix/client/r0/login \
  -H 'Content-Type: application/json' \
  -d '{"type":"m.login.password","user":"commerce","password":"commerce123"}' \
  | grep -o '"access_token":"[^"]*"'
```

**Method 2: Via Element Web**
1. Open http://localhost:8081
2. Sign in with user credentials
3. Click user avatar → All Settings → Help & About
4. Scroll to bottom → Click "Access Token"
5. Copy the token (keep it secure!)

### Updating config.yaml with Tokens

Edit `config/config.yaml` and update each department:

```yaml
departments:
  - id: "support"
    matrix:
      access_token: "syt_c3VwcG9ydA_WuQVgMMyWokphzuvinDp_3qbzPn"  # From support user
      bot_user_id: "@support:localhost"

  - id: "tech_support"
    matrix:
      access_token: "syt_dGVjaF9zdXBwb3J0_oxoDhiLmLaVQbuQeSOzb_4FaQ5b"  # From tech_support user
      bot_user_id: "@tech_support:localhost"

  - id: "identification"
    matrix:
      access_token: "syt_aWRlbnRpZmljYXRpb24_eJHwCqgZbYIKjOEvVLQR_1z3PGG"  # From identification user
      bot_user_id: "@identification:localhost"

  - id: "commerce"
    matrix:
      access_token: "syt_Y29tbWVyY2U_EwSCqQwYadpeXlDCkXAn_4VqJa8"  # From commerce user
      bot_user_id: "@commerce:localhost"
```

---

## Widget Configuration

### Basic Widget Settings

Edit `config/config.yaml` to customize the widget appearance:

```yaml
widget:
  # Main widget title
  title: "Customer Support"

  # Subtitle shown in header
  subtitle: "We're here to help!"

  # Brand color (used for buttons, headers)
  brand_color: "#667eea"

  # Widget position on page
  position: "bottom-right"  # Options: bottom-right, bottom-left, top-right, top-left

  # Department selection screen
  department_selection:
    title: "How can we help you today?"
    subtitle: "Choose the team that best matches your needs"
    show_descriptions: true  # Show department descriptions
    layout: "grid"          # Options: grid, list
```

### Department Configuration

Each department can have custom settings:

```yaml
departments:
  - id: "support"
    name: "General Support"                    # Display name
    description: "Technical help and general inquiries"  # Description text
    icon: "🎧"                                 # Emoji icon
    color: "#667eea"                           # Department color

    widget:
      greeting: "Hi! How can our support team help you today?"
      placeholder_text: "Describe your technical issue or question..."
```

### Space Configuration (Advanced)

Control how Matrix spaces are organized:

```yaml
departments:
  - id: "support"
    matrix:
      spaceConfig:
        channelId: "web-chat"                  # Channel identifier
        autoCreateDepartmentSpace: true        # Auto-create spaces
        departmentSpaceNaming: "Web-Chat - General Support"  # Space name pattern
```

---

## Telegram Integration Setup

### Prerequisites

1. **Telegram Account**: You need a Telegram account
2. **BotFather**: Access to @BotFather on Telegram
3. **Telegram API Credentials**: API ID and API Hash from https://my.telegram.org

### Step 1: Create Telegram Bot

#### Create Bot via BotFather

1. Open Telegram and search for **@BotFather**
2. Send `/newbot` command
3. Follow prompts:
   - Bot name: `Your Support Bot`
   - Bot username: `YourSupportBot` (must end with 'bot')
4. **Save the bot token**: `1234567890:ABCdefGHIjklMNOpqrsTUVwxyz`

#### Configure Bot Settings

```bash
# Send to @BotFather:
/setdescription @YourSupportBot
# Enter: "Customer support bot - Get help from our team"

/setabouttext @YourSupportBot
# Enter: "24/7 customer support"

/setuserpic @YourSupportBot
# Upload a profile picture
```

### Step 2: Get Telegram API Credentials

1. Visit https://my.telegram.org/auth
2. Log in with your phone number
3. Go to **API Development Tools**
4. Create new application:
   - App title: `Matrix Chat Support`
   - Short name: `matrix-support`
   - Platform: `Other`
5. **Save these values:**
   - `api_id`: e.g., `22451908`
   - `api_hash`: e.g., `40f6de1fd19af98c0b60c364a30d5fa9`

### Step 3: Configure mautrix-telegram Bridge

Edit `mautrix-telegram/config.yaml`:

```yaml
telegram:
  # YOUR API credentials from my.telegram.org
  api_id: 22451908
  api_hash: 40f6de1fd19af98c0b60c364a30d5fa9

  # Your bot token from @BotFather
  bot_token: "1234567890:ABCdefGHIjklMNOpqrsTUVwxyz"

permissions:
  '*': relaybot                    # All users can use relaybot
  '@support:localhost': puppeting  # Support can use puppeting

relaybot:
  private_chat:
    invite: ['@support:localhost']  # Auto-invite support to chats
    state_changes: true
    message: "Welcome! A team member will assist you shortly."
  authless_portals: true
  ignore_own_incoming_events: false  # IMPORTANT: Process bot messages
```

**Key settings explained:**
- `api_id`, `api_hash`: Your Telegram app credentials
- `bot_token`: Your bot's token from BotFather
- `permissions`: Who can use the bridge
- `relaybot.private_chat.invite`: Auto-invite support users to new chats
- `ignore_own_incoming_events: false`: Required for bot message processing

### Step 4: Update config.yaml with Telegram Settings

Edit `config/config.yaml`:

```yaml
social_media:
  - id: "telegram_support"
    name: "Telegram Bot"
    platform: "telegram"
    icon: "✈️"
    color: "#0088cc"
    enabled: true
    config:
      # Your bot username (without @)
      bot_username: "YourSupportBot"

      # Your bot token from @BotFather
      bot_token: "1234567890:ABCdefGHIjklMNOpqrsTUVwxyz"

      # Welcome message
      welcome_message: "Welcome! Please select the department you need help with."

      # Department commands
      departments:
        - department_id: "support"
          command: "/start_support"
          channel_specific: true
        - department_id: "tech_support"
          command: "/start_tech"
          channel_specific: true
        - department_id: "identification"
          command: "/start_id"
          channel_specific: true
        - department_id: "commerce"
          command: "/start_commerce"
          channel_specific: true

communication_channels:
  - type: "social"
    id: "telegram_channel"
    name: "Telegram"
    description: "Continue the conversation on Telegram"
    icon: "✈️"
    color: "#0088cc"
    available: true
    social_media_id: "telegram_support"  # Links to social_media config above
```

### Step 5: Restart Bridge

```bash
# Restart mautrix-telegram bridge with new config
docker compose restart mautrix-telegram

# View logs to verify
docker compose logs -f mautrix-telegram

# Should see:
# "Bridge started"
# "Connected to Telegram"
```

### Step 6: Authenticate Support User with Telegram

The support user needs to log in to Telegram via the bridge:

```bash
# Find the bridge management room
# Option 1: Via Element Web (http://localhost:8081)
# - Log in as support user
# - Look for room with bridge bot
# - Room name will be like "Telegram bridge bot"

# Option 2: Via API
curl -H "Authorization: Bearer YOUR_SUPPORT_TOKEN" \
  http://localhost:8008/_matrix/client/v3/joined_rooms
# Look for room ID starting with !
```

**In Element Web (as support user):**
1. Find the bridge management room (with bridge bot)
2. Send command: `login`
3. Enter your phone number: `+1234567890`
4. Enter SMS verification code
5. Success! Support user is now logged into Telegram

---

## Building the Widget

### Build Process

The widget is built using Vite and outputs an IIFE bundle.

```bash
# Build widget for production
npm run build:widget

# Output:
# dist/widget/
#   ├── matrix-chat-widget.iife.js  (8.7 MB, ~3 MB gzipped)
#   └── style.css                    (27.6 KB)
```

**Build configuration** (`vite.config.ts`):
```typescript
build: {
  lib: {
    entry: 'src/widget.tsx',
    name: 'MatrixChatWidget',
    fileName: 'matrix-chat-widget',
    formats: ['iife']  // Self-contained bundle
  },
  outDir: 'dist/widget'
}
```

### Verify Build

```bash
# Check build output
ls -lh dist/widget/

# Should show:
# matrix-chat-widget.iife.js  (~8.7M)
# style.css                   (~28K)

# Test widget loads
curl http://localhost:3001/widget/matrix-chat-widget.iife.js
# Should return JavaScript code
```

### Development Mode (Optional)

For active development with hot reload:

```bash
# Start Vite dev server
npm run dev

# Opens on http://localhost:3000
# Changes auto-reload in browser
```

---

## Running the Server

### Start Widget Server

The Express server serves the widget, configuration API, and embed script.

```bash
# Start server
npm run serve

# Alternative:
node server/index.js

# Expected output:
Configuration loaded successfully
Serving widget assets from /path/to/dist/widget
Serving public files from /path/to/public
Matrix Chat Support server running on port 3001
Widget embed URL: http://localhost:3001/embed.js
Health check: http://localhost:3001/health

🏢 Multi-department mode detected
✅ Configuration is valid
Widget is ready to use!
```

**Server endpoints:**
- `/` - Server info
- `/api/config` - Widget configuration (JSON)
- `/health` - Health check
- `/embed.js` - Embed script (loads widget)
- `/widget/*` - Static widget assets
- `/*` - Public files (test pages)

### Verify Server

```bash
# Test health endpoint
curl http://localhost:3001/health
# Response: {"status":"ok","timestamp":"...","version":"1.0.0"}

# Test configuration endpoint
curl http://localhost:3001/api/config | jq
# Should return complete widget configuration

# Test embed script
curl http://localhost:3001/embed.js
# Should return JavaScript loader code
```

### Start Telegram Bot (Optional)

If using Telegram integration:

```bash
# In a separate terminal
cd scripts
node telegram-department-router.js

# Expected output:
📂 Loaded 0 chat-room mappings from storage
🔧 Creating/ensuring Telegram spaces exist...
✅ Main Telegram space exists: !TQZiGikKYnVKosNwoN:localhost
✅ Telegram department spaces created/verified
🤖 Telegram department router started!
🔗 Matrix homeserver: http://localhost:8008
✈️ Telegram bot: @YourSupportBot
📋 Available commands:
   /start_support - General Support
   /start_tech - Tech Support
   /start_id - Account Verification
   /start_commerce - Sales & Commerce
✅ Bot ready to receive messages!
```

### Process Management (Production)

Use PM2 for production deployment:

```bash
# Install PM2 globally
npm install -g pm2

# Start widget server
pm2 start server/index.js --name matrix-chat-widget

# Start Telegram bot
pm2 start scripts/telegram-department-router.js --name telegram-router

# Save process list
pm2 save

# Setup auto-restart on system boot
pm2 startup
# Follow the instructions shown

# View logs
pm2 logs matrix-chat-widget
pm2 logs telegram-router

# Monitor processes
pm2 monit
```

---

## Testing

### Test Matrix Server

```bash
# Health check
curl http://localhost:8008/health
# Response: {"status":"OK"}

# Test authentication
curl -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:8008/_matrix/client/r0/account/whoami
# Response: {"user_id":"@support:localhost"}

# Test room creation
curl -X POST -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  http://localhost:8008/_matrix/client/v3/createRoom \
  -d '{"name":"Test Room","preset":"private_chat"}'
# Response: {"room_id":"!abc123:localhost"}
```

### Test Widget Server

```bash
# Health check
curl http://localhost:3001/health

# Configuration endpoint
curl http://localhost:3001/api/config

# Widget asset
curl -I http://localhost:3001/widget/matrix-chat-widget.iife.js
# Should return: 200 OK

# Embed script
curl http://localhost:3001/embed.js
```

### Test Widget in Browser

#### Using Test Page

Open the built-in test page:

```bash
# Open in browser
open http://localhost:3001/widget/widget-test.html

# Or manually:
# 1. Navigate to http://localhost:3001/widget/widget-test.html
# 2. Click chat button (bottom-right)
# 3. Select department
# 4. Choose "Web Chat" or "Telegram"
# 5. Fill in contact form
# 6. Start chatting
```

#### Embedding in Your Own Page

Create a test HTML file:

```html
<!DOCTYPE html>
<html>
<head>
  <title>Widget Test</title>
</head>
<body>
  <h1>Test Page</h1>

  <!-- Widget loads here -->
  <script src="http://localhost:3001/embed.js"></script>
</body>
</html>
```

### Test Telegram Bot

1. **Open Telegram** on your phone or desktop
2. **Search for your bot**: `@YourSupportBot`
3. **Send any message** to the bot
4. **Bot should respond** with department selection
5. **Send a department command**: `/start_support`
6. **Verify in Element**:
   - Open http://localhost:8081
   - Log in as `@support:localhost` / `support123`
   - Look for new room in "Telegram - General Support" space
   - Send a message in Matrix
   - Verify it appears in Telegram

### Test Department Routing

#### Web Widget Test:
1. Open test page: http://localhost:3001/widget/widget-test.html
2. Click chat button
3. Select "Tech Support" department
4. Choose "Web Chat"
5. Fill form and send message
6. **Verify in Element**:
   - Log in as `@tech_support:localhost`
   - Find room in "Web-Chat - Tech Support" space
   - Respond to customer

#### Telegram Test:
1. Message bot: `@YourSupportBot`
2. Send `/start_tech` command
3. Send a test message
4. **Verify in Element**:
   - Log in as `@tech_support:localhost`
   - Find room in "Telegram - Tech Support" space
   - Respond to customer
5. Verify response appears in Telegram

---

## Production Deployment

### Prerequisites

- **Domain name** with DNS configured
- **SSL certificate** (Let's Encrypt recommended)
- **Web server** (Nginx or Apache)
- **Server** with minimum 2GB RAM, 20GB disk

### Architecture Options

#### Option 1: Single Server (Recommended for Small-Medium)

```
Internet → Nginx (SSL, reverse proxy) → Widget Server (3001)
                                      → Synapse (8008)
                                      → Telegram Bot
```

#### Option 2: Multi-Server (Enterprise)

```
Internet → Load Balancer → Multiple Widget Servers
                        → Dedicated Synapse Server
                        → Dedicated Telegram Bot Server
```

### Nginx Configuration

#### Install Nginx

```bash
# Ubuntu/Debian
sudo apt-get update
sudo apt-get install nginx

# macOS
brew install nginx
```

#### Configure SSL with Let's Encrypt

```bash
# Install certbot
sudo apt-get install certbot python3-certbot-nginx

# Get SSL certificate
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com

# Auto-renewal
sudo certbot renew --dry-run
```

#### Nginx Site Configuration

Create `/etc/nginx/sites-available/matrix-chat-widget`:

```nginx
# HTTP to HTTPS redirect
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;
    return 301 https://$server_name$request_uri;
}

# HTTPS server
server {
    listen 443 ssl http2;
    server_name yourdomain.com www.yourdomain.com;

    # SSL certificates (from Let's Encrypt)
    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;

    # SSL settings
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    # Security headers
    add_header Strict-Transport-Security "max-age=31536000" always;
    add_header X-Frame-Options SAMEORIGIN;
    add_header X-Content-Type-Options nosniff;
    add_header X-XSS-Protection "1; mode=block";

    # Widget server proxy
    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Matrix Synapse proxy (optional - for external access)
    location /_matrix {
        proxy_pass http://localhost:8008;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Caching for static assets
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
        proxy_pass http://localhost:3001;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

#### Enable Site

```bash
# Create symlink
sudo ln -s /etc/nginx/sites-available/matrix-chat-widget /etc/nginx/sites-enabled/

# Test configuration
sudo nginx -t

# Reload Nginx
sudo systemctl reload nginx
```

### Environment Variables (Production)

Create `.env` file (never commit to git):

```bash
# Matrix Configuration
MATRIX_HOMESERVER=https://matrix.yourdomain.com
MATRIX_ACCESS_TOKEN=syt_...your_production_token...
MATRIX_BOT_USER_ID=@support:yourdomain.com

# Telegram Configuration
TELEGRAM_BOT_TOKEN=1234567890:ABCdefGHIjklMNOpqrsTUVwxyz
TELEGRAM_API_ID=22451908
TELEGRAM_API_HASH=40f6de1fd19af98c0b60c364a30d5fa9

# Server Configuration
NODE_ENV=production
PORT=3001

# Security
SESSION_SECRET=your_very_secure_random_string_here
```

Load in production:

```bash
# Export variables
export $(cat .env | xargs)

# Or use dotenv package
npm install dotenv
```

### Systemd Service (Alternative to PM2)

Create `/etc/systemd/system/matrix-chat-widget.service`:

```ini
[Unit]
Description=Matrix Chat Support Widget Server
After=network.target docker.service
Requires=docker.service

[Service]
Type=simple
User=www-data
WorkingDirectory=/var/www/matrix-chat-support
Environment=NODE_ENV=production
EnvironmentFile=/var/www/matrix-chat-support/.env
ExecStart=/usr/bin/node server/index.js
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

Enable and start:

```bash
sudo systemctl daemon-reload
sudo systemctl enable matrix-chat-widget
sudo systemctl start matrix-chat-widget
sudo systemctl status matrix-chat-widget
```

### Docker Production Deployment

Create `docker-compose.prod.yml`:

```yaml
version: '3.8'

services:
  widget-server:
    build: .
    restart: always
    ports:
      - "3001:3001"
    environment:
      - NODE_ENV=production
      - MATRIX_HOMESERVER=${MATRIX_HOMESERVER}
      - MATRIX_ACCESS_TOKEN=${MATRIX_ACCESS_TOKEN}
    volumes:
      - ./config:/app/config:ro
      - ./dist:/app/dist:ro
    networks:
      - app_net
    depends_on:
      - synapse

  synapse:
    image: matrixdotorg/synapse:latest
    restart: always
    ports:
      - "8008:8008"
    volumes:
      - synapse_data:/data
    networks:
      - app_net

networks:
  app_net:

volumes:
  synapse_data:
```

Deploy:

```bash
docker compose -f docker-compose.prod.yml up -d
```

### Monitoring & Logging

#### Log Management

```bash
# PM2 logs
pm2 logs matrix-chat-widget --lines 100

# Docker logs
docker compose logs -f --tail=100 synapse

# Nginx logs
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log
```

#### Health Monitoring

Create monitoring script `scripts/health-check.sh`:

```bash
#!/bin/bash

# Check widget server
if ! curl -f http://localhost:3001/health > /dev/null 2>&1; then
    echo "Widget server is down!"
    # Send alert (email, Slack, etc.)
fi

# Check Matrix server
if ! curl -f http://localhost:8008/health > /dev/null 2>&1; then
    echo "Matrix server is down!"
    # Send alert
fi
```

Add to crontab:

```bash
# Run every 5 minutes
*/5 * * * * /path/to/scripts/health-check.sh
```

### Backup Strategy

#### Configuration Backup

```bash
# Backup config and data
tar -czf backup-$(date +%Y%m%d).tar.gz \
  config/ \
  data/chat-room-mappings.json \
  mautrix-telegram/config.yaml

# Upload to remote storage
# aws s3 cp backup-*.tar.gz s3://your-bucket/
```

#### Database Backup

```bash
# Backup Synapse database
docker exec postgres pg_dump -U synapse_user synapse > synapse-backup-$(date +%Y%m%d).sql

# Backup mautrix-telegram database
docker exec postgres pg_dump -U synapse_user mautrix_telegram > telegram-backup-$(date +%Y%m%d).sql
```

---

## Troubleshooting

### Common Issues

#### Issue: Widget Not Loading

**Symptoms:**
- Chat button doesn't appear
- Console shows CORS errors
- 404 errors for widget assets

**Solutions:**

```bash
# 1. Verify server is running
curl http://localhost:3001/health

# 2. Check widget build exists
ls -la dist/widget/
# Should show matrix-chat-widget.iife.js and style.css

# 3. Rebuild widget
npm run build:widget

# 4. Check browser console for errors
# Open developer tools (F12) and check Console tab

# 5. Verify CORS configuration
curl -I http://localhost:3001/api/config
# Should have: Access-Control-Allow-Origin header
```

#### Issue: Matrix Connection Failed

**Symptoms:**
- "Failed to connect to Matrix" error
- "Invalid access token" error
- Rooms not created

**Solutions:**

```bash
# 1. Verify Synapse is running
docker compose ps synapse
curl http://localhost:8008/health

# 2. Test access token
curl -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:8008/_matrix/client/r0/account/whoami
# Should return user_id

# 3. Check token hasn't expired
# Get new token:
curl -X POST http://localhost:8008/_matrix/client/r0/login \
  -H 'Content-Type: application/json' \
  -d '{"type":"m.login.password","user":"support","password":"support123"}'

# 4. Update config.yaml with new token
nano config/config.yaml
# Replace access_token with new token

# 5. Restart server
pm2 restart matrix-chat-widget
```

#### Issue: Telegram Bot Not Responding

**Symptoms:**
- Bot doesn't reply to messages
- Commands don't work
- No rooms created in Matrix

**Solutions:**

```bash
# 1. Verify bot is running
ps aux | grep telegram-department-router
# Or: pm2 list

# 2. Check bot token is correct
# Test with Telegram API:
curl "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getMe"
# Should return bot information

# 3. Verify bridge is running
docker compose ps mautrix-telegram
docker compose logs mautrix-telegram

# 4. Check bot configuration
cat config/config.yaml | grep -A 10 telegram_support

# 5. Restart bot
pm2 restart telegram-router
# Or: node scripts/telegram-department-router.js
```

#### Issue: Messages Not Forwarding (Telegram ↔ Matrix)

**Symptoms:**
- Customer messages in Telegram don't appear in Matrix
- Support replies in Matrix don't reach Telegram

**Solutions:**

```bash
# 1. Check chat-room mappings
cat data/chat-room-mappings.json | jq
# Should show mapping between Telegram chat IDs and Matrix room IDs

# 2. Verify bridge bot is in the room
curl -H "Authorization: Bearer YOUR_TOKEN" \
  "http://localhost:8008/_matrix/client/v3/rooms/!roomid:localhost/joined_members"
# Should include bridge bot user

# 3. Check bridge logs
docker compose logs mautrix-telegram | grep -i error

# 4. Check relaybot configuration
cat mautrix-telegram/config.yaml | grep -A 10 relaybot
# Verify: ignore_own_incoming_events: false

# 5. Restart bridge
docker compose restart mautrix-telegram
```

#### Issue: Spaces Not Created

**Symptoms:**
- Rooms created but not organized in spaces
- Element shows flat room list

**Solutions:**

```bash
# 1. Check admin token is configured
cat config/config.yaml | grep admin_access_token

# 2. Verify admin user has permissions
curl -H "Authorization: Bearer ADMIN_TOKEN" \
  "http://localhost:8008/_matrix/client/v3/rooms/!spaceid:localhost/state/m.room.power_levels"

# 3. Check space creation logs in bot output
# Look for: "Creating/ensuring Telegram spaces exist..."

# 4. Manually trigger space creation
# Restart Telegram bot (it creates spaces on startup)
pm2 restart telegram-router
```

### Debug Mode

Enable verbose logging:

**Server (`server/index.js`):**
```javascript
// Add at top of file
console.log = (...args) => {
  const timestamp = new Date().toISOString()
  process.stdout.write(`[${timestamp}] `)
  process.stdout.write(args.join(' ') + '\n')
}
```

**Telegram Bot (`scripts/telegram-department-router.js`):**
```javascript
// Already has extensive logging
// View with:
pm2 logs telegram-router --lines 100
```

**Docker Logs:**
```bash
# Follow all logs
docker compose logs -f

# Specific service
docker compose logs -f synapse
docker compose logs -f mautrix-telegram
```

### Getting Help

1. **Check Logs First**:
   ```bash
   pm2 logs matrix-chat-widget
   docker compose logs synapse
   docker compose logs mautrix-telegram
   ```

2. **Verify Configuration**:
   ```bash
   # Validate YAML syntax
   python3 -c "import yaml; yaml.safe_load(open('config/config.yaml'))"
   ```

3. **Test Individual Components**:
   - Widget Server: `curl http://localhost:3001/health`
   - Matrix: `curl http://localhost:8008/health`
   - Telegram Bot: Send test message

4. **Community Resources**:
   - Matrix documentation: https://matrix.org/docs
   - mautrix-telegram docs: https://docs.mau.fi/bridges/python/telegram/index.html
   - Synapse docs: https://matrix-org.github.io/synapse/latest/

---

## Advanced Configuration

### Custom Department Fields

Add custom fields to contact form:

```yaml
departments:
  - id: "support"
    widget:
      additional_fields:
        - id: "order_number"
          label: "Order Number"
          type: "text"
          required: false
          placeholder: "e.g., ORD-12345"
        - id: "priority"
          label: "Priority"
          type: "select"
          required: true
          options:
            - value: "low"
              label: "Low"
            - value: "medium"
              label: "Medium"
            - value: "high"
              label: "High - Urgent"
```

### Working Hours Configuration

Configure availability per channel:

```yaml
social_media:
  - id: "telegram_support"
    config:
      working_hours:
        enabled: true
        timezone: "America/New_York"  # Use IANA timezone
        schedule:
          - day: "monday"
            start: "09:00"
            end: "17:00"
            enabled: true
          - day: "tuesday"
            start: "09:00"
            end: "17:00"
            enabled: true
          # ... other days
          - day: "saturday"
            start: "10:00"
            end: "15:00"
            enabled: false  # Closed on weekends
        off_hours_message: "We're currently offline. We'll respond during business hours (9 AM - 5 PM EST, Mon-Fri)."
```

### Multiple Homeservers

Configure different Matrix servers per department:

```yaml
departments:
  - id: "support"
    matrix:
      homeserver: "https://matrix1.yourdomain.com"
      access_token: "token1"

  - id: "enterprise_support"
    matrix:
      homeserver: "https://matrix2.yourdomain.com"  # Different server
      access_token: "token2"
```

### Custom Styling

Override widget styles:

```html
<style>
  /* Target widget button */
  .matrix-chat-widget .chatButton {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%) !important;
    box-shadow: 0 8px 16px rgba(102, 126, 234, 0.4) !important;
  }

  /* Target department cards */
  .matrix-chat-widget .departmentCard {
    border-radius: 16px !important;
  }

  /* Custom animation */
  .matrix-chat-widget .chatButton:hover {
    transform: scale(1.1) !important;
    transition: transform 0.3s ease !important;
  }
</style>
```

### Rate Limiting

Protect against abuse:

```javascript
// In server/index.js, add rate limiting middleware:
import rateLimit from 'express-rate-limit'

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP'
})

app.use('/api/', apiLimiter)
```

### Webhooks

Send notifications on new conversations:

```javascript
// In server/index.js or bot script:
async function notifyNewConversation(customerInfo, department) {
  await axios.post('https://your-webhook-url.com/notify', {
    event: 'new_conversation',
    customer: customerInfo,
    department: department,
    timestamp: new Date().toISOString()
  })
}
```

---

## Summary

You now have a complete Matrix Chat Support Widget installation with:

✅ **Matrix/Synapse server** running in Docker
✅ **Multi-department widget** with customizable UI
✅ **Telegram integration** with bot and bridge
✅ **Matrix Spaces** for organized conversations
✅ **Production-ready** deployment configuration

**Next Steps:**

1. **Customize** widget appearance in `config/config.yaml`
2. **Test** thoroughly with real users
3. **Monitor** logs and performance
4. **Deploy** to production with SSL
5. **Expand** with additional features

**Quick Reference:**

```bash
# Start everything
docker compose up -d              # Matrix/Synapse
npm run build:widget              # Build widget
npm run serve                     # Widget server
node scripts/telegram-department-router.js  # Telegram bot

# Check status
curl http://localhost:3001/health  # Widget server
curl http://localhost:8008/health  # Matrix server

# View logs
pm2 logs matrix-chat-widget
docker compose logs -f synapse

# Stop everything
pm2 stop all
docker compose down
```

For questions or issues, refer to the [Troubleshooting](#troubleshooting) section or check project documentation.

---

**Document Version**: 1.0
**Last Updated**: 2025-09-30
**Tested On**: macOS, Ubuntu 22.04, Docker 24.x, Node 18.x
