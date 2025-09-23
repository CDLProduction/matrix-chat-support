# Matrix Spaces Troubleshooting Guide

**Version**: 1.0.0  
**Target**: Matrix Spaces Integration Issues  
**Last Updated**: September 4, 2025

---

## 🔍 Quick Diagnostics

### **Space Integration Status Check**
Run these commands to quickly diagnose your Matrix Spaces integration:

```bash
# 1. Verify server is running
curl -f http://localhost:3001/health || echo "❌ Server not responding"

# 2. Check configuration loading
curl -s http://localhost:3001/api/config | jq '.widget.spaces' || echo "❌ Config API failed"

# 3. Test widget script
curl -f http://localhost:3001/embed.js > /dev/null && echo "✅ Widget script available" || echo "❌ Widget script failed"

# 4. Verify build files
ls dist/widget/matrix-chat-widget.iife.js dist/widget/style.css 2>/dev/null && echo "✅ Build files present" || echo "❌ Build files missing"
```

### **Space Configuration Validation**
```bash
# Check spaces configuration file
[ -f "config/spaces.yaml" ] && echo "✅ Spaces config exists" || echo "❌ Spaces config missing"

# Validate YAML syntax
python3 -c "import yaml; yaml.safe_load(open('config/spaces.yaml'))" 2>/dev/null && echo "✅ YAML syntax valid" || echo "❌ YAML syntax error"
```

---

## 🚨 Common Issues & Solutions

### **Issue #1: Space Creation Failures**

#### **Symptoms**
```
[MatrixClient] Failed to initialize SpaceManager: M_FORBIDDEN
[SpaceManager] Error creating root space: 403 Forbidden
```

#### **Root Causes**
1. **Bot lacks space creation permissions**
2. **Matrix homeserver version too old**
3. **Invalid access token**
4. **Homeserver configuration restrictions**

#### **Solutions**

**Check Bot Permissions**:
```bash
# Test space creation manually
curl -X POST "http://localhost:8008/_matrix/client/r0/createRoom" \
  -H "Authorization: Bearer YOUR_BOT_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "creation_content": {"type": "m.space"},
    "name": "Test Space",
    "topic": "Permission test",
    "preset": "private_chat"
  }'
```

**Expected Success Response**:
```json
{"room_id": "!testspace:localhost"}
```

**If Failed**: Contact your Matrix administrator to grant space creation permissions to bot users.

**Verify Homeserver Version**:
```bash
# Check Synapse version
curl "http://localhost:8008/_matrix/federation/v1/version"
```

**Required**: Synapse 1.34.0+ for full Matrix Spaces support.

**Temporary Workaround**:
```yaml
# In config/spaces.yaml
settings:
  spaceCreationMode: "disabled"  # Fallback to legacy mode
```

### **Issue #2: Room Not Added to Space**

#### **Symptoms**
```
[MatrixClient] Room created successfully: !roomId:localhost
[MatrixClient] Failed to organize room in spaces: M_NOT_FOUND
```

#### **Root Causes**
1. **Space doesn't exist yet**
2. **Bot lacks space management permissions**
3. **Race condition during space creation**

#### **Solutions**

**Enable Space Repair**:
```yaml
# In config/spaces.yaml
settings:
  repairHierarchyOnStart: true  # Auto-repair broken relationships
```

**Manual Space Repair**:
```bash
# Restart the widget server to trigger space initialization
npm run serve
```

**Check Space Hierarchy**:
```bash
# List all spaces created by bot
curl -H "Authorization: Bearer YOUR_BOT_ACCESS_TOKEN" \
  "http://localhost:8008/_matrix/client/r0/joined_rooms" | \
  jq '.joined_rooms[] | select(contains("!"))' 
```

### **Issue #3: Configuration Loading Errors**

#### **Symptoms**
```
[ConfigManager] Failed to load spaces configuration: ENOENT
[MatrixClient] SpaceManager initialization skipped: No configuration
```

#### **Root Causes**
1. **Missing spaces.yaml file**
2. **Invalid YAML syntax**
3. **File permissions issues**

#### **Solutions**

**Create Default Configuration**:
```bash
# Copy default spaces configuration
cp config/spaces.yaml.example config/spaces.yaml 2>/dev/null || echo "Create spaces.yaml manually"
```

**Validate Configuration**:
```bash
# Check YAML syntax
python3 -c "
import yaml
try:
    with open('config/spaces.yaml') as f:
        config = yaml.safe_load(f)
    print('✅ Configuration valid')
    print('Spaces enabled:', config.get('settings', {}).get('autoSetupSpaces', False))
except Exception as e:
    print('❌ Configuration error:', e)
"
```

**Fix Permissions**:
```bash
chmod 644 config/spaces.yaml
chown $(whoami): config/spaces.yaml
```

### **Issue #4: UI Not Showing Space Indicators**

#### **Symptoms**
- Chat works normally but no space indicators visible
- Department selection doesn't show space context
- Space information missing from header

#### **Root Causes**
1. **CSS not loading properly**
2. **Space context not being set**
3. **Configuration disabled space UI**

#### **Solutions**

**Rebuild Widget**:
```bash
# Clean rebuild
rm -rf dist/
npm run build:widget
```

**Check CSS Loading**:
```bash
# Verify CSS includes space styles
grep -i "spaceIndicator\|spaceContext" dist/widget/style.css || echo "❌ Space styles missing"
```

**Enable Space UI**:
```yaml
# In config/config-departments.yaml or your config file
widget:
  spaces:
    showSpaceInHeader: true
    displayChannelOrigin: true
    spaceIndicatorStyle: "minimal"  # or "detailed", not "hidden"
```

**Clear Browser Cache**:
- Hard refresh: Ctrl+F5 (Windows/Linux) or Cmd+Shift+R (Mac)
- Clear browser cache completely
- Test in incognito/private browsing mode

### **Issue #5: TypeScript Compilation Errors**

#### **Symptoms**
```
error TS2339: Property 'spaceContext' does not exist on type 'ChatSession'
error TS2339: Property 'spaces' does not exist on type 'WidgetConfig'
```

#### **Root Causes**
1. **Types not updated after upgrade**
2. **Node modules need refresh**
3. **Build cache issues**

#### **Solutions**

**Full Clean Install**:
```bash
# Complete dependency refresh
rm -rf node_modules package-lock.json
npm install
npm run build:widget
```

**Type Check Only**:
```bash
# Skip type checking during development
npm run build:widget --skip-type-check
```

**Manual Type Verification**:
```bash
# Check if types are properly exported
grep -n "SpaceSessionContext\|WidgetSpaceConfig" src/types/index.ts
```

### **Issue #6: Docker Environment Issues**

#### **Symptoms**
- Spaces don't work in Docker environment
- Matrix homeserver doesn't support spaces
- Connection issues with Matrix server

#### **Root Causes**
1. **Synapse version in Docker too old**
2. **Network configuration issues**
3. **Bot registration problems**

#### **Solutions**

**Update Docker Images**:
```bash
# Pull latest Synapse image
docker pull matrixdotorg/synapse:latest
docker-compose down
docker-compose up -d
```

**Verify Synapse Spaces Support**:
```bash
# Check Synapse version
docker exec matrix-synapse cat /opt/venv/lib/python*/site-packages/synapse/__init__.py | grep __version__
```

**Network Diagnostics**:
```bash
# Test Matrix API connectivity
docker exec matrix-synapse curl -f http://localhost:8008/_matrix/client/versions
```

**Re-register Bot Users**:
```bash
# If bot tokens are invalid, re-run setup
./scripts/docker-setup.sh
```

---

## 🔧 Advanced Troubleshooting

### **Debug Mode Configuration**

Enable debug logging for detailed troubleshooting:

```yaml
# In config/spaces.yaml
features:
  debugMode: true
  performanceMonitoring: true

logging:
  logSpaceOperations: true
  logHierarchyChanges: true
  logRoomSpaceChanges: true
  spaceLogLevel: "debug"
```

### **Space Hierarchy Analysis**

**Check Current Space Structure**:
```bash
# Using Matrix API
curl -H "Authorization: Bearer YOUR_BOT_ACCESS_TOKEN" \
  "http://localhost:8008/_matrix/client/unstable/org.matrix.msc2946/rooms/!rootSpaceId:localhost/hierarchy"
```

**Space Relationship Debugging**:
```javascript
// Browser console debugging
console.log('Current session:', localStorage.getItem('matrix-chat-session'));
console.log('Space context:', JSON.parse(localStorage.getItem('matrix-chat-session') || '{}').spaceContext);
```

### **Performance Monitoring**

**Monitor Space Operations**:
```bash
# Watch for space-related logs
tail -f /path/to/server.log | grep -i space
```

**Memory Usage Analysis**:
```bash
# Check Node.js memory usage
ps aux | grep node | grep -v grep
```

### **Integration Testing Script**

Create a comprehensive test script:

```bash
#!/bin/bash
# matrix-spaces-test.sh

echo "🧪 Matrix Spaces Integration Test"
echo "=================================="

# Test 1: Configuration
echo "1. Testing configuration..."
curl -s http://localhost:3001/api/config > /tmp/config.json
if jq -e '.widget.spaces' /tmp/config.json > /dev/null 2>&1; then
    echo "✅ Space configuration available"
else
    echo "⚠️  Space configuration not found (OK if disabled)"
fi

# Test 2: Matrix connectivity
echo "2. Testing Matrix connectivity..."
if curl -f http://localhost:8008/_matrix/client/versions > /dev/null 2>&1; then
    echo "✅ Matrix homeserver accessible"
else
    echo "❌ Matrix homeserver not accessible"
    exit 1
fi

# Test 3: Widget assets
echo "3. Testing widget assets..."
if curl -f http://localhost:3001/embed.js > /dev/null 2>&1; then
    echo "✅ Widget embed script available"
else
    echo "❌ Widget embed script failed"
    exit 1
fi

# Test 4: Build integrity
echo "4. Testing build files..."
if [ -f "dist/widget/matrix-chat-widget.iife.js" ] && [ -f "dist/widget/style.css" ]; then
    echo "✅ Widget build files present"
else
    echo "❌ Widget build files missing"
    echo "Run: npm run build:widget"
    exit 1
fi

# Test 5: Space configuration syntax
echo "5. Testing spaces configuration..."
if [ -f "config/spaces.yaml" ]; then
    if python3 -c "import yaml; yaml.safe_load(open('config/spaces.yaml'))" 2>/dev/null; then
        echo "✅ Spaces configuration syntax valid"
    else
        echo "❌ Spaces configuration has syntax errors"
        exit 1
    fi
else
    echo "⚠️  Spaces configuration not found (using defaults)"
fi

echo ""
echo "🎉 All tests passed! Matrix Spaces integration is ready."
echo ""
echo "Next steps:"
echo "1. Start the widget: npm run serve"
echo "2. Test a chat conversation"
echo "3. Check Matrix client for space organization"
```

---

## 📊 Monitoring & Health Checks

### **Operational Health Checks**

**Space Service Health**:
```bash
# Check if spaces are being created
curl -s http://localhost:3001/api/config | jq -r '.widget.spaces.showSpaceInHeader // "not configured"'
```

**Matrix Integration Health**:
```bash
# Verify bot can still create rooms
curl -X POST "http://localhost:8008/_matrix/client/r0/createRoom" \
  -H "Authorization: Bearer YOUR_BOT_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": "Health Check Room", "preset": "private_chat"}' \
  > /dev/null && echo "✅ Room creation working" || echo "❌ Room creation failed"
```

**Performance Metrics**:
```bash
# Monitor space operation times
grep "Space operation completed" /path/to/logs | tail -10
```

### **Log Analysis Patterns**

**Successful Space Integration**:
```
✅ Look for these patterns:
[MatrixClient] SpaceManager initialized successfully
[SpaceManager] Creating root space: Customer Support  
[SpaceManager] Root space created: !spaceid:localhost
[MatrixClient] Room successfully organized in space hierarchy
```

**Warning Patterns (Non-Critical)**:
```
⚠️  Expected warnings that are safe to ignore:
[MatrixClient] Failed to organize room in spaces: <error>
[ConfigManager] Space not found for mapping update
[SpaceManager] Space creation skipped: mode=disabled
```

**Error Patterns (Need Attention)**:
```
❌ Critical errors requiring investigation:
[MatrixClient] Failed to initialize SpaceManager: M_FORBIDDEN
[ConfigManager] Failed to load spaces configuration: <error>
[SpaceManager] Critical error in space hierarchy: <error>
```

---

## 🆘 Emergency Recovery

### **Complete Spaces Reset**

If spaces become completely broken:

```bash
# 1. Disable spaces temporarily
echo "settings:
  spaceCreationMode: disabled" >> config/spaces.yaml

# 2. Restart widget
npm run serve

# 3. Verify basic functionality works
curl http://localhost:3001/health

# 4. Re-enable spaces after investigation
# Edit config/spaces.yaml to set spaceCreationMode: "auto"
```

### **Rollback to Non-Spaces Version**

If you need to completely disable spaces:

```yaml
# config/spaces.yaml
settings:
  autoSetupSpaces: false
  spaceCreationMode: "disabled"

# widget configuration
widget:
  spaces:
    showSpaceInHeader: false
    spaceIndicatorStyle: "hidden"
```

### **Database Recovery**

If Matrix database becomes corrupted:

```bash
# Docker environment
docker-compose down
docker volume rm matrix-chat-support_postgres_data
docker-compose up -d
./scripts/docker-setup.sh  # Re-create users
```

---

## 📞 Getting Help

### **Information to Collect**

When reporting issues, include:

1. **System Information**:
   ```bash
   node --version
   npm --version
   curl -s http://localhost:8008/_matrix/client/versions | jq .
   ```

2. **Configuration**:
   ```bash
   cat config/spaces.yaml
   curl -s http://localhost:3001/api/config | jq '.widget.spaces'
   ```

3. **Logs**:
   ```bash
   # Last 50 lines of server logs with space-related entries
   tail -50 /path/to/server.log | grep -i space
   ```

4. **Browser Console**:
   - Open browser developer tools
   - Look for errors in Console tab
   - Check Network tab for failed requests

### **Common Resolution Times**

- **Space UI Issues**: 5-10 minutes (CSS/configuration)
- **Permission Problems**: 10-15 minutes (Matrix admin required)
- **Configuration Errors**: 2-5 minutes (YAML syntax fixes)
- **Version Compatibility**: 15-30 minutes (Docker updates)

### **Self-Help Resources**

1. **Migration Guide**: `MATRIX_SPACES_MIGRATION_GUIDE.md`
2. **Architecture Documentation**: `ARCHITECTURE.md` 
3. **Integration Guide**: `SPACES_INTEGRATION_GUIDE.md`
4. **Configuration Examples**: `config/spaces.yaml`

**Most issues with Matrix Spaces integration are configuration-related and can be resolved quickly with the solutions provided in this guide!** 🔧