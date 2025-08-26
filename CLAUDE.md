# Matrix Chat Support Widget

A modern, embeddable chat support widget that integrates with Matrix/Synapse servers. Similar to Chatterbox functionality, this widget provides seamless customer support chat that can be embedded into any website.

## 🚀 Features

- **Easy Integration**: Single script tag embedding into any website
- **Matrix/Synapse Compatible**: Works with any Matrix homeserver including Synapse
- **Modern UI**: Clean, responsive chat interface with customizable branding  
- **Customer Details Collection**: Captures user information before starting chat
- **Room Management**: Creates new support rooms or connects to existing ones
- **Real-time Messaging**: Instant message delivery using Matrix's real-time sync
- **Mobile Responsive**: Works perfectly on desktop, tablet, and mobile devices
- **Production Ready**: Complete deployment setup for Apache2/Nginx

## 📋 Prerequisites

- **Node.js 18+**: For building and running the server
- **Matrix Homeserver**: Access to a Matrix/Synapse server
- **Matrix User/Bot**: Account with access token for handling support conversations
- **Web Server**: Apache2 or Nginx for production deployment (optional)

## 🛠️ Technology Stack

### Frontend
- **React 18** with TypeScript for the widget UI
- **Vite** for fast development and optimized builds
- **CSS Modules** for scoped styling (prevents conflicts when embedded)
- **Matrix JS SDK** for Matrix protocol communication

### Backend
- **Node.js/Express** for configuration API and static file serving
- **YAML** configuration for easy server setup
- **CORS** support for cross-origin embedding

### Build System
- **Vite Library Mode** creates single-file embeddable widget
- **TypeScript** for type safety and better development experience
- **ESLint** for code quality and consistency

## 📁 Project Structure

```
matrix-chat-support/
├── src/                          # Source code
│   ├── components/              # React components
│   │   └── ChatWidget.tsx      # Main widget component
│   ├── utils/                   # Utility functions
│   │   └── matrix-client.ts    # Matrix client wrapper
│   ├── types/                   # TypeScript type definitions
│   │   └── index.ts            # Main type exports
│   ├── styles/                  # CSS modules
│   │   └── widget.module.css   # Widget styling
│   ├── main.tsx                # Development demo entry
│   └── widget.tsx              # Embeddable widget entry
├── server/                      # Node.js backend
│   └── index.js                # Express server for config/static files
├── config/                      # Configuration files
│   ├── config.yaml             # Main configuration
│   ├── nginx.conf              # Nginx virtual host config
│   └── apache2.conf            # Apache2 virtual host config
├── scripts/                     # Setup and deployment scripts
│   └── setup.sh                # Automated setup script
├── examples/                    # Integration examples
│   └── embed-example.html      # HTML embedding example
├── dist/                        # Built files (created after build)
│   ├── widget/                 # Embeddable widget build
│   └── demo/                   # Demo application build
└── public/                      # Static assets
```

## 🚀 Quick Start

### 1. Clone and Setup

```bash
# Clone the repository
git clone <your-repo-url> matrix-chat-support
cd matrix-chat-support

# Run automated setup (installs deps, builds widget, creates config)
./scripts/setup.sh
```

### 2. Configure Matrix Server

Edit `config/config.yaml`:

```yaml
matrix:
  homeserver: "https://your-matrix-server.com"  # Your Matrix server URL
  access_token: "syt_xxx..."                    # Bot user access token
  support_room_id: "!roomid:server.com"        # Optional: existing support room
  bot_user_id: "@support:server.com"           # Optional: bot user to invite

widget:
  title: "Support Chat"
  subtitle: "We're here to help!"
  brand_color: "#667eea"
  position: "bottom-right"
  greeting: "Hi! How can we help you today?"
```

### 3. Get Matrix Access Token

#### Method 1: Element Web Console
1. Log in to Element Web as your support bot user
2. Go to Settings → Help & About
3. Scroll down to "Advanced" and copy the access token

#### Method 2: Matrix API
```bash
curl -X POST \
  https://your-matrix-server.com/_matrix/client/r0/login \
  -H 'Content-Type: application/json' \
  -d '{
    "type": "m.login.password",
    "user": "your-bot-username",
    "password": "your-bot-password"
  }'
```

### 4. Development

```bash
# Terminal 1: Start development demo
npm run dev

# Terminal 2: Start API server
npm run serve

# Visit http://localhost:3000 to test the widget
```

### 5. Production Build

```bash
# Build widget and demo
npm run build
npm run build:widget

# Start production server
npm run serve

# The widget is now available at:
# http://localhost:3001/embed.js
```

## 🌐 Embedding the Widget

### Simple Embedding (Recommended)

Add this single line to any webpage:

```html
<script src="https://your-domain.com/embed.js"></script>
```

### Custom Container

```html
<div id="my-chat-widget"></div>
<script>
  // Load widget script
  const script = document.createElement('script');
  script.src = 'https://your-domain.com/widget/matrix-chat-widget.iife.js';
  script.onload = function() {
    // Fetch configuration and initialize
    fetch('https://your-domain.com/api/config')
      .then(response => response.json())
      .then(config => {
        window.MatrixChatWidget.init(config, 'my-chat-widget');
      });
  };
  document.head.appendChild(script);
</script>
```

### Widget Configuration Options

The widget can be customized via the config.yaml file:

```yaml
widget:
  title: "Support Chat"                    # Header title
  subtitle: "We're here to help!"          # Header subtitle  
  brand_color: "#667eea"                   # Primary color
  position: "bottom-right"                 # Position on page
  greeting: "Hi! How can we help?"         # Initial greeting text
  placeholder_text: "Describe your issue" # Message placeholder
```

**Position Options:**
- `bottom-right` (default)
- `bottom-left`
- `top-right` 
- `top-left`

## 🏗️ Production Deployment

### Option 1: Nginx Deployment

1. **Copy Nginx config:**
   ```bash
   sudo cp config/nginx.conf /etc/nginx/sites-available/matrix-chat-widget
   ```

2. **Edit the config file:**
   ```bash
   sudo nano /etc/nginx/sites-available/matrix-chat-widget
   ```
   
   Update these paths:
   - `server_name` → your domain
   - SSL certificate paths
   - `/path/to/matrix-chat-support/` → actual project path

3. **Enable site:**
   ```bash
   sudo ln -s /etc/nginx/sites-available/matrix-chat-widget /etc/nginx/sites-enabled/
   sudo nginx -t
   sudo systemctl reload nginx
   ```

4. **Start Node.js server:**
   ```bash
   # Using PM2 (recommended)
   npm install -g pm2
   pm2 start server/index.js --name matrix-chat-widget
   pm2 save
   pm2 startup
   
   # Or using screen/tmux
   screen -S matrix-chat-widget
   npm run serve
   ```

### Option 2: Apache2 Deployment

1. **Enable required modules:**
   ```bash
   sudo a2enmod rewrite ssl headers expires proxy proxy_http
   ```

2. **Copy Apache config:**
   ```bash
   sudo cp config/apache2.conf /etc/apache2/sites-available/matrix-chat-widget.conf
   ```

3. **Edit and enable:**
   ```bash
   sudo nano /etc/apache2/sites-available/matrix-chat-widget.conf
   # Update domain, SSL paths, and project paths
   
   sudo a2ensite matrix-chat-widget
   sudo systemctl reload apache2
   ```

4. **Start Node.js server** (same as Nginx option)

### Environment Variables

For production, you can use environment variables instead of config.yaml:

```bash
export MATRIX_ACCESS_TOKEN="syt_xxx..."
export MATRIX_SUPPORT_ROOM_ID="!roomid:server.com"
export MATRIX_BOT_USER_ID="@support:server.com"
export PORT=3001
```

## 🔧 How It Works

### Architecture Overview

1. **Widget Embedding**: The embed.js script loads configuration from your server and initializes the widget
2. **User Interaction**: Customer clicks chat button, fills form with contact details
3. **Matrix Connection**: Widget connects to Matrix server using bot's access token
4. **Room Creation**: Creates new support room or joins existing one
5. **Real-time Chat**: Messages sync between customer and support agents via Matrix
6. **Support Response**: Support agents receive notifications and can respond via Matrix clients

### Message Flow

```
Customer Website → Widget → Your Server → Matrix Server → Support Agents
                                    ↓
Customer ← Widget ← Your Server ← Matrix Server ← Support Agents
```

### Room Management

**Option A: New Room Per Conversation (default)**
- Creates unique room for each customer conversation
- Room name: "Support Chat - CustomerName"
- Customer details added as room topic
- Support bot/agents invited automatically

**Option B: Shared Support Room**
- All conversations happen in single support room
- Customer details posted as initial message
- Better for teams that prefer consolidated chat

## 🎨 Customization

### Styling

The widget uses CSS modules with scoped class names to prevent conflicts. Main styles are in `src/styles/widget.module.css`.

**Custom Colors:**
```css
/* In your website's CSS, you can override specific colors */
.matrix-chat-widget .chatButton {
  background: linear-gradient(135deg, #your-color 0%, #your-secondary-color 100%) !important;
}
```

### Component Customization

To customize the widget beyond configuration options:

1. Fork/modify the ChatWidget component in `src/components/ChatWidget.tsx`
2. Rebuild the widget with `npm run build:widget`
3. Deploy updated files

### Matrix Integration

The Matrix client (`src/utils/matrix-client.ts`) handles:
- Authentication with access tokens
- Room creation and management  
- Real-time message synchronization
- Error handling and reconnection

## 🧪 Testing

### Development Testing

```bash
# Start development servers
npm run dev     # Demo at http://localhost:3000  
npm run serve   # API at http://localhost:3001

# Test the widget
open examples/embed-example.html
```

### Production Testing

```bash
# Build and test production build
npm run build
npm run build:widget
npm run serve

# Test embed script
curl http://localhost:3001/embed.js
curl http://localhost:3001/api/config
```

### Matrix Server Testing

Verify your Matrix configuration:

```bash
# Test authentication
curl -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  "https://your-matrix-server.com/_matrix/client/r0/account/whoami"

# Test room creation
curl -X POST \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Test Support Room"}' \
  "https://your-matrix-server.com/_matrix/client/r0/createRoom"
```

## 🚨 Troubleshooting

### Common Issues

**Widget not loading:**
- Check browser console for CORS errors
- Verify API server is running on correct port
- Ensure embed.js URL is accessible

**Matrix connection fails:**
- Verify access token is valid and not expired
- Check homeserver URL format (include https://)
- Ensure Matrix server allows client connections

**Messages not syncing:**
- Check Matrix server connectivity
- Verify bot user has room permissions
- Look at browser network tab for failed API calls

### Error Messages

**"Access token required"**
- Update config.yaml with valid Matrix access token

**"Failed to get user ID from access token"**  
- Token may be expired or invalid
- Verify homeserver URL is correct

**"Matrix client not connected"**
- Connection to Matrix server failed
- Check network connectivity and server status

### Debugging

Enable debug logging by setting:
```yaml
logging:
  level: "debug"
```

Check browser console and server logs for detailed error information.

## 🔒 Security Considerations

### Access Token Security
- Use dedicated bot user for support widget
- Regularly rotate access tokens
- Never expose tokens in client-side code
- Use environment variables for production tokens

### CORS Configuration
- Configure CORS origins restrictively in production
- Only allow your actual domains in `cors_origins`
- Avoid using `["*"]` in production

### Rate Limiting
- Enable rate limiting in Nginx/Apache configurations
- Monitor for abuse and unusual traffic patterns
- Consider implementing API rate limiting

### SSL/HTTPS
- Always use HTTPS in production
- Matrix servers require SSL for federation
- Browsers may block HTTP widgets on HTTPS sites

## 📖 API Reference

### Configuration API

**GET /api/config**
Returns widget configuration for client initialization.

Response:
```json
{
  "matrix": {
    "homeserver": "https://matrix.org",
    "accessToken": "syt_xxx...",
    "supportRoomId": "!room:server.com",
    "botUserId": "@bot:server.com"
  },
  "widget": {
    "title": "Support Chat",
    "subtitle": "We're here to help!",
    "brandColor": "#667eea",
    "position": "bottom-right",
    "greeting": "Hi! How can we help?",
    "placeholderText": "Describe your issue..."
  }
}
```

### Widget JavaScript API

**window.MatrixChatWidget.init(config, containerId?)**
Initializes the chat widget.

Parameters:
- `config`: Configuration object (from /api/config)
- `containerId`: Optional DOM element ID for custom container

### Health Check

**GET /health**
Returns server health status.

Response:
```json
{
  "status": "ok",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "version": "1.0.0"
}
```

## 🤝 Contributing

### Development Setup

1. Fork the repository
2. Create feature branch: `git checkout -b feature/amazing-feature`
3. Make changes and test thoroughly
4. Run linting: `npm run lint`
5. Run type checking: `npm run typecheck`
6. Commit changes: `git commit -m 'Add amazing feature'`
7. Push to branch: `git push origin feature/amazing-feature`
8. Open Pull Request

### Code Style

- Use TypeScript for all new code
- Follow existing naming conventions
- Add JSDoc comments for public APIs
- Use semantic commit messages

### Testing Guidelines

- Test widget embedding in multiple browsers
- Verify Matrix integration with different servers
- Test responsive design on mobile devices
- Check console for any errors or warnings

## 📄 License

This project is licensed under the MIT License. See LICENSE file for details.

## 🙏 Acknowledgments

- **Matrix.org** - For the excellent Matrix protocol and JavaScript SDK
- **Chatterbox** - For inspiration on embeddable chat widgets  
- **React Team** - For the fantastic React framework
- **Vite Team** - For the lightning-fast build tool

---

## 📞 Support

If you need help with this widget:

1. Check this documentation
2. Review the examples in `/examples`
3. Look at server logs for error messages
4. Open an issue with detailed information about your setup

Happy chatting! 🎉