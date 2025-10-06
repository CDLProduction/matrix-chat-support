#!/bin/bash

# Verification script for Matrix Chat Support installation
# Checks all critical token configurations

echo "🔍 Matrix Chat Support - Installation Verification"
echo "=================================================="
echo ""

CONFIG_FILE="/opt/matrix-chat-support/config/config.yaml"
CREDS_FILE="/opt/matrix-chat-support/data/user-credentials.txt"

if [ ! -f "$CONFIG_FILE" ]; then
    echo "❌ Config file not found: $CONFIG_FILE"
    exit 1
fi

if [ ! -f "$CREDS_FILE" ]; then
    echo "⚠️  Credentials file not found: $CREDS_FILE"
fi

# Extract admin token from credentials file
if [ -f "$CREDS_FILE" ]; then
    ADMIN_TOKEN=$(grep "ADMIN:" -A 2 "$CREDS_FILE" | grep "Token:" | awk '{print $3}')
    echo "✅ Admin token found: ${ADMIN_TOKEN:0:30}..."
else
    echo "⚠️  No credentials file, skipping token validation"
fi

echo ""
echo "📋 Checking Configuration..."
echo "----------------------------"

# Check top-level matrix config
echo ""
echo "1️⃣  Top-Level Matrix Config (Telegram Router):"
python3 << PYEOF
import yaml
config = yaml.safe_load(open('$CONFIG_FILE'))
matrix_config = config.get('matrix', {})
print(f"   homeserver: {matrix_config.get('homeserver', 'NOT SET')}")
print(f"   access_token: {matrix_config.get('access_token', 'NOT SET')[:30]}...")
print(f"   admin_access_token: {matrix_config.get('admin_access_token', 'NOT SET')[:30]}...")
PYEOF

# Check department configs
echo ""
echo "2️⃣  Department Configurations (Widget):"
python3 << PYEOF
import yaml
config = yaml.safe_load(open('$CONFIG_FILE'))
for dept in config.get('departments', []):
    print(f"\n   {dept['id'].upper()}:")
    print(f"      access_token: {dept['matrix'].get('access_token', 'NOT SET')[:30]}...")
    print(f"      admin_access_token: {dept['matrix'].get('admin_access_token', 'NOT SET')[:30]}...")
    print(f"      bot_user_id: {dept['matrix'].get('bot_user_id', 'NOT SET')}")
PYEOF

# Check Telegram config
echo ""
echo "3️⃣  Telegram Configuration:"
python3 << PYEOF
import yaml
config = yaml.safe_load(open('$CONFIG_FILE'))
for social in config.get('social_media', []):
    if social.get('platform') == 'telegram':
        print(f"   bot_username: {social['config'].get('bot_username', 'NOT SET')}")
        print(f"   bot_token: {social['config'].get('bot_token', 'NOT SET')[:30]}...")
PYEOF

# Validate tokens if admin token is available
if [ -n "$ADMIN_TOKEN" ]; then
    echo ""
    echo "🔐 Validating Tokens..."
    echo "----------------------"

    # Validate admin token
    echo ""
    echo "Testing admin token..."
    ADMIN_CHECK=$(curl -s -H "Authorization: Bearer $ADMIN_TOKEN" "http://localhost:8008/_matrix/client/r0/account/whoami")
    if echo "$ADMIN_CHECK" | grep -q "user_id"; then
        echo "✅ Admin token is valid: $(echo $ADMIN_CHECK | python3 -c 'import sys,json; print(json.load(sys.stdin)["user_id"])')"
    else
        echo "❌ Admin token is INVALID"
        echo "   Response: $ADMIN_CHECK"
    fi

    # Check if config tokens match admin token
    echo ""
    echo "Checking token consistency..."
    python3 << PYEOF
import yaml
config = yaml.safe_load(open('$CONFIG_FILE'))
admin_token = '$ADMIN_TOKEN'
issues = []

# Check top-level
if config.get('matrix', {}).get('admin_access_token') != admin_token:
    issues.append("❌ Top-level matrix.admin_access_token does not match admin token")
else:
    print("✅ Top-level matrix config has correct admin token")

# Check departments
for dept in config.get('departments', []):
    if dept['matrix'].get('admin_access_token') != admin_token:
        issues.append(f"❌ Department '{dept['id']}' admin_access_token does not match admin token")
    else:
        print(f"✅ Department '{dept['id']}' has correct admin token")

if issues:
    print("")
    for issue in issues:
        print(issue)
PYEOF
fi

# Check services
echo ""
echo "🔧 Service Status..."
echo "-------------------"

for service in matrix-chat-widget matrix-chat-telegram matrix-chat-docker; do
    if systemctl is-active --quiet $service.service 2>/dev/null; then
        echo "✅ $service is running"
    else
        echo "❌ $service is NOT running"
    fi
done

# Check endpoints
echo ""
echo "🌐 Endpoint Checks..."
echo "--------------------"

# Widget server
if curl -s "http://localhost:3001/health" > /dev/null 2>&1; then
    echo "✅ Widget server: http://localhost:3001/health"
else
    echo "❌ Widget server not responding"
fi

# Synapse
if curl -s "http://localhost:8008/health" > /dev/null 2>&1; then
    echo "✅ Synapse server: http://localhost:8008/health"
else
    echo "❌ Synapse server not responding"
fi

# Element
if curl -s "http://localhost:8081" > /dev/null 2>&1; then
    echo "✅ Element client: http://localhost:8081"
else
    echo "❌ Element client not responding"
fi

echo ""
echo "=================================================="
echo "✅ Verification Complete!"
echo ""
echo "💡 Next Steps:"
echo "   1. Test widget: Open test-widget.html in browser"
echo "   2. Test Telegram: Send /start_support to @QWMatrixTestBot"
echo "   3. Login to Element: http://localhost:8081"
echo "      - Use credentials from: $CREDS_FILE"
echo ""
