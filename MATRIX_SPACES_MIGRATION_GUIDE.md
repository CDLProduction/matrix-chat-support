# Matrix Spaces Migration Guide

**Version**: 1.0.0  
**Target**: Existing Matrix Chat Support Widget Installations  
**Migration**: Legacy → Matrix Spaces Integration  
**Date**: September 4, 2025

---

## 🎯 Migration Overview

This guide provides step-by-step instructions for upgrading existing Matrix Chat Support Widget installations to include the new Matrix Spaces integration. The migration is **backward compatible** and **zero-downtime**.

### **What's New**
- ✅ **Matrix Spaces Integration**: Hierarchical room organization by communication channel
- ✅ **Enhanced UI**: Space indicators and department selection improvements
- ✅ **Future-Ready Architecture**: Prepared for Telegram and Facebook bridge integrations
- ✅ **Configurable Space Display**: Admin controls for space visibility

### **Migration Benefits**
- **Better Organization**: All web-chat conversations automatically organized in "Web-Chat Space"
- **Scalable Architecture**: Ready for multi-channel communication expansion
- **Professional Polish**: Enhanced UI with space context indicators
- **Zero Breaking Changes**: Existing conversations and configurations remain unchanged

---

## 🚦 Pre-Migration Checklist

### **System Requirements**
- [ ] **Matrix Homeserver**: Synapse 1.34.0+ (for Matrix Spaces support)
- [ ] **Node.js**: 18.0.0+ (existing requirement)
- [ ] **Existing Widget**: Working Matrix Chat Support Widget installation
- [ ] **Bot Permissions**: Verify bot users can create spaces (see verification steps below)

### **Backup Requirements**
- [ ] **Configuration Backup**: Copy existing `config/` directory
- [ ] **Widget Files Backup**: Backup current widget installation
- [ ] **Database Snapshot**: Backup Matrix homeserver database (optional but recommended)

### **Bot Permissions Verification**
Check that your Matrix bot users have the required permissions:

```bash
# Test space creation permission
curl -X POST "https://your-homeserver.com/_matrix/client/r0/createRoom" \
  -H "Authorization: Bearer YOUR_BOT_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "creation_content": {"type": "m.space"},
    "name": "Test Space",
    "topic": "Migration test space",
    "preset": "private_chat"
  }'
```

If this fails, contact your Matrix administrator to grant space creation permissions.

---

## 🔄 Migration Process

### **Phase 1: Code Update (5 minutes)**

#### **1.1 Download New Version**
```bash
# Backup existing installation
cp -r /path/to/matrix-chat-support /path/to/matrix-chat-support-backup

# Update to new version with Spaces support
git pull origin main
# OR download and extract new version files
```

#### **1.2 Install Dependencies**
```bash
cd /path/to/matrix-chat-support
npm install
```

#### **1.3 Build New Widget**
```bash
npm run build:widget
```

### **Phase 2: Configuration Setup (10 minutes)**

#### **2.1 Create Spaces Configuration**
The new `config/spaces.yaml` file is automatically included. No changes needed for basic setup.

**Default Configuration** (`config/spaces.yaml`):
```yaml
spaces:
  rootSpace:
    name: "Customer Support"
    description: "Central hub for all customer support communications"
    avatar: "🏢"
  
  communicationChannels:
    - id: web-chat
      name: "Web-Chat"
      description: "All conversations from the website chat widget"
      avatar: "💻"
      enabled: true
    - id: telegram
      name: "Telegram"
      enabled: false  # Future feature
    - id: facebook
      name: "Facebook" 
      enabled: false  # Future feature

settings:
  autoSetupSpaces: true
  spaceCreationMode: "auto"
  repairHierarchyOnStart: true
```

#### **2.2 Update Existing Configuration (Optional)**
If you want to customize space behavior, add to your existing configuration files:

**`config/config-departments.yaml`** (Optional Enhancement):
```yaml
# Add to existing configuration
widget:
  title: "Customer Support"
  subtitle: "We're here to help!"
  brandColor: "#667eea"
  position: "bottom-right"
  
  # NEW: Space UI settings (optional)
  spaces:
    showSpaceInHeader: true          # Show space indicator in chat header
    displayChannelOrigin: true       # Show "Web-Chat Space" vs just "Space"
    spaceIndicatorStyle: "minimal"   # minimal, detailed, or hidden
    allowSpaceSwitching: false       # Future feature
```

### **Phase 3: Deployment (5 minutes)**

#### **3.1 Zero-Downtime Deployment**
```bash
# Stop existing widget server (if running as service)
pm2 stop matrix-chat-widget  # OR your process manager
# OR kill existing Node.js process

# Start new version
npm run serve
# OR with PM2: pm2 start server/index.js --name matrix-chat-widget
# OR with systemctl: systemctl restart matrix-chat-widget
```

#### **3.2 Verification**
```bash
# Test API endpoint
curl http://localhost:3001/health

# Test configuration loading
curl http://localhost:3001/api/config

# Test widget embedding
curl http://localhost:3001/embed.js
```

### **Phase 4: Space Initialization (Automatic)**

When the first user starts a new chat:
- **Root Space** will be automatically created: "Customer Support"
- **Web-Chat Space** will be automatically created as a child of the root space
- **Department Spaces** will be created as needed when users select departments
- **All new chat rooms** will be automatically organized in the appropriate space

**No manual space creation needed!** The system handles everything automatically.

---

## 🔍 Verification & Testing

### **Migration Success Verification**

#### **1. Widget Loading**
- [ ] Widget loads on your website without errors
- [ ] Department selection works (if using multi-department setup)
- [ ] User form submission works
- [ ] Chat interface loads and connects

#### **2. Space Integration** 
- [ ] Start a new chat conversation
- [ ] Check Matrix client (Element, etc.) for space creation:
  - Look for "Customer Support" root space
  - Look for "Web-Chat" channel space
  - New chat room should appear within the Web-Chat space
- [ ] UI shows space indicator in chat header (small space icon + "Web-Chat Space")

#### **3. Backward Compatibility**
- [ ] Existing chat sessions continue to work
- [ ] Returning users can access their previous conversations
- [ ] No error messages in browser console
- [ ] No error messages in server logs

#### **4. Configuration Validation**
```bash
# Check that spaces configuration loads correctly
curl http://localhost:3001/api/config | jq '.widget.spaces'
# Should return space configuration or null (both are valid)
```

### **Integration Testing Script**
```bash
#!/bin/bash
echo "🧪 Testing Matrix Spaces Migration..."

# Test 1: Health check
echo "1. Testing health endpoint..."
curl -f http://localhost:3001/health || exit 1

# Test 2: Configuration API
echo "2. Testing configuration API..."
curl -f http://localhost:3001/api/config > /dev/null || exit 1

# Test 3: Widget script
echo "3. Testing widget script..."
curl -f http://localhost:3001/embed.js > /dev/null || exit 1

# Test 4: Build integrity
echo "4. Testing build files..."
[ -f "dist/widget/matrix-chat-widget.iife.js" ] || exit 1
[ -f "dist/widget/style.css" ] || exit 1

echo "✅ All migration tests passed!"
```

---

## 🚨 Troubleshooting

### **Common Migration Issues**

#### **Issue: Space Creation Fails**
```
[MatrixClient] Failed to initialize SpaceManager: M_FORBIDDEN
```

**Solution**:
1. Check bot user has space creation permissions
2. Verify Matrix homeserver version (needs 1.34.0+)
3. Check access token validity
4. Try disabling spaces temporarily:
   ```yaml
   # In spaces.yaml
   settings:
     spaceCreationMode: "disabled"
   ```

#### **Issue: Widget Not Loading**
```
Failed to load resource: net::ERR_CONNECTION_REFUSED
```

**Solution**:
1. Verify server is running: `curl http://localhost:3001/health`
2. Check port conflicts: `netstat -tulpn | grep :3001`
3. Verify build completed: `ls dist/widget/`
4. Check server logs: `npm run serve` (foreground)

#### **Issue: CSS Not Loading**
```
Widget appears unstyled, space indicators missing
```

**Solution**:
1. Clear browser cache
2. Rebuild widget: `npm run build:widget`
3. Check CSS file exists: `ls dist/widget/style.css`
4. Verify embed script loads CSS: `curl http://localhost:3001/embed.js | grep style.css`

#### **Issue: TypeScript Compilation Errors**
```
error TS2339: Property 'spaceContext' does not exist
```

**Solution**:
1. Update dependencies: `npm install`
2. Clean build: `rm -rf dist/` && `npm run build:widget`
3. Check Node.js version: `node --version` (should be 18+)

### **Rollback Procedure**
If migration fails and you need to rollback:

```bash
# 1. Stop new version
pm2 stop matrix-chat-widget

# 2. Restore backup
rm -rf /path/to/matrix-chat-support
mv /path/to/matrix-chat-support-backup /path/to/matrix-chat-support

# 3. Start old version
cd /path/to/matrix-chat-support
npm run serve
```

### **Gradual Migration Strategy**
For critical production systems, you can migrate gradually:

1. **Test Environment First**: Deploy to staging/test environment
2. **Parallel Deployment**: Run both versions temporarily
3. **Feature Flag**: Disable spaces initially, enable after verification:
   ```yaml
   settings:
     spaceCreationMode: "disabled"  # Start with disabled
   ```
4. **Monitor**: Watch logs and user feedback before full rollout

---

## 📊 Post-Migration Monitoring

### **Key Metrics to Monitor**

#### **Performance Metrics**
- **Widget Load Time**: Should remain <2 seconds
- **Chat Connection Time**: Should remain <3 seconds  
- **Space Creation Time**: New metric, should be <1 second
- **Memory Usage**: Slight increase expected (~100KB per active chat)

#### **Functional Metrics**
- **Chat Success Rate**: Should remain 99%+
- **Space Organization Rate**: New chats should be 100% organized in spaces
- **Error Rate**: Should remain <1%
- **User Experience**: No user-facing changes except enhanced UI

#### **Space-Specific Metrics**
- **Root Space Creation**: Should happen on first chat
- **Channel Space Creation**: Should happen on first Web-Chat conversation
- **Department Space Creation**: Should happen per department as needed
- **Room Organization**: All new rooms should appear in appropriate spaces

### **Monitoring Commands**
```bash
# Server health
curl http://localhost:3001/health

# Check space configuration loading
grep "SpaceManager initialized" /path/to/logs/server.log

# Monitor space operations
grep "Room successfully organized" /path/to/logs/server.log

# Check for space errors (should be minimal)
grep -i "space.*error" /path/to/logs/server.log
```

### **Log Analysis**
**Successful Space Integration Logs**:
```
[MatrixClient] SpaceManager initialized successfully
[SpaceManager] Creating root space: Customer Support
[SpaceManager] Root space created: !rootSpaceId:localhost
[SpaceManager] Creating channel space: Web-Chat
[MatrixClient] Room successfully organized in space hierarchy
```

**Expected Warning Logs** (non-critical):
```
[MatrixClient] Failed to organize room in spaces: <error>
[ConfigManager] Space not found for mapping update
```
These are normal fallback scenarios where the system continues working without spaces.

---

## 🎯 Success Criteria

### **Migration Complete When**
- [ ] ✅ **Widget Functions**: All existing functionality works unchanged
- [ ] ✅ **Spaces Active**: New conversations automatically organized in Web-Chat space
- [ ] ✅ **UI Enhanced**: Space indicators visible in chat interface
- [ ] ✅ **Zero Errors**: No critical errors in browser console or server logs
- [ ] ✅ **Performance Maintained**: Load times within acceptable ranges
- [ ] ✅ **Backward Compatibility**: Existing users can continue their conversations seamlessly

### **Optional Enhancements**
- [ ] **Custom Space Names**: Customize space names in configuration
- [ ] **Space UI Customization**: Adjust space indicator styles
- [ ] **Analytics Setup**: Monitor space-based conversation metrics

---

## 🔮 What's Next

### **Immediate Benefits (Available Now)**
- **Better Organization**: All widget conversations organized in Web-Chat space
- **Professional UI**: Enhanced chat interface with space context
- **Admin Visibility**: Clear separation of communication channels in Matrix client

### **Upcoming Features (Future Releases)**
- **Telegram Integration**: Telegram bot conversations in dedicated Telegram space
- **Facebook Integration**: Facebook Messenger conversations in dedicated Facebook space
- **Cross-Channel Analytics**: Conversation metrics by communication channel
- **Advanced Space Management**: Dynamic space creation and templates

### **Migration Success**
🎉 **Congratulations!** Your Matrix Chat Support Widget now features Matrix Spaces integration. All new conversations will be automatically organized, and your system is ready for future multi-channel communication expansion.

---

## 📞 Support

### **Migration Support**
- **Documentation**: Refer to this guide and ARCHITECTURE.md
- **Logs**: Check server logs for detailed error information
- **Verification**: Use the testing script provided above
- **Community**: Check GitHub issues for common problems

### **Emergency Contacts**
If you encounter critical issues during migration:
1. Use the rollback procedure above
2. Check troubleshooting section
3. Create detailed issue report with logs
4. Consider gradual migration strategy for critical systems

**The Matrix Spaces migration is designed to be seamless, safe, and immediately beneficial to your customer support operations!** 🚀