#!/bin/bash
# Production Deployment Utility Functions
# Helper functions for production deployment script

# ============================================================================
# Color Definitions
# ============================================================================

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
NC='\033[0m' # No Color

# ============================================================================
# Output Functions
# ============================================================================

print_header() {
    echo ""
    echo -e "${BLUE}============================================${NC}"
    echo -e "${BLUE}  $1${NC}"
    echo -e "${BLUE}============================================${NC}"
    echo ""
}

print_section() {
    echo ""
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${CYAN}  $1${NC}"
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
}

print_step() {
    echo -e "${BLUE}[STEP]${NC} $1" >&2
}

print_success() {
    echo -e "${GREEN}[✓]${NC} $1" >&2
}

print_warning() {
    echo -e "${YELLOW}[⚠]${NC} $1" >&2
}

print_error() {
    echo -e "${RED}[✗]${NC} $1" >&2
}

print_info() {
    echo -e "${CYAN}[ℹ]${NC} $1" >&2
}

error_exit() {
    print_error "$1"
    echo ""
    echo -e "${YELLOW}For troubleshooting, check the logs at:${NC}"
    echo "  - System logs: sudo journalctl -xe"
    echo "  - Docker logs: docker compose logs --tail=50"
    exit 1
}

# ============================================================================
# Progress Tracking
# ============================================================================

TOTAL_STEPS=12
CURRENT_STEP=0

update_progress() {
    CURRENT_STEP=$((CURRENT_STEP + 1))
    local percentage=$((CURRENT_STEP * 100 / TOTAL_STEPS))
    echo -e "${MAGENTA}[Progress: ${percentage}%]${NC} Completed step $CURRENT_STEP of $TOTAL_STEPS"
}

# ============================================================================
# Input Functions
# ============================================================================

ask_question() {
    local question="$1"
    local default="$2"
    local answer

    if [ -n "$default" ]; then
        read -p "$(echo -e "${CYAN}${question} [${default}]:${NC} ")" answer
        echo "${answer:-$default}"
    else
        read -p "$(echo -e "${CYAN}${question}:${NC} ")" answer
        echo "$answer"
    fi
}

ask_yes_no() {
    local question="$1"
    local default="${2:-n}"
    local answer

    while true; do
        if [ "$default" = "y" ]; then
            read -p "$(echo -e "${CYAN}${question} [Y/n]:${NC} ")" answer
            answer="${answer:-y}"
        else
            read -p "$(echo -e "${CYAN}${question} [y/N]:${NC} ")" answer
            answer="${answer:-n}"
        fi

        case "$answer" in
            [Yy]* ) return 0;;
            [Nn]* ) return 1;;
            * ) echo "Please answer yes or no.";;
        esac
    done
}

ask_password() {
    local prompt="$1"
    local password
    local password_confirm

    while true; do
        read -s -p "$(echo -e "${CYAN}$prompt:${NC} ")" password
        echo "" >&2

        if [ -z "$password" ]; then
            print_error "Password cannot be empty"
            continue
        fi

        if [ ${#password} -lt 8 ]; then
            print_error "Password must be at least 8 characters"
            continue
        fi

        read -s -p "$(echo -e "${CYAN}Confirm password:${NC} ")" password_confirm
        echo "" >&2

        if [ "$password" = "$password_confirm" ]; then
            echo "$password"
            return 0
        else
            print_error "Passwords do not match. Please try again."
        fi
    done
}

generate_secure_password() {
    local length="${1:-16}"
    tr -dc 'A-Za-z0-9!@#$%^&*()_+' < /dev/urandom | head -c "$length"
}

# ============================================================================
# Validation Functions
# ============================================================================

validate_domain() {
    local domain="$1"

    # Check if it's a valid IP address (IPv4)
    if [[ "$domain" =~ ^[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}$ ]]; then
        # Validate each octet is 0-255
        local IFS='.'
        read -ra OCTETS <<< "$domain"
        for octet in "${OCTETS[@]}"; do
            if [ "$octet" -gt 255 ]; then
                return 1
            fi
        done
        return 0
    fi

    # Check basic domain format
    if [[ ! "$domain" =~ ^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$ ]]; then
        return 1
    fi

    return 0
}

validate_email() {
    local email="$1"

    if [[ ! "$email" =~ ^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$ ]]; then
        return 1
    fi

    return 0
}

validate_port() {
    local port="$1"

    if [[ ! "$port" =~ ^[0-9]+$ ]] || [ "$port" -lt 1 ] || [ "$port" -gt 65535 ]; then
        return 1
    fi

    return 0
}

check_port_available() {
    local port="$1"

    if command -v lsof &> /dev/null; then
        if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null 2>&1; then
            return 1
        fi
    elif command -v netstat &> /dev/null; then
        if netstat -tuln | grep -q ":$port "; then
            return 1
        fi
    fi

    return 0
}

# ============================================================================
# System Check Functions
# ============================================================================

check_os_compatibility() {
    print_step "Checking OS compatibility..."

    if [ -f /etc/os-release ]; then
        . /etc/os-release
        case "$ID" in
            ubuntu|debian)
                print_success "OS: $PRETTY_NAME (supported)"
                return 0
                ;;
            centos|rhel|fedora)
                print_warning "OS: $PRETTY_NAME (should work, but not fully tested)"
                return 0
                ;;
            *)
                print_warning "OS: $PRETTY_NAME (not officially supported)"
                if ask_yes_no "Continue anyway?"; then
                    return 0
                else
                    return 1
                fi
                ;;
        esac
    else
        print_warning "Could not determine OS version"
        return 1
    fi
}

check_command_exists() {
    local command="$1"
    local package="${2:-$1}"

    if command -v "$command" &> /dev/null; then
        local version=$($command --version 2>&1 | head -n1)
        print_success "$command is installed: $version"
        return 0
    else
        print_error "$command is not installed"
        echo "  Install with: sudo apt install $package   # Ubuntu/Debian"
        echo "            or: sudo yum install $package   # CentOS/RHEL"
        return 1
    fi
}

check_nodejs_version() {
    print_step "Checking Node.js version..."

    if ! command -v node &> /dev/null; then
        print_error "Node.js is not installed"
        echo "  Install Node.js 20+ from: https://nodejs.org/"
        echo "  Or use: curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash - && sudo apt install nodejs -y"
        return 1
    fi

    local node_version=$(node --version | sed 's/v//')
    local major_version=$(echo "$node_version" | cut -d. -f1)

    if [ "$major_version" -ge 20 ]; then
        print_success "Node.js version: v$node_version (✓ >= 20)"
        return 0
    else
        print_error "Node.js version: v$node_version (✗ < 20)"
        echo "  Vite requires Node.js 20.19+ or 22.12+"
        echo "  Upgrade with: curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash - && sudo apt install nodejs -y"
        return 1
    fi
}

check_docker() {
    print_step "Checking Docker..."

    if ! command -v docker &> /dev/null; then
        print_error "Docker is not installed"
        echo "  Install Docker from: https://docs.docker.com/engine/install/"
        return 1
    fi

    local docker_version=$(docker --version 2>&1)
    print_success "Docker installed: $docker_version"

    # Check if Docker daemon is running
    if ! docker ps &> /dev/null; then
        print_error "Docker daemon is not running"
        echo "  Start Docker with: sudo systemctl start docker"
        return 1
    fi

    print_success "Docker daemon is running"

    # Check Docker Compose
    if docker compose version &> /dev/null 2>&1; then
        local compose_version=$(docker compose version --short 2>&1)
        print_success "Docker Compose (v2) installed: $compose_version"
        echo "docker compose" > /tmp/compose_cmd
    elif command -v docker-compose &> /dev/null; then
        local compose_version=$(docker-compose --version 2>&1)
        print_success "Docker Compose (v1) installed: $compose_version"
        echo "docker-compose" > /tmp/compose_cmd
    else
        print_error "Docker Compose is not installed"
        echo "  Install Docker Compose from: https://docs.docker.com/compose/install/"
        return 1
    fi

    return 0
}

check_disk_space() {
    print_step "Checking disk space..."

    local available=$(df / | tail -1 | awk '{print $4}')
    local available_gb=$((available / 1024 / 1024))

    if [ "$available_gb" -ge 10 ]; then
        print_success "Available disk space: ${available_gb}GB (✓ >= 10GB)"
        return 0
    else
        print_warning "Available disk space: ${available_gb}GB (⚠ < 10GB)"
        if ask_yes_no "Continue anyway?"; then
            return 0
        else
            return 1
        fi
    fi
}

check_sudo_permissions() {
    print_step "Checking sudo permissions..."

    if sudo -n true 2>/dev/null; then
        print_success "Sudo access confirmed (no password required)"
        return 0
    elif sudo -v 2>/dev/null; then
        print_success "Sudo access confirmed"
        return 0
    else
        print_error "This script requires sudo privileges"
        return 1
    fi
}

# ============================================================================
# User and Directory Functions
# ============================================================================

create_system_user() {
    local username="$1"
    local home_dir="$2"

    print_step "Creating system user: $username..."

    if id "$username" &>/dev/null; then
        print_warning "User $username already exists"
        return 0
    fi

    sudo useradd -r -s /bin/false -d "$home_dir" "$username" || {
        error_exit "Failed to create system user: $username"
    }

    print_success "System user created: $username"
}

create_directory_structure() {
    local base_dir="$1"

    print_step "Creating directory structure..."

    local dirs=(
        "$base_dir"
        "$base_dir/data"
        "$base_dir/logs"
        "$base_dir/backups"
        "$base_dir/config"
        "$base_dir/scripts"
        "$base_dir/server"
        "$base_dir/dist"
    )

    for dir in "${dirs[@]}"; do
        sudo mkdir -p "$dir" || error_exit "Failed to create directory: $dir"
    done

    print_success "Directory structure created"
}

set_ownership() {
    local path="$1"
    local owner="$2"

    print_step "Setting ownership: $owner for $path..."

    sudo chown -R "$owner:$owner" "$path" || {
        error_exit "Failed to set ownership"
    }

    print_success "Ownership set successfully"
}

# ============================================================================
# Matrix API Functions
# ============================================================================

matrix_login() {
    local homeserver="$1"
    local username="$2"
    local password="$3"
    local max_retries=3
    local retry=0

    while [ $retry -lt $max_retries ]; do
        local response=$(curl -s -X POST \
            -H "Content-Type: application/json" \
            "${homeserver}/_matrix/client/r0/login" \
            -d "{
                \"type\": \"m.login.password\",
                \"user\": \"$username\",
                \"password\": \"$password\"
            }")

        local access_token=$(echo "$response" | jq -r '.access_token // empty')

        if [ -n "$access_token" ] && [ "$access_token" != "null" ]; then
            echo "$access_token"
            return 0
        fi

        local error=$(echo "$response" | jq -r '.error // .errcode // "Unknown error"')
        local errcode=$(echo "$response" | jq -r '.errcode // empty')

        # Check if it's a rate limit error
        if [[ "$error" == *"Too Many Requests"* ]] || [ "$errcode" = "M_LIMIT_EXCEEDED" ]; then
            retry=$((retry + 1))
            if [ $retry -lt $max_retries ]; then
                local wait_time=$((retry * 3))
                print_warning "Rate limited, retrying in ${wait_time}s (attempt $retry/$max_retries)..."
                sleep $wait_time
                continue
            fi
        fi

        print_error "Failed to login as $username: $error"
        return 1
    done

    return 1
}

matrix_create_user() {
    local homeserver="$1"
    local username="$2"
    local password="$3"
    local is_admin="${4:-false}"

    print_info "Creating Matrix user: $username..."

    local admin_flag="--no-admin"
    if [ "$is_admin" = "true" ]; then
        admin_flag="--admin"
    fi

    # Attempt to create user (capture output to check for "already exists" error)
    local create_output=$(docker exec matrix-synapse register_new_matrix_user \
        -c /data/homeserver.yaml \
        -u "$username" \
        -p "$password" \
        $admin_flag \
        "$homeserver" 2>&1)

    local create_result=$?

    # Check if user already exists
    if [ $create_result -ne 0 ]; then
        if echo "$create_output" | grep -iq "already exists\|user exists"; then
            print_warning "User $username already exists, getting token..." >&2
        else
            print_error "Failed to create user: $username" >&2
            echo "$create_output" >&2
            return 1
        fi
    fi

    # Delay to avoid rate limiting
    sleep 2

    # Get access token (works for both new and existing users)
    local token=$(matrix_login "$homeserver" "$username" "$password")

    # Additional delay after login to avoid rate limiting
    sleep 2

    if [ -n "$token" ]; then
        if [ $create_result -eq 0 ]; then
            print_success "User created: $username"
        else
            print_success "Token retrieved for existing user: $username"
        fi
        echo "$token"
        return 0
    else
        print_error "Failed to get token for: $username"
        return 1
    fi
}

wait_for_synapse() {
    local homeserver="$1"
    local max_attempts="${2:-30}"

    print_step "Waiting for Synapse to be ready..."

    local attempt=0
    while [ $attempt -lt $max_attempts ]; do
        if curl -s "${homeserver}/health" > /dev/null 2>&1; then
            print_success "Synapse is ready!"
            return 0
        fi
        echo -n "."
        sleep 2
        ((attempt++))
    done

    echo ""
    print_error "Synapse failed to start within expected time"
    return 1
}

# ============================================================================
# Backup Functions
# ============================================================================

create_backup() {
    local source_dir="$1"
    local backup_dir="$2"
    local backup_name="matrix-chat-backup-$(date +%Y%m%d-%H%M%S)"

    print_step "Creating backup: $backup_name..."

    sudo tar -czf "${backup_dir}/${backup_name}.tar.gz" \
        -C "$source_dir" \
        config/ data/ docker-compose.yml 2>/dev/null || {
        print_warning "Backup creation failed (non-critical)"
        return 1
    }

    print_success "Backup created: ${backup_dir}/${backup_name}.tar.gz"
    return 0
}

# Export functions for use in main script
export -f print_header print_section print_step print_success print_warning print_error print_info error_exit
export -f update_progress ask_question ask_yes_no ask_password generate_secure_password
export -f validate_domain validate_email validate_port check_port_available
export -f check_os_compatibility check_command_exists check_nodejs_version check_docker check_disk_space check_sudo_permissions
export -f create_system_user create_directory_structure set_ownership
export -f matrix_login matrix_create_user wait_for_synapse
export -f create_backup
