# Migration Guide - Existing Environment to Multi-User Setup

## Overview

This guide helps migrate your existing Matrix Chat Support environment to the new multi-user configuration. The new system supports multiple users per department with individual Telegram account authentication (puppeting mode).

## What Changed

### Widget Code Changes

**src/types/index.ts** - Added `departmentUsers` field:
```typescript
export interface MatrixConfig {
  homeserver: string
  accessToken: string
  adminAccessToken?: string
  supportRoomId?: string
  botUserId?: string
  departmentUsers?: string[]  // NEW: Array of department user IDs
  spaceConfig?: DepartmentSpaceConfig
}
```

**src/utils/matrix-client.ts** - Multi-user invitation logic:
- Now invites ALL users from `departmentUsers[]` array
- Maintains backwards compatibility with single `botUserId`
- Error handling for failed invitations

### Configuration Changes

**config/config.yaml** - New structure per department:
```yaml
departments:
  - id: "support"
    name: "General Support"
    users:  # NEW: Multiple users per department
      - username: "support_agent1"
        matrix_user_id: "@support_agent1:localhost"
        access_token: "syt_..."
        display_name: "John Doe"
        telegram_enabled: true
      - username: "support_agent2"
        matrix_user_id: "@support_agent2:localhost"
        access_token: "syt_..."
        display_name: "Jane Smith"
        telegram_enabled: true
    matrix:
      homeserver: "http://localhost:8008"
      access_token: "syt_..."  # Primary user token
      bot_user_id: "@support_agent1:localhost"  # Primary user
      department_users:  # NEW: Array of all user IDs
        - "@support_agent1:localhost"
        - "@support_agent2:localhost"
```

**telegram-department-router.js** - Dynamic keyboard and multi-user invitations:
- Keyboard buttons generated from configuration (not hardcoded)
- Invites all users from `users[]` array when creating rooms

**mautrix-telegram/config.yaml** - Puppeting permissions:
```yaml
permissions:
  '*': relaybot
  'localhost': full
  '@admin:localhost': admin
  '@support_agent1:localhost': puppeting  # Changed from 'full'
  '@support_agent2:localhost': puppeting  # Changed from 'full'
  # ... all department users need 'puppeting'
```

## Migration Steps

### Step 1: Backup Current Configuration

```bash
# Backup all configuration files
mkdir -p backups/$(date +%Y%m%d)
cp config/config.yaml backups/$(date +%Y%m%d)/
cp scripts/telegram-department-router.js backups/$(date +%Y%m%d)/
cp mautrix-telegram/config.yaml backups/$(date +%Y%m%d)/
cp data/mautrix-telegram-registration.yaml backups/$(date +%Y%m%d)/

# Backup database (if needed)
docker exec postgres pg_dump -U synapse_user synapse > backups/$(date +%Y%m%d)/synapse.sql
```

### Step 2: Stop All Services

```bash
# Stop widget server (Ctrl+C in terminal)
# Stop telegram bot (Ctrl+C in terminal)

# Stop Docker services
docker compose down
```

### Step 3: Update Widget Code

The widget code has already been updated in your working directory:
- `src/types/index.ts` - ✅ Updated
- `src/utils/matrix-client.ts` - ✅ Updated

**Rebuild the widget:**
```bash
npm run build:widget
```

### Step 4: Choose Migration Path

You have two options:

#### Option A: Fresh Installation (Recommended)

Use the new installation script to setup everything from scratch:

```bash
# Clean existing data (CAUTION: This deletes all data)
docker compose down -v
rm -f data/install-session.json
rm -f config/config.yaml
rm -f scripts/telegram-department-router.js

# Run new installer
cd scripts
./install.sh
```

**Pros:**
- Guaranteed clean setup
- Automated user creation
- Proper configuration generation
- All tokens obtained automatically

**Cons:**
- Loses existing conversation history
- Need to recreate all users
- Need to re-authenticate Telegram accounts

#### Option B: Manual Migration (Advanced)

Keep existing users and migrate configuration manually:

1. **Create Additional Users** (if needed)
2. **Update config/config.yaml** manually
3. **Update telegram-department-router.js** manually
4. **Update mautrix-telegram/config.yaml** manually
5. **Restart services**

See detailed steps below.

### Step 5A: Fresh Installation Process

If you chose **Option A (Recommended)**:

1. Run the installation script:
```bash
cd scripts
./install.sh
```

2. Follow prompts to configure:
   - 3 departments
   - 9 total users (3 support, 4 commerce, 2 identification)
   - Telegram credentials
   - Widget settings

3. Wait for installation to complete (~5-10 minutes)

4. Authenticate Telegram users (see `data/telegram-auth-guide.md`)

5. Start services:
```bash
# Terminal 1: Widget Server
npm run serve

# Terminal 2: Telegram Bot
node scripts/telegram-department-router.js
```

6. Test widget: http://localhost:3001/widget/widget-test.html

**Installation complete! Skip to "Verification" section below.**

---

### Step 5B: Manual Migration Process

If you chose **Option B (Advanced)**:

#### 5B.1: Create Additional Users

For each new user you need to add:

**Via Synapse Admin Panel** (http://localhost:8080):
1. Login with admin credentials
2. Navigate to Users → Create User
3. Fill in username, display name, password
4. Create user

**Obtain Access Token**:
```bash
# Login via Matrix API
curl -X POST http://localhost:8008/_matrix/client/r0/login \
  -H "Content-Type: application/json" \
  -d '{
    "type": "m.login.password",
    "user": "username",
    "password": "password"
  }'

# Save the "access_token" from response
```

**Repeat for all new users** (up to 9 total).

#### 5B.2: Update config/config.yaml

Edit `config/config.yaml` and restructure each department:

**Before (old structure):**
```yaml
departments:
  - id: "support"
    name: "General Support"
    matrix:
      homeserver: "http://localhost:8008"
      access_token: "syt_OLD_TOKEN"
      bot_user_id: "@support:localhost"
```

**After (new structure):**
```yaml
departments:
  - id: "support"
    name: "General Support"
    description: "Technical help and general inquiries"
    icon: "🎧"
    color: "#667eea"
    users:  # NEW SECTION
      - username: "support_agent1"
        matrix_user_id: "@support_agent1:localhost"
        access_token: "syt_TOKEN_1"
        display_name: "John Doe"
        telegram_enabled: true
      - username: "support_agent2"
        matrix_user_id: "@support_agent2:localhost"
        access_token: "syt_TOKEN_2"
        display_name: "Jane Smith"
        telegram_enabled: true
      - username: "support_agent3"
        matrix_user_id: "@support_agent3:localhost"
        access_token: "syt_TOKEN_3"
        display_name: "Bob Wilson"
        telegram_enabled: true
    matrix:
      homeserver: "http://localhost:8008"
      access_token: "syt_TOKEN_1"  # Use first user's token
      bot_user_id: "@support_agent1:localhost"  # First user
      department_users:  # NEW: List all user IDs
        - "@support_agent1:localhost"
        - "@support_agent2:localhost"
        - "@support_agent3:localhost"
    widget:
      greeting: "Hi! How can our support team help you today?"
```

**Repeat for all departments** (support, commerce, identification).

#### 5B.3: Update telegram-department-router.js

The Telegram bot needs to be regenerated with dynamic configuration. You have two options:

**Option 1: Use config generator function** (recommended):
```bash
# Source the generator library
source scripts/lib/config-generator.sh

# Generate new telegram bot script
generate_telegram_bot_script "data/install-session.json" "scripts/telegram-department-router.js"
```

**Option 2: Manual edit** (advanced):

Find the `DEPARTMENTS` configuration in `telegram-department-router.js`:

**Before:**
```javascript
const DEPARTMENTS = [
  {
    id: 'support',
    name: 'General Support',
    matrixUser: '@support:localhost',
    // ...
  }
]
```

**After:**
```javascript
const DEPARTMENTS = [
  {
    id: 'support',
    name: 'General Support',
    users: [  // NEW: Array of users
      '@support_agent1:localhost',
      '@support_agent2:localhost',
      '@support_agent3:localhost'
    ],
    // ...
  }
]
```

Find room creation code and update invitation:

**Before:**
```javascript
invite: [department.matrixUser],
```

**After:**
```javascript
invite: department.users,  // Invite all users
```

Find keyboard generation and make it dynamic:

**Before (hardcoded):**
```javascript
reply_markup: {
  inline_keyboard: [
    [
      { text: '🎧 General Support', callback_data: 'dept_support' },
      { text: '💼 Tech Support', callback_data: 'dept_tech_support' }
    ],
    // ...
  ]
}
```

**After (dynamic):**
```javascript
function generateDepartmentKeyboard() {
  const buttons = []
  let row = []

  DEPARTMENTS.forEach((dept, index) => {
    row.push({
      text: `${dept.icon || '📁'} ${dept.name}`,
      callback_data: `dept_${dept.id}`
    })

    if (row.length === 2 || index === DEPARTMENTS.length - 1) {
      buttons.push(row)
      row = []
    }
  })

  return { inline_keyboard: buttons }
}

// Use in bot responses:
reply_markup: generateDepartmentKeyboard()
```

#### 5B.4: Update mautrix-telegram/config.yaml

Edit `mautrix-telegram/config.yaml` and update permissions:

**Before:**
```yaml
permissions:
  '*': relaybot
  'localhost': full
  '@admin:localhost': admin
  '@support:localhost': full
  '@tech_support:localhost': full
  '@commerce:localhost': full
  '@identification:localhost': full
```

**After:**
```yaml
permissions:
  '*': relaybot
  'localhost': full
  '@admin:localhost': admin
  # All department users need 'puppeting' permission
  '@support_agent1:localhost': puppeting
  '@support_agent2:localhost': puppeting
  '@support_agent3:localhost': puppeting
  '@commerce_agent1:localhost': puppeting
  '@commerce_agent2:localhost': puppeting
  '@commerce_agent3:localhost': puppeting
  '@commerce_agent4:localhost': puppeting
  '@verify_agent1:localhost': puppeting
  '@verify_agent2:localhost': puppeting
```

#### 5B.5: Restart Services

```bash
# Start Docker services
docker compose up -d

# Wait for services to initialize
sleep 10

# Start widget server
npm run serve &

# Start Telegram bot
node scripts/telegram-department-router.js &
```

## Verification

### 1. Check Widget Multi-User Invitation

**Test widget:**
```bash
open http://localhost:3001/widget/widget-test.html
```

**Steps:**
1. Click chat button
2. Select department
3. Fill in contact form
4. Send message

**Expected Result:**
- Room created in Matrix
- ALL department users invited to room
- Check Element: all users should see new room

**Verify in browser console:**
```
Invited department user: @support_agent1:localhost
Invited department user: @support_agent2:localhost
Invited department user: @support_agent3:localhost
```

### 2. Check Telegram Multi-User Invitation

**Test Telegram bot:**
1. Open Telegram and find your bot
2. Send `/start`
3. Select department (using graphical buttons)
4. Send test message

**Expected Result:**
- Room created in Matrix with "Telegram - [Department]" space
- ALL department users invited
- Check Element: all users should see new room
- All users can respond (messages show up in Telegram)

### 3. Check User Telegram Authentication

Each user needs to authenticate their Telegram account:

**For each user:**
1. Login to Element: http://localhost:8081
2. Find "Telegram bridge bot" room
3. Send: `login`
4. Send phone number: `+1234567890`
5. Enter SMS code
6. Verify success message

**Verify authentication:**
```bash
# Check bridge database for authenticated users
docker exec postgres psql -U synapse_user -d mautrix_telegram \
  -c "SELECT mxid, tg_username FROM puppet;"
```

### 4. Verify Configuration Files

**Check config.yaml:**
```bash
# Verify departmentUsers array exists for each department
grep -A 5 "department_users:" config/config.yaml
```

**Check telegram-department-router.js:**
```bash
# Verify users array exists for each department
grep -A 5 "users:" scripts/telegram-department-router.js
```

**Check bridge config:**
```bash
# Verify puppeting permissions
grep "puppeting" mautrix-telegram/config.yaml
```

## Troubleshooting Migration Issues

### Only One User Invited to Rooms

**Symptom**: Widget/Telegram only invites single user despite configuration

**Cause**: Widget not rebuilt after code changes

**Solution:**
```bash
npm run build:widget
# Restart widget server
npm run serve
```

### Telegram Users Can't Login

**Symptom**: Bridge bot doesn't respond to `login` command

**Cause**: User doesn't have `puppeting` permission in bridge config

**Solution:**
```bash
# Edit mautrix-telegram/config.yaml
# Change user permission from 'full' to 'puppeting'
# Restart bridge
docker compose restart mautrix-telegram
```

### Configuration File Errors

**Symptom**: YAML parsing errors or invalid configuration

**Solution:**
```bash
# Validate YAML syntax
python3 -c "import yaml; yaml.safe_load(open('config/config.yaml'))"

# Regenerate config using install script
cd scripts
./install.sh  # Run again - it's idempotent
```

### Missing Access Tokens

**Symptom**: Users can't be invited, authentication failures

**Solution:**
Obtain token manually:
```bash
curl -X POST http://localhost:8008/_matrix/client/r0/login \
  -H "Content-Type: application/json" \
  -d '{
    "type": "m.login.password",
    "user": "username",
    "password": "password"
  }' | jq -r '.access_token'
```

Add token to config/config.yaml in appropriate user section.

### Bridge Not Processing Messages

**Symptom**: Messages sent in Telegram don't appear in Matrix

**Solution:**
```bash
# Check bridge logs
docker compose logs mautrix-telegram | tail -50

# Verify users authenticated
# Each user must run 'login' command in bridge bot room

# Restart bridge
docker compose restart mautrix-telegram
```

## Rollback Procedure

If migration fails and you need to restore previous setup:

```bash
# Stop all services
docker compose down

# Restore configurations
cp backups/$(date +%Y%m%d)/config.yaml config/
cp backups/$(date +%Y%m%d)/telegram-department-router.js scripts/
cp backups/$(date +%Y%m%d)/config.yaml mautrix-telegram/

# Restore database (if needed)
docker compose up -d postgres
sleep 5
cat backups/$(date +%Y%m%d)/synapse.sql | docker exec -i postgres psql -U synapse_user synapse

# Rebuild widget with old code
git checkout HEAD -- src/types/index.ts src/utils/matrix-client.ts
npm run build:widget

# Start services
docker compose up -d
npm run serve &
node scripts/telegram-department-router.js &
```

## Next Steps After Migration

1. **Test thoroughly**: Test all departments and users
2. **Train support team**: Show users how to use Matrix/Element interface
3. **Authenticate Telegram**: Ensure all users complete Telegram authentication
4. **Monitor logs**: Watch for errors during first few hours
5. **Document custom changes**: Note any custom configuration for your setup
6. **Update documentation**: Update your internal docs with new structure

## Production Considerations

Before migrating production:

1. **Test in staging environment first**
2. **Schedule maintenance window**
3. **Notify users of downtime**
4. **Have rollback plan ready**
5. **Monitor closely after migration**
6. **Keep backups for at least 30 days**

## Getting Help

If you encounter issues during migration:

1. Check troubleshooting section above
2. Review installation logs
3. Check Docker service logs: `docker compose logs [service]`
4. Review `INSTALLATION_GUIDE.md` for detailed setup info
5. Check configuration examples in `config/config.yaml.example`

---

**Migration Guide Version**: 1.0
**Last Updated**: 2025-10-01
**Compatible With**: Multi-user widget v2.0+
