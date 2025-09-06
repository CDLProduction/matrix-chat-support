# Migration Guide: Single → Multi-Department Chat Widget

## 🔄 Overview

This guide helps you migrate from the legacy single-department chat widget to the new multi-department system. **Full backward compatibility is maintained** - your existing setup will continue working without any changes.

---

## 📋 Migration Scenarios

### Scenario 1: Keep Current Setup (No Changes Needed) ✅

If you're happy with your current single-department setup, **no action is required**. Your existing configuration will continue to work exactly as before.

**Your current config.yaml**:
```yaml
matrix:
  homeserver: "https://your-matrix-server.com"
  access_token: "syt_your_token_here"
  bot_user_id: "@support:your-domain.com"

widget:
  title: "Support Chat"
  brand_color: "#667eea"
  position: "bottom-right"
```

✅ **Result**: Same user experience, same functionality, zero changes needed.

### Scenario 2: Upgrade to Multi-Department ⬆️

If you want to add multiple departments while keeping your existing support setup.

#### Step 1: Backup Current Configuration
```bash
cp config/config.yaml config/config-backup.yaml
```

#### Step 2: Restructure Configuration

**Before (Legacy)**:
```yaml
matrix:
  homeserver: "https://your-matrix-server.com"
  access_token: "syt_support_token"
  bot_user_id: "@support:your-domain.com"

widget:
  title: "Support Chat"
  greeting: "Hi! How can we help you today?"
```

**After (Multi-Department)**:
```yaml
# Multi-department configuration
departments:
  - id: "support"
    name: "General Support"
    description: "Technical help and general inquiries"
    icon: "🎧"
    color: "#667eea"
    matrix:
      homeserver: "https://your-matrix-server.com"
      access_token: "syt_support_token"
      admin_access_token: "syt_admin_token"  # New: required for guest users
      bot_user_id: "@support:your-domain.com"
    widget:
      greeting: "Hi! How can our support team help you today?"
      placeholder_text: "Describe your technical issue..."

  - id: "sales"
    name: "Sales & Inquiries"
    description: "Product information and pricing"
    icon: "💼"
    color: "#10b981"
    matrix:
      homeserver: "https://your-matrix-server.com"
      access_token: "syt_sales_token"  # Can be same or different token
      admin_access_token: "syt_admin_token"
      bot_user_id: "@sales:your-domain.com"  # Different bot for sales
    widget:
      greeting: "Welcome! Ready to learn about our products?"
      placeholder_text: "What product interests you?"

# Legacy fallback (optional - for safety)
matrix:
  homeserver: "https://your-matrix-server.com"
  access_token: "syt_support_token"
  admin_access_token: "syt_admin_token"
  bot_user_id: "@support:your-domain.com"

# Widget appearance
widget:
  title: "Customer Support"
  subtitle: "We're here to help!"
  brand_color: "#667eea"
  position: "bottom-right"
  
  # Department selection configuration
  department_selection:
    title: "How can we help you today?"
    subtitle: "Choose the team that best matches your needs"
    show_descriptions: true
    layout: "grid"
```

#### Step 3: Required New Token

⚠️ **Important**: Multi-department mode requires an **admin access token** for guest user creation.

**Create Admin User**:
```bash
# On your Matrix server
register_new_matrix_user -u admin -p your_admin_password -a
```

**Get Admin Token**:
```bash
curl -X POST "https://your-matrix-server.com/_matrix/client/r0/login" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "m.login.password",
    "user": "admin",
    "password": "your_admin_password"
  }'
```

Add the `access_token` from the response as `admin_access_token` in your config.

#### Step 4: Test Migration
```bash
# Test configuration
npm run serve

# Check for errors
curl http://localhost:3001/api/config
curl http://localhost:3001/health
```

✅ **Result**: Users now see department selection before starting chat.

---

## 🔧 Advanced Migration Options

### Option A: Gradual Migration

Start with your existing support department, then add new ones:

```yaml
departments:
  # Start with your existing setup as first department
  - id: "support"
    name: "General Support"  # Same experience as before
    matrix:
      homeserver: "https://your-matrix-server.com"
      access_token: "your_existing_token"  # Use your current token
      admin_access_token: "syt_admin_token"
      bot_user_id: "@support:your-domain.com"  # Your existing bot
    widget:
      greeting: "Hi! How can we help you today?"  # Same greeting

  # Add new departments when ready
  # - id: "sales"
  #   name: "Sales Team" 
  #   matrix: { ... }
```

### Option B: Different Servers Per Department

Use different Matrix servers for different departments:

```yaml
departments:
  - id: "support"
    matrix:
      homeserver: "https://support.your-company.com"
      access_token: "support_token"
      bot_user_id: "@bot:support.your-company.com"
  
  - id: "sales"  
    matrix:
      homeserver: "https://sales.your-company.com"
      access_token: "sales_token"
      bot_user_id: "@bot:sales.your-company.com"
```

### Option C: Shared vs Individual Room Modes

**Shared Room** (all conversations in one room):
```yaml
matrix:
  support_room_id: "!your_existing_room_id:server.com"
```

**Individual Rooms** (new room per customer):
```yaml
matrix:
  support_room_id: null  # Creates new rooms
```

---

## 🧪 Testing Your Migration

### Test Backward Compatibility
```bash
# 1. Test with legacy config
cp config/config-backup.yaml config/config.yaml
npm run serve
# Visit http://localhost:3001 - should work exactly as before

# 2. Test with new multi-department config
cp config/config-departments.yaml config/config.yaml
npm run serve
# Visit http://localhost:3001 - should show department selection
```

### Test User Experience
1. **New Users**: Should see department selection screen
2. **Returning Users**: Should be restored to their previous department
3. **Legacy Users**: Should still work if you rollback configuration

### Test Matrix Integration
```bash
# Check Matrix connectivity for each department
curl -H "Authorization: Bearer YOUR_SUPPORT_TOKEN" \
  "https://your-server.com/_matrix/client/r0/account/whoami"

curl -H "Authorization: Bearer YOUR_SALES_TOKEN" \
  "https://your-server.com/_matrix/client/r0/account/whoami"
```

---

## 🚨 Rollback Plan

If anything goes wrong, you can instantly rollback:

```bash
# Instant rollback to previous configuration
cp config/config-backup.yaml config/config.yaml
npm run serve
```

Your users will immediately return to the previous single-department experience.

---

## 📊 Configuration Examples

### Example 1: Support + Sales Departments
```yaml
departments:
  - id: "support"
    name: "Technical Support"
    description: "Bug reports and technical issues"
    icon: "🔧"
    color: "#ef4444"
    matrix:
      homeserver: "https://matrix.company.com"
      access_token: "syt_support_token"
      admin_access_token: "syt_admin_token"
      bot_user_id: "@tech-support:company.com"
    widget:
      greeting: "Experiencing technical issues? We're here to help!"
      placeholder_text: "Describe the problem you're experiencing..."

  - id: "sales"
    name: "Sales Inquiries"  
    description: "Product demos and pricing"
    icon: "💰"
    color: "#22c55e"
    matrix:
      homeserver: "https://matrix.company.com"
      access_token: "syt_sales_token"
      admin_access_token: "syt_admin_token"
      bot_user_id: "@sales:company.com"
    widget:
      greeting: "Interested in our products? Let's talk!"
      placeholder_text: "What product are you interested in?"
```

### Example 2: Service-Based Departments
```yaml
departments:
  - id: "billing"
    name: "Billing Support"
    description: "Payment and subscription issues"
    icon: "💳"
    color: "#f59e0b"

  - id: "account"  
    name: "Account Management"
    description: "Profile and account settings"
    icon: "👤"
    color: "#8b5cf6"

  - id: "general"
    name: "General Inquiries"
    description: "Everything else"
    icon: "💬"
    color: "#6b7280"
```

---

## 🔍 Troubleshooting Migration Issues

### Issue: "Configuration error: Department X: Matrix access token is required"
**Solution**: Add `access_token` or `admin_access_token` to department config

### Issue: "Admin access token required for guest user creation"
**Solution**: Create admin user on Matrix server and add `admin_access_token`

### Issue: Users see old single-department interface
**Solution**: Clear browser localStorage or add `departments` array to config

### Issue: Department selection not showing
**Solution**: Verify `departments` array exists and has at least one department

### Issue: Matrix connection fails for specific department
**Solution**: Test each department's Matrix credentials individually

---

## 📈 Benefits After Migration

### For Users
- ✅ **Better Routing**: Users reach the right team immediately
- ✅ **Specialized Service**: Department-specific greetings and context
- ✅ **Conversation History**: Separate history per department
- ✅ **Faster Resolution**: Queries go directly to relevant specialists

### For Support Teams  
- ✅ **Better Organization**: Separate queues for different types of requests
- ✅ **Specialized Context**: Room names and topics include department info
- ✅ **Analytics**: Track conversations per department
- ✅ **Scalability**: Easy to add new departments without affecting existing ones

### For Administrators
- ✅ **Zero Downtime**: Migration with full backward compatibility
- ✅ **Flexible Configuration**: Mix of shared and individual room modes
- ✅ **Easy Rollback**: Instant return to previous configuration
- ✅ **Enhanced Monitoring**: Department-specific error logging and metrics

---

## 🎯 Migration Checklist

- [ ] **Backup current configuration**
- [ ] **Create admin user and get admin token**  
- [ ] **Design department structure**
- [ ] **Test configuration locally**
- [ ] **Verify Matrix connectivity for all departments**
- [ ] **Test user experience flows**
- [ ] **Plan rollback procedure**
- [ ] **Deploy and monitor**
- [ ] **Update documentation for support teams**

**Estimated Migration Time**: 1-2 hours for simple setups, 4-8 hours for complex multi-server configurations.

---

## 💡 Need Help?

- **Configuration Issues**: Check `INTEGRATION_TEST_SCENARIOS.md`
- **Matrix Server Setup**: Refer to Matrix Synapse documentation
- **Widget Customization**: See `CLAUDE.md` for styling options
- **Advanced Features**: Review implementation plan phases 1-5

**Support**: Create an issue with your configuration (remove sensitive tokens) for assistance.