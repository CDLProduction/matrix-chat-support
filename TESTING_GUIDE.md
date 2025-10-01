# Testing Guide - Installation Script & Multi-User Setup

## Overview

This guide provides step-by-step testing procedures for:
1. Testing locally on your current environment (migration path)
2. Testing the installation script on a clean Linux VM
3. Verifying multi-user functionality

## Pre-Testing Checklist

### Local Environment (macOS)
- [ ] Current installation backed up
- [ ] Docker Desktop running
- [ ] Node.js 18+ installed
- [ ] npm packages installed
- [ ] Port conflicts resolved (8008, 8080, 8081, 5432, 29317, 3001)

### Linux VM Testing
- [ ] Fresh Ubuntu/Debian VM created
- [ ] VM has minimum 2GB RAM, 10GB disk
- [ ] SSH access configured
- [ ] Internet connectivity verified

## Phase 1: Local Environment Testing (macOS)

### 1.1: Backup Current Environment

```bash
# Create backup directory
mkdir -p backups/$(date +%Y%m%d-%H%M)
cd backups/$(date +%Y%m%d-%H%M)

# Backup configurations
cp ../../config/config.yaml config.yaml.backup
cp ../../scripts/telegram-department-router.js telegram-bot.backup
cp ../../mautrix-telegram/config.yaml bridge-config.backup

# Backup database
docker exec postgres pg_dump -U synapse_user synapse > synapse-$(date +%Y%m%d).sql

# Backup credentials (if exists)
cp ../../data/user-credentials.txt credentials.backup 2>/dev/null || true

cd ../..
echo "✅ Backup complete: backups/$(date +%Y%m%d-%H%M)/"
```

### 1.2: Stop Current Services

```bash
# Stop widget server (Ctrl+C in terminal)
# Stop telegram bot (Ctrl+C in terminal)

# Stop Docker services
docker compose down

# Verify all stopped
docker compose ps
# Should show no running containers
```

### 1.3: Update Widget Code (Already Done)

The widget code has been updated with multi-user support:
- ✅ `src/types/index.ts` - Added `departmentUsers?: string[]`
- ✅ `src/utils/matrix-client.ts` - Multi-user invitation loop

**Rebuild widget with changes:**
```bash
npm run build:widget
```

**Expected output:**
```
vite v5.x.x building for production...
✓ 123 modules transformed.
dist/widget/matrix-chat-widget.iife.js   XXX.XX kB │ gzip: XX.XX kB
dist/widget/style.css                     XX.XX kB │ gzip: XX.XX kB
✓ built in XXXXms
```

### 1.4: Update Current Configuration Manually

**Option A: Manual Migration (Test Changes Only)**

Edit `config/config.yaml` to add `departmentUsers` array:

```bash
# Edit config
nano config/config.yaml
```

**For each department, add `department_users` array:**

```yaml
departments:
  - id: "support"
    name: "General Support"
    matrix:
      homeserver: "http://localhost:8008"
      access_token: "syt_existing_token"
      bot_user_id: "@support:localhost"
      department_users:  # ADD THIS
        - "@support:localhost"
        # Add more users if you have them
```

**Save and exit (Ctrl+X, Y, Enter)**

### 1.5: Restart Services and Test

```bash
# Start Docker services
docker compose up -d

# Wait for initialization
sleep 10

# Start widget server
npm run serve

# In new terminal: Start Telegram bot
node scripts/telegram-department-router.js
```

### 1.6: Test Widget Multi-User Invitation

**Open test page:**
```bash
open http://localhost:3001/widget/widget-test.html
```

**Testing steps:**
1. Click chat button
2. Select "General Support" department
3. Fill contact form:
   - Name: Test User
   - Email: test@example.com
   - Initial message: "Testing multi-user invitation"
4. Send message

**Expected result:**
- Room created successfully
- Widget shows message sent
- Check browser console (F12) for invitation logs:
  ```
  Invited department user: @support:localhost
  ```

**Verify in Element:**
1. Open http://localhost:8081
2. Login with support user credentials
3. Check for new room "Test User"
4. All users in `department_users` should see the room

### 1.7: Test Telegram Multi-User Invitation

**Send test message to Telegram bot:**
1. Open Telegram
2. Find your bot (@YourBotUsername)
3. Send: `/start`
4. Click "General Support" button (or appropriate department)
5. Send test message: "Testing Telegram multi-user"

**Verify in Element:**
1. Open http://localhost:8081
2. Login with support user
3. Check for new room in "Telegram - General Support" space
4. All users in department should see the room

### 1.8: Document Test Results

```bash
# Create test results file
cat > test-results-local.txt << 'EOF'
Local Environment Testing - $(date)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Test 1: Widget Code Updated
  Status: [ ] Pass [ ] Fail
  Notes:

Test 2: Widget Rebuild
  Status: [ ] Pass [ ] Fail
  Notes:

Test 3: Configuration Updated
  Status: [ ] Pass [ ] Fail
  Notes:

Test 4: Services Started
  Status: [ ] Pass [ ] Fail
  Notes:

Test 5: Widget Multi-User Invitation
  Expected: All department users invited
  Actual:
  Status: [ ] Pass [ ] Fail
  Notes:

Test 6: Telegram Multi-User Invitation
  Expected: All department users invited
  Actual:
  Status: [ ] Pass [ ] Fail
  Notes:

Issues Found:
-
-

EOF

# Edit file with results
nano test-results-local.txt
```

---

## Phase 2: Linux VM Testing (Clean Installation)

### 2.1: VM Preparation

**Create Ubuntu VM (VirtualBox/VMware/Cloud):**
- OS: Ubuntu 22.04 LTS (recommended) or Debian 11+
- RAM: 4GB minimum
- Disk: 20GB minimum
- Network: Bridged or NAT with port forwarding

**Initial VM setup:**
```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install basic tools
sudo apt install -y curl wget git build-essential

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER

# Install Node.js 18
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# Install jq (required by install script)
sudo apt install -y jq

# Logout and login for docker group to take effect
exit
```

**Re-login via SSH and verify:**
```bash
docker --version    # Should show Docker 20.10+
node --version      # Should show v18.x.x
npm --version       # Should show 8+
jq --version        # Should show jq 1.6+
```

### 2.2: Clone Repository

```bash
# Clone project
git clone <repository-url> matrix-chat-support
cd matrix-chat-support

# Make install script executable
chmod +x scripts/install.sh
chmod +x scripts/lib/*.sh

# Verify scripts
ls -la scripts/
ls -la scripts/lib/
```

### 2.3: Prepare Test Configuration

Before running installer, prepare your test configuration:

**Test Configuration Plan:**
```
Departments: 3
  1. General Support (support)
     - Users: 2
       - support_agent1 (John Doe) - Telegram enabled
       - support_agent2 (Jane Smith) - Telegram enabled

  2. Commerce Support (commerce)
     - Users: 2
       - commerce_agent1 (Bob Wilson) - Telegram enabled
       - commerce_agent2 (Alice Johnson) - Telegram enabled

  3. Account Verification (identification)
     - Users: 1
       - verify_agent1 (Charlie Brown) - Telegram enabled

Total: 5 users (reduced for testing, can scale to 9 later)

Matrix:
  Domain: localhost
  Port: 8008
  Admin: admin / (auto-generated password)

Telegram:
  Bot Token: <your_test_bot_token>
  API ID: <your_api_id>
  API Hash: <your_api_hash>

Widget:
  Title: Customer Support
  Color: #667eea
  Position: bottom-right
  Port: 3001
```

### 2.4: Run Installation Script

```bash
cd scripts
./install.sh
```

**Follow prompts systematically:**

1. **PostgreSQL**: Press `Y` for Docker
2. **Matrix domain**: `localhost` (Enter)
3. **Matrix port**: `8008` (Enter)
4. **Admin username**: `admin` (Enter)
5. **Admin password**: (Leave empty - auto-generate)
6. **Number of departments**: `3`

**Department 1 (General Support):**
```
Department ID: support
Department name: General Support
Description: Technical help and general inquiries
Icon: 🎧
Color: #667eea
Number of users: 2

User 1:
  Username: support_agent1
  Display name: John Doe
  Password: (leave empty)
  Telegram enabled: Y

User 2:
  Username: support_agent2
  Display name: Jane Smith
  Password: (leave empty)
  Telegram enabled: Y
```

**Department 2 (Commerce):**
```
Department ID: commerce
Department name: Commerce Support
Description: Sales and billing inquiries
Icon: 💼
Color: #10b981
Number of users: 2

User 1:
  Username: commerce_agent1
  Display name: Bob Wilson
  Password: (leave empty)
  Telegram enabled: Y

User 2:
  Username: commerce_agent2
  Display name: Alice Johnson
  Password: (leave empty)
  Telegram enabled: Y
```

**Department 3 (Identification):**
```
Department ID: identification
Department name: Account Verification
Description: Identity verification support
Icon: 🔒
Color: #f59e0b
Number of users: 1

User 1:
  Username: verify_agent1
  Display name: Charlie Brown
  Password: (leave empty)
  Telegram enabled: Y
```

**Telegram Configuration:**
```
Bot token: <paste_your_token>
API ID: <paste_your_api_id>
API Hash: <paste_your_api_hash>
```

**Widget Configuration:**
```
Title: Customer Support
Brand color: #667eea
Position: bottom-right
Port: 3001
```

**Review summary and confirm: `y`**

### 2.5: Monitor Installation

Watch for successful completion of each step:

```
✅ Created directory structure
✅ PostgreSQL started
✅ Synapse started
✅ Admin user created
✅ Creating department users...
  ✅ [1/5] support_agent1 configured
  ✅ [2/5] support_agent2 configured
  ✅ [3/5] commerce_agent1 configured
  ✅ [4/5] commerce_agent2 configured
  ✅ [5/5] verify_agent1 configured
✅ Generated config/config.yaml
✅ Generated telegram-department-router.js
✅ Generated mautrix-telegram configuration
✅ Bridge started
✅ Widget built
✅ Credentials saved
```

**Expected duration:** 5-10 minutes

### 2.6: Verify Installation

**Check credentials:**
```bash
cat ../data/user-credentials.txt
```

**Verify Docker services:**
```bash
docker compose ps
```

**Expected output:**
```
NAME                STATUS          PORTS
postgres            Up              5432/tcp
synapse             Up              0.0.0.0:8008->8008/tcp
synapse-admin       Up              0.0.0.0:8080->8080/tcp
element             Up              0.0.0.0:8081->8081/tcp
mautrix-telegram    Up              29317/tcp
```

**Check configuration files:**
```bash
# Main config
cat ../config/config.yaml | grep -A 3 "departments:"

# Should show 3 departments

# Check users per department
cat ../config/config.yaml | grep -A 5 "users:"

# Should show users array for each department

# Check department_users array
cat ../config/config.yaml | grep -A 5 "department_users:"

# Should show array of user IDs
```

**Test Matrix server:**
```bash
curl http://localhost:8008/health
# Expected: {"status": "ok"}

# Test with admin token
ADMIN_TOKEN=$(grep "admin" ../data/user-credentials.txt | grep "Token:" | awk '{print $3}')
curl -H "Authorization: Bearer $ADMIN_TOKEN" \
  http://localhost:8008/_matrix/client/r0/account/whoami
# Expected: {"user_id": "@admin:localhost"}
```

### 2.7: Start Services

```bash
# Terminal 1: Widget server
cd ..
npm run serve

# Should show:
# Widget server running on http://localhost:3001
```

**In new SSH session (Terminal 2):**
```bash
cd matrix-chat-support/scripts
node telegram-department-router.js

# Should show:
# Bot started successfully
# Listening for commands...
```

### 2.8: Test Widget from VM

**Create simple test HTML:**
```bash
cat > /tmp/test-widget.html << 'EOF'
<!DOCTYPE html>
<html>
<head>
  <title>Widget Test</title>
</head>
<body>
  <h1>Matrix Chat Widget Test</h1>
  <p>Widget should appear in bottom-right corner.</p>
  <script src="http://localhost:3001/embed.js"></script>
</body>
</html>
EOF

# Serve test page
cd /tmp
python3 -m http.server 8000
```

**From your local machine (not VM):**
```bash
# Get VM IP
VM_IP=<your_vm_ip>

# Open test page
open http://$VM_IP:8000/test-widget.html
```

**Test widget functionality:**
1. Click chat button
2. Select "General Support"
3. Fill form and send message
4. Verify room created with multiple users invited

### 2.9: Test Telegram Integration

**Configure port forwarding (if needed):**
- Forward port 8008 from VM to external IP
- Or use ngrok: `ngrok http 8008`

**Test Telegram bot:**
1. Find bot on Telegram: @YourBotUsername
2. Send: `/start`
3. Should show 3 department buttons:
   - 🎧 General Support
   - 💼 Commerce Support
   - 🔒 Account Verification
4. Click "General Support"
5. Send test message: "Testing VM installation"

**Verify in Element on VM:**
```bash
# Open Element Web
open http://localhost:8081

# Or from local machine:
open http://$VM_IP:8081
```

Login with any support user (credentials in `data/user-credentials.txt`)

Check for:
- New room created in "Telegram - General Support" space
- Both `support_agent1` and `support_agent2` invited
- Test message visible

### 2.10: Document VM Test Results

```bash
cat > test-results-vm.txt << 'EOF'
Linux VM Installation Testing - $(date)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

VM Details:
  OS: Ubuntu 22.04
  RAM: 4GB
  Disk: 20GB
  IP:

Installation Results:
  Duration: __ minutes
  Success: [ ] Yes [ ] No

  Checklist:
    [ ] All dependencies installed
    [ ] Docker services started
    [ ] All 5 users created
    [ ] All access tokens obtained
    [ ] config.yaml generated correctly
    [ ] telegram-department-router.js generated
    [ ] mautrix-telegram configured
    [ ] Widget built successfully
    [ ] Credentials file created

Service Verification:
  [ ] Synapse: http://localhost:8008/health returns OK
  [ ] Synapse Admin: http://localhost:8080 accessible
  [ ] Element: http://localhost:8081 accessible
  [ ] Widget: http://localhost:3001/embed.js loads
  [ ] Bridge: docker logs show no errors

Widget Testing:
  Test 1: Department Selection
    Status: [ ] Pass [ ] Fail
    Notes:

  Test 2: Multi-User Invitation (Widget)
    Expected: support_agent1 + support_agent2 invited
    Actual:
    Status: [ ] Pass [ ] Fail

  Test 3: Message Sending
    Status: [ ] Pass [ ] Fail

Telegram Testing:
  Test 1: Bot Responds to /start
    Status: [ ] Pass [ ] Fail

  Test 2: Department Buttons Shown (3 buttons)
    Status: [ ] Pass [ ] Fail

  Test 3: Multi-User Invitation (Telegram)
    Expected: All dept users invited
    Actual:
    Status: [ ] Pass [ ] Fail

  Test 4: Message Bridging
    Status: [ ] Pass [ ] Fail

Issues Found:
-
-

Overall Result: [ ] PASS [ ] FAIL

Next Steps:
-
EOF

nano test-results-vm.txt
```

---

## Phase 3: Comprehensive Testing Scenarios

### 3.1: Multi-Department Testing

**Test switching between departments:**

1. **Widget Test:**
   - Open test page
   - Select "General Support" → Send message
   - Close widget, reopen
   - Select "Commerce Support" → Send message
   - Verify separate rooms created
   - Verify correct users invited to each

2. **Telegram Test:**
   - Send `/start` to bot
   - Select "General Support" → Send message
   - Send `/start` again
   - Select "Commerce Support" → Send message
   - Verify separate rooms in different spaces
   - Verify correct users per department

### 3.2: User Authentication Testing

**Each user must authenticate Telegram:**

For each user created:

1. Open Element: http://localhost:8081
2. Login with user credentials from `data/user-credentials.txt`
3. Find "Telegram bridge bot" room (should auto-appear)
4. Send: `login`
5. Send phone number: `+1234567890` (your phone)
6. Check Telegram app for verification code
7. Send code to bridge bot
8. Verify success message

**Test puppeting:**
- After authentication, user should see all Telegram conversations
- User can respond from their Telegram app
- Messages appear from user's Telegram identity (not bot)

### 3.3: Stress Testing

**Create multiple rooms rapidly:**

```bash
# Script to create 10 test rooms
for i in {1..10}; do
  curl -X POST http://localhost:3001/api/create-room \
    -H "Content-Type: application/json" \
    -d "{
      \"department\": \"support\",
      \"user\": {
        \"name\": \"Test User $i\",
        \"email\": \"test$i@example.com\",
        \"message\": \"Test message $i\"
      }
    }"
  sleep 2
done
```

**Verify:**
- All rooms created successfully
- No invitation failures
- All users invited to all rooms
- No database errors in logs

### 3.4: Error Recovery Testing

**Test missing user:**
```bash
# Temporarily remove a user from config
nano config/config.yaml
# Remove one user from department_users array
# Save and restart

# Try to create room
# Should succeed with warning about failed invitation
# Other users should still be invited
```

**Test bridge offline:**
```bash
# Stop bridge
docker compose stop mautrix-telegram

# Try Telegram bot → Should still work (relaybot mode)
# Restart bridge
docker compose start mautrix-telegram
```

**Test Matrix offline:**
```bash
# Stop Synapse
docker compose stop synapse

# Widget should show connection error
# Restart Synapse
docker compose start synapse
```

---

## Testing Checklist

### Pre-Flight
- [ ] Backup created (local environment)
- [ ] All dependencies installed
- [ ] Telegram bot credentials ready
- [ ] Test configuration planned

### Local Environment
- [ ] Widget code updated and rebuilt
- [ ] Configuration updated with `department_users`
- [ ] Services restarted
- [ ] Widget multi-user invitation tested
- [ ] Telegram multi-user invitation tested
- [ ] Test results documented

### Linux VM
- [ ] Fresh VM created and prepared
- [ ] Installation script executed successfully
- [ ] All users created (5 test users)
- [ ] All services running
- [ ] Widget tested from external browser
- [ ] Telegram bot tested
- [ ] User authentication tested
- [ ] Test results documented

### Comprehensive Testing
- [ ] Multi-department switching tested
- [ ] All users authenticated with Telegram
- [ ] Puppeting mode verified
- [ ] Stress test completed (10+ rooms)
- [ ] Error recovery scenarios tested

### Final Validation
- [ ] No errors in Docker logs
- [ ] All features working as expected
- [ ] Performance acceptable
- [ ] Documentation accurate
- [ ] Ready for production consideration

---

## Expected Test Results

### Success Criteria

**Installation:**
✅ Installation completes in 5-10 minutes
✅ No errors during user creation
✅ All configuration files generated correctly
✅ All Docker services start successfully

**Widget:**
✅ Department selection works
✅ All department users invited to rooms
✅ Messages send/receive correctly
✅ Browser console shows invitation logs

**Telegram:**
✅ Bot responds with graphical buttons
✅ 3 departments shown correctly
✅ All department users invited
✅ Messages bridge bidirectionally

**Performance:**
✅ Room creation < 5 seconds
✅ Message delivery < 1 second
✅ Memory usage < 1GB total
✅ No memory leaks over time

### Failure Scenarios

If any test fails:
1. Document exact error message
2. Check service logs: `docker compose logs [service]`
3. Verify configuration files
4. Consult TROUBLESHOOTING.md
5. Fix issue and retest
6. Document fix in test results

---

## Post-Testing

### Clean Up Test Environment

**Local:**
```bash
# Keep if working, or restore backup if needed
# See MIGRATION_GUIDE.md for rollback
```

**VM:**
```bash
# Keep VM for continued testing
# Or destroy and recreate for fresh test:
docker compose down -v
rm -rf /home/user/matrix-chat-support
```

### Submit Test Results

Compile test results:
```bash
# Combine all test results
cat test-results-local.txt test-results-vm.txt > final-test-results.txt

# Add summary
echo "
Summary
━━━━━━━
Local Tests: [PASS/FAIL]
VM Tests: [PASS/FAIL]
Overall: [PASS/FAIL]

Production Ready: [YES/NO]
" >> final-test-results.txt
```

---

**Testing Guide Version**: 1.0
**Last Updated**: 2025-10-01
**Test Duration**: ~2-4 hours for complete testing
