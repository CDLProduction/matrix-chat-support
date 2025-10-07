# Observer User Setup Guide

This guide explains how to create and configure a read-only observer user who can view all conversations but cannot send messages.

## Overview

The observer user:
- ✅ Can view all department spaces
- ✅ Can read all messages in all rooms
- ✅ Can see conversation history
- ❌ **Cannot send messages** (enforced by room power levels)
- ✅ Gets auto-invited to new customer conversations (with auto-invite enabled)

## Quick Setup (Production Server)

### Step 1: Create Observer User

```bash
cd /opt/matrix-chat-support
chmod +x scripts/create-observer-user.sh
sudo ./scripts/create-observer-user.sh
```

This will:
1. Create the `observer` user account
2. Set display name to "Support Observer"
3. Invite observer to all existing department spaces
4. Configure read-only permissions (power level 0, events_default 50)
5. Save credentials to `/opt/matrix-chat-support/data/observer-credentials.txt`

### Step 2: Login to Element

1. Open: http://172.20.89.50:8081
2. Login with:
   - Username: `observer`
   - Password: [password you set during creation]
3. Observer will see all department spaces but cannot send messages

### Step 3: Enable Auto-Invite (Optional)

To automatically invite observer to new customer conversations:

```bash
sudo ./scripts/setup-observer-auto-invite.sh
```

This adds observer configuration to `config.yaml`:

```yaml
observer:
  enabled: true
  user_id: "@observer:172.20.89.50"
  auto_invite: true
  permissions: "read_only"
```

### Step 4: Update Room Creation Logic

The observer will be automatically invited to **existing** spaces, but for **new customer rooms**, you need to update the room creation code.

#### For Telegram Router

Edit `/opt/matrix-chat-support/scripts/telegram-department-router.js`:

Find the section where new rooms are created (around line 450-500), and add this code **after** the room is created and support agents are invited:

```javascript
// Auto-invite observer if configured
if (config.observer?.enabled && config.observer?.auto_invite) {
  try {
    await axios.post(`${MATRIX_HOMESERVER}/_matrix/client/v3/rooms/${roomId}/invite`, {
      user_id: config.observer.user_id
    }, {
      headers: {
        'Authorization': `Bearer ${ADMIN_ACCESS_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });

    console.log(`👁️ Observer invited to room ${roomId}`);
  } catch (error) {
    console.error('Warning: Failed to invite observer:', error.message);
  }
}
```

Then restart the Telegram router:
```bash
sudo systemctl restart matrix-chat-telegram.service
```

#### For Widget Server

Edit `/opt/matrix-chat-support/server/index.js`:

Find the room creation endpoint (search for `createRoom` or `/api/create-room`), and add the same observer invite code after the room is created.

Then restart the widget server:
```bash
sudo systemctl restart matrix-chat-widget.service
```

## How Read-Only Works

### Matrix Power Levels Explanation

- **Power Level 0**: Observer's permission level (lowest)
- **Power Level 50**: Required to send messages (events_default)
- **Power Level 100**: Admin/moderator level

Since observer has level 0 and sending messages requires level 50, they **cannot send messages**.

### Room Permission Structure

```json
{
  "users": {
    "@observer:172.20.89.50": 0,
    "@support_agent1:172.20.89.50": 50,
    "@admin:172.20.89.50": 100
  },
  "events_default": 50,
  "users_default": 0
}
```

## Testing Observer Permissions

### Test 1: Login and View Rooms
1. Login as observer
2. Navigate to department spaces
3. You should see all conversations

### Test 2: Attempt to Send Message
1. Click on a conversation
2. Try to type in the message box
3. Element should show an error: "You do not have permission to post in this room"

### Test 3: New Conversation (with auto-invite enabled)
1. Create a new customer conversation via Telegram or Widget
2. Check observer's Element client
3. Observer should automatically see the new room

## Managing Observer Access

### Grant Access to Specific Room Manually

```bash
# Get room ID from Element (Room Settings → Advanced)
ROOM_ID="!abc123:172.20.89.50"
ADMIN_TOKEN="syt_xxx..." # From config.yaml

curl -X POST \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  "http://172.20.89.50:8008/_matrix/client/v3/rooms/${ROOM_ID}/invite" \
  -d '{"user_id": "@observer:172.20.89.50"}'
```

### Revoke Access from Specific Room

```bash
curl -X POST \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  "http://172.20.89.50:8008/_matrix/client/v3/rooms/${ROOM_ID}/kick" \
  -d '{"user_id": "@observer:172.20.89.50", "reason": "Access removed"}'
```

### Change Observer to Allow Sending Messages

If you need to temporarily allow observer to send messages:

```bash
ROOM_ID="!abc123:172.20.89.50"

# Get current power levels
curl -H "Authorization: Bearer $ADMIN_TOKEN" \
  "http://172.20.89.50:8008/_matrix/client/v3/rooms/${ROOM_ID}/state/m.room.power_levels/"

# Update observer to level 50 (can send)
# Use the returned JSON, modify users.@observer:172.20.89.50 to 50, then PUT it back
```

## Security Considerations

1. **Password Security**: Use a strong password for observer account
2. **Access Control**: Only share observer credentials with authorized personnel
3. **Audit Logging**: Observer's view activity is logged in Matrix homeserver logs
4. **No Message Editing**: Observer cannot edit/delete messages in any room
5. **No Room Management**: Observer cannot change room settings, invite others, or kick users

## Troubleshooting

### Observer Can Send Messages
- Check room power levels: `events_default` should be 50
- Observer's power level should be 0
- Rerun the setup script to fix permissions

### Observer Not Auto-Invited to New Rooms
- Verify `config.yaml` has observer configuration
- Check that room creation code includes observer invite
- Restart widget server and Telegram router services

### Observer Cannot See Existing Rooms
- Manually invite observer to specific rooms
- Check that observer accepted all space invitations
- Verify observer is logged into correct homeserver

## Alternative: Create Multiple Observer Users

You can create multiple observer accounts for different teams:

```bash
# Create second observer
docker exec matrix-synapse register_new_matrix_user \
  -c /data/homeserver.yaml \
  -u "observer_management" \
  -p "password" \
  --no-admin \
  "http://172.20.89.50:8008"
```

Then manually configure permissions and invites for each observer.

## Summary

✅ **Created**: Read-only observer user
✅ **Permissions**: Can view all conversations, cannot send messages
✅ **Access**: Invited to all department spaces
✅ **Auto-Invite**: Optional configuration for new rooms
✅ **Security**: Power level enforcement prevents message sending

For questions or issues, check the Matrix homeserver logs:
```bash
sudo docker compose logs synapse -f
```
