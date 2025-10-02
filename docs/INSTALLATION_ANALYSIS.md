# Installation Script Analysis & Recommendations

**Analysis Date**: 2025-10-02
**Current Branch**: telegram_fix
**Project State**: Production-ready with recent Telegram fixes

## Executive Summary

The `scripts/install.sh` installer is **PARTIALLY OUTDATED** and requires updates to match the current production-ready state of the project. The installer will create a working environment but will **overwrite critical Telegram router fixes**.

### Critical Issues Found

1. ✅ **telegram-department-router.js Generator is Outdated**
   - Generator creates ~600 line basic version
   - Current production version is 768 lines with critical fixes:
     - Space persistence (prevents duplicate spaces on restart)
     - Room reconnection (smart user reconnection)
     - Enhanced error handling and logging
   - **Impact**: HIGH - Will break Telegram functionality if run

2. ✅ **config-generator.sh Creates Outdated Telegram Script**
   - Uses legacy template without recent fixes
   - Missing: `loadMappings()` enhancements, `verifyRoomAccess()`, reconnection logic
   - **Solution**: Installer should NOT regenerate this file if it exists

3. ✅ **No Systemd Support**
   - Services run manually or via PM2
   - No native Linux service integration
   - **Impact**: MEDIUM - Not production-ready for Linux servers

4. ✅ **Server Config Loading**
   - Server reads from `config/config.yaml` ✓
   - Telegram router reads from `../config/config.yaml` relative path ✓
   - Paths work correctly when run from project root

## Detailed Component Analysis

### 1. Core Scripts Status

#### install.sh (scripts/install.sh)
**Status**: ✅ GOOD - Functional but needs systemd additions

**What It Does**:
- Checks prerequisites (Docker, Node.js, npm, curl, jq)
- Configures PostgreSQL (Docker or local)
- Configures Matrix/Synapse server
- Interactive department and user configuration
- Telegram bot integration (optional)
- Widget configuration
- Generates all config files
- Creates Matrix users with access tokens
- Builds widget

**Dependencies**:
- `scripts/lib/common.sh` ✅
- `scripts/lib/synapse-setup.sh` ✅
- `scripts/lib/config-generator.sh` ⚠️ (generates outdated router)
- `scripts/lib/telegram-setup.sh` ✅

#### common.sh (scripts/lib/common.sh)
**Status**: ✅ EXCELLENT - No changes needed

**Functions**: Print utilities, input prompts, validation, JSON manipulation, file operations

#### synapse-setup.sh (scripts/lib/synapse-setup.sh)
**Status**: ✅ EXCELLENT - Properly creates users and manages Synapse

**Functions**:
- Docker Synapse startup
- User creation via Admin API
- Token generation and verification
- Department user creation
- Space creation (note: spaces now auto-created by services)

#### config-generator.sh (scripts/lib/config-generator.sh)
**Status**: ⚠️ **CRITICAL ISSUE** - Generates outdated telegram-department-router.js

**Problems**:
1. Line 250-832: `generate_telegram_bot_script()` creates basic 600-line version
2. Missing all recent fixes from commit `51a7689`
3. Will overwrite production-ready router with broken version

**Recommendation**:
- **DO NOT** call `generate_telegram_bot_script()` if file exists
- Add check: `if [ ! -f "$output_file" ]; then generate_telegram_bot_script; fi`
- Or mark existing file as template and never regenerate

#### telegram-setup.sh (scripts/lib/telegram-setup.sh)
**Status**: ✅ GOOD - Handles mautrix-telegram configuration correctly

**Functions**:
- Generates mautrix-telegram config
- Creates bridge registration
- Starts bridge service
- Generates authentication guide

### 2. Current Working Implementation

#### telegram-department-router.js (scripts/telegram-department-router.js)
**Status**: ✅ PRODUCTION READY - Contains critical fixes

**Current Version**: 768 lines with features:
```javascript
// Line 24-99: Enhanced loadMappings() with space ID restoration
// Line 148-263: createTelegramSpaces() with reuse logic
// Line 314-325: initializeTelegramSpaces() with proper loading
// Line 474-490: verifyRoomAccess() for room validation
// Line 492-605: handleDepartmentSelection() with reconnection logic
```

**Critical Features**:
1. Space Persistence:
   - Loads/saves `MAIN_TELEGRAM_SPACE_ID`
   - Loads/saves all department `spaceId` values
   - Prevents duplicate space creation on restart

2. Room Reconnection:
   - Detects returning users
   - Verifies room accessibility
   - Reconnects without history spam

3. Enhanced Storage:
   - `data/chat-room-mappings.json` includes `telegramSpaces` object
   - Persistent across restarts

**Dependencies**:
- Reads from: `../config/config.yaml` (relative path from scripts/)
- Writes to: `../data/chat-room-mappings.json`
- Requires: node-telegram-bot-api, axios, fs

### 3. Server Components

#### server/index.js
**Status**: ✅ PRODUCTION READY

**Configuration Loading**:
```javascript
// Loads from config/config.yaml
const configPath = path.join(__dirname, '../config/config.yaml');
```

**Features**:
- Multi-department support
- Serves widget at `/widget/`
- API endpoints at `/api/config`, `/health`
- CORS configured for development

### 4. What Install Script WILL Create

**✅ Working Components**:
1. PostgreSQL database (Docker)
2. Matrix/Synapse server (Docker)
3. All Matrix users with access tokens
4. Valid `config/config.yaml` with all departments
5. mautrix-telegram configuration (if Telegram enabled)
6. Bridge registration files
7. Built widget in `dist/widget/`

**⚠️ Problematic Components**:
1. **telegram-department-router.js** - Will overwrite with outdated version
2. **No systemd services** - Manual startup only

## Recommendations

### Immediate Fixes Required

#### 1. Update config-generator.sh

**File**: `scripts/lib/config-generator.sh`
**Function**: `generate_telegram_bot_script()`
**Change**: Add existence check

```bash
generate_telegram_bot_script() {
  local session_file="$1"
  local output_file="$2"

  # Check if file exists and is newer than template
  if [ -f "$output_file" ]; then
    print_warning "Telegram router exists - preserving existing file"
    print_info "To regenerate, delete: $output_file"
    return 0
  fi

  print_step "Generating telegram-department-router.js..."
  # ... rest of function
}
```

#### 2. Create Systemd Service Files

Create three service files for production Linux deployment:

**File**: `config/systemd/matrix-chat-widget.service`
**File**: `config/systemd/matrix-chat-telegram.service`
**File**: `config/systemd/matrix-chat-docker.service`

#### 3. Add Systemd Support to Installer

**File**: `scripts/install.sh`
**Add**: Post-installation systemd configuration

### Optional Enhancements

1. **Environment File Support**: Create `.env` for sensitive config
2. **Backup Script**: Add backup/restore for `data/` directory
3. **Update Script**: Separate script for updating existing installations
4. **Health Check Script**: Verify all services are running correctly

## Testing Recommendations

### Before Running Installer

1. **Backup current working system**:
   ```bash
   tar -czf matrix-chat-backup-$(date +%Y%m%d).tar.gz \
     config/ data/ scripts/telegram-department-router.js
   ```

2. **Test in clean environment**:
   - Use fresh VM or container
   - Run full installation
   - Verify all components work

3. **Test systemd services** (after implementation):
   ```bash
   sudo systemctl start matrix-chat-widget
   sudo systemctl start matrix-chat-telegram
   sudo systemctl status matrix-chat-widget
   ```

### After Installation

1. **Verify Matrix users created**:
   ```bash
   curl -H "Authorization: Bearer TOKEN" \
     http://localhost:8008/_matrix/client/r0/account/whoami
   ```

2. **Test widget server**:
   ```bash
   curl http://localhost:3001/health
   curl http://localhost:3001/api/config
   ```

3. **Test Telegram router** (if enabled):
   ```bash
   # Check it starts without errors
   cd scripts && node telegram-department-router.js
   # Should show space restoration messages
   ```

4. **Verify space persistence**:
   ```bash
   # Restart router
   pkill -f telegram-department-router
   cd scripts && node telegram-department-router.js
   # Should show "♻️ Reusing existing..." messages
   ```

## Installation Workflow

### Current (Manual)

```bash
# 1. Run installer
./scripts/install.sh

# 2. Manually preserve telegram router
cp scripts/telegram-department-router.js scripts/telegram-department-router.js.production
rm scripts/telegram-department-router.js
mv scripts/telegram-department-router.js.production scripts/telegram-department-router.js

# 3. Start services manually
node server/index.js &
cd scripts && node telegram-department-router.js &
```

### Proposed (With Systemd)

```bash
# 1. Run installer with systemd flag
./scripts/install.sh --with-systemd

# 2. Installer creates systemd services
# 3. Enable and start services
sudo systemctl enable matrix-chat-widget
sudo systemctl enable matrix-chat-telegram
sudo systemctl start matrix-chat-widget
sudo systemctl start matrix-chat-telegram

# 4. Check status
sudo systemctl status matrix-chat-*
```

## Security Considerations

### Current Issues

1. **Tokens in Config**: Access tokens stored in plain text YAML
2. **No File Permissions**: Config files world-readable
3. **No Secrets Management**: Passwords in install session file

### Recommendations

1. **Restrict file permissions**:
   ```bash
   chmod 600 config/config.yaml
   chmod 600 data/chat-room-mappings.json
   chmod 600 data/user-credentials.txt
   ```

2. **Add to .gitignore**:
   ```
   config/config.yaml
   data/*.json
   data/*.txt
   mautrix-telegram/config.yaml
   ```

3. **Environment variables** (future):
   ```bash
   # Instead of tokens in YAML
   export MATRIX_ADMIN_TOKEN="syt_xxx..."
   export TELEGRAM_BOT_TOKEN="xxx..."
   ```

## Conclusion

The installer is **functional but requires updates** before use on existing installations:

**Critical**: Prevent overwriting telegram-department-router.js
**Important**: Add systemd support for production deployments
**Recommended**: Improve security around credential storage

**Next Steps**:
1. ✅ Create systemd service files
2. ✅ Update config-generator.sh to preserve existing router
3. ✅ Add systemd installation to install.sh
4. ✅ Test complete flow in clean environment
5. ✅ Update documentation with systemd instructions

---

**Document Status**: Complete
**Requires Action**: YES - Update config-generator.sh before next installation
**Safe to Run**: NO - Will overwrite production Telegram router
