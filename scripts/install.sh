#!/bin/bash
# Matrix Chat Support Widget - Interactive Installer
# Complete automated installation with multi-user and multi-department support

set -e

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Source all library functions
source "$SCRIPT_DIR/lib/common.sh"
source "$SCRIPT_DIR/lib/synapse-setup.sh"
source "$SCRIPT_DIR/lib/config-generator.sh"
source "$SCRIPT_DIR/lib/telegram-setup.sh"

# Global variables
INSTALL_SESSION_FILE="$PROJECT_ROOT/data/install-session.json"
USER_CREDENTIALS_FILE="$PROJECT_ROOT/data/user-credentials.txt"
LOG_FILE="$PROJECT_ROOT/logs/install-$(date +%Y%m%d_%H%M%S).log"

# ============================================================================
# Prerequisites Check
# ============================================================================

check_prerequisites() {
  print_section "STEP 1: Prerequisites Check"

  local all_ok=true

  print_info "Checking required software..."
  echo ""

  check_command "docker" "Docker" || all_ok=false
  check_docker_permissions || all_ok=false
  check_docker_compose || all_ok=false
  check_command "node" "Node.js" "18" || all_ok=false
  check_command "npm" "npm" || all_ok=false
  check_command "curl" "curl" || all_ok=false
  check_command "jq" "jq" || all_ok=false

  echo ""
  check_disk_space 5 || all_ok=false
  check_ram 2 || all_ok=false

  if [ "$all_ok" = false ]; then
    error_exit "Prerequisites check failed. Please install missing requirements."
  fi

  print_success "All prerequisites met!"
  confirm_continue
}

# ============================================================================
# Interactive Configuration
# ============================================================================

configure_postgres() {
  print_section "STEP 2: PostgreSQL Configuration"

  local choice=$(ask_choice "How would you like to run PostgreSQL?" \
    "Docker (recommended)" \
    "Local installation")

  if [ "$choice" = "1" ]; then
    json_set_string "$INSTALL_SESSION_FILE" ".postgres.mode" "docker"
    json_set_string "$INSTALL_SESSION_FILE" ".postgres.host" "localhost"
    json_set "$INSTALL_SESSION_FILE" ".postgres.port" "5432"
    print_success "Will use PostgreSQL in Docker"
  else
    json_set_string "$INSTALL_SESSION_FILE" ".postgres.mode" "local"

    local host=$(ask_input "PostgreSQL Host" "localhost")
    local port=$(ask_input "PostgreSQL Port" "5432")
    local user=$(ask_input "PostgreSQL User" "synapse_user")
    local password=$(ask_password "PostgreSQL Password")
    local database=$(ask_input "PostgreSQL Database" "synapse")

    json_set_string "$INSTALL_SESSION_FILE" ".postgres.host" "$host"
    json_set "$INSTALL_SESSION_FILE" ".postgres.port" "$port"
    json_set_string "$INSTALL_SESSION_FILE" ".postgres.user" "$user"
    json_set_string "$INSTALL_SESSION_FILE" ".postgres.password" "$password"
    json_set_string "$INSTALL_SESSION_FILE" ".postgres.database" "$database"

    print_success "PostgreSQL configuration saved"
  fi
}

configure_matrix() {
  print_section "STEP 3: Matrix Server Configuration"

  local domain=$(ask_input "Matrix Server Domain" "localhost")
  while ! validate_domain "$domain"; do
    print_error "Invalid domain format"
    domain=$(ask_input "Matrix Server Domain" "localhost")
  done

  local port=$(ask_input "Homeserver Port" "8008")
  while ! validate_port "$port"; do
    print_error "Invalid port number"
    port=$(ask_input "Homeserver Port" "8008")
  done

  local homeserver_url="http://${domain}:${port}"

  json_set_string "$INSTALL_SESSION_FILE" ".matrix.domain" "$domain"
  json_set "$INSTALL_SESSION_FILE" ".matrix.port" "$port"
  json_set_string "$INSTALL_SESSION_FILE" ".matrix.homeserver_url" "$homeserver_url"

  print_subsection "Admin User Configuration"

  local admin_user=$(ask_input "Admin Username" "admin")
  while ! validate_username "$admin_user"; do
    print_error "Invalid username (3-32 chars, lowercase alphanumeric and underscores only)"
    admin_user=$(ask_input "Admin Username" "admin")
  done

  local admin_password=$(ask_password "Admin Password")

  json_set_string "$INSTALL_SESSION_FILE" ".matrix.admin_user" "$admin_user"
  json_set_string "$INSTALL_SESSION_FILE" ".matrix.admin_password" "$admin_password"

  print_success "Matrix configuration saved"
}

configure_departments() {
  print_section "STEP 4: Department Configuration"

  local dept_count=$(ask_input "How many departments do you need?" "3")
  while [[ ! "$dept_count" =~ ^[0-9]+$ ]] || [ "$dept_count" -lt 1 ] || [ "$dept_count" -gt 10 ]; do
    print_error "Please enter a number between 1 and 10"
    dept_count=$(ask_input "How many departments?" "3")
  done

  # Initialize departments array
  json_set "$INSTALL_SESSION_FILE" ".departments" "[]"

  local default_icons=("🎧" "💰" "🔒" "💼" "📋" "🛠️" "📞" "💬" "🏪" "🎯")
  local default_colors=("#667eea" "#10b981" "#f59e0b" "#8b5cf6" "#3b82f6" "#ec4899" "#14b8a6" "#f97316" "#06b6d4" "#84cc16")

  for ((d=0; d<dept_count; d++)); do
    print_subsection "DEPARTMENT $((d+1)) OF $dept_count"

    local dept_id=$(ask_input "Department ID (e.g., support, commerce)" "")
    while ! validate_username "$dept_id"; do
      print_error "Invalid department ID (lowercase alphanumeric and underscores only)"
      dept_id=$(ask_input "Department ID" "")
    done

    local dept_name=$(ask_input "Department Name" "")
    local dept_desc=$(ask_input "Department Description" "")
    local dept_icon=$(ask_input "Icon (emoji)" "${default_icons[$d]}")
    local dept_color=$(ask_input "Color (hex)" "${default_colors[$d]}")
    while ! validate_color "$dept_color"; do
      print_error "Invalid color (must be hex format #RRGGBB)"
      dept_color=$(ask_input "Color (hex)" "${default_colors[$d]}")
    done

    # Create department object
    local dept_obj=$(jq -n \
      --arg id "$dept_id" \
      --arg name "$dept_name" \
      --arg desc "$dept_desc" \
      --arg icon "$dept_icon" \
      --arg color "$dept_color" \
      '{id: $id, name: $name, description: $desc, icon: $icon, color: $color, users: []}')

    json_array_append "$INSTALL_SESSION_FILE" ".departments" "$dept_obj"

    echo ""
    print_info "Configuring users for: $dept_name"
    echo ""

    local user_count=$(ask_input "How many users in this department?" "2")
    while [[ ! "$user_count" =~ ^[0-9]+$ ]] || [ "$user_count" -lt 1 ] || [ "$user_count" -gt 20 ]; do
      print_error "Please enter a number between 1 and 20"
      user_count=$(ask_input "How many users?" "2")
    done

    for ((u=0; u<user_count; u++)); do
      print_box "User $((u+1)) of $user_count - $dept_name"

      local username=$(ask_input "  Username" "")
      while ! validate_username "$username"; do
        print_error "  Invalid username (3-32 chars, lowercase alphanumeric and underscores only)"
        username=$(ask_input "  Username" "")
      done

      local display_name=$(ask_input "  Display Name (Full Name)" "")
      local password=$(ask_password "  Initial Password")

      local telegram_enabled="false"
      if ask_yes_no "  Enable Telegram for this user?" "y"; then
        telegram_enabled="true"
      fi

      # Create user object
      local user_obj=$(jq -n \
        --arg username "$username" \
        --arg display_name "$display_name" \
        --arg password "$password" \
        --argjson telegram_enabled "$telegram_enabled" \
        '{username: $username, display_name: $display_name, password: $password, telegram_enabled: $telegram_enabled, matrix_user_id: null, access_token: null}')

      # Add user to department
      local tmp_file=$(mktemp)
      jq ".departments[$d].users += [$user_obj]" "$INSTALL_SESSION_FILE" > "$tmp_file"
      mv "$tmp_file" "$INSTALL_SESSION_FILE"

      print_success "  User configuration saved"
      echo ""
    done
  done

  print_success "All departments configured!"
}

configure_telegram() {
  print_section "STEP 5: Telegram Integration"

  # Check if any users have Telegram enabled
  local telegram_users=$(jq '[.departments[].users[] | select(.telegram_enabled == true)] | length' "$INSTALL_SESSION_FILE")

  if [ "$telegram_users" -eq 0 ]; then
    print_info "No users have Telegram enabled. Skipping Telegram configuration."
    json_set "$INSTALL_SESSION_FILE" ".telegram.enabled" "false"
    return 0
  fi

  print_info "$telegram_users users have Telegram enabled."
  echo ""

  if ! ask_yes_no "Do you have a Telegram bot already?" "n"; then
    print_box "Creating a Telegram Bot"
    echo ""
    print_info "Follow these steps to create a Telegram bot:"
    echo ""
    echo "  1. Open Telegram and search for: @BotFather"
    echo "  2. Send the command: /newbot"
    echo "  3. Follow the prompts to name your bot"
    echo "  4. Bot username must end with 'bot' (e.g., YourSupportBot)"
    echo "  5. Copy the bot token shown"
    echo ""
    echo "Press ENTER when ready..."
    read
  fi

  local bot_token=$(ask_input "Telegram Bot Token (from @BotFather)" "")

  # Validate token
  local bot_username=$(validate_telegram_token "$bot_token")
  if [ -z "$bot_username" ]; then
    print_warning "Could not validate bot token, but continuing anyway..."
    bot_username=$(ask_input "Bot Username (without @)" "")
  fi

  print_box "Telegram API Credentials"
  echo ""
  print_info "Get your Telegram API credentials:"
  echo ""
  echo "  1. Visit: https://my.telegram.org/auth"
  echo "  2. Login with your phone number"
  echo "  3. Go to: API Development Tools"
  echo "  4. Create new application (or use existing)"
  echo "  5. Copy API ID and API Hash"
  echo ""

  local api_id=$(ask_input "Telegram API ID" "")
  local api_hash=$(ask_input "Telegram API Hash" "")

  json_set "$INSTALL_SESSION_FILE" ".telegram.enabled" "true"
  json_set_string "$INSTALL_SESSION_FILE" ".telegram.bot_token" "$bot_token"
  json_set_string "$INSTALL_SESSION_FILE" ".telegram.bot_username" "$bot_username"
  json_set_string "$INSTALL_SESSION_FILE" ".telegram.api_id" "$api_id"
  json_set_string "$INSTALL_SESSION_FILE" ".telegram.api_hash" "$api_hash"

  print_success "Telegram configuration saved"
}

configure_widget() {
  print_section "STEP 6: Widget Configuration"

  local title=$(ask_input "Widget Title" "Customer Support")
  local brand_color=$(ask_input "Brand Color (hex)" "#667eea")
  while ! validate_color "$brand_color"; do
    print_error "Invalid color (must be hex format #RRGGBB)"
    brand_color=$(ask_input "Brand Color (hex)" "#667eea")
  done

  local position_choice=$(ask_choice "Widget Position" \
    "Bottom Right (recommended)" \
    "Bottom Left" \
    "Top Right" \
    "Top Left")

  local position="bottom-right"
  case "$position_choice" in
    "1") position="bottom-right" ;;
    "2") position="bottom-left" ;;
    "3") position="top-right" ;;
    "4") position="top-left" ;;
  esac

  local port=$(ask_input "Server Port" "3001")
  while ! validate_port "$port"; do
    print_error "Invalid port number"
    port=$(ask_input "Server Port" "3001")
  done

  json_set_string "$INSTALL_SESSION_FILE" ".widget.title" "$title"
  json_set_string "$INSTALL_SESSION_FILE" ".widget.brand_color" "$brand_color"
  json_set_string "$INSTALL_SESSION_FILE" ".widget.position" "$position"
  json_set "$INSTALL_SESSION_FILE" ".widget.port" "$port"

  print_success "Widget configuration saved"
}

# ============================================================================
# Installation Execution
# ============================================================================

execute_installation() {
  print_section "STEP 7: Installation"

  # Create necessary directories
  print_step "Creating directory structure..."
  ensure_directory "$PROJECT_ROOT/data"
  ensure_directory "$PROJECT_ROOT/logs"
  ensure_directory "$PROJECT_ROOT/config"
  ensure_directory "$PROJECT_ROOT/mautrix-telegram"
  print_success "Directories created"

  # Setup PostgreSQL
  local postgres_mode=$(jq -r '.postgres.mode' "$INSTALL_SESSION_FILE")
  if [ "$postgres_mode" = "docker" ]; then
    setup_postgres_docker
  else
    local host=$(jq -r '.postgres.host' "$INSTALL_SESSION_FILE")
    local port=$(jq -r '.postgres.port' "$INSTALL_SESSION_FILE")
    local user=$(jq -r '.postgres.user' "$INSTALL_SESSION_FILE")
    local database=$(jq -r '.postgres.database' "$INSTALL_SESSION_FILE")
    local password=$(jq -r '.postgres.password' "$INSTALL_SESSION_FILE")

    check_postgres_local "$host" "$port" "$user" "$database" "$password" || \
      error_exit "Failed to connect to PostgreSQL"
  fi

  # Setup Synapse
  cd "$PROJECT_ROOT"

  # Generate Synapse configuration before starting
  local server_name=$(jq -r '.matrix.server_name' "$INSTALL_SESSION_FILE")
  generate_synapse_config "$server_name"

  # Now start Synapse with the configuration
  setup_synapse_docker

  local homeserver_url=$(jq -r '.matrix.homeserver_url' "$INSTALL_SESSION_FILE")
  wait_for_synapse "$homeserver_url" || error_exit "Synapse failed to start"

  # Create admin user and get token
  local admin_user=$(jq -r '.matrix.admin_user' "$INSTALL_SESSION_FILE")
  local admin_password=$(jq -r '.matrix.admin_password' "$INSTALL_SESSION_FILE")

  local admin_token=$(create_admin_user "$homeserver_url" "$admin_user" "$admin_password")
  json_set_string "$INSTALL_SESSION_FILE" ".matrix.admin_token" "$admin_token"

  # Create department users
  create_department_users "$INSTALL_SESSION_FILE" "$homeserver_url" "$admin_token"

  # Generate all configuration files
  print_subsection "Generating Configuration Files"

  generate_config_yaml "$INSTALL_SESSION_FILE" "$PROJECT_ROOT/config/config.yaml"

  local telegram_enabled=$(jq -r '.telegram.enabled' "$INSTALL_SESSION_FILE")
  if [ "$telegram_enabled" = "true" ]; then
    generate_telegram_bot_script "$INSTALL_SESSION_FILE" "$PROJECT_ROOT/scripts/telegram-department-router.js"
    generate_mautrix_telegram_config "$INSTALL_SESSION_FILE" "$PROJECT_ROOT/mautrix-telegram/config.yaml" "$PROJECT_ROOT/mautrix-telegram/config.yaml"
    generate_bridge_registration "$PROJECT_ROOT/mautrix-telegram/registration.yaml"

    # Start Telegram bridge
    start_mautrix_telegram
    sleep 5
    verify_bridge_connection "$homeserver_url" || print_warning "Bridge verification incomplete"

    # Generate authentication guide
    generate_telegram_auth_guide "$INSTALL_SESSION_FILE" "$PROJECT_ROOT/docs/TELEGRAM_AUTH_GUIDE.md"
  fi

  # Build widget
  print_subsection "Building Widget"
  cd "$PROJECT_ROOT"

  if [ ! -d "node_modules" ]; then
    print_step "Installing npm dependencies..."
    npm install
  fi

  print_step "Building widget..."
  npm run build:widget

  print_success "Widget built successfully"
}

# ============================================================================
# Post-Installation
# ============================================================================

save_user_credentials() {
  print_step "Saving user credentials..."

  cat > "$USER_CREDENTIALS_FILE" << EOF
# Matrix Chat Support Widget - User Credentials
# Generated: $(date)
#
# ⚠️  KEEP THIS FILE SECURE - Contains sensitive passwords
#

Admin User:
  Username: $(jq -r '.matrix.admin_user' "$INSTALL_SESSION_FILE")
  Password: $(jq -r '.matrix.admin_password' "$INSTALL_SESSION_FILE")
  User ID: @$(jq -r '.matrix.admin_user' "$INSTALL_SESSION_FILE"):$(jq -r '.matrix.domain' "$INSTALL_SESSION_FILE")
  Access Token: $(jq -r '.matrix.admin_token' "$INSTALL_SESSION_FILE")

Department Users:

EOF

  local dept_count=$(jq -r '.departments | length' "$INSTALL_SESSION_FILE")

  for ((d=0; d<dept_count; d++)); do
    local dept_name=$(jq -r ".departments[$d].name" "$INSTALL_SESSION_FILE")
    echo "Department: $dept_name" >> "$USER_CREDENTIALS_FILE"
    echo "─────────────────────────────────────────" >> "$USER_CREDENTIALS_FILE"

    local user_count=$(jq -r ".departments[$d].users | length" "$INSTALL_SESSION_FILE")
    for ((u=0; u<user_count; u++)); do
      local username=$(jq -r ".departments[$d].users[$u].username" "$INSTALL_SESSION_FILE")
      local display_name=$(jq -r ".departments[$d].users[$u].display_name" "$INSTALL_SESSION_FILE")
      local password=$(jq -r ".departments[$d].users[$u].password" "$INSTALL_SESSION_FILE")
      local user_id=$(jq -r ".departments[$d].users[$u].matrix_user_id" "$INSTALL_SESSION_FILE")
      local token=$(jq -r ".departments[$d].users[$u].access_token" "$INSTALL_SESSION_FILE")
      local telegram=$(jq -r ".departments[$d].users[$u].telegram_enabled" "$INSTALL_SESSION_FILE")

      cat >> "$USER_CREDENTIALS_FILE" << EOF
  • $display_name
    Username: $username
    Password: $password
    User ID: $user_id
    Access Token: $token
    Telegram: $telegram

EOF
    done
    echo "" >> "$USER_CREDENTIALS_FILE"
  done

  chmod 600 "$USER_CREDENTIALS_FILE"
  print_success "Credentials saved to: $USER_CREDENTIALS_FILE"
}

display_summary() {
  local homeserver_url=$(jq -r '.matrix.homeserver_url' "$INSTALL_SESSION_FILE")
  local widget_port=$(jq -r '.widget.port' "$INSTALL_SESSION_FILE")
  local dept_count=$(jq -r '.departments | length' "$INSTALL_SESSION_FILE")
  local telegram_enabled=$(jq -r '.telegram.enabled' "$INSTALL_SESSION_FILE")
  local telegram_users=$(jq '[.departments[].users[] | select(.telegram_enabled == true)] | length' "$INSTALL_SESSION_FILE")
  local total_users=$(jq '[.departments[].users[]] | length' "$INSTALL_SESSION_FILE")

  echo ""
  echo ""
  print_header "INSTALLATION COMPLETED SUCCESSFULLY!"
  echo ""

  print_subsection "📊 Installation Summary"
  echo ""
  echo "  Departments: $dept_count"
  echo "  Total Users: $((total_users + 1)) (1 admin + $total_users department users)"
  if [ "$telegram_enabled" = "true" ]; then
    echo "  Telegram Users: $telegram_users"
  fi
  echo ""

  print_subsection "🌐 Access Points"
  echo ""
  echo "  Widget Server:  http://localhost:$widget_port"
  echo "  Element Web:    http://localhost:8081"
  echo "  Admin Panel:    http://localhost:8080"
  echo "  Synapse API:    $homeserver_url"
  echo ""

  print_subsection "🔐 Credentials"
  echo ""
  echo "  Saved to: $USER_CREDENTIALS_FILE"
  echo "  $(print_warning "Keep this file secure!")"
  echo ""

  if [ "$telegram_enabled" = "true" ] && [ "$telegram_users" -gt 0 ]; then
    print_subsection "📱 TELEGRAM AUTHENTICATION REQUIRED"
    echo ""
    echo "  $telegram_users users need to authenticate their Telegram accounts:"
    echo ""
    echo "  1. Open Element Web: http://localhost:8081"
    echo "  2. Login with Matrix credentials"
    echo "  3. Find \"Telegram bridge bot\" room"
    echo "  4. Send: login"
    echo "  5. Enter phone number and verification code"
    echo ""
    echo "  Detailed guide: docs/TELEGRAM_AUTH_GUIDE.md"
    echo ""
  fi

  print_subsection "📖 Next Steps"
  echo ""
  echo "  1. Review user credentials"
  if [ "$telegram_enabled" = "true" ]; then
    echo "  2. Each user authenticates Telegram (see guide above)"
    echo "  3. Test widget: http://localhost:$widget_port/widget/widget-test.html"
    echo "  4. Test Telegram: message @$(jq -r '.telegram.bot_username' "$INSTALL_SESSION_FILE")"
  else
    echo "  2. Test widget: http://localhost:$widget_port/widget/widget-test.html"
  fi
  echo "  5. Configure production deployment (see INSTRUCTIONS.md)"
  echo ""

  print_info "Installation log: $LOG_FILE"
  echo ""
}

# ============================================================================
# Main Installation Flow
# ============================================================================

main() {
  # Create initial session file
  ensure_directory "$(dirname "$INSTALL_SESSION_FILE")"
  echo '{}' > "$INSTALL_SESSION_FILE"

  # Show header
  print_header "Matrix Chat Support Widget - Interactive Installer"

  print_info "This installer will guide you through setting up:"
  echo ""
  echo "  • Matrix/Synapse homeserver"
  echo "  • Multiple departments with multiple users"
  echo "  • Telegram bot integration (optional)"
  echo "  • Web chat widget"
  echo ""

  confirm_continue

  # Run all configuration steps
  check_prerequisites
  configure_postgres
  configure_matrix
  configure_departments
  configure_telegram
  configure_widget

  # Show summary of what will be installed
  print_section "Configuration Summary"
  echo ""
  print_info "Review your configuration:"
  echo ""
  echo "  Departments: $(jq -r '.departments | length' "$INSTALL_SESSION_FILE")"
  echo "  Total Users: $(jq '[.departments[].users[]] | length' "$INSTALL_SESSION_FILE")"
  echo "  Telegram: $(jq -r '.telegram.enabled' "$INSTALL_SESSION_FILE")"
  echo ""

  confirm_continue "Proceed with installation?"

  # Execute installation
  execute_installation

  # Post-installation
  save_user_credentials
  display_summary

  # Optional systemd installation
  setup_systemd

  print_success "🎉 Installation complete!"
  echo ""
}

# ============================================================================
# Systemd Service Setup (Optional)
# ============================================================================

setup_systemd() {
  print_section "STEP 8: Systemd Service Setup (Optional)"

  # Check if systemd is available
  if ! command -v systemctl &> /dev/null; then
    print_info "Systemd not available on this system - skipping"
    return 0
  fi

  # Check if running as root
  if [ "$EUID" -ne 0 ]; then
    print_warning "Systemd installation requires root privileges"
    print_info "You can install systemd services later by running:"
    print_info "  sudo $PROJECT_ROOT/config/systemd/install-systemd.sh"
    echo ""
    return 0
  fi

  echo ""
  print_info "Systemd services allow you to manage the application with:"
  echo ""
  echo "  sudo systemctl start matrix-chat-widget"
  echo "  sudo systemctl status matrix-chat-*"
  echo "  sudo journalctl -u matrix-chat-widget -f"
  echo ""
  print_info "Services will auto-start on system boot and auto-restart on failure"
  echo ""

  if ! ask_yes_no "Install systemd services now?" "y"; then
    print_info "Skipping systemd installation"
    print_info "To install later, run: sudo $PROJECT_ROOT/config/systemd/install-systemd.sh"
    echo ""
    return 0
  fi

  print_subsection "Installing Systemd Services"

  # Create system user if doesn't exist
  if ! id "matrix-chat" &>/dev/null; then
    print_step "Creating system user 'matrix-chat'..."
    useradd -r -s /bin/false -d "$PROJECT_ROOT" -c "Matrix Chat Support Widget" matrix-chat
    print_success "Created user: matrix-chat"
  else
    print_info "User 'matrix-chat' already exists"
  fi

  # Set ownership
  print_step "Setting file ownership..."
  chown -R matrix-chat:matrix-chat "$PROJECT_ROOT"
  chmod 755 "$PROJECT_ROOT/data"
  chmod 755 "$PROJECT_ROOT/logs"

  # Protect sensitive files
  if [ -f "$PROJECT_ROOT/config/config.yaml" ]; then
    chmod 600 "$PROJECT_ROOT/config/config.yaml"
  fi
  if [ -f "$PROJECT_ROOT/data/chat-room-mappings.json" ]; then
    chmod 600 "$PROJECT_ROOT/data/chat-room-mappings.json"
  fi
  print_success "Ownership and permissions configured"

  # Process and install service files
  print_step "Installing service files..."

  local tmp_dir=$(mktemp -d)

  # Update service files with actual project path
  for service_file in "$PROJECT_ROOT/config/systemd"/*.service; do
    if [ -f "$service_file" ]; then
      local service_name=$(basename "$service_file")
      sed "s|/opt/matrix-chat-support|$PROJECT_ROOT|g" "$service_file" > "$tmp_dir/$service_name"
    fi
  done

  # Copy to systemd directory
  cp "$tmp_dir"/*.service /etc/systemd/system/
  rm -rf "$tmp_dir"
  print_success "Service files installed"

  # Reload systemd
  print_step "Reloading systemd daemon..."
  systemctl daemon-reload
  print_success "Systemd reloaded"

  # Enable services
  print_step "Enabling services..."

  # Enable individual services
  systemctl enable matrix-chat-docker.service
  systemctl enable matrix-chat-widget.service

  local telegram_enabled=$(jq -r '.telegram.enabled' "$INSTALL_SESSION_FILE")
  if [ "$telegram_enabled" = "true" ]; then
    systemctl enable matrix-chat-telegram.service
  fi

  # Enable master target
  systemctl enable matrix-chat.target

  print_success "Services enabled for auto-start on boot"
  print_info "Master service 'matrix-chat.target' enabled - manage all services with one command"

  # Start services
  echo ""
  if ask_yes_no "Start services now?" "y"; then
    print_step "Starting all services via master target..."

    # Start master target (starts all dependencies automatically)
    systemctl start matrix-chat.target

    print_info "Waiting for all services to start..."
    sleep 15

    # Check status of all services
    if systemctl is-active --quiet matrix-chat-widget.service; then
      print_success "Widget server started"
    fi

    if systemctl is-active --quiet matrix-chat-docker.service; then
      print_success "Docker services started"
    fi

    if [ "$telegram_enabled" = "true" ]; then
      if systemctl is-active --quiet matrix-chat-telegram.service; then
        print_success "Telegram router started"
      fi
    fi

    echo ""
    print_success "All services started successfully!"
    echo ""
    print_info "Manage all services with: sudo systemctl {start|stop|restart|status} matrix-chat.target"
    print_info "Check individual status: sudo systemctl status matrix-chat-*"
    print_info "View logs: sudo journalctl -u matrix-chat-widget -f"
  else
    print_info "Services installed but not started"
    echo ""
    print_info "Start all services with: sudo systemctl start matrix-chat.target"
    print_info "Or start individually:"
    print_info "  sudo systemctl start matrix-chat-docker"
    print_info "  sudo systemctl start matrix-chat-widget"
    if [ "$telegram_enabled" = "true" ]; then
      print_info "  sudo systemctl start matrix-chat-telegram"
    fi
  fi

  echo ""
}

# Run main function
main "$@"
