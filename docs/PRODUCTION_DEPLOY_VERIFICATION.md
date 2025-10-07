# Production Deployment Script Verification

**Date**: October 7, 2025
**Script**: `scripts/production-deploy.sh`
**Status**: ✅ VERIFIED AND UPDATED FOR MULTI-USER CONFIGURATION

---

## Overview

The production deployment script has been verified and updated to handle the complete multi-user, multi-department configuration including:

- **3 Departments**: Support (3 users), Commerce (4 users), Identification (2 users)
- **Observer User**: Read-only access to all departments
- **Multi-User Invitation**: All department users invited to rooms and spaces
- **Domain Configuration**: IP address or domain name support
- **Telegram Integration**: Full support for Telegram bot deployment

---

## Key Updates Applied

### 1. Observer User Creation ✅

**Added**: Lines 414-417 in `production-deploy.sh`

```bash
# Observer User (read-only access to all departments)
print_info "Creating Observer User (read-only)..."
local observer_token=$(matrix_create_user "$homeserver" "observer" "observer123" "false")
user_tokens["observer"]="$observer_token"
```

**Result**: Script now creates all 11 users (1 admin + 9 department + 1 observer)

---

### 2. Enhanced YAML Configuration Update ✅

**Updated**: Lines 427-503 in `production-deploy.sh`

**Features**:
- ✅ Updates `homeserver` URLs to use production domain/IP
- ✅ **Preserves `department_users` arrays** - does NOT delete them
- ✅ Updates all user IDs from `@user:localhost` to `@user:PRODUCTION_DOMAIN`
- ✅ Updates observer configuration with token and domain
- ✅ Updates Telegram bot token
- ✅ Updates CORS origins for production
- ✅ Maintains department tokens and admin tokens

**Critical Code** (lines 459-465):
```python
# Update department_users array to use production domain
if 'department_users' in dept['matrix'] and dept['matrix']['department_users']:
    updated_users = []
    for user_id in dept['matrix']['department_users']:
        username = user_id.split(':')[0]  # @user:localhost -> @user
        updated_users.append(f'{username}:{domain}')
    dept['matrix']['department_users'] = updated_users
```

**What This Does**:
- Finds `department_users: ["@support_agent1:localhost", "@support_agent2:localhost", ...]`
- Transforms to `department_users: ["@support_agent1:172.20.89.50", "@support_agent2:172.20.89.50", ...]`
- **PRESERVES** the multi-user arrays - does NOT reduce to single user

---

### 3. Improved User Creation Function ✅

**Updated**: `scripts/lib/production-utils.sh` lines 472-527

**New Features**:
- ✅ Handles existing users gracefully (no error if user already exists)
- ✅ Retrieves token for existing users
- ✅ Clear success/warning messages

**Code**:
```bash
# Check if user already exists
if [ $create_result -ne 0 ]; then
    if echo "$create_output" | grep -iq "already exists\|user exists"; then
        print_warning "User $username already exists, getting token..." >&2
    else
        print_error "Failed to create user: $username" >&2
        return 1
    fi
fi
```

**Result**: Script can be re-run without failing on existing users

---

### 4. Updated Credentials File ✅

**Added**: Lines 532-533 in `production-deploy.sh`

```bash
OBSERVER (read-only access to all departments):
  observer | observer123 | Token: ${user_tokens[observer]}
```

**Result**: All 11 users documented in credentials file

---

## Deployment Flow

### Phase 1-5: Infrastructure Setup
1. Pre-flight checks (Docker, Node.js, ports, disk space)
2. System user creation (`matrix-chat`)
3. Application installation and widget build
4. Docker services (PostgreSQL, Synapse, Element, Admin Panel)
5. Configuration gathering (domain, passwords, tokens)

### Phase 6: User Creation ✅ VERIFIED

**Creates**:
- `admin` (admin user)
- `support_agent1`, `support_agent2`, `support_agent3`
- `commerce_agent1`, `commerce_agent2`, `commerce_agent3`, `commerce_agent4`
- `identify_agent1`, `identify_agent2`
- `observer` (read-only)

**Generates**: Access tokens for all 11 users

### Phase 6 (continued): Configuration Update ✅ VERIFIED

**Updates `config.yaml`**:

**BEFORE (localhost)**:
```yaml
departments:
  - id: "support"
    matrix:
      homeserver: "http://localhost:8008"
      bot_user_id: "@support_agent1:localhost"
      department_users:
        - "@support_agent1:localhost"
        - "@support_agent2:localhost"
        - "@support_agent3:localhost"
      access_token: ""  # Empty
```

**AFTER (production with IP 172.20.89.50)**:
```yaml
departments:
  - id: "support"
    matrix:
      homeserver: "http://172.20.89.50:8008"
      bot_user_id: "@support_agent1:172.20.89.50"
      department_users:
        - "@support_agent1:172.20.89.50"
        - "@support_agent2:172.20.89.50"
        - "@support_agent3:172.20.89.50"
      access_token: "syt_c3VwcG9ydF9hZ2VudDE_..."  # Real token
      admin_access_token: "syt_YWRtaW4_..."  # Admin token
```

**Observer Configuration**:
```yaml
observer:
  enabled: true
  user_id: "@observer:172.20.89.50"
  access_token: "syt_b2JzZXJ2ZXI_..."  # Real token
  auto_invite: true
  permissions: "read_only"
```

### Phase 7-12: Service Deployment
7. Telegram router startup
8. Systemd service installation
9. Web server configuration (Nginx/Apache)
10. Firewall setup (optional)
11. Verification tests
12. Documentation generation

---

## What Gets Preserved

### ✅ Multi-User Arrays
All `department_users` arrays are **PRESERVED** and **UPDATED** to production domain:

**Support Department**:
```yaml
department_users:
  - "@support_agent1:DOMAIN"
  - "@support_agent2:DOMAIN"
  - "@support_agent3:DOMAIN"
```

**Commerce Department**:
```yaml
department_users:
  - "@commerce_agent1:DOMAIN"
  - "@commerce_agent2:DOMAIN"
  - "@commerce_agent3:DOMAIN"
  - "@commerce_agent4:DOMAIN"
```

**Identification Department**:
```yaml
department_users:
  - "@identify_agent1:DOMAIN"
  - "@identify_agent2:DOMAIN"
```

### ✅ Space Configuration
```yaml
spaceConfig:
  channelId: "web-chat"  # PRESERVED
  autoCreateDepartmentSpace: true  # PRESERVED
  departmentSpaceNaming: "Web-Chat - General Support"  # PRESERVED
```

### ✅ Widget Settings
```yaml
widget:
  greeting: "Hi! How can our support team help you today?"  # PRESERVED
  placeholder_text: "Describe your technical issue..."  # PRESERVED
```

### ✅ Observer Configuration
```yaml
observer:
  enabled: true  # UPDATED to true
  user_id: "@observer:DOMAIN"  # UPDATED
  access_token: "TOKEN"  # ADDED
  auto_invite: true  # PRESERVED
  permissions: "read_only"  # PRESERVED
```

---

## Post-Deployment Verification

### Expected Behavior After Deployment

#### Widget Test (Commerce Department)
1. Customer visits widget, selects "Commerce Support"
2. Room created with ALL 4 commerce agents invited:
   - `@commerce_agent1:172.20.89.50`
   - `@commerce_agent2:172.20.89.50`
   - `@commerce_agent3:172.20.89.50`
   - `@commerce_agent4:172.20.89.50`
3. All 4 agents see room in "Web-Chat - Commerce Support" space
4. Observer also sees room (read-only)

#### Telegram Test (Identification Department)
1. Customer messages bot with `/start_id`
2. Room created with BOTH identification agents invited:
   - `@identify_agent1:172.20.89.50`
   - `@identify_agent2:172.20.89.50`
3. Both agents see room in "Telegram - Account Verification" space
4. Observer also sees room (read-only)

### Verification Commands

After deployment, SSH to server and run:

```bash
# Check all users exist
curl -H "Authorization: Bearer ADMIN_TOKEN" \
  "http://localhost:8008/_synapse/admin/v2/users?from=0&limit=20" | jq '.users[] | .name'

# Expected output:
# @admin:DOMAIN
# @support_agent1:DOMAIN
# @support_agent2:DOMAIN
# @support_agent3:DOMAIN
# @commerce_agent1:DOMAIN
# @commerce_agent2:DOMAIN
# @commerce_agent3:DOMAIN
# @commerce_agent4:DOMAIN
# @identify_agent1:DOMAIN
# @identify_agent2:DOMAIN
# @observer:DOMAIN

# Check department_users in config
grep -A 5 "department_users:" /opt/matrix-chat-support/config/config.yaml

# Check observer config
grep -A 5 "observer:" /opt/matrix-chat-support/config/config.yaml

# Check services
sudo systemctl status matrix-chat-widget
sudo systemctl status matrix-chat-telegram
```

---

## Important Notes for Production

### Using IP Address as Domain

When you deploy with an IP address like `172.20.89.50`:

✅ **Works**:
- Widget embed: `<script src="http://172.20.89.50:3001/embed.js"></script>`
- Matrix homeserver: `http://172.20.89.50:8008`
- All user IDs: `@user:172.20.89.50`

⚠️ **Limitations**:
- No SSL/HTTPS without domain name
- Telegram webhook may require domain (but polling mode works)
- Some browsers may block mixed content (HTTP widget on HTTPS site)

### Recommended Setup

For production company deployment:
1. Use a real domain name (e.g., `support.yourcompany.com`)
2. Enable SSL via Let's Encrypt during Phase 9
3. Configure firewall to allow ports 80, 443, 8008

---

## Credentials Security

After deployment, credentials are saved to:
```
/opt/matrix-chat-support/data/user-credentials.txt
```

**IMPORTANT**:
- File permissions: `600` (owner read/write only)
- Owner: `matrix-chat` system user
- Contains all 11 user passwords and access tokens
- **BACKUP THIS FILE SECURELY**

---

## Troubleshooting

### Issue: "department_users not found in config"

**Check**:
```bash
cat /opt/matrix-chat-support/config/config.yaml | grep -A 5 "department_users"
```

**Expected**: Should show arrays for all departments

**If missing**: Re-run deployment or manually add from local `config/config.yaml`

### Issue: "Only first user receiving messages"

**Check**:
```bash
# Verify department_users in config
grep -A 5 "department_users:" /opt/matrix-chat-support/config/config.yaml

# Check widget code has fix
grep -A 5 "departmentUsers" /opt/matrix-chat-support/src/utils/matrix-client.ts

# Check Telegram router has fix
grep -A 5 "department.departmentUsers" /opt/matrix-chat-support/scripts/telegram-department-router.js
```

**Solution**: Ensure latest code deployed, rebuild widget if needed

### Issue: "Observer not invited to rooms"

**Check**:
```bash
# Verify observer config
grep -A 5 "observer:" /opt/matrix-chat-support/config/config.yaml

# Should show:
# observer:
#   enabled: true
#   user_id: "@observer:DOMAIN"
#   access_token: "syt_..."
#   auto_invite: true
```

**Solution**: Restart services to pick up config changes

---

## Summary

✅ **Deployment script is READY for production**

**Key Capabilities**:
- Creates all 11 users (admin + 9 dept + observer)
- Preserves multi-user department configuration
- Updates all domains/IPs from localhost to production
- Generates and stores access tokens
- Handles existing users gracefully
- Deploys widget with multi-user fix
- Deploys Telegram router with multi-user fix
- Sets up systemd services for auto-start
- Generates comprehensive documentation

**User Experience After Deployment**:
- Widget: All department users see conversations in proper spaces
- Telegram: All department users see conversations in proper spaces
- Observer: Sees all conversations (read-only) across all departments
- Customers: Seamless experience with professional support team

**Ready for test server deployment with IP address as domain!** 🚀
