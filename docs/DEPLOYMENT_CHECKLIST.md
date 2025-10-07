# Production Deployment Checklist

**Target Server**: Test server
**Domain/IP**: Your server IP address (e.g., 172.20.89.50)
**Date**: October 7, 2025

---

## ✅ Pre-Deployment Verification (COMPLETED)

### Code & Configuration
- [x] Multi-user invitation fix applied to widget (`src/utils/matrix-client.ts`)
- [x] Multi-user invitation fix applied to Telegram router (`scripts/telegram-department-router.js`)
- [x] Observer user support added to both widget and Telegram
- [x] Production deployment script updated (`scripts/production-deploy.sh`)
- [x] Observer user creation added to deployment script
- [x] Config.yaml update script preserves `department_users` arrays
- [x] Python3 and PyYAML dependency checks added
- [x] Existing user handling improved in `production-utils.sh`

### Build Verification
- [x] Widget builds successfully (`npm run build:widget`)
- [x] Widget output: 8.7MB IIFE bundle + 27KB CSS
- [x] No build errors or warnings (except named/default export note)
- [x] MatrixChatWidget global exported correctly

### Script Validation
- [x] No syntax errors in `production-deploy.sh`
- [x] No syntax errors in `lib/production-utils.sh`
- [x] Python YAML update script syntax validated
- [x] All 12 deployment phases implemented

---

## 📋 Server Prerequisites

### On Your Test Server (Ubuntu/Debian)

Install required packages:
```bash
sudo apt update
sudo apt install -y \
  docker.io \
  docker-compose \
  nodejs \
  npm \
  python3 \
  python3-yaml \
  jq \
  curl \
  git \
  tar
```

Check Node.js version (must be 18+):
```bash
node --version  # Should be v18.x or higher
```

If Node.js is too old, install from NodeSource:
```bash
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs
```

---

## 🚀 Deployment Steps

### Step 1: Copy Files to Server

From your **local machine**:

```bash
# Set your server details
SERVER_IP="172.20.89.50"  # Your test server IP
SERVER_USER="your_username"

# Create deployment package
cd /Users/cdl/Projects/matrix-chat-support
tar -czf matrix-chat-deploy.tar.gz \
  config/ \
  server/ \
  scripts/ \
  src/ \
  docker/ \
  dist/ \
  docker-compose.yml \
  package.json \
  package-lock.json \
  vite.config.ts \
  tsconfig.json \
  tsconfig.node.json

# Copy to server
scp matrix-chat-deploy.tar.gz ${SERVER_USER}@${SERVER_IP}:/tmp/

# SSH to server
ssh ${SERVER_USER}@${SERVER_IP}
```

### Step 2: Extract and Prepare

On the **server**:

```bash
# Extract files
cd /tmp
tar -xzf matrix-chat-deploy.tar.gz -C /tmp/matrix-chat-support-temp
cd /tmp/matrix-chat-support-temp

# Make deployment script executable
chmod +x scripts/production-deploy.sh
chmod +x scripts/lib/*.sh
```

### Step 3: Run Deployment

```bash
# Run deployment as root
sudo ./scripts/production-deploy.sh
```

### Step 4: Answer Deployment Prompts

The script will ask you:

**1. Production domain:**
```
Enter production domain: 172.20.89.50
```
*(Use your server IP address)*

**2. Admin password:**
```
Auto-generate secure admin password? (y/n): y
```
*(Recommended: Let it generate a secure password)*

**3. Telegram bot token:**
```
Use existing Telegram bot token (QWMatrixTestBot)? (y/n): y
```
*(Use 'y' to keep your current bot token)*

**4. CORS origins:**
```
Enter CORS origins: http://172.20.89.50:3000,http://172.20.89.50:5173
```
*(Adjust ports as needed for your testing)*

**5. Web server configuration:**
```
Select web server: 3 (Skip)
```
*(For IP-based deployment, skip web server setup)*

**6. Firewall configuration:**
```
Configure UFW firewall? (y/n): n
```
*(Configure manually later if needed)*

---

## 🔍 Post-Deployment Verification

### Step 1: Check Services

```bash
# Check all services
sudo systemctl status matrix-chat-widget
sudo systemctl status matrix-chat-telegram

# Check Docker containers
cd /opt/matrix-chat-support
docker compose ps

# Expected output:
# NAME                                  STATUS
# matrix-synapse                        Up (healthy)
# postgres                              Up
# matrix-chat-support-element-1         Up
# matrix-chat-support-synapse-admin-1   Up
```

### Step 2: Verify Users Created

```bash
# Check credentials file
sudo cat /opt/matrix-chat-support/data/user-credentials.txt

# Should show:
# ADMIN (1 user)
# SUPPORT (3 users)
# COMMERCE (4 users)
# IDENTIFICATION (2 users)
# OBSERVER (1 user)
# Total: 11 users
```

### Step 3: Verify Configuration

```bash
# Check department_users preserved
grep -A 5 "department_users:" /opt/matrix-chat-support/config/config.yaml

# Should show arrays like:
# department_users:
#   - "@support_agent1:172.20.89.50"
#   - "@support_agent2:172.20.89.50"
#   - "@support_agent3:172.20.89.50"

# Check observer configured
grep -A 7 "observer:" /opt/matrix-chat-support/config/config.yaml

# Should show:
# observer:
#   enabled: true
#   user_id: "@observer:172.20.89.50"
#   access_token: "syt_..."
#   auto_invite: true
```

### Step 4: Test Widget

```bash
# Test widget server health
curl http://localhost:3001/health

# Expected: {"status":"ok"}

# Test embed script
curl -I http://localhost:3001/embed.js

# Expected: HTTP/1.1 200 OK

# Test config endpoint
curl http://localhost:3001/api/config | jq '.departments | length'

# Expected: 3 (number of departments)
```

### Step 5: Test Matrix Connectivity

```bash
# Get admin token from credentials
ADMIN_TOKEN=$(grep "Token:" /opt/matrix-chat-support/data/user-credentials.txt | head -1 | awk '{print $NF}')

# Test Matrix API
curl -H "Authorization: Bearer $ADMIN_TOKEN" \
  "http://localhost:8008/_matrix/client/r0/account/whoami"

# Expected: {"user_id":"@admin:172.20.89.50"}

# List all users
curl -H "Authorization: Bearer $ADMIN_TOKEN" \
  "http://localhost:8008/_synapse/admin/v2/users?from=0&limit=20" | \
  jq '.users[] | .name'

# Expected: 11 users (@admin, @support_agent1-3, @commerce_agent1-4, @identify_agent1-2, @observer)
```

---

## 🧪 Functional Testing

### Test 1: Widget - Multi-User Invitation (Commerce Department)

**Create test HTML file** on server:

```bash
cat > /tmp/widget-test.html << 'EOF'
<!DOCTYPE html>
<html>
<head><title>Widget Test</title></head>
<body>
  <h1>Widget Test Page</h1>
  <script src="http://172.20.89.50:3001/embed.js"></script>
</body>
</html>
EOF

# Serve test page
cd /tmp && python3 -m http.server 8000
```

**Test from your browser:**
1. Open `http://172.20.89.50:8000/widget-test.html`
2. Click chat button
3. Select "Commerce Support"
4. Fill form and send message
5. Login to Element as **commerce_agent1** (`http://172.20.89.50:8081`)
6. Login to Element as **commerce_agent2** (incognito window)
7. Login to Element as **commerce_agent3** (another browser)
8. Login to Element as **commerce_agent4** (another browser)

**Expected Result:**
- ✅ ALL 4 commerce agents see the conversation
- ✅ Conversation appears in "Web-Chat - Commerce Support" space
- ✅ Observer also sees conversation (read-only)

### Test 2: Telegram - Multi-User Invitation (Support Department)

**Send Telegram message:**
1. Open Telegram
2. Search for `@QWMatrixTestBot`
3. Send: `/start_support`
4. Send test message: "Testing multi-user support"

**Verify in Element:**
1. Login as **support_agent1** (`http://172.20.89.50:8081`)
2. Login as **support_agent2** (different browser)
3. Login as **support_agent3** (different browser)

**Expected Result:**
- ✅ ALL 3 support agents see the conversation
- ✅ Conversation appears in "Telegram - General Support" space
- ✅ Observer also sees conversation (read-only)

### Test 3: Observer Read-Only Access

**Login as observer:**
1. Open `http://172.20.89.50:8081`
2. Login:
   - Username: `observer`
   - Password: `observer123`

**Verify:**
1. Observer sees spaces:
   - Web-Chat - General Support
   - Web-Chat - Commerce Support
   - Web-Chat - Account Verification
   - Telegram - General Support
   - Telegram - Commerce Support
   - Telegram - Account Verification

2. Click on conversation from Test 1 or Test 2
3. Try to send message

**Expected Result:**
- ✅ Observer can READ all messages
- ✅ Observer CANNOT send messages (error: "You do not have permission to post in this room")

---

## 📊 Service Management

### Start/Stop All Services

```bash
# Start all
sudo systemctl start matrix-chat.target

# Stop all
sudo systemctl stop matrix-chat.target

# Restart all
sudo systemctl restart matrix-chat.target
```

### Individual Services

```bash
# Widget server
sudo systemctl start matrix-chat-widget
sudo systemctl stop matrix-chat-widget
sudo systemctl restart matrix-chat-widget
sudo systemctl status matrix-chat-widget

# Telegram router
sudo systemctl start matrix-chat-telegram
sudo systemctl stop matrix-chat-telegram
sudo systemctl restart matrix-chat-telegram
sudo systemctl status matrix-chat-telegram

# Docker services
cd /opt/matrix-chat-support
docker compose start
docker compose stop
docker compose restart
```

### View Logs

```bash
# Widget server logs
sudo journalctl -u matrix-chat-widget -f

# Telegram router logs
sudo journalctl -u matrix-chat-telegram -f

# Synapse logs
cd /opt/matrix-chat-support
docker compose logs synapse -f

# All services
sudo journalctl -u "matrix-chat-*" -f
```

---

## ⚠️ Troubleshooting

### Issue: Deployment fails with "PyYAML is not installed"

**Fix:**
```bash
sudo apt update
sudo apt install -y python3-yaml
```

### Issue: Widget not loading

**Check:**
```bash
# Service status
sudo systemctl status matrix-chat-widget

# Check logs
sudo journalctl -u matrix-chat-widget -n 50

# Test manually
cd /opt/matrix-chat-support
node server/index.js
```

### Issue: Only first user receiving messages

**Verify config:**
```bash
# Check department_users arrays
grep -A 5 "department_users:" /opt/matrix-chat-support/config/config.yaml

# Should NOT be empty!
# If missing, config.yaml wasn't updated properly
```

**Fix:**
```bash
# Re-run just the config update
cd /opt/matrix-chat-support
# Manually edit config.yaml to add department_users arrays
sudo systemctl restart matrix-chat-widget
sudo systemctl restart matrix-chat-telegram
```

### Issue: Observer can send messages

**Fix room power levels:**
```bash
# Get admin token
ADMIN_TOKEN=$(sudo grep "Token:" /opt/matrix-chat-support/data/user-credentials.txt | head -1 | awk '{print $NF}')

# Get room ID from Element (Room Settings → Advanced)
ROOM_ID="!xyz:172.20.89.50"

# Get current power levels
curl -H "Authorization: Bearer $ADMIN_TOKEN" \
  "http://localhost:8008/_matrix/client/v3/rooms/${ROOM_ID}/state/m.room.power_levels/" > power_levels.json

# Edit power_levels.json to set observer to 0 and events_default to 50
sudo nano power_levels.json

# Upload fixed power levels
curl -X PUT \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  "http://localhost:8008/_matrix/client/v3/rooms/${ROOM_ID}/state/m.room.power_levels/" \
  -d @power_levels.json
```

---

## 📝 Important Files

### Credentials
```
/opt/matrix-chat-support/data/user-credentials.txt
```
**BACKUP THIS FILE!** Contains all user passwords and access tokens.

### Configuration
```
/opt/matrix-chat-support/config/config.yaml
```
Main configuration file with department settings.

### Logs
```
/var/log/journal/  (systemd logs via journalctl)
/opt/matrix-chat-support/logs/  (application logs)
```

### Service Files
```
/etc/systemd/system/matrix-chat-widget.service
/etc/systemd/system/matrix-chat-telegram.service
/etc/systemd/system/matrix-chat-docker.service
```

---

## ✅ Deployment Success Criteria

Check ALL items before considering deployment successful:

- [ ] All 11 users created (@admin + 9 dept + @observer)
- [ ] Widget server responding on port 3001
- [ ] Telegram router running without errors
- [ ] Docker containers (synapse, postgres, element) healthy
- [ ] Config.yaml has correct IP/domain in all fields
- [ ] Config.yaml preserves all `department_users` arrays
- [ ] Observer configured with access token
- [ ] Widget test: All commerce agents (4) see test conversation
- [ ] Telegram test: All support agents (3) see test conversation
- [ ] Observer can READ but NOT send messages
- [ ] All conversations organized in proper spaces
- [ ] Systemd services auto-start on boot

---

## 🎉 Next Steps After Successful Deployment

1. **Document credentials** - Save `/opt/matrix-chat-support/data/user-credentials.txt` to secure location
2. **Train support team** - Provide Element access to all department users
3. **Test all departments** - Verify support, commerce, and identification routing
4. **Monitor logs** - Watch for errors during first few days
5. **Setup backups** - Create backup schedule for config and data
6. **Performance tuning** - Adjust resources based on usage

---

## 📞 Support

If deployment fails or tests don't pass:

1. Check service logs: `sudo journalctl -u matrix-chat-* -n 100`
2. Review deployment summary: `/opt/matrix-chat-support/DEPLOYMENT_SUMMARY.md`
3. Check this document: `/opt/matrix-chat-support/docs/PRODUCTION_DEPLOY_VERIFICATION.md`

**Deployment script is ready!** 🚀
