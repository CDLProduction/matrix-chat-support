# Troubleshooting Guide - Matrix Chat Support Widget

## Quick Reference

| Issue | Common Cause | Quick Fix |
|-------|-------------|-----------|
| Widget not loading | Server not running | `npm run serve` |
| Only 1 user invited | Widget not rebuilt | `npm run build:widget` |
| Telegram not bridging | Users not authenticated | Each user: login via bridge bot |
| Docker won't start | Port conflicts | Check ports 8008, 8080, 8081, 5432, 29317 |
| Installation fails | Missing dependencies | Check Node.js 18+, Docker, jq, curl |
| Bridge errors | Wrong permissions | Change to `puppeting` in bridge config |

## Installation Issues

### Installation Script Won't Start

**Symptom:**
```bash
./install.sh
-bash: ./install.sh: Permission denied
```

**Solution:**
```bash
chmod +x scripts/install.sh
chmod +x scripts/lib/*.sh
./install.sh
```

---

### Prerequisites Check Fails

**Symptom:**
```
❌ Docker not found
❌ Node.js version too old (found v16.x.x, need 18+)
```

**Solution:**
```bash
# Install/Update Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Install/Update Node.js (using nvm)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
nvm install 18
nvm use 18

# Install jq
# macOS:
brew install jq
# Linux:
sudo apt-get install jq
```

---

### Installation Fails During User Creation

**Symptom:**
```
❌ Failed to create user support_agent1
Error: M_FORBIDDEN: User ID already exists
```

**Cause:** Users already exist from previous installation

**Solution 1:** Continue installation (script will skip existing users)
```bash
# Press 'y' to continue when prompted
# Existing users will be reused
```

**Solution 2:** Clean slate installation
```bash
docker compose down -v  # CAUTION: Deletes all data
rm -f data/install-session.json
./install.sh
```

---

### Cannot Obtain Access Tokens

**Symptom:**
```
❌ Failed to login as support_agent1: Invalid username or password
```

**Cause:** User creation failed or wrong password

**Solution:**
```bash
# Check if user exists in Synapse Admin
open http://localhost:8080

# Login with admin credentials
# Navigate to Users section
# Find user, reset password if needed

# Manually obtain token
curl -X POST http://localhost:8008/_matrix/client/r0/login \
  -H "Content-Type: application/json" \
  -d '{
    "type": "m.login.password",
    "user": "support_agent1",
    "password": "correct_password"
  }' | jq -r '.access_token'

# Add token to data/install-session.json manually
```

---

### PostgreSQL Won't Start

**Symptom:**
```
ERROR: port is already allocated
Error response from daemon: Ports are not available: exposing port TCP 0.0.0.0:5432 -> 0.0.0.0:0: listen tcp 0.0.0.0:5432: bind: address already in use
```

**Cause:** Port 5432 already in use by another PostgreSQL instance

**Solution:**
```bash
# Option 1: Stop local PostgreSQL
sudo systemctl stop postgresql  # Linux
brew services stop postgresql   # macOS

# Option 2: Change PostgreSQL port in docker-compose.yml
# Edit: "5432:5432" to "5433:5432"
# Update install script to use port 5433

# Option 3: Use local PostgreSQL during installation
# Choose "local" option when installer asks
```

---

## Docker Issues

### Docker Services Not Starting

**Symptom:**
```bash
docker compose up -d
ERROR: service 'synapse' failed to build
```

**Solution:**
```bash
# Check Docker daemon is running
docker info

# Pull images manually
docker compose pull

# Check disk space
df -h

# Clean Docker cache if low on space
docker system prune -a

# Restart Docker daemon
sudo systemctl restart docker  # Linux
# Or restart Docker Desktop on macOS/Windows
```

---

### Port Conflicts

**Symptom:**
```
ERROR: for synapse  Cannot start service synapse: driver failed programming external connectivity on endpoint matrix-synapse
Bind for 0.0.0.0:8008 failed: port is already allocated
```

**Solution:**
```bash
# Find what's using the port
sudo lsof -i :8008  # Linux/macOS
netstat -ano | findstr :8008  # Windows

# Kill process or change port
# Edit docker-compose.yml to use different ports:
ports:
  - "8009:8008"  # Changed from 8008:8008
```

---

### Container Health Check Failing

**Symptom:**
```bash
docker compose ps
NAME                 STATUS
synapse             Up (unhealthy)
```

**Solution:**
```bash
# Check logs
docker compose logs synapse

# Common issues:
# 1. Database connection failed
docker compose logs postgres

# 2. Configuration error
docker exec matrix-synapse cat /data/homeserver.yaml

# 3. Permissions issue
docker exec matrix-synapse ls -la /data

# Restart service
docker compose restart synapse

# If still failing, recreate
docker compose down
docker compose up -d
```

---

## Widget Issues

### Widget Not Loading on Website

**Symptom:** Widget script loaded but nothing appears

**Solution:**
```bash
# Check server is running
curl http://localhost:3001/health

# Check embed script loads
curl http://localhost:3001/embed.js | head -20

# Check browser console for errors
# Open DevTools (F12) and check Console tab

# Common issues:
# 1. CORS error - check server CORS configuration
# 2. JavaScript error - check build was successful
# 3. CSS not loading - check style.css exists

# Rebuild widget
npm run build:widget

# Restart server
npm run serve
```

---

### Only One User Invited to Rooms

**Symptom:** Widget creates rooms but only invites one department user

**Cause:** Widget not rebuilt after code changes

**Solution:**
```bash
# Rebuild widget with latest changes
npm run build:widget

# Verify build includes new code
grep -r "departmentUsers" dist/widget/

# Restart widget server
# Stop (Ctrl+C) and restart:
npm run serve

# Test again
open http://localhost:3001/widget/widget-test.html
```

---

### Widget Shows "Connection Failed"

**Symptom:** Error message in widget: "Failed to connect to support"

**Cause:** Matrix server unreachable or wrong configuration

**Solution:**
```bash
# Check Matrix server is running
curl http://localhost:8008/health

# Check configuration
cat config/config.yaml | grep -A 5 "homeserver"

# Verify access token
curl -H "Authorization: Bearer syt_YOUR_TOKEN" \
  http://localhost:8008/_matrix/client/r0/account/whoami

# Check browser console for specific error
# Open DevTools (F12) → Console tab

# Common errors:
# - M_FORBIDDEN: Token expired/invalid
# - M_UNKNOWN_TOKEN: Wrong token
# - Network error: Server unreachable
```

---

### Widget Styles Not Loading

**Symptom:** Widget appears but has no styling

**Cause:** CSS file not loaded or wrong path

**Solution:**
```bash
# Check CSS file exists
ls -la dist/widget/style.css

# Check embed script loads CSS
curl http://localhost:3001/embed.js | grep "style.css"

# Rebuild with styles
npm run build:widget

# Verify CSS is served
curl http://localhost:3001/widget/style.css | head -20

# Clear browser cache
# Hard reload: Ctrl+Shift+R (Linux/Windows) or Cmd+Shift+R (macOS)
```

---

## Telegram Integration Issues

### Telegram Bot Not Responding

**Symptom:** Bot doesn't respond to `/start` or messages

**Cause:** Bot script not running or wrong token

**Solution:**
```bash
# Check if bot is running
ps aux | grep telegram-department-router

# Start bot if not running
node scripts/telegram-department-router.js

# Check logs for errors
# Look for "Bot started successfully" message

# Verify bot token
curl "https://api.telegram.org/bot<YOUR_TOKEN>/getMe"

# Should return bot information
# If error, token is invalid

# Check bot username matches configuration
grep "bot_username" config/config.yaml
```

---

### Messages Not Bridging to Matrix

**Symptom:** Messages sent in Telegram don't appear in Matrix

**Cause:** Users not authenticated with bridge or bridge not running

**Solution:**
```bash
# Check bridge is running
docker compose ps mautrix-telegram
# Should show "Up"

# Check bridge logs
docker compose logs mautrix-telegram | tail -50

# Verify user authentication
# Each user MUST login via bridge bot:

# 1. Login to Element: http://localhost:8081
# 2. Find "Telegram bridge bot" room
# 3. Send: login
# 4. Send phone number: +1234567890
# 5. Enter SMS code

# Verify user is authenticated
docker exec postgres psql -U synapse_user -d mautrix_telegram \
  -c "SELECT mxid, tg_username FROM puppet WHERE is_logged_in=true;"

# If user not logged in, they need to authenticate
```

---

### Bridge Bot Not Creating Rooms

**Symptom:** Customer messages telegram bot but no Matrix room created

**Cause:** Bridge permissions incorrect or bot not configured properly

**Solution:**
```bash
# Check bridge permissions in mautrix-telegram/config.yaml
grep -A 10 "permissions:" mautrix-telegram/config.yaml

# Verify relaybot is enabled
grep -A 5 "relaybot:" mautrix-telegram/config.yaml

# Check for this setting:
# authless_portals: true

# Restart bridge
docker compose restart mautrix-telegram

# Check bridge logs for errors
docker compose logs mautrix-telegram --follow

# Send test message to bot
# Watch logs for room creation
```

---

### Department Buttons Not Showing

**Symptom:** Telegram bot shows text list instead of graphical buttons

**Cause:** telegram-department-router.js not using inline keyboard

**Solution:**
```bash
# Check if script has inline_keyboard
grep "inline_keyboard" scripts/telegram-department-router.js

# Should show reply_markup with inline_keyboard array

# If missing, regenerate script:
cd scripts
source lib/config-generator.sh
generate_telegram_bot_script "../data/install-session.json" "telegram-department-router.js"

# Restart bot
pkill -f telegram-department-router
node telegram-department-router.js
```

---

### Multiple Users Not Invited to Telegram Rooms

**Symptom:** Only one user invited when customer messages Telegram bot

**Cause:** telegram-department-router.js using old single-user code

**Solution:**
```bash
# Check DEPARTMENTS configuration
grep -A 10 "const DEPARTMENTS" scripts/telegram-department-router.js

# Should have 'users' array, not single 'matrixUser'

# Example correct structure:
# users: [
#   '@support_agent1:localhost',
#   '@support_agent2:localhost',
#   '@support_agent3:localhost'
# ],

# Regenerate script with updated structure
cd scripts
source lib/config-generator.sh
generate_telegram_bot_script "../data/install-session.json" "telegram-department-router.js"

# Restart bot
pkill -f telegram-department-router
node telegram-department-router.js
```

---

### User Can't Login to Telegram Bridge

**Symptom:** Bridge bot doesn't respond to `login` command

**Cause:** User doesn't have `puppeting` permission

**Solution:**
```bash
# Check user permission in bridge config
grep "@support_agent1:localhost" mautrix-telegram/config.yaml

# Should show: puppeting
# NOT: full, user, or relaybot

# Edit mautrix-telegram/config.yaml
# Change:
#   '@support_agent1:localhost': full
# To:
#   '@support_agent1:localhost': puppeting

# Restart bridge
docker compose restart mautrix-telegram

# Try login again
# In Element, in bridge bot room:
# Send: login
```

---

## Configuration Issues

### YAML Syntax Errors

**Symptom:**
```
Error parsing config/config.yaml: invalid syntax
```

**Solution:**
```bash
# Validate YAML syntax
python3 -c "import yaml; yaml.safe_load(open('config/config.yaml'))"

# Common issues:
# - Inconsistent indentation (use spaces, not tabs)
# - Missing colons
# - Unescaped special characters in strings

# Use YAML linter
yamllint config/config.yaml

# If errors persist, regenerate config
cd scripts
./install.sh  # Re-run installer to regenerate config
```

---

### Access Token Invalid or Expired

**Symptom:**
```
M_UNKNOWN_TOKEN: Access token unknown or expired
M_FORBIDDEN: Invalid access token
```

**Solution:**
```bash
# Verify token works
curl -H "Authorization: Bearer syt_YOUR_TOKEN" \
  http://localhost:8008/_matrix/client/r0/account/whoami

# If invalid, get new token
curl -X POST http://localhost:8008/_matrix/client/r0/login \
  -H "Content-Type: application/json" \
  -d '{
    "type": "m.login.password",
    "user": "username",
    "password": "password"
  }' | jq -r '.access_token'

# Update token in config/config.yaml
# Find user section and replace access_token value

# Restart services
npm run serve  # Restart widget server
```

---

### Department Not Found

**Symptom:**
```
Error: Department 'support' not found in configuration
```

**Solution:**
```bash
# Check department configuration
cat config/config.yaml | grep -A 3 "departments:"

# Verify department ID matches
# Department ID should be: support, commerce, identification
# NOT: support_dept, general_support, etc.

# Check for typos
# Check for correct indentation

# Verify all required fields present:
# - id
# - name
# - users (array)
# - matrix (object)
# - widget (object)
```

---

## Performance Issues

### Slow Room Creation

**Symptom:** Widget takes >10 seconds to create room

**Cause:** Database slow or Matrix server overloaded

**Solution:**
```bash
# Check database performance
docker stats postgres

# Check Synapse performance
docker stats synapse

# Check disk I/O
iostat -x 1 5

# Optimize PostgreSQL
# Edit data/postgres.conf (if using Docker PostgreSQL)
# Increase:
# - shared_buffers
# - effective_cache_size
# - maintenance_work_mem

# Restart PostgreSQL
docker compose restart postgres
```

---

### High Memory Usage

**Symptom:** System slow, high RAM usage

**Solution:**
```bash
# Check container memory usage
docker stats

# Typical memory usage:
# - Synapse: 200-500MB
# - PostgreSQL: 100-300MB
# - Bridge: 50-100MB
# - Total: ~400-900MB

# If higher:
# 1. Check for memory leaks in logs
# 2. Restart services
docker compose restart

# 3. Increase host RAM
# 4. Optimize Synapse cache
# Edit data/homeserver.yaml:
# caches:
#   global_factor: 0.5  # Reduce cache size
```

---

## Testing Issues

### Test Page Not Loading

**Symptom:** http://localhost:3001/widget/widget-test.html returns 404

**Solution:**
```bash
# Check file exists
ls -la public/widget-test.html

# Should be in 'public' directory, not 'dist'

# Check server is serving static files
curl http://localhost:3001/widget/widget-test.html | head

# Restart server
npm run serve

# Alternative: Use minimal test
curl http://localhost:3001/widget/minimal-test.html
```

---

### Widget Test Shows Old Behavior

**Symptom:** Test shows old single-user behavior, not multi-user

**Cause:** Browser cache or widget not rebuilt

**Solution:**
```bash
# Rebuild widget
npm run build:widget

# Clear browser cache
# Hard reload: Ctrl+Shift+R (Linux/Windows) or Cmd+Shift+R (macOS)

# Or clear all cache:
# Chrome: Settings → Privacy → Clear browsing data
# Firefox: Settings → Privacy → Clear Data

# Restart server
npm run serve

# Test in incognito/private window
# This bypasses cache
```

---

## Network Issues

### Can't Access Services from Host

**Symptom:** Services work in Docker but can't access from browser

**Cause:** Firewall or Docker network issues

**Solution:**
```bash
# Check Docker network
docker network inspect matrix-chat-support_default

# Check port bindings
docker compose ps

# Should show: 0.0.0.0:8008->8008/tcp

# Check firewall
sudo ufw status  # Linux
# Add rules if needed:
sudo ufw allow 8008
sudo ufw allow 8080
sudo ufw allow 8081
sudo ufw allow 3001

# Test from host
curl http://localhost:8008/health
curl http://localhost:3001/health
```

---

### Services Can't Communicate

**Symptom:** Bridge can't reach Synapse, or services timeout

**Cause:** Docker network misconfiguration

**Solution:**
```bash
# Check all services on same network
docker network inspect matrix-chat-support_default | grep -A 3 "Containers"

# Should show all services:
# - postgres
# - synapse
# - mautrix-telegram
# - etc.

# Recreate network
docker compose down
docker network prune
docker compose up -d

# Check service names resolve
docker exec mautrix-telegram ping -c 1 synapse
# Should succeed
```

---

## Data Loss & Recovery

### Lost User Credentials

**Symptom:** Can't login, don't remember passwords

**Solution:**
```bash
# Check credentials file
cat data/user-credentials.txt

# If file deleted, reset passwords via Synapse Admin
# 1. Login to http://localhost:8080 with admin
# 2. Navigate to Users
# 3. Click user → Reset password

# Or via API:
curl -X POST \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  "http://localhost:8008/_synapse/admin/v1/reset_password/@user:localhost" \
  -d '{"new_password": "newpass123", "logout_devices": false}'
```

---

### Database Corruption

**Symptom:** Synapse won't start, database errors in logs

**Solution:**
```bash
# Check database integrity
docker exec postgres psql -U synapse_user synapse \
  -c "SELECT pg_database.datname, pg_database_size(pg_database.datname) FROM pg_database;"

# Restore from backup (if available)
docker compose down
docker volume rm matrix-chat-support_postgres-data
docker compose up -d postgres
cat backup.sql | docker exec -i postgres psql -U synapse_user synapse

# If no backup, fresh start required
docker compose down -v
./scripts/install.sh
```

---

## Getting More Help

### Enable Debug Logging

**Widget Server:**
```javascript
// Edit server/index.js
app.use((req, res, next) => {
  console.log('[DEBUG]', req.method, req.url)
  next()
})
```

**Telegram Bot:**
```javascript
// Edit scripts/telegram-department-router.js
// Add after bot initialization:
bot.on('message', (msg) => {
  console.log('[DEBUG] Message:', JSON.stringify(msg, null, 2))
})
```

**Bridge:**
```yaml
# Edit mautrix-telegram/config.yaml
logging:
  level: DEBUG
```

Restart all services and check logs.

---

### Collect Diagnostic Information

```bash
# Create support bundle
mkdir -p diagnostics/$(date +%Y%m%d)
cd diagnostics/$(date +%Y%m%d)

# System info
uname -a > system-info.txt
docker --version >> system-info.txt
node --version >> system-info.txt

# Service status
docker compose ps > docker-status.txt
docker stats --no-stream > docker-stats.txt

# Logs (last 200 lines)
docker compose logs --tail=200 synapse > synapse.log
docker compose logs --tail=200 mautrix-telegram > bridge.log
docker compose logs --tail=200 postgres > postgres.log

# Configurations (sanitize tokens first!)
cp ../../config/config.yaml config.yaml.txt
cp ../../mautrix-telegram/config.yaml bridge-config.yaml.txt

# Network
docker network inspect matrix-chat-support_default > network.txt

# Tar bundle
cd ..
tar -czf diagnostics-$(date +%Y%m%d).tar.gz $(date +%Y%m%d)/
```

Share bundle when asking for help.

---

## Common Error Messages

| Error Message | Meaning | Solution |
|--------------|---------|----------|
| `M_FORBIDDEN` | Permission denied | Check access token |
| `M_UNKNOWN_TOKEN` | Invalid token | Get new access token |
| `M_USER_IN_USE` | Username taken | Choose different username |
| `M_ROOM_IN_USE` | Room alias taken | Use different room alias |
| `M_INVALID_USERNAME` | Bad username format | Use alphanumeric + underscore |
| `Connection refused` | Service not running | Start service |
| `ECONNRESET` | Network interrupted | Check network/firewall |
| `YAML parse error` | Invalid YAML syntax | Fix YAML indentation |
| `Module not found` | Missing dependency | Run `npm install` |

---

**Troubleshooting Guide Version**: 1.0
**Last Updated**: 2025-10-01
