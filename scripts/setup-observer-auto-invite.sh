#!/bin/bash

# Setup Auto-Invite for Observer User
# Adds observer user ID to config so they're automatically invited to new rooms

set -e

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

CONFIG_FILE="/opt/matrix-chat-support/config/config.yaml"
OBSERVER_USER_ID="@observer:172.20.89.50"

echo -e "${BLUE}Configuring auto-invite for observer user...${NC}"

# Check if observer section already exists
if grep -q "observer_user_id:" "$CONFIG_FILE"; then
    echo -e "${GREEN}✓ Observer already configured${NC}"
else
    # Add observer configuration to the top-level config
    python3 << PYEOF
import yaml

config_file = "$CONFIG_FILE"

with open(config_file, 'r') as f:
    config = yaml.safe_load(f)

# Add observer configuration
config['observer'] = {
    'enabled': True,
    'user_id': '$OBSERVER_USER_ID',
    'auto_invite': True,
    'permissions': 'read_only'
}

with open(config_file, 'w') as f:
    yaml.dump(config, f, default_flow_style=False, sort_keys=False)

print("Observer configuration added to config.yaml")
PYEOF

    echo -e "${GREEN}✓ Observer configuration added to config.yaml${NC}"
fi

echo ""
echo -e "${BLUE}To enable auto-invite in widget server and Telegram router:${NC}"
echo ""
echo "Add this code after room creation in both:"
echo "  - server/index.js"
echo "  - scripts/telegram-department-router.js"
echo ""
echo "Code snippet:"
echo "  // Auto-invite observer if configured"
echo "  if (config.observer?.enabled && config.observer?.auto_invite) {"
echo "    await axios.post(\`\${homeserver}/_matrix/client/v3/rooms/\${roomId}/invite\`, {"
echo "      user_id: config.observer.user_id"
echo "    }, {"
echo "      headers: { 'Authorization': \`Bearer \${adminToken}\` }"
echo "    });"
echo "  }"
echo ""
