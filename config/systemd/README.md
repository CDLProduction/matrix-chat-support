# Systemd Service Installation Guide

This directory contains systemd service unit files for running Matrix Chat Support Widget as system services on Linux servers.

## Services Overview

### Master Target: matrix-chat.target
**Purpose**: Manages the entire application stack with one command
**Controls**: All services below
**Type**: systemd target (group of services)

**Use this for simple management:**
```bash
sudo systemctl start matrix-chat.target    # Start everything
sudo systemctl stop matrix-chat.target     # Stop everything
sudo systemctl status matrix-chat.target   # Check all services
```

### Individual Services:

### 1. matrix-chat-docker.service
**Purpose**: Manages Docker Compose services (Synapse, PostgreSQL, Admin Panel, Element)
**Type**: oneshot (starts services and exits)
**Dependencies**: docker.service
**Part of**: matrix-chat.target

### 2. matrix-chat-widget.service
**Purpose**: Runs the widget server (server/index.js)
**Type**: simple (long-running process)
**Port**: 3001
**Dependencies**: docker.service, matrix-chat-docker.service
**Part of**: matrix-chat.target

### 3. matrix-chat-telegram.service
**Purpose**: Runs the Telegram department router (scripts/telegram-department-router.js)
**Type**: simple (long-running process)
**Dependencies**: docker.service, matrix-chat-widget.service
**Part of**: matrix-chat.target

## Prerequisites

1. **System User**: Services run as `matrix-chat` user
2. **Installation Path**: `/opt/matrix-chat-support`
3. **Node.js**: Installed system-wide (`/usr/bin/node`)
4. **Docker**: Installed and running
5. **Permissions**: Configured data and logs directories

## Installation Steps

### Step 1: Create System User

```bash
# Create dedicated system user (no login shell)
sudo useradd -r -s /bin/false -d /opt/matrix-chat-support matrix-chat
```

### Step 2: Install Application

```bash
# Clone or copy application to /opt
sudo mkdir -p /opt/matrix-chat-support
sudo cp -r /path/to/matrix-chat-support/* /opt/matrix-chat-support/

# Set ownership
sudo chown -R matrix-chat:matrix-chat /opt/matrix-chat-support
```

### Step 3: Configure Permissions

```bash
# Ensure data and logs directories are writable
sudo chmod 755 /opt/matrix-chat-support/data
sudo chmod 755 /opt/matrix-chat-support/logs

# Protect sensitive configuration files
sudo chmod 600 /opt/matrix-chat-support/config/config.yaml
sudo chmod 600 /opt/matrix-chat-support/data/chat-room-mappings.json
```

### Step 4: Install Systemd Services

```bash
# Copy service files to systemd directory
sudo cp /opt/matrix-chat-support/config/systemd/*.service /etc/systemd/system/

# Reload systemd to recognize new services
sudo systemctl daemon-reload
```

### Step 5: Enable Services

```bash
# Enable services to start on boot
sudo systemctl enable matrix-chat-docker.service
sudo systemctl enable matrix-chat-widget.service
sudo systemctl enable matrix-chat-telegram.service  # If using Telegram
```

### Step 6: Start Services

```bash
# Start Docker services first
sudo systemctl start matrix-chat-docker.service

# Wait a few seconds for Synapse to be ready
sleep 10

# Start widget server
sudo systemctl start matrix-chat-widget.service

# Start Telegram router (if configured)
sudo systemctl start matrix-chat-telegram.service
```

## Service Management

### Check Status

```bash
# Check all services
sudo systemctl status matrix-chat-*

# Check individual service
sudo systemctl status matrix-chat-widget.service
```

### View Logs

```bash
# Real-time logs (follow mode)
sudo journalctl -u matrix-chat-widget.service -f

# Last 100 lines
sudo journalctl -u matrix-chat-widget.service -n 100

# Logs since boot
sudo journalctl -u matrix-chat-widget.service -b

# Logs from all matrix-chat services
sudo journalctl -u 'matrix-chat-*' -f
```

### Start/Stop/Restart

```bash
# Stop services
sudo systemctl stop matrix-chat-telegram.service
sudo systemctl stop matrix-chat-widget.service
sudo systemctl stop matrix-chat-docker.service

# Start services
sudo systemctl start matrix-chat-docker.service
sudo systemctl start matrix-chat-widget.service
sudo systemctl start matrix-chat-telegram.service

# Restart a service
sudo systemctl restart matrix-chat-widget.service

# Reload configuration without stopping
sudo systemctl reload-or-restart matrix-chat-widget.service
```

### Disable Services

```bash
# Disable from starting on boot
sudo systemctl disable matrix-chat-telegram.service
sudo systemctl disable matrix-chat-widget.service
sudo systemctl disable matrix-chat-docker.service
```

## Updating Application

When updating the application code:

```bash
# Stop Node.js services (keep Docker running)
sudo systemctl stop matrix-chat-telegram.service
sudo systemctl stop matrix-chat-widget.service

# Update code
cd /opt/matrix-chat-support
sudo -u matrix-chat git pull
sudo -u matrix-chat npm install
sudo -u matrix-chat npm run build:widget

# Restart services
sudo systemctl start matrix-chat-widget.service
sudo systemctl start matrix-chat-telegram.service
```

## Configuration Changes

After modifying `config/config.yaml`:

```bash
# Restart services to pick up new configuration
sudo systemctl restart matrix-chat-widget.service
sudo systemctl restart matrix-chat-telegram.service
```

## Troubleshooting

### Service Won't Start

1. **Check service status**:
   ```bash
   sudo systemctl status matrix-chat-widget.service
   ```

2. **Check logs for errors**:
   ```bash
   sudo journalctl -u matrix-chat-widget.service -n 50
   ```

3. **Verify file permissions**:
   ```bash
   ls -la /opt/matrix-chat-support/
   sudo -u matrix-chat ls -la /opt/matrix-chat-support/data/
   ```

4. **Test manual startup**:
   ```bash
   sudo -u matrix-chat /usr/bin/node /opt/matrix-chat-support/server/index.js
   ```

### Permission Denied Errors

```bash
# Fix ownership
sudo chown -R matrix-chat:matrix-chat /opt/matrix-chat-support

# Fix data directory permissions
sudo chmod 755 /opt/matrix-chat-support/data
sudo chmod 755 /opt/matrix-chat-support/logs
```

### Docker Services Not Starting

```bash
# Check Docker is running
sudo systemctl status docker

# Check Docker Compose file exists
ls -la /opt/matrix-chat-support/docker-compose.yml

# Manually start Docker services to see errors
cd /opt/matrix-chat-support
sudo docker compose up -d
sudo docker compose ps
sudo docker compose logs synapse
```

### Port Already in Use

```bash
# Check what's using port 3001
sudo lsof -i :3001

# Kill process if needed
sudo kill -9 <PID>

# Or change port in config/config.yaml
```

## Security Hardening

The service files include several security features:

- `NoNewPrivileges=true` - Prevents privilege escalation
- `PrivateTmp=true` - Isolates /tmp directory
- `ProtectSystem=strict` - Makes most of filesystem read-only
- `ProtectHome=true` - Hides /home directories
- `ReadWritePaths=...` - Only allows writing to specific paths
- `ProtectKernelTunables=true` - Protects kernel parameters
- `ProtectKernelModules=true` - Prevents loading kernel modules
- `ProtectControlGroups=true` - Protects cgroup filesystem

### Additional Recommendations

1. **Use firewall** to restrict access:
   ```bash
   sudo ufw allow from 192.168.1.0/24 to any port 3001  # Local network only
   sudo ufw allow from any to any port 8008  # Matrix federation
   ```

2. **Enable SELinux/AppArmor** if available on your distribution

3. **Regular updates**:
   ```bash
   sudo apt update && sudo apt upgrade  # Ubuntu/Debian
   sudo yum update  # CentOS/RHEL
   ```

4. **Monitor logs regularly**:
   ```bash
   # Set up log rotation
   sudo nano /etc/logrotate.d/matrix-chat
   ```

## Monitoring

### Health Checks

```bash
# Widget server health
curl http://localhost:3001/health

# Matrix Synapse health
curl http://localhost:8008/health

# Check all services are running
sudo systemctl is-active matrix-chat-widget.service
sudo systemctl is-active matrix-chat-telegram.service
sudo systemctl is-active matrix-chat-docker.service
```

### Resource Usage

```bash
# CPU and memory usage
systemctl status matrix-chat-widget.service
systemctl status matrix-chat-telegram.service

# Detailed resource usage
sudo systemd-cgtop
```

## Backup and Restore

### Backup

```bash
# Backup configuration and data
sudo tar -czf matrix-chat-backup-$(date +%Y%m%d).tar.gz \
  -C /opt/matrix-chat-support \
  config/ data/ docker-compose.yml
```

### Restore

```bash
# Stop services
sudo systemctl stop matrix-chat-telegram.service
sudo systemctl stop matrix-chat-widget.service
sudo systemctl stop matrix-chat-docker.service

# Extract backup
sudo tar -xzf matrix-chat-backup-YYYYMMDD.tar.gz \
  -C /opt/matrix-chat-support

# Fix permissions
sudo chown -R matrix-chat:matrix-chat /opt/matrix-chat-support

# Restart services
sudo systemctl start matrix-chat-docker.service
sleep 10
sudo systemctl start matrix-chat-widget.service
sudo systemctl start matrix-chat-telegram.service
```

## Uninstallation

```bash
# Stop and disable services
sudo systemctl stop matrix-chat-telegram.service matrix-chat-widget.service matrix-chat-docker.service
sudo systemctl disable matrix-chat-telegram.service matrix-chat-widget.service matrix-chat-docker.service

# Remove service files
sudo rm /etc/systemd/system/matrix-chat-*.service
sudo systemctl daemon-reload

# Remove application (CAUTION: This deletes all data!)
sudo rm -rf /opt/matrix-chat-support

# Remove system user
sudo userdel matrix-chat
```

## Support

For issues specific to systemd configuration, check:

1. System logs: `sudo journalctl -xe`
2. Service status: `sudo systemctl status matrix-chat-*`
3. Application logs in `/opt/matrix-chat-support/logs/`

For application issues, refer to the main project documentation.
