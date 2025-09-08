# Matrix Chat Support Widget - Development Environment Setup

Complete guide for setting up the development environment from scratch on macOS, Linux, or Windows.

## 📋 Prerequisites

### Required Software
- **Node.js 18+** - [Download](https://nodejs.org/)
- **npm 8+** - Comes with Node.js
- **Docker Desktop** - [Download](https://www.docker.com/products/docker-desktop/)
- **Git** - For version control
- **Code Editor** - VS Code recommended

### System Requirements
- **macOS:** Ventura (13.0+) or later
- **Linux:** Ubuntu 20.04+, Debian 11+, or equivalent
- **Windows:** 10/11 with WSL2 enabled
- **RAM:** 8GB minimum, 16GB recommended
- **Disk Space:** 10GB free space

## 🚀 Quick Setup (5 minutes)

### 1. Clone and Install Dependencies
```bash
# Clone repository
git clone <repository-url> matrix-chat-support
cd matrix-chat-support

# Install dependencies
npm install

# Build widget
npm run build:widget
```

### 2. Start Development Servers
```bash
# Terminal 1: Widget API Server
npm run serve

# Terminal 2: Development Server  
npm run dev
```

### 3. Verify Setup
- **Health Check:** http://localhost:3001/health
- **Widget Demo:** http://localhost:3000
- **Configuration API:** http://localhost:3001/api/config

✅ **Setup Complete!** The widget is now running in demo mode.

---

## 🐳 Full Docker Setup (with Matrix Server)

### Prerequisites Check
```bash
# Verify Docker installation
docker --version
docker compose version

# Should show versions like:
# Docker version 24.0.0+
# Docker Compose version v2.20.0+
```

### Automated Setup
```bash
# Clean any existing containers
./scripts/docker-fix-and-cleanup.sh

# Run complete setup
./scripts/docker-setup.sh
```

### Manual Docker Setup (if automated fails)

#### 1. Start Docker Services
```bash
# Start all services
docker compose up -d

# Wait for services to be healthy
docker compose ps
```

#### 2. Generate Synapse Configuration
```bash
# Generate Matrix Synapse config
docker run --rm -v $(pwd)/data/synapse:/data \
  -e SYNAPSE_SERVER_NAME=localhost \
  -e SYNAPSE_REPORT_STATS=no \
  matrixdotorg/synapse:latest generate

# Fix permissions (Linux/macOS)
docker run --rm -v $(pwd)/data/synapse:/data alpine chown -R 991:991 /data

# Windows (PowerShell)
docker run --rm -v ${PWD}/data/synapse:/data alpine chown -R 991:991 /data
```

#### 3. Configure Database (Edit data/synapse/homeserver.yaml)
```yaml
database:
  name: psycopg2
  args:
    user: synapse
    password: synapse_password  
    database: synapse
    host: postgres
    port: 5432
    cp_min: 5
    cp_max: 10

# Enable registration
enable_registration: true
enable_registration_without_verification: true

# Enable Matrix Spaces
experimental_features:
  spaces_enabled: true
  msc2716_enabled: true
  msc3202_enabled: true

# CORS for widget
cors:
  - '*'
```

#### 4. Create Matrix Users
```bash
# Admin user
docker exec -it matrix-synapse register_new_matrix_user \
  -c /data/homeserver.yaml \
  -u admin -p admin123 --admin \
  http://localhost:8008

# Support bot users
docker exec -it matrix-synapse register_new_matrix_user \
  -c /data/homeserver.yaml \
  -u support -p support123 \
  http://localhost:8008

docker exec -it matrix-synapse register_new_matrix_user \
  -c /data/homeserver.yaml \
  -u tech_support -p tech123 \
  http://localhost:8008

docker exec -it matrix-synapse register_new_matrix_user \
  -c /data/homeserver.yaml \
  -u identification -p id123 \
  http://localhost:8008
```

#### 5. Get Access Tokens
```bash
# Use the get-access-token script
./scripts/get-access-token.sh support support123
./scripts/get-access-token.sh tech_support tech123  
./scripts/get-access-token.sh identification id123
```

#### 6. Update Configuration
Edit `config/config.yaml` with the obtained tokens:
```yaml
departments:
  - id: "support"
    matrix:
      homeserver: "http://localhost:8008"
      access_token: "syt_your_support_token_here"
      bot_user_id: "@support:localhost"
  # ... repeat for other departments
```

---

## 🏗️ Architecture Overview

### Directory Structure
```
matrix-chat-support/
├── src/                    # Source code
│   ├── components/         # React components
│   ├── utils/             # Matrix client, storage, spaces
│   ├── styles/            # CSS modules
│   └── types/             # TypeScript definitions
├── server/                # Express API server
├── config/                # Configuration files
├── scripts/               # Setup & deployment scripts
├── docker/                # Docker configurations
├── dist/                  # Built widget files
└── data/                  # Matrix server data
```

### Key Components
- **ChatWidget.tsx** - Main widget component (37K lines)
- **matrix-client.ts** - Matrix protocol integration
- **space-manager.ts** - Matrix Spaces functionality
- **chat-storage.ts** - Persistence system (Strategy 2.1)
- **config.yaml** - Multi-department configuration

---

## 🔧 Development Workflow

### Daily Development Commands
```bash
# Start development
npm run dev          # Demo at localhost:3000
npm run serve        # API at localhost:3001

# Build and test
npm run build:widget # Production build
npm run typecheck    # TypeScript validation
npm run lint         # Code linting
npm test            # Run tests

# Docker management
docker compose ps           # Check status
docker compose logs -f      # View logs
docker compose restart     # Restart services
docker compose down -v      # Clean reset
```

### Environment Variables
```bash
# Optional environment overrides
export MATRIX_ACCESS_TOKEN="syt_xxx..."
export MATRIX_BOT_USER_ID="@support:localhost"
export MATRIX_HOMESERVER="http://localhost:8008"
```

### Configuration Files
- **config/config.yaml** - Main widget configuration
- **docker-compose.yml** - Docker services
- **vite.config.ts** - Build configuration
- **tsconfig.json** - TypeScript settings

---

## 🧪 Testing & Validation

### Basic Functionality Test
```bash
# Health check
curl http://localhost:3001/health

# Configuration API
curl http://localhost:3001/api/config | jq

# Widget embed script
curl http://localhost:3001/embed.js
```

### Demo Mode Testing
1. Visit http://localhost:3000
2. Select a department
3. Fill out contact form
4. Test chat interface
5. Verify persistence (refresh page)

### Matrix Integration Testing
1. Visit http://localhost:8080 (Admin Panel)
2. Login: admin / admin123
3. Check users and rooms
4. Visit http://localhost:8081 (Element Web)
5. Login as support bot
6. Verify room creation and spaces

### Widget Integration Testing
```html
<!-- Test page -->
<!DOCTYPE html>
<html>
<head><title>Widget Test</title></head>
<body>
    <h1>Test Page</h1>
    <script src="http://localhost:3001/embed.js"></script>
</body>
</html>
```

---

## 🚨 Troubleshooting

### Common Issues & Solutions

#### npm install fails
```bash
# Clear cache and retry
npm cache clean --force
rm -rf node_modules package-lock.json
npm install
```

#### Docker containers won't start
```bash
# Check Docker is running
docker ps

# Clean and restart
docker compose down -v
docker system prune -a
./scripts/docker-fix-and-cleanup.sh
```

#### Synapse configuration errors
```bash
# Check logs
docker compose logs synapse

# Regenerate config
rm -rf data/synapse
./scripts/docker-setup.sh
```

#### Widget not loading
```bash
# Verify servers are running
curl http://localhost:3001/health
curl http://localhost:3000

# Check CORS in browser console
# Restart servers if needed
```

#### Permission errors (Linux/macOS)
```bash
# Fix Docker permissions
sudo chown -R $(id -u):$(id -g) .
./scripts/fix-docker-permissions.sh
```

#### Matrix API connection fails
```bash
# Test Matrix connection
curl http://localhost:8008/_matrix/client/versions

# Verify access tokens
curl -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:8008/_matrix/client/r0/account/whoami
```

### Debug Commands
```bash
# Detailed logs
docker compose logs -f synapse
npm run serve -- --verbose

# Health checks
./scripts/docker-setup.sh --health-check
curl http://localhost:3001/health?detailed=true

# Configuration validation
npm run typecheck
npm run lint
```

---

## 🌐 Network & Ports

### Required Ports
- **3000** - Development server (Vite)
- **3001** - Widget API server (Express)
- **8008** - Matrix Synapse server
- **8080** - Synapse Admin Panel
- **8081** - Element Web client
- **5432** - PostgreSQL (internal)
- **6379** - Redis (internal)

### Firewall Configuration
```bash
# macOS
sudo pfctl -d  # Disable if issues

# Linux (Ubuntu)
sudo ufw allow 3000:3001/tcp
sudo ufw allow 8008/tcp
sudo ufw allow 8080:8081/tcp
```

---

## 📦 Production Deployment

### Build for Production
```bash
# Build optimized widget
npm run build:widget

# Verify build
ls -la dist/widget/
curl http://localhost:3001/widget/matrix-chat-widget.iife.js
```

### Environment Setup
```bash
# Production environment variables
export NODE_ENV=production
export MATRIX_HOMESERVER="https://your-matrix-server.com"
export WIDGET_PORT=3001
```

### Process Management
```bash
# PM2 (recommended)
npm install -g pm2
pm2 start server/index.js --name matrix-chat-widget
pm2 startup
pm2 save

# System service (Linux)
sudo systemctl enable matrix-chat-widget
sudo systemctl start matrix-chat-widget
```

---

## 🔍 Advanced Configuration

### Multi-Department Setup
Edit `config/config.yaml`:
```yaml
departments:
  - id: "support"
    name: "General Support"
    description: "Technical help and general inquiries"
    icon: "🎧"
    color: "#667eea"
    matrix:
      homeserver: "http://localhost:8008"
      access_token: "syt_support_token"
      bot_user_id: "@support:localhost"
    widget:
      greeting: "Hi! How can our support team help you today?"
```

### Matrix Spaces Configuration
```yaml
spaces:
  enabled: true
  rootSpace:
    name: "Customer Support"
    description: "Root space for all customer support activities"
    visibility: "private"
  autoCreate: true
  hierarchy:
    - "General Support"
    - "Technical Support"  
    - "Account Issues"
```

### Widget Customization
```yaml
widget:
  title: "Customer Support"
  brand_color: "#667eea"
  position: "bottom-right"  # bottom-left, top-right, top-left
  greeting: "Hi! How can we help?"
  department_selection:
    title: "How can we help you today?"
    show_descriptions: true
    layout: "grid"  # list, grid
```

---

## 📚 Development Resources

### Key Files to Understand
1. **src/components/ChatWidget.tsx** - Main widget logic
2. **src/utils/matrix-client.ts** - Matrix integration
3. **src/utils/space-manager.ts** - Spaces functionality
4. **src/utils/chat-storage.ts** - Persistence (Strategy 2.1)
5. **config/config.yaml** - Configuration management

### Useful Scripts
```bash
# Get user access token
./scripts/get-access-token.sh username password

# Deploy to production
./scripts/deploy.sh

# Clean Docker environment
./scripts/docker-cleanup.sh

# Fix permissions
./scripts/fix-docker-permissions.sh
```

### Testing Scenarios
1. **New User Flow** - Department selection → Form → Chat
2. **Returning User** - Session restoration → Previous chat
3. **Department Switch** - Room preservation → Re-invitation
4. **Matrix Spaces** - Space creation → Room organization
5. **Error Handling** - Network failures → Graceful fallbacks

---

## 🎯 Feature Highlights

### Current Implementation
- ✅ **Multi-Department System** - 3+ departments with dedicated bots
- ✅ **Matrix Spaces Integration** - Hierarchical room organization  
- ✅ **Chat Persistence** - 30-day retention with welcome back
- ✅ **Strategy 2.1** - Smart room preservation and re-invitation
- ✅ **Professional UI** - Responsive design, auto-expanding input
- ✅ **Demo Mode** - Full functionality without Matrix server
- ✅ **Production Ready** - Docker, PM2, Nginx/Apache configs

### Recently Added Features
- **Enhanced Room Management** - Status tracking (active/left/invalid)
- **Bot-Assisted Re-invitation** - Seamless department switching
- **Memory Preservation** - Room history across department visits
- **Advanced Error Handling** - User-friendly error messages
- **Performance Optimization** - 3.5MB gzipped bundle

---

## 🔄 Migration & Backup

### Backup Important Data
```bash
# Configuration backup
tar -czf config-backup.tar.gz config/ data/synapse/homeserver.yaml

# Widget build backup
tar -czf widget-backup.tar.gz dist/

# Docker volumes backup
docker run --rm -v matrix-chat-support_synapse_data:/data \
  -v $(pwd):/backup alpine tar czf /backup/synapse-backup.tar.gz /data
```

### Fresh Environment Setup
```bash
# Complete cleanup
docker compose down -v
docker system prune -a
rm -rf node_modules data/ dist/

# Fresh setup
npm install
npm run build:widget
./scripts/docker-setup.sh
```

---

## 🆘 Support & Maintenance

### Regular Maintenance
```bash
# Weekly updates
npm audit fix
docker compose pull
docker system prune

# Monthly cleanup
npm cache clean --force
docker volume prune
```

### Monitoring
```bash
# Health monitoring
curl http://localhost:3001/health
docker compose ps
pm2 status

# Log monitoring  
tail -f ~/.pm2/logs/matrix-chat-widget-out.log
docker compose logs -f --tail=50
```

### Performance Tuning
- Monitor bundle size: `npm run build:widget -- --analyze`
- Database optimization: Regular PostgreSQL maintenance
- Redis caching: Monitor memory usage
- Matrix server: Adjust rate limits and worker processes

---

## 📝 Version History

### Development Setup Versions
- **v1.0** - Initial setup with single department
- **v2.0** - Multi-department implementation  
- **v2.1** - Smart room preservation (Strategy 2.1)
- **v3.0** - Matrix Spaces integration
- **v3.1** - Enhanced error handling and demo mode
- **Current** - Production-ready with complete Docker environment

---

**Last Updated:** September 2025  
**Environment:** macOS Ventura, Docker Desktop, Node.js 18+  
**Status:** ✅ Complete and tested