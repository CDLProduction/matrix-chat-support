#!/bin/bash
# Quick production user setup script
# Creates admin + 9 department users with tokens

set -e

echo "🚀 Creating Production Users..."
echo ""

# Admin user
echo "Creating admin user..."
docker exec matrix-chat-support-synapse-1 register_new_matrix_user \
  -c /data/homeserver.yaml \
  -u admin \
  -p admin123 \
  --admin \
  http://localhost:8008 2>&1 | grep -v "Synapse Admin API" || true

# Get admin token
ADMIN_TOKEN=$(curl -s -X POST http://localhost:8008/_matrix/client/r0/login \
  -H "Content-Type: application/json" \
  -d '{"type":"m.login.password","user":"admin","password":"admin123"}' \
  | jq -r '.access_token')

echo "✅ Admin created | Token: ${ADMIN_TOKEN:0:20}..."
echo ""

# Support Department (3 users)
echo "📁 Support Department (3 users)..."
for i in 1 2 3; do
  echo "  Creating support_agent$i..."
  docker exec matrix-chat-support-synapse-1 register_new_matrix_user \
    -c /data/homeserver.yaml \
    -u "support_agent$i" \
    -p "support${i}123" \
    http://localhost:8008 2>&1 | grep -v "Synapse Admin API" || true
done

# Commerce Department (4 users)
echo "📁 Commerce Department (4 users)..."
for i in 1 2 3 4; do
  echo "  Creating commerce_agent$i..."
  docker exec matrix-chat-support-synapse-1 register_new_matrix_user \
    -c /data/homeserver.yaml \
    -u "commerce_agent$i" \
    -p "commerce${i}123" \
    http://localhost:8008 2>&1 | grep -v "Synapse Admin API" || true
done

# Identification Department (2 users)
echo "📁 Identification Department (2 users)..."
for i in 1 2; do
  echo "  Creating identify_agent$i..."
  docker exec matrix-chat-support-synapse-1 register_new_matrix_user \
    -c /data/homeserver.yaml \
    -u "identify_agent$i" \
    -p "identify${i}123" \
    http://localhost:8008 2>&1 | grep -v "Synapse Admin API" || true
done

echo ""
echo "🔑 Getting access tokens..."

# Get all tokens
SUPPORT1=$(curl -s -X POST http://localhost:8008/_matrix/client/r0/login -H "Content-Type: application/json" -d '{"type":"m.login.password","user":"support_agent1","password":"support1123"}' | jq -r '.access_token')
SUPPORT2=$(curl -s -X POST http://localhost:8008/_matrix/client/r0/login -H "Content-Type: application/json" -d '{"type":"m.login.password","user":"support_agent2","password":"support2123"}' | jq -r '.access_token')
SUPPORT3=$(curl -s -X POST http://localhost:8008/_matrix/client/r0/login -H "Content-Type: application/json" -d '{"type":"m.login.password","user":"support_agent3","password":"support3123"}' | jq -r '.access_token')

COMMERCE1=$(curl -s -X POST http://localhost:8008/_matrix/client/r0/login -H "Content-Type: application/json" -d '{"type":"m.login.password","user":"commerce_agent1","password":"commerce1123"}' | jq -r '.access_token')
COMMERCE2=$(curl -s -X POST http://localhost:8008/_matrix/client/r0/login -H "Content-Type: application/json" -d '{"type":"m.login.password","user":"commerce_agent2","password":"commerce2123"}' | jq -r '.access_token')
COMMERCE3=$(curl -s -X POST http://localhost:8008/_matrix/client/r0/login -H "Content-Type: application/json" -d '{"type":"m.login.password","user":"commerce_agent3","password":"commerce3123"}' | jq -r '.access_token')
COMMERCE4=$(curl -s -X POST http://localhost:8008/_matrix/client/r0/login -H "Content-Type: application/json" -d '{"type":"m.login.password","user":"commerce_agent4","password":"commerce4123"}' | jq -r '.access_token')

IDENTIFY1=$(curl -s -X POST http://localhost:8008/_matrix/client/r0/login -H "Content-Type: application/json" -d '{"type":"m.login.password","user":"identify_agent1","password":"identify1123"}' | jq -r '.access_token')
IDENTIFY2=$(curl -s -X POST http://localhost:8008/_matrix/client/r0/login -H "Content-Type: application/json" -d '{"type":"m.login.password","user":"identify_agent2","password":"identify2123"}' | jq -r '.access_token')

echo "✅ All tokens obtained"
echo ""

# Update config.yaml with tokens
echo "📝 Updating config.yaml with tokens..."

sed -i.bak "s/PLACEHOLDER_TOKEN_ADMIN/$ADMIN_TOKEN/g" ../config/config.yaml
sed -i.bak "s/PLACEHOLDER_TOKEN_SUPPORT1/$SUPPORT1/g" ../config/config.yaml
sed -i.bak "s/PLACEHOLDER_TOKEN_COMMERCE1/$COMMERCE1/g" ../config/config.yaml
sed -i.bak "s/PLACEHOLDER_TOKEN_IDENTIFY1/$IDENTIFY1/g" ../config/config.yaml

rm -f ../config/config.yaml.bak

echo "✅ Configuration updated"
echo ""

# Save credentials
cat > ../data/user-credentials.txt << EOF
# Production User Credentials
# Created: $(date)

ADMIN:
  Username: admin
  Password: admin123
  Token: $ADMIN_TOKEN

SUPPORT DEPARTMENT (3 users):
  1. support_agent1
     Password: support1123
     Token: $SUPPORT1

  2. support_agent2
     Password: support2123
     Token: $SUPPORT2

  3. support_agent3
     Password: support3123
     Token: $SUPPORT3

COMMERCE DEPARTMENT (4 users):
  1. commerce_agent1
     Password: commerce1123
     Token: $COMMERCE1

  2. commerce_agent2
     Password: commerce2123
     Token: $COMMERCE2

  3. commerce_agent3
     Password: commerce3123
     Token: $COMMERCE3

  4. commerce_agent4
     Password: commerce4123
     Token: $COMMERCE4

IDENTIFICATION DEPARTMENT (2 users):
  1. identify_agent1
     Password: identify1123
     Token: $IDENTIFY1

  2. identify_agent2
     Password: identify2123
     Token: $IDENTIFY2

EOF

echo "💾 Credentials saved to: data/user-credentials.txt"
echo ""
echo "✅ Setup Complete!"
echo ""
echo "📊 Summary:"
echo "  - Total users: 10 (1 admin + 9 department)"
echo "  - Support: 3 users"
echo "  - Commerce: 4 users"
echo "  - Identification: 2 users"
echo ""
echo "🔗 Access Points:"
echo "  - Synapse: http://localhost:8008"
echo "  - Synapse Admin: http://localhost:8080"
echo "  - Element: http://localhost:8081"
echo ""
echo "🚀 Next steps:"
echo "  1. npm run serve"
echo "  2. Open http://localhost:3001/test.html"
echo "  3. Test widget with all 3 departments"
