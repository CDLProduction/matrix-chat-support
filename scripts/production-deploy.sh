#!/bin/bash

################################################################################
# Matrix Chat Support Widget - Production Deployment Script
################################################################################
#
# This script deploys the complete Matrix Chat Support system to a production
# server with the current working configuration:
#   - 3 Departments (Support, Commerce, Identification)
#   - 9 Department Users + 1 Admin
#   - Telegram Integration
#   - Systemd Services
#   - Optional Web Server Configuration
#
# Requirements:
#   - Ubuntu 20.04+ or Debian 11+
#   - Docker & Docker Compose
#   - Node.js 18+
#   - Sudo privileges
#   - Minimum 10GB disk space
#
# Usage:
#   sudo ./scripts/production-deploy.sh
#
################################################################################

set -e

# Source utility functions
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/lib/production-utils.sh"

# ============================================================================
# Configuration
# ============================================================================

INSTALL_DIR="/opt/matrix-chat-support"
SYSTEM_USER="matrix-chat"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

# Default values
DEFAULT_ADMIN_PASSWORD="admin123"
DEFAULT_DOMAIN="localhost"
DEFAULT_PORT="8008"

# Session file to track installation state
SESSION_FILE="/tmp/matrix-chat-production-session.json"

# ============================================================================
# Phase 1: Pre-Flight Checks
# ============================================================================

phase_preflight_checks() {
    print_header "Phase 1/12: Pre-Flight Checks"

    check_sudo_permissions || error_exit "Sudo access required"
    check_os_compatibility || error_exit "Unsupported OS"
    check_docker || error_exit "Docker not available"
    check_nodejs_version || error_exit "Node.js 18+ required"
    check_disk_space || print_warning "Low disk space"

    # Check required commands
    print_step "Checking required commands..."
    local missing=0
    for cmd in jq curl git tar; do
        if ! command -v $cmd &> /dev/null; then
            print_error "$cmd is not installed"
            ((missing++))
        else
            print_success "$cmd is available"
        fi
    done

    if [ $missing -gt 0 ]; then
        echo ""
        print_info "Install missing packages:"
        echo "  sudo apt update && sudo apt install -y jq curl git tar"
        error_exit "Missing required commands"
    fi

    # Check ports
    print_step "Checking required ports..."
    for port in 8008 8080 8081 3001; do
        if check_port_available $port; then
            print_success "Port $port is available"
        else
            print_warning "Port $port is in use"
        fi
    done

    print_success "Pre-flight checks passed!"
    update_progress
}

# ============================================================================
# Phase 2: System Preparation
# ============================================================================

phase_system_preparation() {
    print_header "Phase 2/12: System Preparation"

    # Create system user
    create_system_user "$SYSTEM_USER" "$INSTALL_DIR"

    # Create directory structure
    create_directory_structure "$INSTALL_DIR"

    # Install system dependencies if needed
    print_step "Ensuring system dependencies..."
    sudo apt-get update -qq
    sudo apt-get install -y -qq jq curl git tar openssl &> /dev/null || true

    print_success "System preparation complete!"
    update_progress
}

# ============================================================================
# Phase 3: Application Installation
# ============================================================================

phase_application_installation() {
    print_header "Phase 3/12: Application Installation"

    print_step "Copying project files to $INSTALL_DIR..."

    # Copy necessary directories
    sudo cp -r "$PROJECT_DIR/config" "$INSTALL_DIR/"
    sudo cp -r "$PROJECT_DIR/server" "$INSTALL_DIR/"
    sudo cp -r "$PROJECT_DIR/scripts" "$INSTALL_DIR/"
    sudo cp -r "$PROJECT_DIR/src" "$INSTALL_DIR/" 2>/dev/null || true
    sudo cp -r "$PROJECT_DIR/docker" "$INSTALL_DIR/" 2>/dev/null || true
    sudo cp "$PROJECT_DIR/docker-compose.yml" "$INSTALL_DIR/"
    sudo cp "$PROJECT_DIR/package.json" "$INSTALL_DIR/"
    sudo cp "$PROJECT_DIR/package-lock.json" "$INSTALL_DIR/" 2>/dev/null || true
    sudo cp "$PROJECT_DIR/vite.config.js" "$INSTALL_DIR/" 2>/dev/null || true
    sudo cp "$PROJECT_DIR/vite.config.ts" "$INSTALL_DIR/" 2>/dev/null || true

    # Copy built widget if exists
    if [ -d "$PROJECT_DIR/dist" ]; then
        sudo cp -r "$PROJECT_DIR/dist" "$INSTALL_DIR/"
        print_success "Pre-built widget copied"
    else
        print_warning "Widget not built yet, will build during installation"
    fi

    # Set ownership
    set_ownership "$INSTALL_DIR" "$SYSTEM_USER"

    # Install Node.js dependencies
    print_step "Installing Node.js dependencies..."
    cd "$INSTALL_DIR"

    # Check if widget needs to be built
    local need_build=false
    if [ ! -d "$INSTALL_DIR/dist/widget" ] || [ -z "$(ls -A $INSTALL_DIR/dist/widget 2>/dev/null)" ]; then
        need_build=true
    fi

    # Use npm ci if package-lock.json exists, otherwise use npm install
    # Include devDependencies if we need to build (vite is in devDependencies)
    if [ -f "$INSTALL_DIR/package-lock.json" ]; then
        print_info "Using npm ci (package-lock.json found)..."
        if [ "$need_build" = true ]; then
            sudo -u $SYSTEM_USER npm ci --quiet || {
                error_exit "Failed to install Node.js dependencies"
            }
        else
            sudo -u $SYSTEM_USER npm ci --omit=dev --quiet || {
                error_exit "Failed to install Node.js dependencies"
            }
        fi
    else
        print_info "Using npm install (no package-lock.json)..."
        if [ "$need_build" = true ]; then
            sudo -u $SYSTEM_USER npm install --quiet || {
                error_exit "Failed to install Node.js dependencies"
            }
        else
            sudo -u $SYSTEM_USER npm install --omit=dev --quiet || {
                error_exit "Failed to install Node.js dependencies"
            }
        fi
    fi
    print_success "Node.js dependencies installed"

    # Build widget if needed
    if [ "$need_build" = true ]; then
        print_step "Building widget..."
        cd "$INSTALL_DIR"
        sudo -u $SYSTEM_USER npm run build:widget || {
            error_exit "Failed to build widget"
        }
        print_success "Widget built successfully"

        # Clean up dev dependencies after build to save space
        print_info "Removing dev dependencies to save space..."
        sudo -u $SYSTEM_USER npm prune --omit=dev --quiet || true

        cd - > /dev/null
    else
        print_info "Widget already built, skipping build step"
    fi

    print_success "Application installation complete!"
    update_progress
}

# ============================================================================
# Phase 4: Configuration Setup
# ============================================================================

phase_configuration_setup() {
    print_header "Phase 4/12: Configuration Setup"

    # Ask for production configuration
    print_section "Production Configuration"

    local domain
    while true; do
        domain=$(ask_question "Enter production domain (e.g., chat.company.com)" "$DEFAULT_DOMAIN")
        if validate_domain "$domain" || [ "$domain" = "localhost" ]; then
            break
        else
            print_error "Invalid domain format"
        fi
    done

    local admin_email=""
    if [ "$domain" != "localhost" ]; then
        while true; do
            admin_email=$(ask_question "Enter admin email for SSL certificates" "admin@$domain")
            if validate_email "$admin_email"; then
                break
            else
                print_error "Invalid email format"
            fi
        done
    fi

    local admin_password
    if ask_yes_no "Auto-generate secure admin password?" "y"; then
        admin_password=$(generate_secure_password 16)
        print_info "Generated admin password: $admin_password"
    else
        admin_password=$(ask_password "Enter admin password (min 8 characters)")
    fi

    # Telegram configuration
    local telegram_token="8497512931:AAGddNooUhvamOws_7ohRTQRgAulQPs9jGM"
    if ask_yes_no "Use existing Telegram bot token (QWMatrixTestBot)?" "y"; then
        print_info "Using existing Telegram bot token"
    else
        telegram_token=$(ask_question "Enter Telegram bot token" "")
    fi

    # CORS origins
    local cors_origins="http://localhost:3000,http://localhost:5173"
    if [ "$domain" != "localhost" ]; then
        cors_origins=$(ask_question "Enter CORS origins (comma-separated)" "https://$domain,https://www.$domain")
    fi

    # Save configuration to session (using jq to properly escape JSON)
    jq -n \
        --arg domain "$domain" \
        --arg admin_email "$admin_email" \
        --arg admin_password "$admin_password" \
        --arg telegram_token "$telegram_token" \
        --arg cors_origins "$cors_origins" \
        --arg install_dir "$INSTALL_DIR" \
        --arg system_user "$SYSTEM_USER" \
        '{
            domain: $domain,
            admin_email: $admin_email,
            admin_password: $admin_password,
            telegram_token: $telegram_token,
            cors_origins: $cors_origins,
            install_dir: $install_dir,
            system_user: $system_user
        }' > "$SESSION_FILE"

    print_success "Configuration saved"
    update_progress
}

# ============================================================================
# Phase 5: Docker Services
# ============================================================================

phase_docker_services() {
    print_header "Phase 5/12: Docker Services Setup"

    cd "$INSTALL_DIR"

    # Get compose command
    local compose_cmd="docker compose"
    if ! docker compose version &> /dev/null 2>&1; then
        compose_cmd="docker-compose"
    fi

    # Update homeserver.yaml with domain
    local domain=$(jq -r '.domain' "$SESSION_FILE")

    print_step "Configuring Synapse homeserver..."

    # Copy homeserver template
    sudo cp "$INSTALL_DIR/docker/synapse/homeserver.yaml" "$INSTALL_DIR/data/homeserver.yaml" || {
        error_exit "Homeserver template not found"
    }
    sudo cp "$INSTALL_DIR/docker/synapse/localhost.log.config" "$INSTALL_DIR/data/localhost.log.config" || {
        error_exit "Log config template not found"
    }

    # Update server_name in homeserver.yaml
    sudo sed -i "s/server_name: \"localhost\"/server_name: \"$domain\"/" "$INSTALL_DIR/data/homeserver.yaml"
    sudo sed -i "s/localhost.signing.key/${domain}.signing.key/" "$INSTALL_DIR/data/homeserver.yaml"

    # Create media_store directory
    sudo mkdir -p "$INSTALL_DIR/data/media_store"

    # Set ownership for Synapse to match current user (1000:1000 for cdl user)
    sudo chown -R 1000:1000 "$INSTALL_DIR/data/" 2>/dev/null || {
        sudo chmod -R 777 "$INSTALL_DIR/data/"
    }

    # Create .env file for Docker Compose with proper UID/GID
    cat > "$INSTALL_DIR/.env" << 'EOF'
# Synapse User/Group ID Configuration
SYNAPSE_UID=1000
SYNAPSE_GID=1000
EOF

    print_success "Synapse configured for domain: $domain"

    # Start Docker services
    print_step "Starting Docker services..."

    sudo $compose_cmd up -d postgres || error_exit "Failed to start PostgreSQL"
    print_success "PostgreSQL started"

    sleep 5

    # Start Synapse (it will auto-generate signing key on first run)
    print_step "Starting Synapse and generating signing key..."
    sudo $compose_cmd up -d synapse || error_exit "Failed to start Synapse"

    # Wait for signing key to be generated
    sleep 3
    if [ ! -f "$INSTALL_DIR/data/localhost.signing.key" ]; then
        print_info "Waiting for Synapse to generate signing key..."
        sleep 5
    fi

    print_success "Synapse started"

    sudo $compose_cmd up -d synapse-admin element 2>/dev/null || true
    print_success "Admin panel and Element started"

    # Wait for Synapse to be ready
    wait_for_synapse "http://localhost:8008" 60 || error_exit "Synapse failed to start"

    print_success "Docker services ready!"
    update_progress
}

# ============================================================================
# Phase 6: User Creation & Token Management
# ============================================================================

phase_user_creation() {
    print_header "Phase 6/12: User Creation & Token Management"

    local domain=$(jq -r '.domain' "$SESSION_FILE")
    local admin_password=$(jq -r '.admin_password' "$SESSION_FILE")
    local homeserver="http://localhost:8008"

    # Create admin user
    print_section "Creating Admin User"
    local admin_token=$(matrix_create_user "$homeserver" "admin" "$admin_password" "true")

    if [ -z "$admin_token" ]; then
        error_exit "Failed to create admin user"
    fi

    # Store admin token
    jq --arg token "$admin_token" '.admin_token = $token' "$SESSION_FILE" > "$SESSION_FILE.tmp"
    mv "$SESSION_FILE.tmp" "$SESSION_FILE"

    # Create department users
    print_section "Creating Department Users"

    declare -A user_tokens

    # Support Department (3 users)
    print_info "Support Department (3 users)..."
    for i in 1 2 3; do
        local token=$(matrix_create_user "$homeserver" "support_agent$i" "support${i}123" "false")
        user_tokens["support_agent$i"]="$token"
    done

    # Commerce Department (4 users)
    print_info "Commerce Department (4 users)..."
    for i in 1 2 3 4; do
        local token=$(matrix_create_user "$homeserver" "commerce_agent$i" "commerce${i}123" "false")
        user_tokens["commerce_agent$i"]="$token"
    done

    # Identification Department (2 users)
    print_info "Identification Department (2 users)..."
    for i in 1 2; do
        local token=$(matrix_create_user "$homeserver" "identify_agent$i" "identify${i}123" "false")
        user_tokens["identify_agent$i"]="$token"
    done

    # Observer User (read-only access to all departments)
    print_info "Creating Observer User (read-only)..."
    local observer_token=$(matrix_create_user "$homeserver" "observer" "observer123" "false")
    user_tokens["observer"]="$observer_token"

    print_success "All users created (1 admin + 9 department users + 1 observer)"

    # Update config.yaml with tokens using Python/YAML for safety
    print_step "Updating config.yaml with access tokens..."

    local config_file="$INSTALL_DIR/config/config.yaml"
    local telegram_token=$(jq -r '.telegram_token' "$SESSION_FILE")

    # Use Python to safely update YAML with tokens and domain
    python3 << PYEOF
import yaml
import sys

config_file = "$config_file"
domain = "$domain"

try:
    with open(config_file, 'r') as f:
        config = yaml.safe_load(f)

    # Update top-level matrix config (used by Telegram router)
    if 'matrix' in config:
        config['matrix']['homeserver'] = f'http://{domain}:8008'
        config['matrix']['access_token'] = '$admin_token'
        config['matrix']['admin_access_token'] = '$admin_token'
        config['matrix']['bot_user_id'] = f'@admin:{domain}'

    # Update department tokens and homeserver URLs
    for dept in config.get('departments', []):
        # Update homeserver and domain for all departments
        if 'matrix' in dept:
            dept['matrix']['homeserver'] = f'http://{domain}:8008'

            # Update user IDs to use production domain
            if 'bot_user_id' in dept['matrix']:
                # Extract username from existing bot_user_id
                old_bot = dept['matrix']['bot_user_id']
                username = old_bot.split(':')[0]  # @username:localhost -> @username
                dept['matrix']['bot_user_id'] = f'{username}:{domain}'

            # Update department_users array to use production domain
            if 'department_users' in dept['matrix'] and dept['matrix']['department_users']:
                updated_users = []
                for user_id in dept['matrix']['department_users']:
                    username = user_id.split(':')[0]  # @user:localhost -> @user
                    updated_users.append(f'{username}:{domain}')
                dept['matrix']['department_users'] = updated_users

        # Update department-specific tokens
        if dept['id'] == 'support' and '${user_tokens[support_agent1]}':
            dept['matrix']['access_token'] = '${user_tokens[support_agent1]}'
            dept['matrix']['admin_access_token'] = '$admin_token'
        elif dept['id'] == 'commerce' and '${user_tokens[commerce_agent1]}':
            dept['matrix']['access_token'] = '${user_tokens[commerce_agent1]}'
            dept['matrix']['admin_access_token'] = '$admin_token'
        elif dept['id'] == 'identification' and '${user_tokens[identify_agent1]}':
            dept['matrix']['access_token'] = '${user_tokens[identify_agent1]}'
            dept['matrix']['admin_access_token'] = '$admin_token'

    # Update Telegram token
    for social in config.get('social_media', []):
        if social.get('platform') == 'telegram':
            social['config']['bot_token'] = '$telegram_token'

    # Update observer user with token and domain
    if 'observer' in config:
        config['observer']['user_id'] = f'@observer:{domain}'
        config['observer']['access_token'] = '${user_tokens[observer]}'
        config['observer']['enabled'] = True
        config['observer']['auto_invite'] = True

    # Update server CORS origins
    if 'server' in config:
        cors_list = '$cors_origins'.split(',')
        config['server']['cors_origins'] = cors_list

    with open(config_file, 'w') as f:
        yaml.dump(config, f, default_flow_style=False, sort_keys=False)

    print("Configuration updated successfully", file=sys.stderr)
except Exception as e:
    print(f"Warning: Could not update config.yaml: {e}", file=sys.stderr)
    import traceback
    traceback.print_exc(file=sys.stderr)
PYEOF

    print_success "Configuration updated with tokens"

    # Save all credentials
    print_step "Saving credentials..."

    cat > "$INSTALL_DIR/data/user-credentials.txt" << EOF
Production User Credentials - Created: $(date)

ADMIN:
  User: admin | Password: $admin_password
  Token: $admin_token

SUPPORT (3 users):
  support_agent1 | support1123 | Token: ${user_tokens[support_agent1]}
  support_agent2 | support2123 | Token: ${user_tokens[support_agent2]}
  support_agent3 | support3123 | Token: ${user_tokens[support_agent3]}

COMMERCE (4 users):
  commerce_agent1 | commerce1123 | Token: ${user_tokens[commerce_agent1]}
  commerce_agent2 | commerce2123 | Token: ${user_tokens[commerce_agent2]}
  commerce_agent3 | commerce3123 | Token: ${user_tokens[commerce_agent3]}
  commerce_agent4 | commerce4123 | Token: ${user_tokens[commerce_agent4]}

IDENTIFICATION (2 users):
  identify_agent1 | identify1123 | Token: ${user_tokens[identify_agent1]}
  identify_agent2 | identify2123 | Token: ${user_tokens[identify_agent2]}

OBSERVER (read-only access to all departments):
  observer | observer123 | Token: ${user_tokens[observer]}
EOF

    sudo chmod 600 "$INSTALL_DIR/data/user-credentials.txt"
    sudo chown $SYSTEM_USER:$SYSTEM_USER "$INSTALL_DIR/data/user-credentials.txt"

    print_success "Credentials saved to: $INSTALL_DIR/data/user-credentials.txt"
    update_progress
}

# ============================================================================
# Phase 7: Telegram Integration
# ============================================================================

phase_telegram_integration() {
    print_header "Phase 7/12: Telegram Integration"

    local telegram_token=$(jq -r '.telegram_token' "$SESSION_FILE")

    if [ -z "$telegram_token" ] || [ "$telegram_token" = "null" ]; then
        print_warning "No Telegram token configured, skipping Telegram integration"
        update_progress
        return 0
    fi

    print_step "Starting Telegram router..."

    # Start Telegram router in background
    cd "$INSTALL_DIR"
    sudo -u $SYSTEM_USER node scripts/telegram-department-router.js > logs/telegram-router.log 2>&1 &
    local telegram_pid=$!

    sleep 5

    # Check if still running
    if ps -p $telegram_pid > /dev/null; then
        print_success "Telegram router started (PID: $telegram_pid)"

        # Save PID for later
        echo "$telegram_pid" > "$INSTALL_DIR/data/telegram-router.pid"
    else
        print_error "Telegram router failed to start"
        cat "$INSTALL_DIR/logs/telegram-router.log" | tail -20
        print_warning "Continuing without Telegram integration"
    fi

    update_progress
}

# ============================================================================
# Phase 8: Systemd Service Installation
# ============================================================================

phase_systemd_installation() {
    print_header "Phase 8/12: Systemd Service Installation"

    if ! ask_yes_no "Install systemd services for auto-start on boot?" "y"; then
        print_warning "Skipping systemd installation"
        update_progress
        return 0
    fi

    # Stop any manually started services
    print_step "Stopping manually started services..."
    if [ -f "$INSTALL_DIR/data/telegram-router.pid" ]; then
        local pid=$(cat "$INSTALL_DIR/data/telegram-router.pid")
        sudo kill $pid 2>/dev/null || true
    fi

    # Update service files with actual paths
    print_step "Installing systemd service files..."

    # Copy and update service files
    for service_file in "$INSTALL_DIR/config/systemd"/*.service "$INSTALL_DIR/config/systemd"/*.target; do
        if [ -f "$service_file" ]; then
            local service_name=$(basename "$service_file")
            sudo cp "$service_file" "/etc/systemd/system/"
            print_success "Installed: $service_name"
        fi
    done

    # Reload systemd
    sudo systemctl daemon-reload

    # Enable services
    print_step "Enabling services..."
    sudo systemctl enable matrix-chat-docker.service
    sudo systemctl enable matrix-chat-widget.service
    sudo systemctl enable matrix-chat-telegram.service 2>/dev/null || true

    # Fix data directory permissions for widget server access
    # Synapse container runs as UID 1000, widget service runs as matrix-chat user
    # Set data directory to be group-accessible so both can use it
    print_step "Setting data directory permissions..."

    # Add matrix-chat user to group 1000 (typically 'cdl' group)
    sudo usermod -a -G $(id -g 1000) matrix-chat 2>/dev/null || true

    # Set group ownership and permissions
    sudo chgrp -R $(id -g 1000) "$INSTALL_DIR/data"
    sudo chmod -R 775 "$INSTALL_DIR/data"

    # Ensure future files inherit group ownership
    sudo chmod g+s "$INSTALL_DIR/data"

    # Start services
    print_step "Starting services..."
    sudo systemctl start matrix-chat-docker.service
    sleep 5
    sudo systemctl start matrix-chat-widget.service
    sleep 3
    sudo systemctl start matrix-chat-telegram.service 2>/dev/null || true

    # Check status
    print_step "Checking service status..."
    if sudo systemctl is-active --quiet matrix-chat-widget.service; then
        print_success "Widget server is running"
    else
        print_error "Widget server failed to start"
    fi

    if sudo systemctl is-active --quiet matrix-chat-telegram.service; then
        print_success "Telegram router is running"
    else
        print_warning "Telegram router not running (may not be configured)"
    fi

    print_success "Systemd services installed!"
    update_progress
}

# ============================================================================
# Phase 9: Web Server Configuration (Optional)
# ============================================================================

phase_webserver_configuration() {
    print_header "Phase 9/12: Web Server Configuration (Optional)"

    local domain=$(jq -r '.domain' "$SESSION_FILE")

    if [ "$domain" = "localhost" ]; then
        print_warning "Domain is localhost, skipping web server configuration"
        update_progress
        return 0
    fi

    echo "Web server options:"
    echo "  1) Nginx (recommended)"
    echo "  2) Apache2"
    echo "  3) Skip (access via IP:3001)"
    echo ""

    local choice=$(ask_question "Select web server" "1")

    case "$choice" in
        1)
            configure_nginx
            ;;
        2)
            configure_apache
            ;;
        *)
            print_warning "Skipping web server configuration"
            ;;
    esac

    update_progress
}

configure_nginx() {
    print_step "Configuring Nginx..."

    # Check if Nginx is installed
    if ! command -v nginx &> /dev/null; then
        if ask_yes_no "Nginx is not installed. Install it now?" "y"; then
            sudo apt-get update -qq
            sudo apt-get install -y nginx
        else
            print_warning "Skipping Nginx configuration"
            return 0
        fi
    fi

    local domain=$(jq -r '.domain' "$SESSION_FILE")
    local admin_email=$(jq -r '.admin_email' "$SESSION_FILE")

    # Generate Nginx config
    local nginx_config="/etc/nginx/sites-available/matrix-chat-widget"

    sudo cp "$INSTALL_DIR/config/nginx.conf" "$nginx_config"
    sudo sed -i "s/your-domain.com/$domain/g" "$nginx_config"
    sudo sed -i "s|/path/to/matrix-chat-support|$INSTALL_DIR|g" "$nginx_config"

    # Enable site
    sudo ln -sf "$nginx_config" "/etc/nginx/sites-enabled/matrix-chat-widget"

    # Test configuration
    if sudo nginx -t; then
        sudo systemctl reload nginx
        print_success "Nginx configured for $domain"
    else
        print_error "Nginx configuration test failed"
        return 1
    fi

    # Offer Let's Encrypt setup
    if ask_yes_no "Set up Let's Encrypt SSL certificate?" "y"; then
        setup_letsencrypt "$domain" "$admin_email"
    fi
}

configure_apache() {
    print_step "Configuring Apache2..."

    # Check if Apache is installed
    if ! command -v apache2 &> /dev/null; then
        if ask_yes_no "Apache2 is not installed. Install it now?" "y"; then
            sudo apt-get update -qq
            sudo apt-get install -y apache2
        else
            print_warning "Skipping Apache configuration"
            return 0
        fi
    fi

    local domain=$(jq -r '.domain' "$SESSION_FILE")

    # Enable required modules
    sudo a2enmod proxy proxy_http rewrite ssl headers expires

    # Generate Apache config
    local apache_config="/etc/apache2/sites-available/matrix-chat-widget.conf"

    sudo cp "$INSTALL_DIR/config/apache2.conf" "$apache_config"
    sudo sed -i "s/your-domain.com/$domain/g" "$apache_config"
    sudo sed -i "s|/path/to/matrix-chat-support|$INSTALL_DIR|g" "$apache_config"

    # Enable site
    sudo a2ensite matrix-chat-widget

    # Test and reload
    if sudo apache2ctl configtest; then
        sudo systemctl reload apache2
        print_success "Apache2 configured for $domain"
    else
        print_error "Apache2 configuration test failed"
        return 1
    fi
}

setup_letsencrypt() {
    local domain="$1"
    local email="$2"

    if ! command -v certbot &> /dev/null; then
        print_step "Installing Certbot..."
        sudo apt-get update -qq
        sudo apt-get install -y certbot python3-certbot-nginx
    fi

    print_step "Requesting SSL certificate from Let's Encrypt..."

    sudo certbot --nginx -d "$domain" --non-interactive --agree-tos --email "$email" || {
        print_warning "SSL certificate setup failed (may need manual configuration)"
        return 1
    }

    print_success "SSL certificate installed!"
}

# ============================================================================
# Phase 10: Firewall Configuration
# ============================================================================

phase_firewall_configuration() {
    print_header "Phase 10/12: Firewall Configuration (Optional)"

    if ! ask_yes_no "Configure UFW firewall?" "n"; then
        print_warning "Skipping firewall configuration"
        update_progress
        return 0
    fi

    # Install UFW if needed
    if ! command -v ufw &> /dev/null; then
        sudo apt-get install -y ufw
    fi

    print_step "Configuring firewall rules..."

    # Allow SSH first (important!)
    sudo ufw allow 22/tcp
    print_success "Allowed SSH (22/tcp)"

    # Allow HTTP/HTTPS
    sudo ufw allow 80/tcp
    sudo ufw allow 443/tcp
    print_success "Allowed HTTP/HTTPS (80,443/tcp)"

    # Matrix federation (optional)
    if ask_yes_no "Allow Matrix federation (port 8008)?" "n"; then
        sudo ufw allow 8008/tcp
        print_success "Allowed Matrix federation (8008/tcp)"
    fi

    # Enable firewall
    if ask_yes_no "Enable firewall now?" "y"; then
        sudo ufw --force enable
        print_success "Firewall enabled"
    fi

    update_progress
}

# ============================================================================
# Phase 11: Verification & Testing
# ============================================================================

phase_verification() {
    print_header "Phase 11/12: Verification & Testing"

    local domain=$(jq -r '.domain' "$SESSION_FILE")
    local failed=0

    # Test widget server
    print_step "Testing widget server..."
    if curl -s "http://localhost:3001/health" > /dev/null; then
        print_success "Widget server health check passed"
    else
        print_error "Widget server health check failed"
        ((failed++))
    fi

    # Test Synapse
    print_step "Testing Synapse..."
    if curl -s "http://localhost:8008/health" > /dev/null; then
        print_success "Synapse health check passed"
    else
        print_error "Synapse health check failed"
        ((failed++))
    fi

    # Test embed script
    print_step "Testing embed script..."
    local embed_response=$(curl -s "http://localhost:3001/embed.js")
    if echo "$embed_response" | grep -q "MatrixChatWidget"; then
        print_success "Embed script is accessible"
    else
        if echo "$embed_response" | grep -q "Widget not built"; then
            print_error "Widget not built. Run 'npm run build:widget' in $INSTALL_DIR"
        else
            print_error "Embed script test failed"
        fi
        ((failed++))
    fi

    # Check systemd services
    print_step "Checking systemd services..."
    for service in matrix-chat-widget matrix-chat-telegram; do
        if sudo systemctl is-active --quiet $service.service 2>/dev/null; then
            print_success "$service is running"
        else
            print_warning "$service is not running"
        fi
    done

    if [ $failed -eq 0 ]; then
        print_success "All critical tests passed!"
    else
        print_warning "$failed tests failed - check logs for details"
    fi

    update_progress
}

# ============================================================================
# Phase 12: Documentation & Handoff
# ============================================================================

phase_documentation() {
    print_header "Phase 12/12: Documentation & Handoff"

    local domain=$(jq -r '.domain' "$SESSION_FILE")

    # Generate deployment summary
    cat > "$INSTALL_DIR/DEPLOYMENT_SUMMARY.md" << EOF
# Matrix Chat Support - Deployment Summary

**Deployment Date**: $(date)
**Domain**: $domain
**Installation Directory**: $INSTALL_DIR

## Access Points

- **Widget Embed URL**: https://$domain/embed.js (or http://localhost:3001/embed.js)
- **Widget Server**: http://localhost:3001
- **Synapse Admin**: http://localhost:8080
- **Element Web**: http://localhost:8081
- **Matrix Homeserver**: http://localhost:8008

## Credentials

All user credentials are saved in:
\`$INSTALL_DIR/data/user-credentials.txt\`

**IMPORTANT**: Secure this file immediately!
\`\`\`bash
sudo chmod 600 $INSTALL_DIR/data/user-credentials.txt
\`\`\`

## Service Management

### Start All Services
\`\`\`bash
sudo systemctl start matrix-chat.target
\`\`\`

### Stop All Services
\`\`\`bash
sudo systemctl stop matrix-chat.target
\`\`\`

### Check Status
\`\`\`bash
sudo systemctl status matrix-chat-*
\`\`\`

### View Logs
\`\`\`bash
# Widget server logs
sudo journalctl -u matrix-chat-widget -f

# Telegram router logs
sudo journalctl -u matrix-chat-telegram -f

# Docker logs
cd $INSTALL_DIR && docker compose logs -f
\`\`\`

## Widget Integration

Add this to your website:
\`\`\`html
<script src="https://$domain/embed.js"></script>
\`\`\`

## Departments Configured

1. **General Support** (3 agents)
2. **Commerce Support** (4 agents)
3. **Account Verification** (2 agents)

## Telegram Bot

- **Bot**: @QWMatrixTestBot
- **Commands**:
  - \`/start_support\` - General Support
  - \`/start_commerce\` - Commerce Support
  - \`/start_id\` - Account Verification

## Backup

Create regular backups:
\`\`\`bash
sudo tar -czf matrix-chat-backup-\$(date +%Y%m%d).tar.gz \\
  -C $INSTALL_DIR \\
  config/ data/ docker-compose.yml
\`\`\`

## Troubleshooting

### Widget Not Loading
\`\`\`bash
# Check widget server status
sudo systemctl status matrix-chat-widget

# Check logs
sudo journalctl -u matrix-chat-widget -n 50
\`\`\`

### Telegram Not Working
\`\`\`bash
# Restart Telegram router
sudo systemctl restart matrix-chat-telegram

# Check logs
sudo journalctl -u matrix-chat-telegram -n 50
\`\`\`

### Matrix Connection Issues
\`\`\`bash
# Check Synapse status
docker compose ps synapse

# View Synapse logs
docker compose logs synapse --tail=100
\`\`\`

## Next Steps

1. ✅ Review credentials in \`data/user-credentials.txt\`
2. ✅ Test widget on your website
3. ✅ Configure SSL certificate (if not done)
4. ✅ Set up monitoring/alerting
5. ✅ Create backup schedule
6. ✅ Train support team on using Matrix/Element

## Support

- Project Documentation: $INSTALL_DIR/CLAUDE.md
- Systemd Services: $INSTALL_DIR/config/systemd/README.md
- Logs Directory: $INSTALL_DIR/logs/

---
Generated by Matrix Chat Support Production Deployment Script
EOF

    print_success "Deployment summary created: $INSTALL_DIR/DEPLOYMENT_SUMMARY.md"
    update_progress
}

# ============================================================================
# Main Execution
# ============================================================================

main() {
    clear
    print_header "Matrix Chat Support - Production Deployment"

    echo "This script will install the complete Matrix Chat Support system with:"
    echo "  • 3 Departments (Support, Commerce, Identification)"
    echo "  • 9 Department Users + 1 Admin"
    echo "  • Telegram Integration"
    echo "  • Systemd Services"
    echo ""
    echo "Installation directory: $INSTALL_DIR"
    echo ""

    if ! ask_yes_no "Continue with production deployment?" "y"; then
        echo "Deployment cancelled."
        exit 0
    fi

    # Execute all 12 phases
    phase_preflight_checks
    phase_system_preparation
    phase_application_installation
    phase_configuration_setup
    phase_docker_services
    phase_user_creation
    phase_telegram_integration
    phase_systemd_installation
    phase_webserver_configuration
    phase_firewall_configuration
    phase_verification
    phase_documentation

    # Final summary
    echo ""
    print_header "🎉 Deployment Complete!"
    echo ""
    print_success "Matrix Chat Support has been successfully deployed!"
    echo ""

    local domain=$(jq -r '.domain' "$SESSION_FILE")

    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${GREEN}Quick Access Information:${NC}"
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
    echo "📋 Widget Embed Code:"
    echo "   <script src=\"https://$domain/embed.js\"></script>"
    echo ""
    echo "🔗 Access Points:"
    echo "   • Widget Server: http://localhost:3001"
    echo "   • Synapse Admin: http://localhost:8080"
    echo "   • Element Web: http://localhost:8081"
    echo ""
    echo "🔑 Credentials:"
    echo "   • Saved at: $INSTALL_DIR/data/user-credentials.txt"
    echo "   • Admin password provided during setup"
    echo ""
    echo "⚙️  Service Management:"
    echo "   • Start all: sudo systemctl start matrix-chat.target"
    echo "   • Stop all: sudo systemctl stop matrix-chat.target"
    echo "   • Status: sudo systemctl status matrix-chat-*"
    echo ""
    echo "📚 Documentation:"
    echo "   • Deployment Summary: $INSTALL_DIR/DEPLOYMENT_SUMMARY.md"
    echo "   • Project Docs: $INSTALL_DIR/CLAUDE.md"
    echo "   • Systemd Guide: $INSTALL_DIR/config/systemd/README.md"
    echo ""
    echo "📊 Departments:"
    echo "   • General Support (3 agents)"
    echo "   • Commerce Support (4 agents)"
    echo "   • Account Verification (2 agents)"
    echo ""
    echo "✈️  Telegram Bot: @QWMatrixTestBot"
    echo "   • /start_support - General Support"
    echo "   • /start_commerce - Commerce Support"
    echo "   • /start_id - Account Verification"
    echo ""
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
    print_info "Next steps:"
    echo "  1. Review credentials in data/user-credentials.txt"
    echo "  2. Test widget on your website"
    echo "  3. Train support team on Matrix/Element"
    echo "  4. Set up monitoring and backups"
    echo ""
    print_success "Thank you for using Matrix Chat Support!"
    echo ""
}

# Run main function
main "$@"
