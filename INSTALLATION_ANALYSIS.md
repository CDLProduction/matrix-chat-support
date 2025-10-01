# Complete Installation Analysis - Matrix Chat Support Widget

> **Deep technical analysis of all components to ensure perfect installation script**

## 🎯 Executive Summary

This document contains a complete analysis of the Matrix Chat Support Widget system to create a bulletproof installation script that supports:

- **3 departments**: support, commerce, identification
- **Multiple users per department**: 3 + 4 + 2 = 9 total Matrix users
- **Telegram puppeting**: Each user uses their own Telegram account
- **Zero manual configuration**: Fully automated setup

---

## 📊 PART 1: Current Architecture Analysis

### Widget (Web Chat) Architecture

**Entry Point**: `src/widget.tsx` → Vite builds to IIFE bundle

**Key Components**:
1. **ChatWidget** (`src/components/ChatWidget.tsx`)
   - Department selection UI (graphical cards with icons)
   - Channel selection (Web Chat vs Telegram)
   - Contact form for customer details
   - Chat interface

2. **Matrix Client** (`src/utils/matrix-client.ts`)
   - Creates guest users for customers
   - Creates Matrix rooms using **admin API** (not bot token!)
   - Invites department bot user (single user from config)
   - Uses `supportRoomId` if configured, or creates new rooms
   - **Space Management**: Integrates with SpaceManager

3. **Room Creation Process**:
   ```typescript
   // Line 784: Using SUPPORT BOT to create room
   const supportBotClient = createClient({
     baseUrl: this.config.homeserver,
     accessToken: await this.getSupportBotToken()  // From config
   })

   const response = await supportBotClient.createRoom({
     name: roomName,
     topic: roomTopic,
     preset: 'private_chat',
     invite: [currentUserId]  // Guest user
   })

   // Line 794: Invite guest to room
   await supportBotClient.invite(this.currentRoomId, currentUserId)

   // Line 797: Guest joins
   await this.client.joinRoom(this.currentRoomId)

   // Line 803: Invite configured bot user (if different)
   if (this.config.botUserId && this.config.botUserId !== supportBotUserId) {
     await supportBotClient.invite(this.currentRoomId, this.config.botUserId)
   }
   ```

**CRITICAL FINDINGS**:
- ✅ Widget creates rooms using department's access_token
- ✅ Only invites ONE bot user (`config.botUserId`)
- ❌ **Does NOT invite multiple users** from department
- 🔧 **Need to modify** widget to invite all department users

### Telegram Bot Architecture

**Entry Point**: `scripts/telegram-department-router.js`

**Key Components**:
1. **Department Configuration** (Lines 76-101):
   ```javascript
   const TELEGRAM_DEPARTMENT_SPACES = {
     'support': {
       spaceId: null,
       name: 'Telegram - General Support',
       matrixUser: '@support:localhost',  // SINGLE USER
       command: '/start_support'
     }
     // ... other departments
   }
   ```

2. **Welcome Message with Inline Keyboard** (Lines 388-424):
   ```javascript
   await bot.sendMessage(chatId, welcomeMessage, {
     parse_mode: 'Markdown',
     reply_markup: {
       inline_keyboard: [
         [
           { text: '🎧 General Support', callback_data: 'dept_support' },
           { text: '💼 Tech Support', callback_data: 'dept_tech_support' }
         ],
         [
           { text: '🔒 Account Verification', callback_data: 'dept_identification' },
           { text: '💰 Sales & Commerce', callback_data: 'dept_commerce' }
         ]
       ]
     }
   })
   ```

3. **Department Selection Handler** (Lines 432-478):
   ```javascript
   async function handleDepartmentSelection(departmentId, telegramUser, chatId) {
     const department = TELEGRAM_DEPARTMENT_SPACES[departmentId]

     // Create Matrix room
     const roomResponse = await axios.post(`${MATRIX_HOMESERVER}/_matrix/client/v3/createRoom`, {
       name: roomName,
       preset: 'private_chat',
       invite: [department.matrixUser],  // SINGLE USER INVITED
       initial_state: [{
         type: 'm.room.power_levels',
         content: {
           users: {
             '@admin:localhost': 100,
             [department.matrixUser]: 50  // Only one user
           }
         }
       }]
     })
   }
   ```

4. **Message Forwarding** (Lines 514-648):
   - **Telegram → Matrix**: Direct message send via admin token
   - **Matrix → Telegram**: Polls Matrix sync API every 5 seconds
   - **Loop Prevention**: Filters by sender, timestamps, processed message IDs

**CRITICAL FINDINGS**:
- ✅ Uses inline keyboard buttons (graphical)
- ✅ Creates department spaces automatically
- ✅ Message loop prevention with timestamp filtering
- ❌ **Only invites ONE user** per department
- 🔧 **Need to modify** to invite all department users
- 🔧 **Need to generate** keyboard dynamically based on config

### mautrix-telegram Bridge Configuration

**Current Config** (`mautrix-telegram/config.yaml`):

```yaml
telegram:
  api_id: 22451908
  api_hash: 40f6de1fd19af98c0b60c364a30d5fa9
  bot_token: ""  # Disabled - direct bot used instead

permissions:
  '*': relaybot
  'localhost': full
  '@admin:localhost': admin
  '@support:localhost': full
  '@tech_support:localhost': full
  '@identification:localhost': full
  '@commerce:localhost': full

relaybot:
  private_chat:
    invite: []  # Empty - we handle invites in bot
    state_changes: true
    message: |
      🎧 **Welcome to Customer Support!**
      ...
  authless_portals: true
  ignore_own_incoming_events: false  # CRITICAL: Process bot messages
```

**CRITICAL FINDINGS**:
- ✅ Bridge configured with `full` permission (not `puppeting`)
- ❌ Users need `puppeting` permission to use personal Telegram
- 🔧 **Need to change** all support users to `puppeting` level
- ✅ `ignore_own_incoming_events: false` prevents message loops
- 🔧 **Need to add** all 9 users to permissions

---

## 📊 PART 2: Multi-User Requirements

### Desired Configuration

**Department Structure**:
```yaml
departments:
  - id: "support"
    name: "General Support"
    users:  # NEW: Array of users
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
      - username: "support_agent3"
        matrix_user_id: "@support_agent3:localhost"
        access_token: "syt_..."
        display_name: "Bob Wilson"
        telegram_enabled: true
    matrix:
      bot_user_id: "@support_agent1:localhost"  # Primary (for widget)
      access_token: "syt_..."  # Primary token

  - id: "commerce"
    name: "Sales & Commerce"
    users:  # 4 users
      - username: "commerce_agent1"
        # ...
      - username: "commerce_agent2"
        # ...
      - username: "commerce_agent3"
        # ...
      - username: "commerce_agent4"
        # ...

  - id: "identification"
    name: "Account Verification"
    users:  # 2 users
      - username: "id_agent1"
        # ...
      - username: "id_agent2"
        # ...
```

### Critical Code Changes Needed

#### Change 1: Widget - Invite Multiple Users

**File**: `src/utils/matrix-client.ts` (around line 803)

**Current**:
```typescript
if (this.config.botUserId && this.config.botUserId !== supportBotUserId) {
  await supportBotClient.invite(this.currentRoomId, this.config.botUserId)
}
```

**Required**:
```typescript
// Invite ALL department users if configured
if (this.config.departmentUsers && Array.isArray(this.config.departmentUsers)) {
  for (const userId of this.config.departmentUsers) {
    if (userId !== supportBotUserId && userId !== currentUserId) {
      try {
        await supportBotClient.invite(this.currentRoomId, userId)
        console.log(`Invited ${userId} to room`)
      } catch (error) {
        console.warn(`Failed to invite ${userId}:`, error)
      }
    }
  }
} else if (this.config.botUserId && this.config.botUserId !== supportBotUserId) {
  // Fallback to single bot user (backward compatibility)
  await supportBotClient.invite(this.currentRoomId, this.config.botUserId)
}
```

#### Change 2: Telegram Bot - Multiple User Invitations

**File**: `scripts/telegram-department-router.js` (around line 310)

**Current**:
```javascript
const roomResponse = await axios.post(`${MATRIX_HOMESERVER}/_matrix/client/v3/createRoom`, {
  invite: [department.matrixUser],  // Single user
})
```

**Required**:
```javascript
const roomResponse = await axios.post(`${MATRIX_HOMESERVER}/_matrix/client/v3/createRoom`, {
  invite: department.users,  // Array of users
  initial_state: [{
    type: 'm.room.power_levels',
    content: {
      users: {
        '@admin:localhost': 100,
        ...Object.fromEntries(department.users.map(u => [u, 50]))
      }
    }
  }]
})
```

#### Change 3: Telegram Bot - Dynamic Keyboard

**File**: `scripts/telegram-department-router.js` (around line 388)

**Current**: Hardcoded 4 departments

**Required**:
```javascript
function generateDepartmentKeyboard() {
  const keyboard = []
  const deptArray = Object.entries(TELEGRAM_DEPARTMENT_SPACES)

  for (let i = 0; i < deptArray.length; i += 2) {
    const row = []
    const [id1, dept1] = deptArray[i]
    row.push({
      text: `${dept1.icon || '📋'} ${dept1.name}`,
      callback_data: `dept_${id1}`
    })

    if (deptArray[i + 1]) {
      const [id2, dept2] = deptArray[i + 1]
      row.push({
        text: `${dept2.icon || '📋'} ${dept2.name}`,
        callback_data: `dept_${id2}`
      })
    }

    keyboard.push(row)
  }

  return { inline_keyboard: keyboard }
}
```

#### Change 4: mautrix-telegram - Puppeting Permissions

**File**: `mautrix-telegram/config.yaml`

**Current**:
```yaml
permissions:
  '@support:localhost': full
```

**Required**:
```yaml
permissions:
  '*': relaybot
  # ALL USERS WITH PUPPETING
  '@support_agent1:localhost': puppeting
  '@support_agent2:localhost': puppeting
  '@support_agent3:localhost': puppeting
  '@commerce_agent1:localhost': puppeting
  '@commerce_agent2:localhost': puppeting
  '@commerce_agent3:localhost': puppeting
  '@commerce_agent4:localhost': puppeting
  '@id_agent1:localhost': puppeting
  '@id_agent2:localhost': puppeting
  '@admin:localhost': admin
```

---

## 📊 PART 3: Installation Script Requirements

### Phase 1: Prerequisites Check

```bash
Required:
✓ Docker (v20.10+) or PostgreSQL (v12+)
✓ Node.js (v18+)
✓ npm (v9+)
✓ curl
✓ jq (for JSON parsing)
✓ 2GB RAM minimum
✓ 5GB disk space
```

### Phase 2: Interactive Configuration

**Questions to Ask**:

1. **PostgreSQL Setup**:
   - Docker (recommended) or Local
   - If local: host, port, user, password, database

2. **Matrix Configuration**:
   - Domain (default: localhost)
   - Homeserver port (default: 8008)
   - Create admin user credentials

3. **Department Configuration** (loop):
   - How many departments? (1-10)
   - For each department:
     - Department ID (alphanumeric, no spaces)
     - Display Name
     - Description
     - Icon (emoji, default based on ID)
     - Color (hex, default provided)
     - How many users? (1-20)
     - For each user:
       - Username (alphanumeric_underscore)
       - Display Name (full name)
       - Initial Password (hidden input)
       - Enable Telegram? (y/n)

4. **Telegram Configuration** (if any user has Telegram):
   - Bot Token (from @BotFather)
   - API ID (from my.telegram.org)
   - API Hash
   - Bot Username

5. **Widget Configuration**:
   - Widget Title (default: "Customer Support")
   - Brand Color (default: "#667eea")
   - Widget Position (bottom-right, bottom-left, top-right, top-left)
   - Server Port (default: 3001)

### Phase 3: Data Storage During Install

**Temporary File**: `data/install-session.json`

```json
{
  "install_id": "uuid-v4",
  "timestamp": "2025-09-30T10:30:00Z",
  "postgres": {
    "mode": "docker",
    "host": "localhost",
    "port": 5432
  },
  "matrix": {
    "domain": "localhost",
    "homeserver_url": "http://localhost:8008",
    "admin_user": "admin",
    "admin_password": "secure_password",
    "admin_token": null  // Filled after creation
  },
  "departments": [
    {
      "id": "support",
      "name": "General Support",
      "description": "...",
      "icon": "🎧",
      "color": "#667eea",
      "users": [
        {
          "username": "support_agent1",
          "display_name": "John Doe",
          "password": "temp_password",
          "telegram_enabled": true,
          "matrix_user_id": null,  // Filled after creation
          "access_token": null  // Filled after login
        }
      ]
    }
  ],
  "telegram": {
    "bot_token": "1234:ABC...",
    "api_id": "22451908",
    "api_hash": "...",
    "bot_username": "YourSupportBot"
  },
  "widget": {
    "title": "Customer Support",
    "brand_color": "#667eea",
    "position": "bottom-right",
    "port": 3001
  }
}
```

### Phase 4: Execution Steps

```bash
Step 1: Environment Setup
├─ Create directories: data/, config/, logs/, mautrix-telegram/
├─ Check/install Node dependencies
└─ Setup PostgreSQL (Docker or connect to local)

Step 2: Synapse Setup
├─ Generate Synapse homeserver.yaml
├─ Start Synapse (Docker or system service)
├─ Wait for ready (polling /health endpoint)
├─ Create admin user
└─ Get admin access token

Step 3: User Creation (Loop)
For each department:
  For each user:
    ├─ Create Matrix user (register_new_matrix_user or admin API)
    ├─ Login to get access token
    └─ Store in install-session.json

Step 4: Configuration Generation
├─ Generate config/config.yaml
│   ├─ All departments with users[] arrays
│   ├─ All access tokens in place
│   └─ Department-specific settings
├─ Generate mautrix-telegram/config.yaml
│   ├─ All users with puppeting permissions
│   ├─ Proper relaybot configuration
│   └─ Telegram API credentials
├─ Generate mautrix-telegram/registration.yaml
│   └─ Copy to Synapse data directory
└─ Generate scripts/telegram-department-router.js
    ├─ Department configuration from install data
    ├─ Dynamic keyboard generation
    └─ Multi-user invitation logic

Step 5: Bridge Setup
├─ Start mautrix-telegram bridge
├─ Wait for bridge ready
└─ Verify bridge registration with Synapse

Step 6: Widget Build
├─ Modify src/utils/matrix-client.ts (multi-user invites)
├─ Modify src/types/index.ts (add departmentUsers to config)
├─ npm install (if needed)
└─ npm run build:widget

Step 7: Service Startup
├─ Start widget server (PM2 or systemd)
├─ Start Telegram bot (PM2 or systemd)
└─ Verify all services running

Step 8: Post-Installation
├─ Save user credentials to secure file
├─ Display summary of created resources
├─ Show Telegram authentication instructions
└─ Provide next steps guide
```

### Phase 5: Post-Install Output

```
╔═══════════════════════════════════════════════════════════╗
║         INSTALLATION COMPLETED SUCCESSFULLY               ║
╚═══════════════════════════════════════════════════════════╝

📊 CREATED RESOURCES:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Matrix Users: 10 (1 admin + 9 department users)
Departments: 3 (support, commerce, identification)
Telegram Users: 7 (users with Telegram enabled)

┌─────────────────────────────────────────────────────────┐
│  Department: General Support (support)                  │
├─────────────────────────────────────────────────────────┤
│  Users:                                                 │
│    • support_agent1 (John Doe) - Telegram: ✓           │
│    • support_agent2 (Jane Smith) - Telegram: ✓         │
│    • support_agent3 (Bob Wilson) - Telegram: ✓         │
└─────────────────────────────────────────────────────────┘

[... similar for other departments ...]

🔐 USER CREDENTIALS:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Saved to: data/user-credentials.txt (KEEP SECURE!)

📱 TELEGRAM AUTHENTICATION REQUIRED:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

7 users need to authenticate their Telegram accounts:

For each user:
1. Open Element Web: http://localhost:8081
2. Login with Matrix credentials
3. Find "Telegram bridge bot" room
4. Send: login
5. Enter YOUR phone number
6. Enter SMS verification code
7. Done! You can now use your Telegram for support

Detailed guide: docs/TELEGRAM_AUTH_GUIDE.md

🌐 ACCESS POINTS:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Widget Server:  http://localhost:3001
Element Web:    http://localhost:8081
Admin Panel:    http://localhost:8080
Synapse API:    http://localhost:8008

Test Widget:    http://localhost:3001/widget/widget-test.html
Telegram Bot:   @YourSupportBot

📖 NEXT STEPS:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. Each user authenticates Telegram (see above)
2. Test widget in browser
3. Test Telegram bot: message @YourSupportBot
4. Configure production deployment (see INSTRUCTIONS.md)
5. Setup monitoring and backups

Installation log: logs/install-2025-09-30-103000.log

For help: ./scripts/install.sh --help
```

---

## 📊 PART 4: Critical Files to Generate/Modify

### File 1: `scripts/install.sh` (NEW)
- Main interactive installer
- ~1500 lines
- Bash script with colored output
- JSON manipulation with jq
- Error handling and rollback

### File 2: `scripts/lib/common.sh` (NEW)
- Shared functions (colors, prompts, validation)
- ~300 lines

### File 3: `scripts/lib/synapse-setup.sh` (NEW)
- Synapse user creation
- Token management
- ~200 lines

### File 4: `scripts/lib/config-generator.sh` (NEW)
- Generate config.yaml from install data
- Template-based generation
- ~400 lines

### File 5: `scripts/lib/telegram-setup.sh` (NEW)
- mautrix-telegram configuration
- Bridge registration
- ~300 lines

### File 6: `config/config.template.yaml` (NEW)
- Template with placeholders
- {{VARIABLE}} syntax for replacement

### File 7: `scripts/telegram-department-router.js` (REGENERATE)
- Generate from template based on install data
- Dynamic department configuration
- Multi-user support

### File 8: `src/utils/matrix-client.ts` (MODIFY)
- Add multi-user invitation logic
- ~10 lines change around line 803

### File 9: `src/types/index.ts` (MODIFY)
- Add `departmentUsers?: string[]` to MatrixConfig
- ~2 lines change

### File 10: `mautrix-telegram/config.yaml` (REGENERATE)
- Generate permissions for all users
- Based on install data

---

## 📊 PART 5: Risk Assessment & Mitigation

### High Risk Items

1. **User Creation Failures**
   - Risk: Matrix user creation fails mid-process
   - Mitigation: Transaction log + rollback capability
   - Recovery: Delete created users, restart from checkpoint

2. **Token Management**
   - Risk: Access tokens not obtained correctly
   - Mitigation: Validate each token immediately after creation
   - Recovery: Re-login specific users without recreating

3. **Bridge Startup**
   - Risk: mautrix-telegram fails to start
   - Mitigation: Validate config before starting
   - Recovery: Show bridge logs, offer to regenerate config

4. **Port Conflicts**
   - Risk: Ports 3001, 8008, 8080, 8081 already in use
   - Mitigation: Check ports before starting services
   - Recovery: Offer to stop conflicting services or use different ports

### Medium Risk Items

1. **Disk Space**
   - Risk: Run out of space during Docker image download
   - Mitigation: Check available space (require 5GB minimum)

2. **Memory**
   - Risk: System has insufficient RAM
   - Mitigation: Check available RAM (require 2GB minimum)

3. **Network**
   - Risk: Cannot download Docker images or npm packages
   - Mitigation: Test internet connectivity first

### Low Risk Items

1. **Configuration typos**
   - Mitigation: Validate all input (regex for usernames, emails, etc.)

2. **File permissions**
   - Mitigation: Check write permissions before starting

---

## 📊 PART 6: Installation Script Architecture

### Main Script Flow

```bash
#!/bin/bash
# scripts/install.sh

set -e  # Exit on error

# Source libraries
source "$(dirname "$0")/lib/common.sh"
source "$(dirname "$0")/lib/synapse-setup.sh"
source "$(dirname "$0")/lib/config-generator.sh"
source "$(dirname "$0")/lib/telegram-setup.sh"

# Global variables
INSTALL_SESSION_FILE="data/install-session.json"
USER_CREDENTIALS_FILE="data/user-credentials.txt"

# Main installation flow
main() {
  print_header "Matrix Chat Support Widget - Interactive Installer"

  # Phase 1: Prerequisites
  check_prerequisites

  # Phase 2: Interactive Configuration
  interactive_setup

  # Phase 3: Environment Setup
  setup_environment

  # Phase 4: Synapse Setup
  setup_synapse

  # Phase 5: User Creation
  create_all_users

  # Phase 6: Configuration Generation
  generate_all_configs

  # Phase 7: Bridge Setup
  setup_telegram_bridge

  # Phase 8: Widget Build
  build_widget

  # Phase 9: Service Startup
  start_all_services

  # Phase 10: Post-Installation
  display_summary
  save_user_credentials
  show_next_steps
}

main "$@"
```

### Key Functions

```bash
# Check all prerequisites
check_prerequisites() {
  check_command "docker" "Docker"
  check_command "node" "Node.js" "18"
  check_command "npm" "npm"
  check_command "curl" "curl"
  check_command "jq" "jq"
  check_disk_space "5"  # 5GB minimum
  check_ram "2"  # 2GB minimum
}

# Interactive setup wizard
interactive_setup() {
  # Collect all configuration
  ask_postgres_setup
  ask_matrix_config
  ask_department_config  # Loop through departments
  ask_telegram_config  # Only if Telegram users exist
  ask_widget_config

  # Save to session file
  save_install_session
}

# Create all Matrix users
create_all_users() {
  create_admin_user

  for dept in $(jq -c '.departments[]' "$INSTALL_SESSION_FILE"); do
    dept_id=$(echo "$dept" | jq -r '.id')
    for user in $(echo "$dept" | jq -c '.users[]'); do
      username=$(echo "$user" | jq -r '.username')
      password=$(echo "$user" | jq -r '.password')
      display_name=$(echo "$user" | jq -r '.display_name')

      create_matrix_user "$username" "$password" "$display_name"
      token=$(login_and_get_token "$username" "$password")
      save_user_token "$dept_id" "$username" "$token"
    done
  done
}

# Generate all configuration files
generate_all_configs() {
  generate_config_yaml
  generate_telegram_bot_script
  generate_mautrix_config
  generate_mautrix_registration
}
```

---

## ✅ CONCLUSION

This analysis confirms that creating a complete installation script is feasible with these requirements:

1. **Code Modifications**: Minor changes to widget (10 lines) and types (2 lines)
2. **Script Complexity**: ~2500 lines total across main script and libraries
3. **Time Estimate**: 4-6 hours to implement and test thoroughly
4. **Testing Requirements**: Full end-to-end test with 3 departments, 9 users

**Ready to proceed with implementation.**
