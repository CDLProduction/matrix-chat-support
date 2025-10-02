#!/bin/bash
# Common functions and utilities for Matrix Chat Support Widget installer
# This file provides shared functions for colors, prompts, validation, and utilities

# Color codes for terminal output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
MAGENTA='\033[0;35m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m' # No Color

# Status symbols
CHECK_MARK="${GREEN}✓${NC}"
CROSS_MARK="${RED}✗${NC}"
INFO_MARK="${BLUE}ℹ${NC}"
WARN_MARK="${YELLOW}⚠${NC}"

# ============================================================================
# Printing Functions
# ============================================================================

print_header() {
  local text="$1"
  local width=70
  echo ""
  echo -e "${BOLD}${CYAN}╔$(printf '═%.0s' $(seq 1 $width))╗${NC}"
  printf "${BOLD}${CYAN}║${NC}%-${width}s${BOLD}${CYAN}║${NC}\n" "  $text"
  echo -e "${BOLD}${CYAN}╚$(printf '═%.0s' $(seq 1 $width))╝${NC}"
  echo ""
}

print_section() {
  local text="$1"
  echo ""
  echo -e "${BOLD}${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo -e "${BOLD}${BLUE}$text${NC}"
  echo -e "${BOLD}${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo ""
}

print_subsection() {
  local text="$1"
  echo ""
  echo -e "${BOLD}${MAGENTA}═══════════════════════════════════════════════════════════${NC}"
  echo -e "${BOLD}${MAGENTA}$text${NC}"
  echo -e "${BOLD}${MAGENTA}═══════════════════════════════════════════════════════════${NC}"
  echo ""
}

print_box() {
  local text="$1"
  echo ""
  echo -e "${CYAN}┌─────────────────────────────────────────────────────────┐${NC}"
  printf "${CYAN}│${NC} %-55s ${CYAN}│${NC}\n" "$text"
  echo -e "${CYAN}└─────────────────────────────────────────────────────────┘${NC}"
  echo ""
}

print_success() {
  echo -e "${CHECK_MARK} ${GREEN}$1${NC}"
}

print_error() {
  echo -e "${CROSS_MARK} ${RED}$1${NC}" >&2
}

print_warning() {
  echo -e "${WARN_MARK} ${YELLOW}$1${NC}"
}

print_info() {
  echo -e "${INFO_MARK} ${BLUE}$1${NC}"
}

print_step() {
  echo -e "${BOLD}► $1${NC}"
}

# ============================================================================
# Input/Prompt Functions
# ============================================================================

ask_yes_no() {
  local prompt="$1"
  local default="${2:-n}"
  local response

  if [ "$default" = "y" ]; then
    prompt="$prompt (Y/n)"
  else
    prompt="$prompt (y/N)"
  fi

  while true; do
    read -p "$(echo -e "${CYAN}$prompt:${NC} ")" response
    response="${response:-$default}"
    case "$response" in
      [Yy]|[Yy][Ee][Ss]) return 0 ;;
      [Nn]|[Nn][Oo]) return 1 ;;
      *) print_error "Please answer yes or no." ;;
    esac
  done
}

ask_input() {
  local prompt="$1"
  local default="$2"
  local response

  if [ -n "$default" ]; then
    prompt="$prompt [$default]"
  fi

  read -p "$(echo -e "${CYAN}$prompt:${NC} ")" response
  echo "${response:-$default}"
}

ask_password() {
  local prompt="$1"
  local password
  local password_confirm

  while true; do
    read -s -p "$(echo -e "${CYAN}$prompt:${NC} ")" password
    echo ""

    if [ -z "$password" ]; then
      print_error "Password cannot be empty"
      continue
    fi

    if [ ${#password} -lt 8 ]; then
      print_error "Password must be at least 8 characters"
      continue
    fi

    read -s -p "$(echo -e "${CYAN}Confirm password:${NC} ")" password_confirm
    echo ""

    if [ "$password" = "$password_confirm" ]; then
      echo "$password"
      return 0
    else
      print_error "Passwords do not match. Please try again."
    fi
  done
}

ask_choice() {
  local prompt="$1"
  shift
  local options=("$@")
  local choice

  echo -e "${CYAN}$prompt${NC}" >&2
  for i in "${!options[@]}"; do
    echo "  $((i+1))) ${options[$i]}" >&2
  done

  while true; do
    read -p "$(echo -e "${CYAN}Enter choice [1]:${NC} ")" choice
    choice="${choice:-1}"

    if [[ "$choice" =~ ^[0-9]+$ ]] && [ "$choice" -ge 1 ] && [ "$choice" -le "${#options[@]}" ]; then
      echo "$choice"
      return 0
    else
      print_error "Invalid choice. Please enter a number between 1 and ${#options[@]}."
    fi
  done
}

# ============================================================================
# Validation Functions
# ============================================================================

validate_username() {
  local username="$1"

  # Must be alphanumeric with underscores, 3-32 chars
  if [[ ! "$username" =~ ^[a-z0-9_]{3,32}$ ]]; then
    return 1
  fi

  return 0
}

validate_domain() {
  local domain="$1"

  # Basic domain validation (localhost allowed)
  if [ "$domain" = "localhost" ]; then
    return 0
  fi

  if [[ ! "$domain" =~ ^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$ ]]; then
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

validate_color() {
  local color="$1"

  # Must be hex color #RRGGBB
  if [[ ! "$color" =~ ^#[0-9A-Fa-f]{6}$ ]]; then
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

# ============================================================================
# System Check Functions
# ============================================================================

check_command() {
  local cmd="$1"
  local name="${2:-$cmd}"
  local min_version="$3"

  if ! command -v "$cmd" &> /dev/null; then
    print_error "$name is not installed"
    return 1
  fi

  if [ -n "$min_version" ]; then
    local version=$("$cmd" --version 2>&1 | grep -oE '[0-9]+\.[0-9]+' | head -1)
    if [ -z "$version" ]; then
      print_warning "Could not determine $name version"
    else
      local major=$(echo "$version" | cut -d. -f1)
      local required_major=$(echo "$min_version" | cut -d. -f1)
      if [ "$major" -lt "$required_major" ]; then
        print_error "$name version $version is too old (need $min_version+)"
        return 1
      fi
    fi
  fi

  print_success "$name found"
  return 0
}

check_port_available() {
  local port="$1"

  if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null 2>&1 ; then
    return 1
  fi

  return 0
}

check_disk_space() {
  local required_gb="$1"
  local required_kb=$((required_gb * 1024 * 1024))

  local available_kb=$(df . | tail -1 | awk '{print $4}')

  if [ "$available_kb" -lt "$required_kb" ]; then
    print_error "Insufficient disk space. Required: ${required_gb}GB, Available: $((available_kb / 1024 / 1024))GB"
    return 1
  fi

  print_success "Sufficient disk space available"
  return 0
}

check_ram() {
  local required_gb="$1"
  local required_mb=$((required_gb * 1024))

  if [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS
    local total_mb=$(($(sysctl -n hw.memsize) / 1024 / 1024))
  else
    # Linux
    local total_mb=$(free -m | awk '/^Mem:/{print $2}')
  fi

  if [ "$total_mb" -lt "$required_mb" ]; then
    print_error "Insufficient RAM. Required: ${required_gb}GB, Available: $((total_mb / 1024))GB"
    return 1
  fi

  print_success "Sufficient RAM available"
  return 0
}

# ============================================================================
# JSON Manipulation Functions
# ============================================================================

json_get() {
  local json_file="$1"
  local json_path="$2"

  jq -r "$json_path" "$json_file" 2>/dev/null || echo ""
}

json_set() {
  local json_file="$1"
  local json_path="$2"
  local value="$3"

  local tmp_file=$(mktemp)
  jq "$json_path = $value" "$json_file" > "$tmp_file" && mv "$tmp_file" "$json_file"
}

json_set_string() {
  local json_file="$1"
  local json_path="$2"
  local value="$3"

  local tmp_file=$(mktemp)
  jq --arg val "$value" "$json_path = \$val" "$json_file" > "$tmp_file" && mv "$tmp_file" "$json_file"
}

json_array_append() {
  local json_file="$1"
  local json_path="$2"
  local value="$3"

  local tmp_file=$(mktemp)
  jq "$json_path += [$value]" "$json_file" > "$tmp_file" && mv "$tmp_file" "$json_file"
}

# ============================================================================
# File/Directory Functions
# ============================================================================

ensure_directory() {
  local dir="$1"

  if [ ! -d "$dir" ]; then
    mkdir -p "$dir" || {
      print_error "Failed to create directory: $dir"
      return 1
    }
  fi

  return 0
}

backup_file() {
  local file="$1"

  if [ -f "$file" ]; then
    local backup="${file}.backup.$(date +%Y%m%d_%H%M%S)"
    cp "$file" "$backup"
    print_info "Backed up $file to $backup"
  fi
}

# ============================================================================
# Utility Functions
# ============================================================================

generate_random_string() {
  local length="${1:-32}"
  cat /dev/urandom | LC_ALL=C tr -dc 'a-zA-Z0-9' | fold -w "$length" | head -n 1
}

generate_secure_token() {
  openssl rand -base64 48 | tr -d "=+/" | cut -c1-64
}

wait_for_url() {
  local url="$1"
  local max_attempts="${2:-30}"
  local attempt=0

  print_info "Waiting for $url to be ready..."

  while [ $attempt -lt $max_attempts ]; do
    if curl -s -f "$url" > /dev/null 2>&1; then
      print_success "Service is ready!"
      return 0
    fi

    echo -n "."
    sleep 2
    ((attempt++))
  done

  echo ""
  print_error "Service did not become ready within expected time"
  return 1
}

confirm_continue() {
  local message="${1:-Do you want to continue?}"

  echo ""
  if ! ask_yes_no "$message" "y"; then
    print_info "Installation cancelled by user"
    exit 0
  fi
}

# ============================================================================
# Progress/Spinner Functions
# ============================================================================

show_spinner() {
  local pid=$1
  local delay=0.1
  local spinstr='|/-\'

  while ps -p $pid > /dev/null 2>&1; do
    local temp=${spinstr#?}
    printf " [%c]  " "$spinstr"
    local spinstr=$temp${spinstr%"$temp"}
    sleep $delay
    printf "\b\b\b\b\b\b"
  done
  printf "    \b\b\b\b"
}

# ============================================================================
# Error Handling
# ============================================================================

error_exit() {
  local message="$1"
  local exit_code="${2:-1}"

  print_error "$message"
  print_error "Installation failed. Check logs for details."
  exit "$exit_code"
}

# Export functions
export -f print_header print_section print_subsection print_box
export -f print_success print_error print_warning print_info print_step
export -f ask_yes_no ask_input ask_password ask_choice
export -f validate_username validate_domain validate_port validate_color validate_email
export -f check_command check_port_available check_disk_space check_ram
export -f json_get json_set json_set_string json_array_append
export -f ensure_directory backup_file
export -f generate_random_string generate_secure_token wait_for_url confirm_continue
export -f error_exit
