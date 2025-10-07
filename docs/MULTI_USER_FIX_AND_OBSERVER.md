# Multi-User Invitation Fix & Observer User Setup

## Overview of Changes

This document describes the fixes applied to resolve two critical issues:

1. **Multi-User Invitation Bug**: Messages were only arriving to one user per department (e.g., `support_agent1`) instead of ALL users configured in `department_users`
2. **Observer User**: Created a read-only user that can view all conversations across all departments for management oversight

---

## Issue #1: Multi-User Invitation Bug

### Problem
When a new customer conversation started (via Telegram or Widget), only the first user (e.g., `@support_agent1:localhost`) was invited to the room. Other agents (`support_agent2`, `support_agent3`) were not invited and couldn't see the conversation.

### Root Cause
In `scripts/telegram-department-router.js` line 413 (before fix), the code only invited `department.matrixUser` (single user) instead of looping through `department.departmentUsers` array.

### Solution Applied

#### File: `scripts/telegram-department-router.js`

**Before (Line 410-426):**
```javascript
// Ensure department user is invited to the space so they can see hierarchy
try {
  await axios.post(`${MATRIX_HOMESERVER}/_matrix/client/v3/rooms/${department.spaceId}/invite`, {
    user_id: department.matrixUser
  }, ...);
}
```

**After (Line 410-451):**
```javascript
// Invite ALL department users to the room (not just the first one)
const usersToInvite = department.departmentUsers || [department.matrixUser];
console.log(`📧 Inviting ${usersToInvite.length} department users to room ${roomId}...`);

for (const userId of usersToInvite) {
  try {
    // Invite to room
    await axios.post(`${MATRIX_HOMESERVER}/_matrix/client/v3/rooms/${roomId}/invite`, {
      user_id: userId
    }, ...);

    // Invite to department space
    await axios.post(`${MATRIX_HOMESERVER}/_matrix/client/v3/rooms/${department.spaceId}/invite`, {
      user_id: userId
    }, ...);
  } catch (error) { ... }
}
```

#### File: `src/utils/matrix-client.ts`

The widget was already correctly inviting all department users (lines 854-867). No changes needed.

---

## Issue #2: Observer User Setup

### Requirements
- Create a user that can view all conversations across all departments
- Read-only access (cannot send messages)
- Auto-invited to all new customer conversations
- For management/oversight purposes

### Solution Applied

#### 1. Configuration Added to `config/config.yaml`

```yaml
# Observer user (read-only access to all departments)
observer:
  enabled: true
  user_id: "@observer:localhost"
  password: "observer123"  # Change this after creation
  access_token: ""  # Will be filled after user creation
  display_name: "Support Observer"
  auto_invite: true
  permissions: "read_only"
  description: "Manager with read-only access to all conversations"
```

#### 2. Telegram Router Updated

Added observer invitation logic in `scripts/telegram-department-router.js` (lines 453-496):

```javascript
// Invite observer user if configured (read-only access)
if (config.observer && config.observer.enabled && config.observer.auto_invite) {
  try {
    // Invite observer to the room
    await axios.post(`${MATRIX_HOMESERVER}/_matrix/client/v3/rooms/${roomId}/invite`, {
      user_id: config.observer.user_id
    }, ...);

    // Set read-only permissions
    const powerLevelsResponse = await axios.get(...);
    const powerLevels = powerLevelsResponse.data;
    powerLevels.users[config.observer.user_id] = 0;  // Observer has level 0
    powerLevels.events_default = 50;  // Requires level 50 to send messages
    await axios.put(..., powerLevels, ...);

    console.log(`👁️  Observer invited to room ${roomId} (read-only)`);
  } catch (observerError) { ... }
}
```

#### 3. Widget Updated

Added observer invitation in `src/utils/matrix-client.ts` (lines 879-889):

```javascript
// Invite observer user if configured (read-only access)
if ((window as any).__MATRIX_CONFIG__?.observer?.enabled &&
    (window as any).__MATRIX_CONFIG__?.observer?.auto_invite) {
  try {
    const observerUserId = (window as any).__MATRIX_CONFIG__.observer.user_id
    await supportBotClient.invite(this.currentRoomId, observerUserId)
    console.log('Invited observer user (read-only)')
  } catch (error) {
    console.warn('Failed to invite observer user:', error)
  }
}
```

---

## Deployment Instructions

### Step 1: Update Configuration Files

On your **local machine**:

```bash
cd /Users/cdl/Projects/matrix-chat-support

# Verify changes in config.yaml
grep -A 10 "observer:" config/config.yaml

# You should see the observer configuration block
```

### Step 2: Rebuild Widget (Local)

```bash
# Rebuild the widget with observer support
npm run build:widget

# This creates updated files in dist/widget/
```

### Step 3: Copy Updated Files to Server

```bash
# Replace with your actual server details
SERVER_IP="172.20.89.50"
SERVER_USER="your_username"

# Copy updated config
scp config/config.yaml ${SERVER_USER}@${SERVER_IP}:/opt/matrix-chat-support/config/

# Copy updated Telegram router
scp scripts/telegram-department-router.js ${SERVER_USER}@${SERVER_IP}:/opt/matrix-chat-support/scripts/

# Copy updated widget
scp -r dist/widget/* ${SERVER_USER}@${SERVER_IP}:/opt/matrix-chat-support/dist/widget/
```

### Step 4: Create Observer User on Server

SSH into your server:

```bash
ssh ${SERVER_USER}@${SERVER_IP}
cd /opt/matrix-chat-support

# Create observer user
docker exec matrix-synapse register_new_matrix_user \
  -c /data/homeserver.yaml \
  -u observer \
  -p observer123 \
  --no-admin \
  "http://172.20.89.50:8008"
```

### Step 5: Get Observer Access Token

```bash
# Login to get access token
curl -X POST \
  -H "Content-Type: application/json" \
  http://172.20.89.50:8008/_matrix/client/r0/login \
  -d '{
    "type": "m.login.password",
    "user": "observer",
    "password": "observer123"
  }' | jq -r '.access_token'

# Save this token - you'll need it for config.yaml
```

### Step 6: Update config.yaml with Observer Token

```bash
# Edit config.yaml
sudo nano /opt/matrix-chat-support/config/config.yaml

# Find the observer section and add the token:
observer:
  enabled: true
  user_id: "@observer:172.20.89.50"  # Change localhost to server IP
  password: "observer123"
  access_token: "syt_b2JzZXJ2ZXI_xxxxxxxxxxxxx"  # Paste token here
  display_name: "Support Observer"
  auto_invite: true
  permissions: "read_only"
```

### Step 7: Restart Services

```bash
# Restart Telegram router
sudo systemctl restart matrix-chat-telegram.service

# Restart widget server
sudo systemctl restart matrix-chat-widget.service

# Check status
sudo systemctl status matrix-chat-telegram.service
sudo systemctl status matrix-chat-widget.service
```

---

## Testing Instructions

### Test 1: Multi-User Invitation (Telegram)

1. **Send message to Telegram bot** from a new Telegram account:
   ```
   /start_support
   ```

2. **Login to Element as support_agent1**:
   - URL: `http://172.20.89.50:8081`
   - User: `support_agent1`
   - Password: `support1123`

3. **Login to Element as support_agent2** (in different browser or incognito):
   - URL: `http://172.20.89.50:8081`
   - User: `support_agent2`
   - Password: `support2123`

4. **Verify both users see the new conversation**:
   - Both should see the same room in "Telegram - General Support" space
   - Both can send messages
   - Customer receives responses from both agents

5. **Expected console output** in Telegram router logs:
   ```bash
   sudo journalctl -u matrix-chat-telegram.service -n 50 -f

   # You should see:
   📧 Inviting 3 department users to room !xyz:172.20.89.50...
     ✅ Invited @support_agent1:172.20.89.50 to room
     ✅ Invited @support_agent2:172.20.89.50 to room
     ✅ Invited @support_agent3:172.20.89.50 to room
   ```

### Test 2: Observer User Can View (Read-Only)

1. **Create a new Telegram conversation**:
   ```
   /start_commerce
   ```

2. **Login as observer**:
   - URL: `http://172.20.89.50:8081`
   - User: `observer`
   - Password: `observer123`

3. **Verify observer can see the conversation**:
   - Navigate to "Telegram - Commerce Support" space
   - Observer should see the new conversation
   - Observer can read all messages

4. **Verify observer CANNOT send messages**:
   - Try to type a message
   - Element should show: **"You do not have permission to post in this room"**

5. **Expected console output**:
   ```bash
   sudo journalctl -u matrix-chat-telegram.service -n 50 -f

   # You should see:
   👁️  Observer invited to room !abc:172.20.89.50 (read-only)
   ```

### Test 3: Multi-User Invitation (Widget)

1. **Embed widget on test website** or use the test page

2. **Start a new conversation** as a customer

3. **Verify all commerce agents see it**:
   - Login as `commerce_agent1`, `commerce_agent2`, `commerce_agent3`, `commerce_agent4`
   - All 4 users should see the conversation in "Web-Chat - Commerce Support"

4. **Verify observer sees it**:
   - Observer should see it in "Web-Chat - Commerce Support"
   - Observer can read but not send

### Test 4: All Departments

Repeat Test 1 and Test 2 for all departments:
- **Support** (3 users): `/start_support`
- **Commerce** (4 users): `/start_commerce`
- **Identification** (2 users): `/start_id`

Each department's users should all be invited to their respective conversations.

---

## Troubleshooting

### Issue: Only one user still receiving messages

**Check 1: Verify department_users in config**
```bash
grep -A 5 "department_users:" /opt/matrix-chat-support/config/config.yaml

# Should show arrays like:
#   department_users:
#     - "@support_agent1:172.20.89.50"
#     - "@support_agent2:172.20.89.50"
#     - "@support_agent3:172.20.89.50"
```

**Check 2: Verify Telegram router loaded the fix**
```bash
grep -A 10 "usersToInvite" /opt/matrix-chat-support/scripts/telegram-department-router.js

# Should show the new loop code
```

**Check 3: Check service logs**
```bash
sudo journalctl -u matrix-chat-telegram.service -n 100 --no-pager | grep "Invited"

# You should see multiple "Invited" lines per conversation
```

### Issue: Observer can send messages

**Fix: Reset room power levels**
```bash
# Get admin token
ADMIN_TOKEN=$(grep -A 1 "admin_access_token:" /opt/matrix-chat-support/config/config.yaml | tail -1 | awk '{print $2}' | tr -d '"')

# Get room ID from Element (Room Settings → Advanced)
ROOM_ID="!xyz:172.20.89.50"

# Get current power levels
curl -H "Authorization: Bearer $ADMIN_TOKEN" \
  "http://172.20.89.50:8008/_matrix/client/v3/rooms/${ROOM_ID}/state/m.room.power_levels/" \
  > power_levels.json

# Edit power_levels.json:
nano power_levels.json

# Ensure:
# "users": {
#   "@observer:172.20.89.50": 0,
#   ...
# },
# "events_default": 50

# Upload fixed power levels
curl -X PUT \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  "http://172.20.89.50:8008/_matrix/client/v3/rooms/${ROOM_ID}/state/m.room.power_levels/" \
  -d @power_levels.json
```

### Issue: Observer not auto-invited to new rooms

**Check 1: Verify observer config enabled**
```bash
grep -A 5 "observer:" /opt/matrix-chat-support/config/config.yaml

# Should show:
# observer:
#   enabled: true
#   auto_invite: true
```

**Check 2: Check logs for observer invitation**
```bash
sudo journalctl -u matrix-chat-telegram.service -n 100 --no-pager | grep -i observer
```

**Check 3: Manually invite observer to existing rooms**
```bash
ROOM_ID="!xyz:172.20.89.50"

curl -X POST \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  "http://172.20.89.50:8008/_matrix/client/v3/rooms/${ROOM_ID}/invite" \
  -d '{"user_id": "@observer:172.20.89.50"}'
```

---

## Summary of Changes

### Files Modified:
1. **config/config.yaml** - Added observer configuration block
2. **scripts/telegram-department-router.js** - Fixed multi-user invitation + added observer
3. **src/utils/matrix-client.ts** - Added observer invitation to widget

### Users Per Department (After Fix):
- **Support**: 3 users (`support_agent1`, `support_agent2`, `support_agent3`) + observer
- **Commerce**: 4 users (`commerce_agent1-4`) + observer
- **Identification**: 2 users (`identify_agent1`, `identify_agent2`) + observer

### Expected Behavior:
- ✅ All department users invited to new conversations
- ✅ Observer auto-invited to all conversations (read-only)
- ✅ Works for both Telegram and Widget channels
- ✅ Observer cannot send messages (power level enforcement)

---

## Next Steps

1. **Test on local environment** first before deploying to production
2. **Deploy to production server** following Step 3-7 above
3. **Test with real employees** using all departments
4. **Monitor logs** for any issues during first week
5. **Document observer credentials** securely

For issues or questions, check service logs:
```bash
sudo journalctl -u matrix-chat-telegram.service -f
sudo journalctl -u matrix-chat-widget.service -f
```
