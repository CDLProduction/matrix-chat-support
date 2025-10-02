#!/bin/bash
# Systemd Services Installer for Matrix Chat Support Widget
# This script automates the installation of systemd service files

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Default installation path
INSTALL_PATH="${INSTALL_PATH:-/opt/matrix-chat-support}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

print_success() {
  echo -e "${GREEN}✓${NC} $1"
}

print_error() {
  echo -e "${RED}✗${NC} $1" >&2
}

print_info() {
  echo -e "${BLUE}ℹ${NC} $1"
}

print_warning() {
  echo -e "${YELLOW}⚠${NC} $1"
}

# Check if running as root
if [ "$EUID" -ne 0 ]; then
  print_error "This script must be run as root (use sudo)"
  exit 1
fi

# Welcome message
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo " Matrix Chat Support Widget - Systemd Service Installer"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Step 1: Check prerequisites
print_info "Checking prerequisites..."
echo ""

# Check if systemd is available
if ! command -v systemctl &> /dev/null; then
  print_error "systemd is not available on this system"
  exit 1
fi
print_success "systemd found"

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
  print_error "Docker is not installed"
  exit 1
fi
print_success "Docker found"

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
  print_error "Node.js is not installed"
  exit 1
fi
print_success "Node.js found ($(node --version))"

echo ""

# Step 2: Confirm installation path
print_info "Installation path: $INSTALL_PATH"
echo ""

if [ ! -d "$INSTALL_PATH" ]; then
  read -p "Directory does not exist. Create it? (y/n) " -n 1 -r
  echo ""
  if [[ $REPLY =~ ^[Yy]$ ]]; then
    mkdir -p "$INSTALL_PATH"
    print_success "Created directory: $INSTALL_PATH"
  else
    print_error "Installation cancelled"
    exit 1
  fi
fi

# Step 3: Create system user
print_info "Creating system user 'matrix-chat'..."
echo ""

if id "matrix-chat" &>/dev/null; then
  print_warning "User 'matrix-chat' already exists"
else
  useradd -r -s /bin/false -d "$INSTALL_PATH" -c "Matrix Chat Support Widget" matrix-chat
  print_success "Created user: matrix-chat"
fi

# Step 4: Copy application files
print_info "Installing application files..."
echo ""

if [ "$PROJECT_ROOT" != "$INSTALL_PATH" ]; then
  print_info "Copying files from $PROJECT_ROOT to $INSTALL_PATH"

  # Create directories
  mkdir -p "$INSTALL_PATH"/{config,data,logs,scripts,server,dist}

  # Copy files (preserving structure)
  cp -r "$PROJECT_ROOT/config" "$INSTALL_PATH/" 2>/dev/null || true
  cp -r "$PROJECT_ROOT/scripts" "$INSTALL_PATH/" 2>/dev/null || true
  cp -r "$PROJECT_ROOT/server" "$INSTALL_PATH/" 2>/dev/null || true
  cp -r "$PROJECT_ROOT/dist" "$INSTALL_PATH/" 2>/dev/null || true
  cp -r "$PROJECT_ROOT/node_modules" "$INSTALL_PATH/" 2>/dev/null || true
  cp "$PROJECT_ROOT/package.json" "$INSTALL_PATH/" 2>/dev/null || true
  cp "$PROJECT_ROOT/docker-compose.yml" "$INSTALL_PATH/" 2>/dev/null || true

  # Copy data directory (but not overwrite existing)
  if [ ! -d "$INSTALL_PATH/data" ] || [ -z "$(ls -A $INSTALL_PATH/data)" ]; then
    cp -r "$PROJECT_ROOT/data" "$INSTALL_PATH/" 2>/dev/null || mkdir -p "$INSTALL_PATH/data"
  else
    print_warning "Preserving existing data directory"
  fi

  print_success "Application files copied"
else
  print_info "Already in installation directory"
fi

# Step 5: Set ownership and permissions
print_info "Setting ownership and permissions..."
echo ""

# Set ownership
chown -R matrix-chat:matrix-chat "$INSTALL_PATH"
print_success "Set ownership to matrix-chat:matrix-chat"

# Set permissions for data and logs
chmod 755 "$INSTALL_PATH/data"
chmod 755 "$INSTALL_PATH/logs"
print_success "Data and logs directories configured"

# Protect sensitive files
if [ -f "$INSTALL_PATH/config/config.yaml" ]; then
  chmod 600 "$INSTALL_PATH/config/config.yaml"
  print_success "Protected config.yaml"
fi

if [ -f "$INSTALL_PATH/data/chat-room-mappings.json" ]; then
  chmod 600 "$INSTALL_PATH/data/chat-room-mappings.json"
  print_success "Protected chat-room-mappings.json"
fi

# Step 6: Update systemd service files with correct paths
print_info "Configuring systemd service files..."
echo ""

# Create temporary directory for processed service files
TMP_DIR=$(mktemp -d)

# Process each service file
for service_file in "$SCRIPT_DIR"/*.service; do
  if [ -f "$service_file" ]; then
    service_name=$(basename "$service_file")

    # Replace /opt/matrix-chat-support with actual installation path
    sed "s|/opt/matrix-chat-support|$INSTALL_PATH|g" "$service_file" > "$TMP_DIR/$service_name"

    print_info "Processed $service_name"
  fi
done

# Step 7: Install systemd service files
print_info "Installing systemd services..."
echo ""

cp "$TMP_DIR"/*.service /etc/systemd/system/
rm -rf "$TMP_DIR"
print_success "Service files installed to /etc/systemd/system/"

# Reload systemd
systemctl daemon-reload
print_success "Systemd daemon reloaded"

# Step 8: Enable services
print_info "Enabling services..."
echo ""

read -p "Enable services to start on boot? (y/n) " -n 1 -r
echo ""
if [[ $REPLY =~ ^[Yy]$ ]]; then
  systemctl enable matrix-chat-docker.service
  print_success "Enabled matrix-chat-docker.service"

  systemctl enable matrix-chat-widget.service
  print_success "Enabled matrix-chat-widget.service"

  # Check if Telegram is configured
  if grep -q "platform: telegram" "$INSTALL_PATH/config/config.yaml" 2>/dev/null; then
    systemctl enable matrix-chat-telegram.service
    print_success "Enabled matrix-chat-telegram.service"
  else
    print_info "Telegram not configured, skipping telegram service"
  fi
fi

# Step 9: Start services
echo ""
read -p "Start services now? (y/n) " -n 1 -r
echo ""
if [[ $REPLY =~ ^[Yy]$ ]]; then
  print_info "Starting Docker services..."
  systemctl start matrix-chat-docker.service
  sleep 5
  print_success "Docker services started"

  print_info "Waiting for Synapse to be ready..."
  sleep 10

  print_info "Starting widget server..."
  systemctl start matrix-chat-widget.service
  sleep 2
  print_success "Widget server started"

  if systemctl is-enabled matrix-chat-telegram.service &>/dev/null; then
    print_info "Starting Telegram router..."
    systemctl start matrix-chat-telegram.service
    sleep 2
    print_success "Telegram router started"
  fi
fi

# Summary
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo " Installation Complete!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
print_success "Matrix Chat Support Widget installed as systemd services"
echo ""
print_info "Service Management Commands:"
echo ""
echo "  Check status:  sudo systemctl status matrix-chat-*"
echo "  View logs:     sudo journalctl -u matrix-chat-widget.service -f"
echo "  Restart:       sudo systemctl restart matrix-chat-widget.service"
echo "  Stop:          sudo systemctl stop matrix-chat-*"
echo ""
print_info "Access Points:"
echo ""
echo "  Widget Server:  http://localhost:3001"
echo "  Element Web:    http://localhost:8081"
echo "  Admin Panel:    http://localhost:8080"
echo "  Synapse API:    http://localhost:8008"
echo ""
print_info "For detailed documentation, see:"
echo "  $SCRIPT_DIR/README.md"
echo ""
