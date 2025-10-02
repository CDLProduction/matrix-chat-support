#!/bin/bash
# Synapse setup and user management functions
# Handles Matrix/Synapse server setup and user creation
# Note: Requires common.sh to be sourced by parent script

# ============================================================================
# Synapse Server Setup
# ============================================================================

generate_synapse_config() {
  local server_name="$1"

  print_step "Generating Synapse configuration..."

  # Check if homeserver.yaml already exists and is valid
  if [ -f "data/homeserver.yaml" ] && grep -q "database:" data/homeserver.yaml 2>/dev/null; then
    print_success "Synapse configuration already exists"
    return 0
  fi

  # Clean up any broken partial config
  if [ -f "data/homeserver.yaml" ]; then
    print_warning "Removing incomplete Synapse configuration"
    rm -f data/homeserver.yaml
  fi

  # Generate config using Synapse Docker container
  print_info "Running Synapse config generator..."

  docker run --rm \
    -v "$(pwd)/data:/data" \
    -e SYNAPSE_SERVER_NAME="${server_name}" \
    -e SYNAPSE_REPORT_STATS=no \
    matrixdotorg/synapse:v1.113.0 generate || {
      error_exit "Failed to generate Synapse configuration"
    }

  # Verify config was created
  if [ ! -f "data/homeserver.yaml" ]; then
    error_exit "Synapse configuration was not created"
  fi

  print_info "Configuring PostgreSQL database..."

  # Fix ownership so we can edit the file
  sudo chown -R $(whoami):$(whoami) data/ 2>/dev/null || true

  # Backup original SQLite config
  cp data/homeserver.yaml data/homeserver.yaml.sqlite.bak 2>/dev/null || true

  # Replace SQLite database section with PostgreSQL
  # Find the database section and replace it
  python3 << 'PYTHON_SCRIPT' || {
import yaml
import sys

try:
    # Read existing config
    with open('data/homeserver.yaml', 'r') as f:
        config = yaml.safe_load(f)

    # Update database configuration
    config['database'] = {
        'name': 'psycopg2',
        'args': {
            'user': 'synapse_user',
            'password': 'synapse_password',
            'database': 'synapse',
            'host': 'postgres',
            'port': 5432,
            'cp_min': 5,
            'cp_max': 10
        }
    }

    # Enable registration
    config['enable_registration'] = True
    config['enable_registration_without_verification'] = True

    # Write updated config
    with open('data/homeserver.yaml', 'w') as f:
        yaml.dump(config, f, default_flow_style=False, sort_keys=False)

    sys.exit(0)
except Exception as e:
    print(f"Error: {e}", file=sys.stderr)
    sys.exit(1)
PYTHON_SCRIPT
    error_exit "Failed to update Synapse configuration with PostgreSQL settings"
  }

  print_success "Synapse configuration generated and configured for PostgreSQL"
}

setup_synapse_docker() {
  print_step "Starting Synapse with Docker Compose..."

  # Check if docker-compose.yml exists
  if [ ! -f "docker-compose.yml" ]; then
    error_exit "docker-compose.yml not found in current directory"
  fi

  # Start Docker services - try v2 first, fallback to v1
  if command -v docker &> /dev/null && docker compose version &> /dev/null 2>&1; then
    docker compose up -d postgres synapse synapse-admin element || {
      error_exit "Failed to start Docker services"
    }
  elif command -v docker-compose &> /dev/null; then
    docker-compose up -d postgres synapse synapse-admin element || {
      error_exit "Failed to start Docker services"
    }
  else
    error_exit "Neither 'docker compose' nor 'docker-compose' is available"
  fi

  print_success "Docker services started"
}

wait_for_synapse() {
  local homeserver_url="$1"

  print_step "Waiting for Synapse to be ready..."

  wait_for_url "${homeserver_url}/health" 60 || {
    print_error "Synapse did not start properly"
    if docker compose version &> /dev/null 2>&1; then
      print_info "Check logs with: docker compose logs synapse"
    else
      print_info "Check logs with: docker-compose logs synapse"
    fi
    return 1
  }

  return 0
}

# ============================================================================
# User Creation Functions
# ============================================================================

create_matrix_user_admin_api() {
  local homeserver_url="$1"
  local admin_token="$2"
  local username="$3"
  local password="$4"
  local display_name="$5"
  local is_admin="${6:-false}"

  local user_id="@${username}:localhost"

  print_info "Creating user: $username ($display_name)..."

  # Create user via Synapse Admin API
  local response=$(curl -s -X PUT \
    -H "Authorization: Bearer $admin_token" \
    -H "Content-Type: application/json" \
    "${homeserver_url}/_synapse/admin/v2/users/${user_id}" \
    -d "{
      \"password\": \"$password\",
      \"admin\": $is_admin,
      \"displayname\": \"$display_name\",
      \"user_type\": null
    }")

  # Check if user was created successfully
  if echo "$response" | jq -e '.name' > /dev/null 2>&1; then
    print_success "Created user: $username"
    return 0
  else
    local error=$(echo "$response" | jq -r '.error // .errcode // "Unknown error"')

    # Check if user already exists
    if echo "$error" | grep -q "User ID already taken"; then
      print_warning "User $username already exists, skipping creation"
      return 0
    fi

    print_error "Failed to create user $username: $error"
    return 1
  fi
}

create_matrix_user_register_tool() {
  local username="$1"
  local password="$2"
  local is_admin="$3"

  print_info "Creating user: $username..."

  local admin_flag=""
  if [ "$is_admin" = "true" ]; then
    admin_flag="--admin"
  fi

  # Use docker exec to run register_new_matrix_user
  docker exec matrix-synapse register_new_matrix_user \
    -c /data/homeserver.yaml \
    -u "$username" \
    -p "$password" \
    $admin_flag \
    http://localhost:8008 2>&1 | grep -v "Synapse Admin API is not configured"

  local exit_code=$?

  if [ $exit_code -eq 0 ]; then
    print_success "Created user: $username"
    return 0
  else
    print_warning "User $username may already exist or creation failed"
    return 1
  fi
}

# ============================================================================
# Token Management
# ============================================================================

login_and_get_token() {
  local homeserver_url="$1"
  local username="$2"
  local password="$3"

  print_info "Obtaining access token for: $username..."

  local response=$(curl -s -X POST \
    -H "Content-Type: application/json" \
    "${homeserver_url}/_matrix/client/r0/login" \
    -d "{
      \"type\": \"m.login.password\",
      \"user\": \"$username\",
      \"password\": \"$password\"
    }")

  local access_token=$(echo "$response" | jq -r '.access_token // empty')

  if [ -z "$access_token" ] || [ "$access_token" = "null" ]; then
    local error=$(echo "$response" | jq -r '.error // .errcode // "Unknown error"')
    print_error "Failed to login as $username: $error"
    return 1
  fi

  print_success "Token obtained for: $username"
  echo "$access_token"
  return 0
}

verify_token() {
  local homeserver_url="$1"
  local access_token="$2"

  local response=$(curl -s \
    -H "Authorization: Bearer $access_token" \
    "${homeserver_url}/_matrix/client/r0/account/whoami")

  local user_id=$(echo "$response" | jq -r '.user_id // empty')

  if [ -n "$user_id" ] && [ "$user_id" != "null" ]; then
    return 0
  fi

  return 1
}

# ============================================================================
# Admin User Setup
# ============================================================================

create_admin_user() {
  local homeserver_url="$1"
  local username="$2"
  local password="$3"

  print_subsection "Creating Admin User"

  # Try using register_new_matrix_user tool first
  create_matrix_user_register_tool "$username" "$password" "true"

  # Get admin token
  local admin_token=$(login_and_get_token "$homeserver_url" "$username" "$password")

  if [ -z "$admin_token" ]; then
    error_exit "Failed to obtain admin token"
  fi

  # Verify token works
  if ! verify_token "$homeserver_url" "$admin_token"; then
    error_exit "Admin token verification failed"
  fi

  print_success "Admin user created and verified"
  echo "$admin_token"
}

# ============================================================================
# Department User Creation
# ============================================================================

create_department_users() {
  local session_file="$1"
  local homeserver_url="$2"
  local admin_token="$3"

  print_subsection "Creating Department Users"

  local dept_count=$(jq -r '.departments | length' "$session_file")
  local total_users=0
  local created_users=0

  # Count total users
  for ((d=0; d<dept_count; d++)); do
    local user_count=$(jq -r ".departments[$d].users | length" "$session_file")
    total_users=$((total_users + user_count))
  done

  print_info "Creating $total_users department users..."
  echo ""

  # Create each user
  for ((d=0; d<dept_count; d++)); do
    local dept_id=$(jq -r ".departments[$d].id" "$session_file")
    local dept_name=$(jq -r ".departments[$d].name" "$session_file")
    local user_count=$(jq -r ".departments[$d].users | length" "$session_file")

    print_info "Department: $dept_name ($user_count users)"

    for ((u=0; u<user_count; u++)); do
      local username=$(jq -r ".departments[$d].users[$u].username" "$session_file")
      local password=$(jq -r ".departments[$d].users[$u].password" "$session_file")
      local display_name=$(jq -r ".departments[$d].users[$u].display_name" "$session_file")

      # Create user
      if create_matrix_user_admin_api "$homeserver_url" "$admin_token" "$username" "$password" "$display_name" "false"; then
        # Get access token
        local token=$(login_and_get_token "$homeserver_url" "$username" "$password")

        if [ -n "$token" ]; then
          # Save token to session file
          json_set_string "$session_file" ".departments[$d].users[$u].access_token" "$token"
          json_set_string "$session_file" ".departments[$d].users[$u].matrix_user_id" "@${username}:localhost"

          ((created_users++))
          print_success "  [$created_users/$total_users] $username configured"
        else
          print_error "  Failed to get token for $username"
        fi
      else
        print_error "  Failed to create $username"
      fi
    done

    echo ""
  done

  if [ $created_users -eq $total_users ]; then
    print_success "All $total_users users created successfully"
    return 0
  else
    print_warning "Created $created_users out of $total_users users"
    return 1
  fi
}

# ============================================================================
# Space Creation
# ============================================================================

create_root_space() {
  local homeserver_url="$1"
  local admin_token="$2"
  local space_name="$3"
  local space_topic="$4"

  print_info "Creating root space: $space_name..."

  local response=$(curl -s -X POST \
    -H "Authorization: Bearer $admin_token" \
    -H "Content-Type: application/json" \
    "${homeserver_url}/_matrix/client/v3/createRoom" \
    -d "{
      \"name\": \"$space_name\",
      \"topic\": \"$space_topic\",
      \"creation_content\": {
        \"type\": \"m.space\"
      },
      \"power_level_content_override\": {
        \"users\": {
          \"@admin:localhost\": 100
        }
      },
      \"initial_state\": [
        {
          \"type\": \"m.room.history_visibility\",
          \"content\": {\"history_visibility\": \"shared\"}
        },
        {
          \"type\": \"m.room.guest_access\",
          \"content\": {\"guest_access\": \"can_join\"}
        },
        {
          \"type\": \"m.room.join_rules\",
          \"content\": {\"join_rule\": \"invite\"}
        }
      ]
    }")

  local room_id=$(echo "$response" | jq -r '.room_id // empty')

  if [ -n "$room_id" ] && [ "$room_id" != "null" ]; then
    print_success "Root space created: $room_id"
    echo "$room_id"
    return 0
  else
    local error=$(echo "$response" | jq -r '.error // .errcode // "Unknown error"')
    print_error "Failed to create root space: $error"
    return 1
  fi
}

# ============================================================================
# PostgreSQL Setup
# ============================================================================

setup_postgres_docker() {
  print_step "Starting PostgreSQL with Docker..."

  # Try docker compose (v2) first, fallback to docker-compose (v1)
  if command -v docker &> /dev/null && docker compose version &> /dev/null 2>&1; then
    docker compose up -d postgres || {
      error_exit "Failed to start PostgreSQL"
    }
  elif command -v docker-compose &> /dev/null; then
    docker-compose up -d postgres || {
      error_exit "Failed to start PostgreSQL"
    }
  else
    error_exit "Neither 'docker compose' nor 'docker-compose' is available"
  fi

  # Wait for PostgreSQL to be ready
  print_info "Waiting for PostgreSQL to be ready..."
  sleep 5

  # Test connection
  if docker exec postgres pg_isready -U synapse_user > /dev/null 2>&1; then
    print_success "PostgreSQL is ready"
    return 0
  else
    print_error "PostgreSQL failed to start properly"
    return 1
  fi
}

check_postgres_local() {
  local host="$1"
  local port="$2"
  local user="$3"
  local database="$4"

  print_step "Checking local PostgreSQL connection..."

  if command -v psql &> /dev/null; then
    if PGPASSWORD="$5" psql -h "$host" -p "$port" -U "$user" -d "$database" -c "SELECT 1;" > /dev/null 2>&1; then
      print_success "PostgreSQL connection successful"
      return 0
    fi
  fi

  print_error "Failed to connect to PostgreSQL"
  return 1
}

# Export functions
export -f setup_synapse_docker wait_for_synapse
export -f create_matrix_user_admin_api create_matrix_user_register_tool
export -f login_and_get_token verify_token
export -f create_admin_user create_department_users
export -f create_root_space
export -f setup_postgres_docker check_postgres_local
