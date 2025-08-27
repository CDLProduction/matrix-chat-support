#!/bin/bash

# Get Matrix Access Token Script
# This script helps retrieve access tokens for Matrix users

set -e

echo "🔑 Matrix Access Token Retrieval"
echo "================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Default values
HOMESERVER="http://localhost:8008"
USERNAME=""
PASSWORD=""

# Function to show usage
show_usage() {
    echo "Usage: $0 [options]"
    echo ""
    echo "Options:"
    echo "  -u, --username USERNAME    Matrix username"
    echo "  -p, --password PASSWORD    Matrix password"
    echo "  -s, --server SERVER       Homeserver URL (default: http://localhost:8008)"
    echo "  -h, --help                Show this help"
    echo ""
    echo "Examples:"
    echo "  $0 -u support -p support123"
    echo "  $0 --username admin --password admin123"
    echo "  $0 -u myuser -p mypass -s https://matrix.example.com"
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -u|--username)
            USERNAME="$2"
            shift 2
            ;;
        -p|--password)
            PASSWORD="$2"
            shift 2
            ;;
        -s|--server)
            HOMESERVER="$2"
            shift 2
            ;;
        -h|--help)
            show_usage
            exit 0
            ;;
        *)
            print_error "Unknown option: $1"
            show_usage
            exit 1
            ;;
    esac
done

# Interactive mode if no username provided
if [ -z "$USERNAME" ]; then
    echo ""
    print_status "Interactive mode"
    read -p "Matrix username: " USERNAME
fi

if [ -z "$PASSWORD" ]; then
    read -s -p "Matrix password: " PASSWORD
    echo ""
fi

# Validate inputs
if [ -z "$USERNAME" ] || [ -z "$PASSWORD" ]; then
    print_error "Username and password are required"
    show_usage
    exit 1
fi

print_status "Attempting to get access token..."
print_status "Server: $HOMESERVER"
print_status "User: $USERNAME"

# Check if server is reachable
if ! curl -s "$HOMESERVER/_matrix/client/versions" > /dev/null; then
    print_error "Cannot reach Matrix server at $HOMESERVER"
    print_status "Make sure the server is running and accessible"
    exit 1
fi

# Try to get access token
RESPONSE=$(curl -s -X POST "$HOMESERVER/_matrix/client/r0/login" \
  -H 'Content-Type: application/json' \
  -d "{
    \"type\": \"m.login.password\",
    \"user\": \"$USERNAME\",
    \"password\": \"$PASSWORD\"
  }")

# Check if login was successful
if echo "$RESPONSE" | grep -q "access_token"; then
    ACCESS_TOKEN=$(echo "$RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin)['access_token'])" 2>/dev/null)
    USER_ID=$(echo "$RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin)['user_id'])" 2>/dev/null)
    DEVICE_ID=$(echo "$RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin)['device_id'])" 2>/dev/null)
    
    print_success "Login successful!"
    echo ""
    print_status "=== ACCESS TOKEN INFORMATION ==="
    echo "User ID:      $USER_ID"
    echo "Access Token: $ACCESS_TOKEN"
    echo "Device ID:    $DEVICE_ID"
    echo "Server:       $HOMESERVER"
    echo ""
    
    # Offer to update config file
    if [ -f "config/config.yaml" ]; then
        read -p "Update config/config.yaml with this token? (y/N): " update_config
        if [[ $update_config =~ ^[Yy]$ ]]; then
            # Backup original
            cp config/config.yaml config/config.yaml.bak
            
            # Update config
            sed -i "s|homeserver:.*|homeserver: \"$HOMESERVER\"|g" config/config.yaml
            sed -i "s|access_token:.*|access_token: \"$ACCESS_TOKEN\"|g" config/config.yaml
            sed -i "s|bot_user_id:.*|bot_user_id: \"$USER_ID\"|g" config/config.yaml
            
            print_success "Config file updated! (backup saved as config.yaml.bak)"
        fi
    fi
    
    # Show usage examples
    echo ""
    print_status "=== USAGE EXAMPLES ==="
    echo ""
    echo "For config/config.yaml:"
    echo "matrix:"
    echo "  homeserver: \"$HOMESERVER\""
    echo "  access_token: \"$ACCESS_TOKEN\""
    echo "  bot_user_id: \"$USER_ID\""
    echo ""
    
    echo "Test the token:"
    echo "curl -H \"Authorization: Bearer $ACCESS_TOKEN\" \\"
    echo "  \"$HOMESERVER/_matrix/client/r0/account/whoami\""
    echo ""
    
else
    # Parse error message
    if echo "$RESPONSE" | grep -q "error"; then
        ERROR_CODE=$(echo "$RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin).get('errcode', 'UNKNOWN'))" 2>/dev/null)
        ERROR_MSG=$(echo "$RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin).get('error', 'Unknown error'))" 2>/dev/null)
        print_error "Login failed: $ERROR_CODE - $ERROR_MSG"
    else
        print_error "Login failed: Unknown error"
        echo "Response: $RESPONSE"
    fi
    
    echo ""
    print_status "Common issues:"
    echo "• Check username and password"
    echo "• Ensure user exists (create with: docker exec -it matrix-synapse register_new_matrix_user...)"
    echo "• Verify server is running (check: curl $HOMESERVER/health)"
    echo "• Check server logs: docker-compose logs synapse"
    exit 1
fi