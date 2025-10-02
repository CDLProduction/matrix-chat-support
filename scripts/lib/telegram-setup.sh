#!/bin/bash
# Telegram bridge setup and configuration
# Handles mautrix-telegram bridge configuration and startup
# Note: Requires common.sh to be sourced by parent script

# ============================================================================
# mautrix-telegram Configuration Generation
# ============================================================================

generate_mautrix_telegram_config() {
  local session_file="$1"
  local output_file="$2"
  local template_file="$3"

  print_step "Generating mautrix-telegram configuration..."

  backup_file "$output_file"

  # Check if template exists, if not use existing config as base
  if [ ! -f "$template_file" ]; then
    template_file="$output_file"
  fi

  # Copy base configuration
  cp "$template_file" "$output_file"

  local api_id=$(jq -r ".telegram.api_id" "$session_file")
  local api_hash=$(jq -r ".telegram.api_hash" "$session_file")

  # Update Telegram API credentials
  sed -i.bak "s/api_id:.*/api_id: $api_id/" "$output_file"
  sed -i.bak "s/api_hash:.*/api_hash: $api_hash/" "$output_file"
  sed -i.bak "s/bot_token:.*/bot_token: \"\"/" "$output_file"  # Disable bot token

  # Generate permissions section
  print_info "Generating permissions for all users..."

  # Find the permissions section and replace it
  local temp_file=$(mktemp)
  local in_permissions=false
  local in_relaybot=false

  while IFS= read -r line; do
    if [[ "$line" =~ ^[[:space:]]*permissions: ]]; then
      echo "$line" >> "$temp_file"
      echo "        '*': relaybot" >> "$temp_file"
      echo "        'localhost': full" >> "$temp_file"
      echo "        '@admin:localhost': admin" >> "$temp_file"

      # Add all department users with puppeting permission
      local dept_count=$(jq -r '.departments | length' "$session_file")
      for ((d=0; d<dept_count; d++)); do
        local user_count=$(jq -r ".departments[$d].users | length" "$session_file")
        for ((u=0; u<user_count; u++)); do
          local telegram_enabled=$(jq -r ".departments[$d].users[$u].telegram_enabled" "$session_file")
          if [ "$telegram_enabled" = "true" ]; then
            local user_id=$(jq -r ".departments[$d].users[$u].matrix_user_id" "$session_file")
            echo "        '$user_id': puppeting" >> "$temp_file"
          fi
        done
      done

      in_permissions=true
      continue
    fi

    if [ "$in_permissions" = true ] && [[ "$line" =~ ^[[:space:]]*relaybot: ]]; then
      in_permissions=false
      in_relaybot=true
      echo "$line" >> "$temp_file"
      continue
    fi

    if [ "$in_permissions" = false ]; then
      echo "$line" >> "$temp_file"
    fi
  done < "$output_file"

  mv "$temp_file" "$output_file"

  # Remove backup files
  rm -f "${output_file}.bak"

  print_success "Generated: $output_file"
}

# ============================================================================
# Bridge Registration Generation
# ============================================================================

generate_bridge_registration() {
  local output_file="$1"

  print_step "Generating bridge registration file..."

  backup_file "$output_file"

  # Generate random tokens
  local as_token=$(generate_secure_token)
  local hs_token=$(generate_secure_token)
  local sender_localpart=$(generate_random_string 64)

  cat > "$output_file" << EOF
# Auto-generated registration file for mautrix-telegram
id: telegram
as_token: $as_token
hs_token: $hs_token
namespaces:
  users:
    - exclusive: true
      regex: '@telegram_.*:localhost'
  aliases:
    - exclusive: true
      regex: '#telegram_.*:localhost'
  rooms: []
url: http://mautrix-telegram:29317
sender_localpart: $sender_localpart
rate_limited: false
de.sorunome.msc2409.push_ephemeral: true
EOF

  print_success "Generated: $output_file"

  # Copy to Synapse data directory if it exists
  if [ -d "data" ]; then
    cp "$output_file" "data/mautrix-telegram-registration.yaml"
    print_success "Copied registration to Synapse data directory"
  fi
}

# ============================================================================
# Bridge Startup and Verification
# ============================================================================

start_mautrix_telegram() {
  print_step "Starting mautrix-telegram bridge..."

  # Start bridge service
  docker compose up -d mautrix-telegram || {
    print_error "Failed to start mautrix-telegram bridge"
    return 1
  }

  # Wait for bridge to be ready
  print_info "Waiting for bridge to initialize..."
  sleep 10

  # Check if bridge is running
  if docker compose ps mautrix-telegram | grep -q "Up"; then
    print_success "mautrix-telegram bridge is running"
    return 0
  else
    print_error "mautrix-telegram bridge failed to start"
    print_info "Check logs with: docker compose logs mautrix-telegram"
    return 1
  fi
}

verify_bridge_connection() {
  local homeserver_url="$1"

  print_step "Verifying bridge connection..."

  # Check if bridge bot is accessible
  local response=$(curl -s "${homeserver_url}/_matrix/client/r0/profile/@telegram:localhost/displayname")

  if echo "$response" | jq -e '.displayname' > /dev/null 2>&1; then
    print_success "Bridge is connected and accessible"
    return 0
  else
    print_warning "Bridge connection could not be verified"
    print_info "This is normal if the bridge just started - it may need a few more seconds"
    return 1
  fi
}

# ============================================================================
# User Authentication Instructions
# ============================================================================

generate_telegram_auth_guide() {
  local session_file="$1"
  local output_file="$2"

  print_step "Generating Telegram authentication guide..."

  cat > "$output_file" << 'EOF'
# Telegram User Authentication Guide

## Overview

Each support agent needs to authenticate their personal Telegram account with the bridge to enable puppeting mode. This allows agents to receive and respond to customer messages directly in their own Telegram app.

## Prerequisites

- Matrix account created and credentials known
- Access to Element Web (http://localhost:8081)
- Personal Telegram account with phone number
- SMS verification capability

## Authentication Steps

### For Each User:

EOF

  # List all users who need to authenticate
  local dept_count=$(jq -r '.departments | length' "$session_file")
  local user_number=1

  for ((d=0; d<dept_count; d++)); do
    local dept_name=$(jq -r ".departments[$d].name" "$session_file")
    local user_count=$(jq -r ".departments[$d].users | length" "$session_file")

    for ((u=0; u<user_count; u++)); do
      local telegram_enabled=$(jq -r ".departments[$d].users[$u].telegram_enabled" "$session_file")

      if [ "$telegram_enabled" = "true" ]; then
        local username=$(jq -r ".departments[$d].users[$u].username" "$session_file")
        local display_name=$(jq -r ".departments[$d].users[$u].display_name" "$session_file")
        local user_id=$(jq -r ".departments[$d].users[$u].matrix_user_id" "$session_file")

        cat >> "$output_file" << EOF
### $user_number. $display_name ($dept_name)

**Matrix User**: $user_id

**Steps**:

1. Open Element Web: http://localhost:8081
2. Login with credentials:
   - Username: $username
   - Password: [provided during installation]

3. Find the **"Telegram bridge bot"** room in your room list
   - It may be named "Telegram bridge bot" or similar
   - If you don't see it, wait a few moments and refresh

4. In the bridge bot room, send the command:
   \`\`\`
   login
   \`\`\`

5. The bot will respond asking for your phone number. Send:
   \`\`\`
   +1234567890
   \`\`\`
   (Replace with YOUR actual Telegram phone number including country code)

6. You will receive an SMS verification code on your Telegram
   - Open Telegram on your phone
   - Note the verification code

7. Send the verification code to the bridge bot:
   \`\`\`
   12345
   \`\`\`
   (Replace with your actual code)

8. **Success!** The bot will confirm your Telegram account is linked

9. Test it:
   - Have someone message the support bot
   - You should see the message in YOUR personal Telegram
   - Reply from YOUR Telegram - customer should receive it

---

EOF
        ((user_number++))
      fi
    done
  done

  cat >> "$output_file" << 'EOF'

## Troubleshooting

### "Invalid phone number"
- Make sure to include country code (e.g., +1 for US)
- Format: +[country code][phone number] with no spaces

### "Verification code invalid"
- Make sure you entered the code quickly (they expire)
- Don't include spaces or dashes
- Request a new code if needed

### "Already logged in"
- You may have already authenticated
- Try sending a test message to the bot

### Bridge bot room not found
- Wait a few minutes for the bridge to fully initialize
- Restart Element Web
- Check bridge is running: `docker compose ps mautrix-telegram`

## Post-Authentication

After ALL users have authenticated:

1. **Test the system**:
   - Message the Telegram bot as a test customer
   - All department agents should see the message in their Telegram
   - Any agent can respond
   - Customer sees the response from the agent who replied

2. **Enable notifications**:
   - Each agent should enable Telegram notifications
   - This ensures instant alerts for new messages

3. **Configure Telegram settings** (optional):
   - Each agent can customize their Telegram notifications
   - Archive settings, mute options, etc.

## Support

If you encounter issues not covered here:

1. Check bridge logs: `docker compose logs mautrix-telegram`
2. Check Synapse logs: `docker compose logs synapse`
3. Verify bridge is running: `docker compose ps`
4. Restart bridge if needed: `docker compose restart mautrix-telegram`

EOF

  print_success "Generated: $output_file"
}

# ============================================================================
# Telegram Bot Token Validation
# ============================================================================

validate_telegram_token() {
  local token="$1"

  print_info "Validating Telegram bot token..." >&2

  local response=$(curl -s "https://api.telegram.org/bot${token}/getMe")
  local is_bot=$(echo "$response" | jq -r '.result.is_bot // false')

  if [ "$is_bot" = "true" ]; then
    local username=$(echo "$response" | jq -r '.result.username')
    local bot_name=$(echo "$response" | jq -r '.result.first_name')
    print_success "Bot verified: @$username ($bot_name)" >&2
    echo "$username"
    return 0
  else
    print_error "Invalid Telegram bot token" >&2
    return 1
  fi
}

# Export functions
export -f generate_mautrix_telegram_config generate_bridge_registration
export -f start_mautrix_telegram verify_bridge_connection
export -f generate_telegram_auth_guide validate_telegram_token
