# Matrix Chat Support Widget - Installation Guide

## Overview

This guide covers the automated installation script that sets up a complete Matrix Chat Support system with multiple departments, users, and Telegram integration.

## What the Installation Script Does

The interactive installer automates the following:

1. **Prerequisites Check**: Verifies Docker, Node.js, npm, curl, jq, disk space, and RAM
2. **PostgreSQL Setup**: Configures PostgreSQL (Docker or local)
3. **Matrix/Synapse Setup**: Starts Synapse homeserver and creates admin user
4. **Department Configuration**: Creates multiple departments with multiple users per department
5. **User Creation**: Automatically creates all Matrix users and obtains access tokens
6. **Telegram Bridge**: Configures mautrix-telegram with puppeting support
7. **Configuration Generation**: Creates all config files (config.yaml, telegram-department-router.js, etc.)
8. **Widget Build**: Builds the web widget with multi-user support
9. **Credentials Export**: Saves all credentials to a secure file

## System Requirements

### Minimum Requirements:
- **OS**: Linux, macOS, or WSL2 on Windows
- **RAM**: 2GB minimum (4GB recommended)
- **Disk Space**: 5GB minimum (10GB recommended)
- **Docker**: 20.10+ with Docker Compose
- **Node.js**: 18.0+
- **npm**: 8.0+
- **Python**: 3.8+ (for Telegram bridge)
- **Tools**: curl, jq, bash 4.0+

### Network Requirements:
- Internet access for Docker image downloads
- Ports available: 8008 (Synapse), 8080 (Synapse Admin), 8081 (Element), 29317 (Bridge), 3001 (Widget)

## Pre-Installation Checklist

### 1. Prepare Telegram Bot (if using Telegram integration)

Create a Telegram bot via [@BotFather](https://t.me/BotFather):

```
/newbot
# Follow prompts to create bot
# Save the bot token: 1234567890:ABCdefGHIjklMNOpqrsTUVwxyz
```

Get Telegram API credentials from [my.telegram.org](https://my.telegram.org):
1. Log in with your phone number
2. Go to "API development tools"
3. Create an application
4. Save **api_id** and **api_hash**

### 2. Prepare Department Structure

Plan your departments and users:

**Example Production Setup:**
```
Department 1: General Support
  - User 1: support_agent1 (John Doe) - Telegram enabled
  - User 2: support_agent2 (Jane Smith) - Telegram enabled
  - User 3: support_agent3 (Bob Wilson) - Telegram enabled

Department 2: Commerce Support
  - User 1: commerce_agent1 (Alice Johnson) - Telegram enabled
  - User 2: commerce_agent2 (Charlie Brown) - Telegram enabled
  - User 3: commerce_agent3 (David Lee) - Telegram enabled
  - User 4: commerce_agent4 (Emma Davis) - Telegram enabled

Department 3: Account Verification
  - User 1: verify_agent1 (Frank Miller) - Telegram enabled
  - User 2: verify_agent2 (Grace Chen) - Telegram enabled

Total: 3 departments, 9 users
```

### 3. Prepare Passwords

Decide on password strategy:
- **Option A**: Let script generate secure random passwords
- **Option B**: Provide your own passwords during installation

## Installation Process

### Step 1: Clone Repository (if not already done)

```bash
git clone <repository-url> matrix-chat-support
cd matrix-chat-support
```

### Step 2: Make Install Script Executable

```bash
chmod +x scripts/install.sh
chmod +x scripts/lib/*.sh
```

### Step 3: Run Installation Script

```bash
cd scripts
./install.sh
```

### Step 4: Follow Interactive Prompts

The installer will guide you through configuration:

#### 4.1 PostgreSQL Setup
```
PostgreSQL Configuration
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Use Docker for PostgreSQL? [Y/n]:
```
- **Recommended**: Press `Y` for Docker setup (automatic)
- **Advanced**: Press `n` for local PostgreSQL (requires existing install)

#### 4.2 Matrix Server Configuration
```
Matrix domain (default: localhost): localhost
Matrix port (default: 8008): 8008
Admin username (default: admin): admin
Admin password (leave empty to generate):
```
- Use defaults for local development
- Leave password empty for auto-generation

#### 4.3 Department Configuration
```
Number of departments (1-10): 3
```

**For each department:**
```
Department 1 Configuration
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Department ID: support
Department name: General Support
Department description: Technical help and general inquiries
Department icon (emoji): 🎧
Department color (hex): #667eea

Number of users for this department (1-10): 3
```

**For each user in department:**
```
User 1 Configuration
────────────────────────────────────────────────────

Username: support_agent1
Display name: John Doe
Password (leave empty to generate):
Enable Telegram for this user? [Y/n]: Y
```

**Repeat for all departments and users.**

#### 4.4 Telegram Configuration (if any users have Telegram enabled)
```
Telegram Configuration
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Telegram bot token: 1234567890:ABCdefGHIjklMNOpqrsTUVwxyz
Telegram API ID: 12345678
Telegram API Hash: abcdef1234567890abcdef1234567890
```

#### 4.5 Widget Configuration
```
Widget Configuration
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Widget title: Customer Support
Brand color (hex): #667eea
Widget position (bottom-right/bottom-left/top-right/top-left): bottom-right
Widget server port: 3001
```

#### 4.6 Configuration Summary
```
Configuration Summary
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Matrix:
  Domain: localhost
  Homeserver: http://localhost:8008
  Admin: admin

Departments: 3
  1. General Support (support) - 3 users
  2. Commerce Support (commerce) - 4 users
  3. Account Verification (identification) - 2 users

Total Users: 9
Telegram Enabled: Yes (9 users)

Proceed with installation? [y/N]:
```

Press `y` to begin installation.

### Step 5: Installation Execution

The script will automatically:

1. ✅ Create directory structure
2. ✅ Setup PostgreSQL
3. ✅ Start Matrix/Synapse
4. ✅ Create admin user
5. ✅ Create all department users (with progress indicator)
6. ✅ Obtain access tokens for all users
7. ✅ Generate config/config.yaml
8. ✅ Generate scripts/telegram-department-router.js
9. ✅ Generate mautrix-telegram configuration
10. ✅ Start Telegram bridge
11. ✅ Build widget
12. ✅ Save credentials

**Expected Duration**: 5-10 minutes depending on network speed

### Step 6: Installation Complete

```
Installation Summary
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✅ Installation completed successfully!

Access Points:
  Synapse Server: http://localhost:8008
  Synapse Admin: http://localhost:8080
  Element Web: http://localhost:8081
  Widget Server: http://localhost:3001
  Widget Embed: http://localhost:3001/embed.js

Credentials:
  All user credentials saved to: ../data/user-credentials.txt
  Admin user: admin
  Admin password: [saved in credentials file]

Next Steps:
  1. Authenticate Telegram users (see ../data/telegram-auth-guide.md)
  2. Start widget server: npm run serve
  3. Start Telegram bot: node scripts/telegram-department-router.js
  4. Test widget: open http://localhost:3001/widget/widget-test.html
```

## Post-Installation Steps

### 1. Review Credentials

```bash
cat data/user-credentials.txt
```

**Keep this file secure!** It contains:
- Admin credentials
- All user passwords
- All access tokens

### 2. Authenticate Telegram Users

Each user with Telegram enabled needs to authenticate their personal Telegram account:

```bash
# Read the authentication guide
cat data/telegram-auth-guide.md
```

**For each user:**
1. Open Element Web: http://localhost:8081
2. Login with user credentials from `user-credentials.txt`
3. Find "Telegram bridge bot" room
4. Send command: `login`
5. Send phone number: `+1234567890` (with country code)
6. Enter verification code from Telegram app
7. Confirm successful authentication

### 3. Start Services

```bash
# Terminal 1: Start Widget Server
npm run serve

# Terminal 2: Start Telegram Bot
cd scripts
node telegram-department-router.js
```

### 4. Test Widget

Open test page:
```bash
open http://localhost:3001/widget/widget-test.html
```

Or embed in your own page:
```html
<script src="http://localhost:3001/embed.js"></script>
```

### 5. Test Telegram Integration

1. Find your bot on Telegram: `@YourBotUsername`
2. Send `/start` command
3. Bot should respond with department selection buttons
4. Select department and send test message
5. Verify message appears in Matrix/Element for support team

## Verifying Installation

### Check Docker Services

```bash
docker compose ps
```

Expected output:
```
NAME                    STATUS              PORTS
postgres                Up                  5432/tcp
synapse                 Up                  0.0.0.0:8008->8008/tcp
synapse-admin           Up                  0.0.0.0:8080->8080/tcp
element                 Up                  0.0.0.0:8081->8081/tcp
mautrix-telegram        Up                  29317/tcp
```

### Check Matrix Users

Login to Synapse Admin: http://localhost:8080
- Default credentials: `admin` / (see credentials file)
- Verify all 9 users + admin created
- Check user permissions

### Check Configuration Files

```bash
# Main configuration
cat config/config.yaml

# Telegram bot script
cat scripts/telegram-department-router.js

# Bridge configuration
cat mautrix-telegram/config.yaml

# Bridge registration
cat data/mautrix-telegram-registration.yaml
```

### Check Widget Build

```bash
ls -lh dist/widget/
```

Should contain:
- `matrix-chat-widget.iife.js` (main bundle)
- `style.css` (widget styles)

## Troubleshooting

### Installation Fails During User Creation

**Symptom**: User creation errors or token retrieval fails

**Solution**:
```bash
# Check Synapse is running
docker compose logs synapse

# Verify Synapse health
curl http://localhost:8008/health

# Retry installation (script is idempotent)
./install.sh
```

### Docker Services Not Starting

**Symptom**: `docker compose up` fails

**Solution**:
```bash
# Check Docker daemon
docker info

# Check port conflicts
netstat -tuln | grep -E '8008|8080|8081|5432|29317'

# Clean restart
docker compose down -v
./install.sh
```

### Telegram Bridge Not Working

**Symptom**: Messages not bridging between Telegram and Matrix

**Solution**:
```bash
# Check bridge logs
docker compose logs mautrix-telegram

# Verify bridge registration
cat data/mautrix-telegram-registration.yaml

# Restart bridge
docker compose restart mautrix-telegram

# Verify user authentication
# Each user must login via bridge bot in Element
```

### Widget Not Loading

**Symptom**: Widget script returns 404 or doesn't initialize

**Solution**:
```bash
# Rebuild widget
npm run build:widget

# Check server is running
curl http://localhost:3001/health

# Check embed script
curl http://localhost:3001/embed.js

# Start server if not running
npm run serve
```

### "departmentUsers" Not Working

**Symptom**: Only one user invited to rooms instead of all department users

**Solution**:
```bash
# Rebuild widget with latest changes
npm run build:widget

# Verify config.yaml has users array
grep -A 10 "users:" config/config.yaml

# Restart widget server
# Stop (Ctrl+C) and restart: npm run serve
```

## Clean Reinstall

If you need to start over:

```bash
# Stop all services
docker compose down -v

# Remove generated files
rm -f data/install-session.json
rm -f data/user-credentials.txt
rm -f data/telegram-auth-guide.md
rm -f data/mautrix-telegram-registration.yaml
rm -f config/config.yaml
rm -f scripts/telegram-department-router.js

# Remove build artifacts
rm -rf dist/

# Run installer again
cd scripts
./install.sh
```

## Security Considerations

### Production Deployment

**Before deploying to production:**

1. **Change Default Passwords**: Never use generated passwords in production
2. **Enable HTTPS**: Use SSL certificates for all services
3. **Firewall Rules**: Restrict access to internal services
4. **Secure Credentials**: Store `user-credentials.txt` in secure vault
5. **Token Rotation**: Regularly rotate access tokens
6. **Database Backups**: Setup automated PostgreSQL backups

### Secure Credential Storage

```bash
# Encrypt credentials file
gpg -c data/user-credentials.txt

# Delete plaintext
rm data/user-credentials.txt

# Decrypt when needed
gpg -d data/user-credentials.txt.gpg
```

### Access Control

- Restrict Synapse Admin panel access
- Use strong admin passwords
- Enable rate limiting on Matrix API
- Monitor bridge logs for suspicious activity

## Updating Configuration

### Adding New Department

1. Edit `config/config.yaml`
2. Add new department configuration with users array
3. Create Matrix users via Synapse Admin
4. Obtain access tokens for new users
5. Restart widget server: `npm run serve`
6. Restart Telegram bot if using Telegram

### Adding User to Existing Department

1. Create user via Synapse Admin panel: http://localhost:8080
2. Login and get access token via Matrix API
3. Edit `config/config.yaml` - add user to department's users array
4. Edit `mautrix-telegram/config.yaml` - add puppeting permission
5. Restart services
6. User authenticates Telegram account via bridge bot

### Modifying Widget Appearance

Edit `config/config.yaml`:
```yaml
widget:
  title: "New Title"
  brand_color: "#newcolor"
  position: "top-right"
```

Restart widget server for changes to take effect.

## Advanced Configuration

### Custom Domain Setup

For production with custom domain:

1. Update `config/config.yaml`:
```yaml
matrix:
  homeserver: "https://matrix.yourdomain.com"
```

2. Configure reverse proxy (nginx/apache)
3. Setup SSL certificates
4. Update Synapse homeserver.yaml with proper server_name
5. Configure DNS records

### External PostgreSQL

To use external PostgreSQL:

1. During installation, choose "local" PostgreSQL
2. Provide connection details:
   - Host: your-db-server.com
   - Port: 5432
   - Database: synapse
   - User: synapse_user
   - Password: secure_password

3. Ensure PostgreSQL user has CREATE DATABASE privilege

## Next Steps

After successful installation and testing:

1. **Production Planning**: Review security checklist
2. **Backup Strategy**: Setup automated backups
3. **Monitoring**: Configure logging and monitoring
4. **Documentation**: Document your specific configuration
5. **Training**: Train support team on Matrix/Element interface

## Support

For issues not covered in this guide:

1. Check troubleshooting section above
2. Review installation logs: `data/install-*.log`
3. Check Docker service logs: `docker compose logs [service]`
4. Consult project documentation: `README.md`, `CLAUDE.md`
5. Open issue on GitHub with installation details

---

**Installation Guide Version**: 1.0
**Last Updated**: 2025-10-01
**Compatible With**: Installation script v1.0
