#!/bin/bash
# Quick production setup using Admin API
set -e

echo "🚀 Quick Production Setup..."

# Get admin token first
ADMIN_TOKEN=$(curl -s -X POST http://localhost:8008/_matrix/client/r0/login \
  -H "Content-Type: application/json" \
  -d '{"type":"m.login.password","user":"admin","password":"admin123"}' \
  | jq -r '.access_token')

echo "✅ Admin token: ${ADMIN_TOKEN:0:20}..."

# Function to create user via Admin API
create_user() {
  local username=$1
  local password=$2
  local displayname=$3

  # Create user silently
  curl -s -X PUT \
    -H "Authorization: Bearer $ADMIN_TOKEN" \
    -H "Content-Type: application/json" \
    "http://localhost:8008/_synapse/admin/v2/users/@${username}:localhost" \
    -d "{
      \"password\": \"$password\",
      \"admin\": false,
      \"displayname\": \"$displayname\"
    }" > /dev/null 2>&1

  # Get token
  local token=$(curl -s -X POST http://localhost:8008/_matrix/client/r0/login \
    -H "Content-Type: application/json" \
    -d "{\"type\":\"m.login.password\",\"user\":\"$username\",\"password\":\"$password\"}" \
    | jq -r '.access_token')

  # Print status to stderr, return token to stdout
  echo "  ✓ Created $username" >&2
  echo "$token"
}

# Support Department
echo ""
echo "📁 Support Department..."
S1=$(create_user "support_agent1" "support1123" "John Doe")
S2=$(create_user "support_agent2" "support2123" "Jane Smith")
S3=$(create_user "support_agent3" "support3123" "Bob Wilson")

# Commerce Department
echo ""
echo "📁 Commerce Department..."
C1=$(create_user "commerce_agent1" "commerce1123" "Alice Johnson")
C2=$(create_user "commerce_agent2" "commerce2123" "Charlie Brown")
C3=$(create_user "commerce_agent3" "commerce3123" "David Lee")
C4=$(create_user "commerce_agent4" "commerce4123" "Emma Davis")

# Identification Department
echo ""
echo "📁 Identification Department..."
I1=$(create_user "identify_agent1" "identify1123" "Frank Miller")
I2=$(create_user "identify_agent2" "identify2123" "Grace Chen")

echo ""
echo "📝 Updating config..."

# Update config using a safer method (avoid sed escaping issues)
CONFIG_FILE="../config/config.yaml"

# Create a temporary file with token replacements
cp "$CONFIG_FILE" "${CONFIG_FILE}.tmp"

# Replace placeholders using perl (handles special characters better)
perl -i -pe "s/PLACEHOLDER_TOKEN_ADMIN/$ADMIN_TOKEN/g" "${CONFIG_FILE}.tmp"
perl -i -pe "s/PLACEHOLDER_TOKEN_SUPPORT1/$S1/g" "${CONFIG_FILE}.tmp"
perl -i -pe "s/PLACEHOLDER_TOKEN_COMMERCE1/$C1/g" "${CONFIG_FILE}.tmp"
perl -i -pe "s/PLACEHOLDER_TOKEN_IDENTIFY1/$I1/g" "${CONFIG_FILE}.tmp"
perl -i -pe 's/: "null"/: "'"$ADMIN_TOKEN"'"/g' "${CONFIG_FILE}.tmp"

# Move the updated file to replace the original
mv "${CONFIG_FILE}.tmp" "$CONFIG_FILE"

# Save credentials
cat > ../data/user-credentials.txt << EOF
Production User Credentials - Created: $(date)

ADMIN:
  User: admin | Password: admin123
  Token: $ADMIN_TOKEN

SUPPORT (3 users):
  support_agent1 | support1123 | Token: $S1
  support_agent2 | support2123 | Token: $S2
  support_agent3 | support3123 | Token: $S3

COMMERCE (4 users):
  commerce_agent1 | commerce1123 | Token: $C1
  commerce_agent2 | commerce2123 | Token: $C2
  commerce_agent3 | commerce3123 | Token: $C3
  commerce_agent4 | commerce4123 | Token: $C4

IDENTIFICATION (2 users):
  identify_agent1 | identify1123 | Token: $I1
  identify_agent2 | identify2123 | Token: $I2
EOF

echo "✅ Done! Credentials saved to: data/user-credentials.txt"
echo ""
echo "🚀 Next: npm run serve"
