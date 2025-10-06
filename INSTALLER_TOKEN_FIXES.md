# Critical Token Management Fixes - Installation Guide

## Summary
This document details all critical token-related fixes implemented to ensure the Matrix Chat Support system works correctly for both Widget and Telegram components.

## Problem Overview

### Issue 1: Widget Guest User Creation Failure
**Symptom:** Widget fails with "Failed to create guest user: 401 - Invalid access token passed"

**Root Cause:**
- Widget uses `department.matrix.admin_access_token` to create guest users via Synapse Admin API
- Installer was NOT updating `admin_access_token` in department configurations
- Old/template tokens remained in config, causing API authentication failures

**Impact:** Users cannot start chats through the web widget

### Issue 2: Telegram Router User Invitation Failure
**Symptom:** Telegram service logs show "M_UNKNOWN_TOKEN" errors when inviting users to spaces

**Root Cause:**
- Telegram router reads from top-level `config.matrix.admin_access_token`
- Installer was NOT updating top-level matrix configuration
- Only department-level tokens were being updated

**Impact:** Telegram bot cannot invite support agents to conversation rooms

---

## Installer Fixes Applied

### File: `scripts/production-deploy.sh`

#### Fix 1: Top-Level Matrix Token Update (Lines 433-436)
```python
# Update top-level matrix config (used by Telegram router)
if 'matrix' in config:
    config['matrix']['access_token'] = '$admin_token'
    config['matrix']['admin_access_token'] = '$admin_token'
```

**Purpose:** Ensures Telegram router has valid admin token for space/room management

#### Fix 2: Department Admin Token Update (Lines 442, 445, 448)
```python
# Support department
dept['matrix']['admin_access_token'] = '$admin_token'

# Commerce department
dept['matrix']['admin_access_token'] = '$admin_token'

# Identification department
dept['matrix']['admin_access_token'] = '$admin_token'
```

**Purpose:** Ensures each department configuration has valid admin token for guest user creation

---

## Configuration Structure

### Top-Level Matrix Config
Used by: **Telegram Router**
```yaml
matrix:
  homeserver: "http://localhost:8008"
  access_token: "syt_YWRtaW4_..." # MUST be valid admin token
  admin_access_token: "syt_YWRtaW4_..." # MUST be valid admin token
  support_room_id: null
  bot_user_id: "@admin:localhost"
```

### Department-Level Matrix Config
Used by: **Widget Server**
```yaml
departments:
  - id: support
    matrix:
      homeserver: "http://localhost:8008"
      access_token: "syt_c3VwcG9ydF9hZ2VudDE_..." # Department bot token
      admin_access_token: "syt_YWRtaW4_..." # MUST be valid admin token
      bot_user_id: "@support_agent1:localhost"
```

---

## Token Usage Map

| Component | Token Used | Purpose | Config Location |
|-----------|------------|---------|-----------------|
| Widget - Guest Creation | `admin_access_token` | Create guest users via Synapse Admin API | `departments[].matrix.admin_access_token` |
| Widget - Room Creation | `access_token` | Create rooms as department bot | `departments[].matrix.access_token` |
| Telegram - Space Invite | `admin_access_token` | Invite users to spaces | `matrix.admin_access_token` |
| Telegram - Auto-join | `access_token` | Auto-join bot to spaces | `departments[].matrix.access_token` |

---

## Installation Process Flow

### Phase 6: User Creation & Token Management (production-deploy.sh:369-493)

1. **Create Admin User**
   - Username: `admin`
   - Password: User-provided or auto-generated
   - **Captures admin token → `$admin_token`**

2. **Create Department Users**
   - Support: `support_agent1-3` (3 users)
   - Commerce: `commerce_agent1-4` (4 users)
   - Identification: `identify_agent1-2` (2 users)
   - **Captures each user token → `user_tokens` array**

3. **Update config.yaml with Python/YAML** (Lines 422-461)
   - ✅ Update top-level `matrix.access_token = $admin_token`
   - ✅ Update top-level `matrix.admin_access_token = $admin_token`
   - ✅ Update `departments[].matrix.access_token = <dept_bot_token>`
   - ✅ Update `departments[].matrix.admin_access_token = $admin_token`
   - ✅ Update `social_media[telegram].config.bot_token = $telegram_token`

4. **Save Credentials** (Lines 465-492)
   - Creates `/opt/matrix-chat-support/data/user-credentials.txt`
   - Contains all usernames, passwords, and tokens for reference

---

## Verification Steps

### After Installation - Widget Test
```bash
# 1. Check widget server logs
sudo journalctl -u matrix-chat-widget.service -n 50

# 2. Test widget in browser
# Open test page and attempt to start chat
# Should NOT show "Failed to create guest user" error

# 3. Verify admin token in config
python3 -c "import yaml; c=yaml.safe_load(open('/opt/matrix-chat-support/config/config.yaml')); print('Support admin_token:', c['departments'][0]['matrix']['admin_access_token'][:30]+'...')"
```

### After Installation - Telegram Test
```bash
# 1. Check Telegram service logs
sudo journalctl -u matrix-chat-telegram.service -n 50

# 2. Should NOT see "M_UNKNOWN_TOKEN" errors

# 3. Verify top-level admin token
python3 -c "import yaml; c=yaml.safe_load(open('/opt/matrix-chat-support/config/config.yaml')); print('Top-level admin_token:', c['matrix']['admin_access_token'][:30]+'...')"

# 4. Test Telegram bot
# Send /start_support to bot
# Check logs for successful space creation and user invitations
```

---

## Manual Fix Scripts (If Needed)

### Fix Widget Tokens
```python
#!/usr/bin/env python3
import yaml

config_file = '/opt/matrix-chat-support/config/config.yaml'
admin_token = 'syt_YWRtaW4_...'  # Get from user-credentials.txt

with open(config_file, 'r') as f:
    config = yaml.safe_load(f)

for dept in config.get('departments', []):
    dept['matrix']['admin_access_token'] = admin_token
    print(f"✅ Updated {dept['id']}")

with open(config_file, 'w') as f:
    yaml.dump(config, f, default_flow_style=False, sort_keys=False)

print("✅ Widget tokens fixed!")
```

### Fix Telegram Tokens
```python
#!/usr/bin/env python3
import yaml

config_file = '/opt/matrix-chat-support/config/config.yaml'
admin_token = 'syt_YWRtaW4_...'  # Get from user-credentials.txt

with open(config_file, 'r') as f:
    config = yaml.safe_load(f)

if 'matrix' in config:
    config['matrix']['access_token'] = admin_token
    config['matrix']['admin_access_token'] = admin_token

with open(config_file, 'w') as f:
    yaml.dump(config, f, default_flow_style=False, sort_keys=False)

print("✅ Telegram tokens fixed!")
```

---

## Related Files Modified

1. **`scripts/production-deploy.sh`** (Lines 433-448)
   - Added top-level matrix token updates
   - Added department admin_access_token updates

2. **`server/index.js`** (Line 156)
   - Fixed CORS to allow `file://` protocol (origin: null)
   - Enables widget testing from local HTML files

3. **`scripts/telegram-department-router.js`** (Lines 15-24)
   - Fixed EventSource import for ES modules
   - Used `createRequire` for CommonJS compatibility

4. **`package.json`** (Line 2)
   - Added `"type": "module"` for ES module support

5. **`vite.config.js`** (New file)
   - Converted from TypeScript for better ES module compatibility
   - Added `__dirname` polyfill

---

## Common Errors & Solutions

### Error: "Failed to create guest user: 401"
**Solution:** Run widget token fix script, restart widget service

### Error: "M_UNKNOWN_TOKEN" in Telegram logs
**Solution:** Run Telegram token fix script, restart telegram service

### Error: "Could not start chat"
**Solution:** Check both widget and Telegram token fixes, verify admin token is valid

### Error: Widget CORS issues from file://
**Solution:** Already fixed in server/index.js (allows origin: null)

---

## Testing Checklist

- [ ] Fresh installation completes without errors
- [ ] Widget opens and shows department selection
- [ ] Can start chat in any department
- [ ] Guest users are created successfully
- [ ] Telegram service starts without token errors
- [ ] Telegram bot responds to /start_support
- [ ] Support agents receive invitations to spaces
- [ ] Messages flow bidirectionally (widget ↔ Matrix ↔ Telegram)

---

## Credits

**Fixed Issues:**
- Password capture contamination (stdout/stderr separation)
- JSON escaping with jq (special characters in passwords)
- Rate limiting (2s delays + retry logic)
- Node.js version requirements (upgraded to v22)
- Widget build process (devDependencies inclusion)
- Data directory permissions (group access for matrix-chat user)
- **Admin token propagation (top-level + department configs)**

**Date:** October 6, 2025
**Version:** Production-ready with complete token management
