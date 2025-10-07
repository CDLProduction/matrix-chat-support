#!/bin/bash

# Create Observer User for Matrix Chat Support
# This user can view all conversations but cannot send messages

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  Create Read-Only Observer User${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Configuration
HOMESERVER="http://172.20.89.50:8008"
OBSERVER_USERNAME="observer"
OBSERVER_DISPLAYNAME="Support Observer"

# Get admin token from config
ADMIN_TOKEN=$(grep -A 1 "access_token:" /opt/matrix-chat-support/config/config.yaml | head -1 | awk '{print $2}' | tr -d '"')

if [ -z "$ADMIN_TOKEN" ]; then
    echo -e "${RED}Error: Could not find admin token in config${NC}"
    exit 1
fi

echo -e "${YELLOW}Enter password for observer user:${NC}"
read -s OBSERVER_PASSWORD
echo ""

# Create observer user
echo -e "${BLUE}Creating observer user...${NC}"
docker exec matrix-synapse register_new_matrix_user \
    -c /data/homeserver.yaml \
    -u "$OBSERVER_USERNAME" \
    -p "$OBSERVER_PASSWORD" \
    --no-admin \
    "$HOMESERVER" || {
    echo -e "${YELLOW}User might already exist, continuing...${NC}"
}

# Get observer access token
echo -e "${BLUE}Getting observer access token...${NC}"
OBSERVER_TOKEN=$(curl -s -X POST \
    -H "Content-Type: application/json" \
    "${HOMESERVER}/_matrix/client/r0/login" \
    -d "{
        \"type\": \"m.login.password\",
        \"user\": \"$OBSERVER_USERNAME\",
        \"password\": \"$OBSERVER_PASSWORD\"
    }" | jq -r '.access_token')

if [ -z "$OBSERVER_TOKEN" ] || [ "$OBSERVER_TOKEN" = "null" ]; then
    echo -e "${RED}Failed to get observer token${NC}"
    exit 1
fi

# Set display name
curl -s -X PUT \
    -H "Authorization: Bearer $OBSERVER_TOKEN" \
    -H "Content-Type: application/json" \
    "${HOMESERVER}/_matrix/client/v3/profile/@${OBSERVER_USERNAME}:172.20.89.50/displayname" \
    -d "{\"displayname\": \"$OBSERVER_DISPLAYNAME\"}" > /dev/null

echo -e "${GREEN}✓ Observer user created: @${OBSERVER_USERNAME}:172.20.89.50${NC}"
echo -e "${GREEN}✓ Access token obtained${NC}"

# Get all department spaces
echo -e "${BLUE}Finding department spaces...${NC}"

SPACES=$(curl -s -X GET \
    -H "Authorization: Bearer $ADMIN_TOKEN" \
    "${HOMESERVER}/_matrix/client/v3/sync?filter={\"room\":{\"timeline\":{\"limit\":0}}}" | \
    jq -r '.rooms.join | keys[]')

# Function to set read-only permissions in a room
set_readonly_permissions() {
    local room_id=$1

    # Get current power levels
    POWER_LEVELS=$(curl -s -X GET \
        -H "Authorization: Bearer $ADMIN_TOKEN" \
        "${HOMESERVER}/_matrix/client/v3/rooms/${room_id}/state/m.room.power_levels/" || echo "{}")

    # Update power levels to restrict observer
    # Observer gets power level 0, but events_default requires level 50
    UPDATED_LEVELS=$(echo "$POWER_LEVELS" | jq --arg observer "@${OBSERVER_USERNAME}:172.20.89.50" \
        '.users[$observer] = 0 | .events_default = 50')

    # Set power levels
    curl -s -X PUT \
        -H "Authorization: Bearer $ADMIN_TOKEN" \
        -H "Content-Type: application/json" \
        "${HOMESERVER}/_matrix/client/v3/rooms/${room_id}/state/m.room.power_levels/" \
        -d "$UPDATED_LEVELS" > /dev/null
}

# Invite observer to all spaces
echo -e "${BLUE}Inviting observer to department spaces...${NC}"
for space in $SPACES; do
    # Check if it's a space (has m.space type)
    IS_SPACE=$(curl -s -X GET \
        -H "Authorization: Bearer $ADMIN_TOKEN" \
        "${HOMESERVER}/_matrix/client/v3/rooms/${space}/state/m.room.create/" | \
        jq -r '.type // ""')

    if [ "$IS_SPACE" = "m.space" ]; then
        SPACE_NAME=$(curl -s -X GET \
            -H "Authorization: Bearer $ADMIN_TOKEN" \
            "${HOMESERVER}/_matrix/client/v3/rooms/${space}/state/m.room.name/" | \
            jq -r '.name // "Unknown"')

        echo -e "  📂 ${SPACE_NAME}"

        # Invite to space
        curl -s -X POST \
            -H "Authorization: Bearer $ADMIN_TOKEN" \
            -H "Content-Type: application/json" \
            "${HOMESERVER}/_matrix/client/v3/rooms/${space}/invite" \
            -d "{\"user_id\": \"@${OBSERVER_USERNAME}:172.20.89.50\"}" > /dev/null

        # Auto-join the space
        curl -s -X POST \
            -H "Authorization: Bearer $OBSERVER_TOKEN" \
            -H "Content-Type: application/json" \
            "${HOMESERVER}/_matrix/client/v3/rooms/${space}/join" \
            -d '{}' > /dev/null

        # Set read-only permissions
        set_readonly_permissions "$space"
    fi
done

echo -e "${GREEN}✓ Observer invited to all spaces${NC}"

# Save observer credentials
CREDS_FILE="/opt/matrix-chat-support/data/observer-credentials.txt"
cat > "$CREDS_FILE" << EOF
Observer User Credentials
Created: $(date)

Username: observer
Password: $OBSERVER_PASSWORD
User ID: @${OBSERVER_USERNAME}:172.20.89.50
Access Token: $OBSERVER_TOKEN

Element Login:
  URL: http://172.20.89.50:8081
  Username: observer
  Password: [as set above]

Permissions:
  - Can view all department spaces
  - Can read all messages
  - CANNOT send messages (read-only)
  - Auto-invited to new rooms (requires configuration)

EOF

chmod 600 "$CREDS_FILE"

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  Observer User Created Successfully!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "Login credentials saved to: ${CREDS_FILE}"
echo ""
echo -e "${BLUE}Login to Element:${NC}"
echo -e "  URL: http://172.20.89.50:8081"
echo -e "  Username: observer"
echo -e "  Password: [your password]"
echo ""
echo -e "${YELLOW}Note: Observer can read all messages but cannot send.${NC}"
echo -e "${YELLOW}New rooms will need observer invited (see auto-invite setup).${NC}"
echo ""
