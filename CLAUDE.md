# Matrix Chat Support Widget

A modern, embeddable chat support widget that integrates with Matrix/Synapse servers. Provides seamless customer support chat that can be embedded into any website.

## 🚀 Key Features

- **Easy Integration**: Single script tag embedding
- **Matrix/Synapse Compatible**: Works with any Matrix homeserver
- **Professional UI**: Modern chat interface with responsive design
- **Chat History Persistence**: Maintains conversations across browser sessions
- **Demo Mode**: Fully functional without Matrix server setup
- **Real-time Messaging**: Instant sync using Matrix protocol
- **Smart Message Handling**: Auto-expanding input, long message truncation
- **Production Ready**: Complete deployment setup

## 📋 Prerequisites

- **Node.js 18+**: For building and running the server
- **Matrix Homeserver**: Access to Matrix/Synapse server with bot account
- **Web Server**: Apache2 or Nginx for production (optional)

## 🛠️ Technology Stack

- **Frontend**: React 18 + TypeScript + Vite + CSS Modules
- **Backend**: Node.js/Express with YAML configuration
- **Matrix**: Matrix JS SDK for protocol communication

## 📁 Key Structure

```
matrix-chat-support/
├── src/                    # Source code
│   ├── components/         # React components (ChatWidget, etc.)
│   ├── utils/             # Matrix client & chat storage
│   ├── styles/            # CSS modules
│   └── types/             # TypeScript definitions
├── server/                # Express API server
├── config/                # Configuration files
├── scripts/               # Setup & deployment scripts
├── docker/                # Docker development environment
└── examples/              # Integration examples
```

## 🚀 Quick Start

### 1. Setup
```bash
git clone <repo> matrix-chat-support
cd matrix-chat-support
./scripts/setup.sh  # Installs deps, builds widget
```

### 2. Configure Matrix Server
Edit `config/config.yaml`:
```yaml
matrix:
  homeserver: "https://your-matrix-server.com"
  access_token: "syt_xxx..."  # Bot user token
  bot_user_id: "@support:server.com"

widget:
  title: "Support Chat"
  brand_color: "#667eea"
  position: "bottom-right"
```

### 3. Development
```bash
npm run dev      # Demo at http://localhost:3000
npm run serve    # API at http://localhost:3001
```

### 4. Production
```bash
npm run build:widget
npm run serve
# Widget available at: http://localhost:3001/embed.js
```

## 🐳 Docker Development

Complete Matrix Synapse environment for testing:

```bash
./scripts/docker-setup.sh  # Automated setup
docker compose up -d       # Start services
npm run serve              # Start widget server
```

**Services (auto-configured):**
- Synapse Server: http://localhost:8008
- Admin Panel: http://localhost:8080
- Element Web: http://localhost:8081
- Auto-created users: `admin`/`admin`, `support`/`support123`

**Management:**
```bash
docker compose ps                    # Status
docker compose down                  # Stop (keep data)
docker compose down -v               # Clean reset
./scripts/docker-cleanup.sh          # Interactive cleanup
```

## 🌐 Embedding

### Simple Embedding
```html
<script src="https://your-domain.com/embed.js"></script>
```

### Custom Container
```html
<div id="my-chat-widget"></div>
<script src="https://your-domain.com/widget/matrix-chat-widget.iife.js"></script>
<script>
fetch('/api/config')
  .then(r => r.json())
  .then(config => MatrixChatWidget.init(config, 'my-chat-widget'));
</script>
```

### Configuration Options
```yaml
widget:
  title: "Support Chat"
  brand_color: "#667eea"  
  position: "bottom-right"  # bottom-right, bottom-left, top-right, top-left
  greeting: "Hi! How can we help?"
```

## ✨ Key Features

### Chat History Persistence
- Maintains conversations across browser sessions
- 30-day user session retention with dual storage (localStorage + cookies)
- "Welcome back" experience for returning users
- Smart room restoration and message history loading

### Modern UI/UX
- Professional chat interface (600px modal with responsive design)
- Auto-expanding textarea (1-5 lines)
- Message truncation for long content (300+ characters)
- Custom scrollbars and smooth animations
- Mobile-responsive (full-screen on mobile)

### Smart Features
- Demo mode (works without Matrix server)
- Real-time message synchronization
- User-friendly error handling
- Cross-browser compatibility
- Bundle: 9.7MB (~3.5MB gzipped)

## 🚀 Production Deployment

### Nginx Setup
```bash
sudo cp config/nginx.conf /etc/nginx/sites-available/matrix-chat-widget
sudo nano /etc/nginx/sites-available/matrix-chat-widget  # Edit domain, SSL, paths
sudo ln -s /etc/nginx/sites-available/matrix-chat-widget /etc/nginx/sites-enabled/
sudo systemctl reload nginx
```

### Apache2 Setup  
```bash
sudo a2enmod rewrite ssl headers expires proxy proxy_http
sudo cp config/apache2.conf /etc/apache2/sites-available/matrix-chat-widget.conf
sudo nano /etc/apache2/sites-available/matrix-chat-widget.conf  # Edit config
sudo a2ensite matrix-chat-widget && sudo systemctl reload apache2
```

### Process Management
```bash
# PM2 (recommended)
npm install -g pm2
pm2 start server/index.js --name matrix-chat-widget
pm2 startup && pm2 save

# Environment variables
export MATRIX_ACCESS_TOKEN="syt_xxx..."
export MATRIX_BOT_USER_ID="@support:server.com"
```

## 🔧 How It Works

1. **Embed Script** → Loads config and initializes widget
2. **Contact Form** → Customer provides details 
3. **Matrix Connection** → Creates room using bot token
4. **Real-time Chat** → Bidirectional sync via Matrix protocol
5. **Persistence** → Maintains session across page refreshes

**Room Management:**
- **New Room Per Conversation** (default): Unique rooms with customer details
- **Shared Support Room**: All chats in one room

## 🎨 Customization

### CSS Override
```css
.matrix-chat-widget .chatButton {
  background: linear-gradient(135deg, #your-color 0%, #your-secondary 100%) !important;
}
```

### Component Modification
1. Edit `src/components/ChatWidget.tsx`
2. Run `npm run build:widget`
3. Deploy updated files

### Key Files
- `src/utils/matrix-client.ts` - Matrix integration
- `src/utils/chat-storage.ts` - Persistence system
- `src/styles/widget.module.css` - Scoped styling

## 🧪 Testing

### Development Testing
```bash
npm run dev     # Demo mode at localhost:3000
npm run serve   # API server at localhost:3001
```

**Demo Mode Features:**
- Works without Matrix server
- Simulated support responses with delays  
- Full UI testing (form validation, animations, responsive design)
- Error handling and graceful fallbacks

### Production Testing
```bash
npm run build:widget && npm run serve
curl http://localhost:3001/embed.js     # Embed script
curl http://localhost:3001/api/config   # Configuration  
curl http://localhost:3001/health       # Health check
```

### Browser Compatibility
- Chrome/Edge/Firefox/Safari (desktop & mobile)
- Cross-browser testing recommended for production

### Matrix Server Testing
```bash
# Test Matrix connection
curl -H "Authorization: Bearer TOKEN" \
  "https://server.com/_matrix/client/r0/account/whoami"
```

## 🚨 Troubleshooting

### Common Issues
- **Widget not loading**: Check CORS errors, verify API server running (port 3001)
- **Button not visible**: Check z-index conflicts, CSS positioning overrides
- **Matrix connection fails**: Verify access token validity and homeserver URL
- **Messages not syncing**: Check bot permissions, Matrix server connectivity

### Error Messages
- `"Access token required"` → Update config.yaml with valid token
- `"Failed to get user ID"` → Token expired or invalid homeserver URL  
- `"Matrix client not connected"` → Network/server connectivity issue

### Debugging
```yaml
logging:
  level: "debug"  # Enable in config.yaml
```
Check browser console and server logs for detailed information.

## 🔒 Security

- **Access Tokens**: Use dedicated bot user, rotate regularly, never expose client-side
- **CORS**: Configure restrictive origins in production (no wildcards)
- **HTTPS**: Always use SSL in production
- **Rate Limiting**: Enable in web server configs, monitor for abuse

## 📖 API Reference

### Endpoints
- **GET /api/config** - Returns widget configuration
- **GET /health** - Health check (`{"status": "ok"}`)
- **GET /embed.js** - Embed script

### JavaScript API
```js
window.MatrixChatWidget.init(config, containerId?)
```

## 🤝 Contributing

1. Fork repository
2. Create feature branch: `git checkout -b feature/name`
3. Test thoroughly: `npm run lint && npm run typecheck`  
4. Commit and push changes
5. Open Pull Request

**Code Style:** TypeScript, existing conventions, semantic commits

## 📄 License

MIT License - See LICENSE file for details.

## 📞 Support

1. Check this documentation
2. Review `/examples` directory
3. Check server logs for errors
4. Open issue with setup details

---

## 🎯 Recent Major Updates

### Chat History Persistence ✅
- **30-day session retention** with localStorage + cookie fallback
- **"Welcome back" experience** for returning users
- **Smart message restoration** from previous sessions
- **Privacy controls** with "start fresh conversation" option

### Production-Ready Fixes ✅  
- **Zero browser errors** - Fixed all Node.js environment issues
- **User-friendly error handling** - Intelligent Matrix API error transformation
- **CORS flexibility** - Works with any localhost port for development
- **CSP compliance** - Proper Content Security Policy headers
- **Complete CSS loading** - Fixed embed script to load styles

### Technical Architecture ✅
- **Timeline-based history restoration** using Matrix initial sync
- **Multi-layer user detection** with session storage persistence
- **Smart room management** prevents "user already in room" errors
- **Strategy 2.1 Room Preservation** - Enhanced department room management with re-invitation support
- **Optimized builds** - 9.7MB bundle (3.5MB gzipped)
- **Cross-browser compatibility** - Chrome, Firefox, Safari, Edge

### Strategy 2.1 "Smart Room Preservation" ✅

**Problem Solved:** Strategy 2 was creating new rooms when users returned to previously visited departments instead of reconnecting to existing rooms.

**Key Features:**
- **Enhanced Storage Format** - Room status tracking ('active', 'left', 'invalid') with membership history
- **Memory Preservation** - Leaving rooms updates status to 'left' instead of clearing from storage
- **Bot-Assisted Re-invitation** - Automatic re-invitation to previously left rooms via support bot
- **Room State Recovery** - Comprehensive validation and recovery for corrupted room states
- **Backwards Compatibility** - Legacy rooms without status default to 'active'

**Implementation:**
- `setDepartmentRoomStatus()` - Enhanced room status management
- `getDepartmentRoomInfo()` - Retrieves room info with status
- `rejoinExistingRoom()` - Smart room reconnection logic
- `requestRoomReinvitation()` - Bot-mediated re-invitation process

**Status Workflow:**
1. **room_created** → **active** (user joins new room)
2. **department_switch** → **left** (user switches departments, room preserved)
3. **department_switch_return** → **active** (user returns, room reactivated)
4. **access_lost/rejoin_failed** → **invalid** (room no longer accessible)

**Benefits:**
- Eliminates duplicate rooms when switching between departments
- Preserves conversation history across department visits
- Provides seamless user experience with "Welcome back" messaging
- Reduces server load by reusing existing rooms