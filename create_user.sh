#!/bin/bash

SYNAPSE_URL="http://localhost:8008"
SHARED_SECRET=":_XM;,E=us1#ko2BCfsmm+dGCN:1fj2Bo_Ht=uV^&k@.kol6YP"

# Function to create a user
create_user() {
    local username="$1"
    local password="$2"
    local is_admin="$3"
    
    echo "Creating user: $username"
    
    # Get nonce
    NONCE=$(curl -s "$SYNAPSE_URL/_synapse/admin/v1/register" | python3 -c "import sys, json; print(json.load(sys.stdin)['nonce'])")
    
    # Generate MAC using Python
    MAC=$(python3 -c "
import hmac
import hashlib

nonce = '$NONCE'
user = '$username'
password = '$password'
admin = '$is_admin'
secret = '$SHARED_SECRET'

mac = hmac.new(secret.encode('utf-8'), digestmod=hashlib.sha1)
mac.update(nonce.encode('utf-8'))
mac.update(b'\x00')
mac.update(user.encode('utf-8'))
mac.update(b'\x00')
mac.update(password.encode('utf-8'))
mac.update(b'\x00')
mac.update(b'admin' if admin == 'true' else b'notadmin')
print(mac.hexdigest())
")
    
    # Create user
    curl -XPOST "$SYNAPSE_URL/_synapse/admin/v1/register" \
        -H "Content-Type: application/json" \
        -d "{\"nonce\":\"$NONCE\",\"username\":\"$username\",\"password\":\"$password\",\"admin\":$is_admin,\"mac\":\"$MAC\"}"
    echo
}

# Create users
create_user "admin" "admin" "true"
create_user "support" "support123" "false"
