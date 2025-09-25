#!/usr/bin/env python3
import requests
import json
import hashlib
import hmac

# Synapse configuration
SYNAPSE_URL = "http://localhost:8008"
SHARED_SECRET = ":_XM;,E=us1#ko2BCfsmm+dGCN:1fj2Bo_Ht=uV^&k@.kol6YP"

def get_nonce():
    """Get a nonce for user registration"""
    response = requests.get(f"{SYNAPSE_URL}/_synapse/admin/v1/register")
    return response.json()["nonce"]

def generate_mac(nonce, user, password, admin):
    """Generate MAC for user registration"""
    mac = hmac.new(
        key=SHARED_SECRET.encode('utf-8'),
        digestmod=hashlib.sha1,
    )

    mac.update(nonce.encode('utf-8'))
    mac.update(b"\x00")
    mac.update(user.encode('utf-8'))
    mac.update(b"\x00")
    mac.update(password.encode('utf-8'))
    mac.update(b"\x00")
    mac.update(b"admin" if admin else b"notadmin")

    return mac.hexdigest()

def create_user(username, password, is_admin=False):
    """Create a new Matrix user"""
    nonce = get_nonce()
    mac = generate_mac(nonce, username, password, is_admin)

    data = {
        "nonce": nonce,
        "username": username,
        "password": password,
        "admin": is_admin,
        "mac": mac,
    }

    response = requests.post(
        f"{SYNAPSE_URL}/_synapse/admin/v1/register",
        json=data,
        headers={"Content-Type": "application/json"}
    )

    print(f"Creating user {username}:")
    print(f"Status: {response.status_code}")
    print(f"Response: {response.text}")
    return response.json() if response.status_code == 200 else None

# Create users
if __name__ == "__main__":
    print("Creating Matrix users...")

    # Create admin user
    admin_result = create_user("admin", "admin", is_admin=True)

    # Create support user
    support_result = create_user("support", "support123", is_admin=False)

    print("\nUser creation completed!")
    print("Admin user:", admin_result)
    print("Support user:", support_result)