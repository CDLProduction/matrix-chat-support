# Matrix Chat Support Widget

A modern, embeddable chat support widget that integrates with Matrix/Synapse servers. Similar to Chatterbox functionality, this widget provides seamless customer support chat that can be embedded into any website.

## 🚀 Features

- **Easy Integration**: Single script tag embedding into any website
- **Matrix/Synapse Compatible**: Works with any Matrix homeserver including Synapse
- **Modern UI**: Sleek, professional chat interface with refined design and animations
- **Customer Details Collection**: Enhanced form with name, email, and message requirements
- **Room Management**: Creates new support rooms or connects to existing ones
- **Real-time Messaging**: Instant message delivery using Matrix's real-time sync
- **Smart Message Handling**: Auto-expanding input, long message truncation, and word wrapping
- **Demo Mode**: Fully functional demo experience without Matrix server setup
- **Perfect Scrolling**: Custom scrollbars and optimal height management
- **Professional Design**: Modern message bubbles, circular send button, and smooth animations
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
│   │   ├── ChatWidget.tsx      # Main widget component
│   │   └── LongMessage.tsx     # Message truncation component
│   ├── utils/                   # Utility functions
│   │   └── matrix-client.ts    # Matrix client wrapper
│   ├── types/                   # TypeScript type definitions
│   │   └── index.ts            # Main type exports
│   ├── styles/                  # CSS modules
│   │   ├── widget.module.css   # Widget styling
│   │   └── widget.module.css.d.ts # CSS module type definitions
│   ├── main.tsx                # Development demo entry
│   └── widget.tsx              # Embeddable widget entry
├── server/                      # Node.js backend
│   └── index.js                # Express server for config/static files
├── config/                      # Configuration files
│   ├── config.yaml             # Main configuration
│   ├── nginx.conf              # Nginx virtual host config
│   └── apache2.conf            # Apache2 virtual host config
├── scripts/                     # Setup and deployment scripts
│   ├── setup.sh                # Automated setup script
│   └── deploy.sh               # Production deployment script
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
npm run dev        # Starts on http://localhost:3000 (or next available port)

# Terminal 2: Start API server
npm run serve      # Starts on http://localhost:3001

# Visit the development URL to test the widget in demo mode
# The widget works fully without Matrix server configuration!
```

**Demo Mode Features:**
- Fully functional UI without Matrix server
- Simulated support responses with realistic delays
- Interactive messaging with random bot replies
- Perfect for testing and development

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

## 🎨 Design & User Experience

### Modern Chat Interface

The widget features a completely refined, professional chat interface designed to match industry standards:

#### **Visual Design Features:**
- **Sleek Modal Design**: 600px height with 16px border radius and professional shadows
- **Modern Message Bubbles**: 18px rounded corners with subtle shadows and gradient backgrounds
- **Refined Color Palette**: Professional colors with excellent contrast (#2d3748 for text, #fafbfc backgrounds)
- **Smooth Animations**: Cubic-bezier transitions for professional feel
- **Custom Scrollbars**: Thin, elegant scrollbars (6px width) that match the design

#### **Enhanced User Flow:**
1. **Contact Form**: Clean form requiring name, email, and message
2. **Send Message Button**: Prominent button with send icon starts the chat
3. **Chat Interface**: Professional message layout with user/support distinction
4. **Interactive Messaging**: Real-time or demo responses with status indicators

#### **Smart Message Handling:**
- **Auto-Expanding Input**: Textarea grows from 1 to 5 lines as you type
- **Keyboard Shortcuts**: Enter to send, Shift+Enter for new lines
- **Long Message Truncation**: Messages over 300 characters show "Show more/less" buttons  
- **Perfect Word Wrapping**: Handles long URLs and text without breaking layout
- **Message Status**: Shows "Sending...", "Sent", or "Failed" for user messages

#### **Responsive Design:**
- **Desktop**: 380px × 600px modal with perfect positioning
- **Mobile**: Full-screen modal (calc(100vh - 100px)) with optimized touch targets
- **Tablet**: Adaptive sizing with proper spacing
- **All Orientations**: Works in portrait and landscape modes

### Accessibility Features

- **Keyboard Navigation**: Full keyboard accessibility
- **Screen Reader Support**: Proper ARIA labels and semantic HTML
- **High Contrast**: Excellent color contrast ratios
- **Focus Indicators**: Clear focus states for all interactive elements
- **Mobile Touch Targets**: 44px minimum touch targets

### Performance Optimizations

- **Lazy Loading**: Components load on demand
- **Efficient Scrolling**: Smooth scroll to latest messages
- **Memory Management**: Proper cleanup of event listeners
- **Bundle Size**: Optimized single-file widget (~3.6MB gzipped)
- **CSS Scoping**: Scoped styles prevent conflicts with host website

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

### Development Testing (Demo Mode)

The widget includes a comprehensive demo mode that works without any Matrix server:

```bash
# Start development servers
npm run dev     # Demo interface (auto-assigns available port)
npm run serve   # API server at http://localhost:3001

# Visit the demo URL and test all features:
# ✅ Chat button visibility and hover effects
# ✅ Modal opening/closing animations
# ✅ Contact form validation (name, email, message required)
# ✅ Auto-expanding textarea (1-5 lines)
# ✅ Simulated chat responses with realistic delays
# ✅ Message truncation for long messages
# ✅ Keyboard shortcuts (Enter/Shift+Enter)
# ✅ Responsive design (resize browser window)
# ✅ Custom scrollbars and smooth animations
```

**Demo Mode Features:**
- **No Matrix Setup Required**: Works immediately out of the box
- **Realistic Chat Simulation**: Random support responses with delays
- **Full UI Testing**: Test all interface elements and interactions
- **Error Handling**: Graceful fallbacks and user-friendly messages

### UI/UX Testing Checklist

**Desktop Testing (1920×1080+):**
- [ ] Chat button appears in bottom-right corner
- [ ] Modal opens with smooth animation
- [ ] Form validation works (name, email, message required)
- [ ] Send button triggers chat interface
- [ ] Messages display correctly with proper alignment
- [ ] Textarea expands smoothly when typing long messages
- [ ] Send button stays visible and aligned during expansion
- [ ] Custom scrollbars appear when content overflows
- [ ] Long messages show expand/collapse functionality

**Mobile Testing (< 768px):**
- [ ] Modal takes full screen with proper margins
- [ ] Touch targets are minimum 44px
- [ ] Keyboard doesn't obscure input area
- [ ] Scrolling works smoothly
- [ ] Form fields are easily tappable
- [ ] Messages wrap correctly on narrow screens

**Keyboard Testing:**
- [ ] Tab navigation works through all elements
- [ ] Enter key sends messages
- [ ] Shift+Enter creates new lines
- [ ] Escape key closes modal
- [ ] Focus indicators are visible

### Production Testing

```bash
# Build and test production build
npm run build
npm run build:widget
npm run serve

# Test all endpoints
curl http://localhost:3001/embed.js          # Should return embed script
curl http://localhost:3001/api/config        # Should return configuration
curl http://localhost:3001/health            # Should return {"status":"ok"}
curl http://localhost:3001/widget/           # Should serve widget files

# Test embed script integration
open examples/embed-example.html
```

### Cross-Browser Testing

**Recommended Testing Matrix:**
- **Chrome 90+**: Full feature support, smooth animations
- **Firefox 88+**: Full feature support, custom scrollbars may differ
- **Safari 14+**: Full feature support, some animation differences
- **Edge 90+**: Full feature support, identical to Chrome
- **Mobile Safari**: Touch interactions, keyboard behavior
- **Chrome Mobile**: Touch interactions, viewport handling

### Performance Testing

```bash
# Bundle size analysis
npm run build:widget
ls -lh dist/widget/                          # Check file sizes

# Expected sizes:
# matrix-chat-widget.iife.js: ~10MB (3.6MB gzipped)
# style.css: ~5KB (1.5KB gzipped)

# Load testing
curl -w "@curl-format.txt" -s http://localhost:3001/embed.js
```

### Integration Testing

Test the widget on different website types:
- [ ] **WordPress sites**: No styling conflicts
- [ ] **React apps**: No JavaScript conflicts  
- [ ] **Static HTML sites**: Clean integration
- [ ] **Bootstrap sites**: CSS compatibility
- [ ] **Tailwind sites**: No class name conflicts

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
- Verify API server is running on correct port (3001)
- Ensure embed.js URL is accessible
- Clear browser cache and reload

**Chat button not visible:**
- Check if positioning CSS is being overridden by host site
- Verify z-index conflicts (widget uses z-index: 999999)
- Ensure no CSS Grid or Flexbox layouts are affecting positioning
- Test in different browsers to isolate CSS conflicts

**Modal positioning issues:**
- Modal uses fixed positioning relative to viewport
- Check for CSS transforms on parent elements (can affect positioning)
- Verify max-height calculations on small screens
- Test on different screen sizes and orientations

**Message input problems:**
- **Textarea not expanding**: Check for CSS conflicts with height/min-height
- **Send button misaligned**: Verify flexbox support and alignment properties
- **Long messages cut off**: Ensure container has proper overflow settings
- **Scrollbar not appearing**: Check if host site overrides scrollbar styles

**Demo mode issues:**
- Demo mode triggers when `access_token: "DEMO_MODE_NO_CONNECTION"`
- Simulated responses have 1.5-second delays
- Random responses cycle through predefined messages
- All UI features work without Matrix server

**Matrix connection fails:**
- Verify access token is valid and not expired
- Check homeserver URL format (include https://)
- Ensure Matrix server allows client connections
- Test token with curl command first

**Messages not syncing:**
- Check Matrix server connectivity
- Verify bot user has room permissions
- Look at browser network tab for failed API calls
- Enable debug logging in config.yaml

**Mobile-specific issues:**
- **Keyboard covering input**: Modal adjusts height automatically
- **Touch targets too small**: All interactive elements are 44px minimum
- **Scrolling problems**: Custom scrollbars work on WebKit browsers
- **Modal too large**: Uses calc(100vh - 100px) with responsive padding

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

---

## 📝 Development Changelog

### Version 1.0.0 - Complete Redesign & Enhancement

#### 🎨 **Major UI/UX Improvements**
- **Complete visual redesign** with modern, professional interface
- **Refined modal design**: Increased to 600px height with better proportions
- **Enhanced message bubbles**: 18px border radius, professional shadows, gradient backgrounds
- **Modern color palette**: Professional colors (#2d3748, #fafbfc, #667eea) with excellent contrast
- **Smooth animations**: Cubic-bezier transitions throughout the interface
- **Custom scrollbars**: Thin, elegant scrollbars (6px) that match the design aesthetic

#### 📱 **Enhanced Form & Input System**
- **Improved contact form**: Better spacing, refined typography, enhanced placeholders
- **Required message field**: Users must provide their message before starting chat
- **Auto-expanding textarea**: Smoothly grows from 1 to 5 lines as user types
- **Smart height management**: Proper constraints (44px min, 100px max) with reset functionality
- **Keyboard shortcuts**: Enter to send, Shift+Enter for new lines
- **Send button refinement**: Circular design (44px) with perfect alignment and hover effects

#### 💬 **Smart Message Handling**
- **Long message truncation**: Messages over 300 characters show expand/collapse functionality
- **Perfect word wrapping**: Handles long URLs and text without breaking layout
- **Message status indicators**: "Sending...", "Sent", "Failed" states for user messages
- **Enhanced message display**: Better padding (14px-18px), improved line-height (1.45)
- **Collapsible long messages**: LongMessage component with smooth expand/collapse

#### 🔄 **Demo Mode Implementation**
- **Full demo functionality**: Complete chat experience without Matrix server
- **Simulated responses**: Random support replies with realistic 1.5-second delays
- **Error handling**: Graceful fallbacks for connection issues
- **Development-friendly**: Perfect for testing and client demonstrations

#### 📐 **Layout & Positioning Fixes**
- **Modal positioning**: Fixed positioning with proper viewport constraints
- **Mobile responsiveness**: Full-screen modals on mobile (calc(100vh - 100px))
- **Chat input layout**: Fixed container with min/max heights (76px-160px)
- **Send button alignment**: Always visible and properly aligned regardless of textarea height
- **Scrolling optimization**: Custom scrollbars for messages and form areas

#### 🛠️ **Technical Improvements**
- **TypeScript enhancements**: Better type definitions and CSS module types
- **Component architecture**: Separated LongMessage component for better maintainability
- **Build optimization**: Improved Vite configuration for better bundle output
- **Error boundaries**: Better error handling and user feedback
- **Accessibility**: Improved ARIA labels, keyboard navigation, focus indicators

#### 🎯 **User Experience Enhancements**
- **Intuitive flow**: Contact form → Send Message → Chat Interface
- **Visual feedback**: Loading states, hover effects, focus states
- **Mobile optimization**: Touch-friendly targets (44px minimum), proper keyboard handling
- **Performance**: Smooth animations, efficient re-renders, optimized bundle size
- **Professional polish**: Industry-standard chat experience matching modern applications

#### 🔧 **Developer Experience**
- **Comprehensive documentation**: Updated CLAUDE.md with all improvements
- **Better development tools**: Enhanced npm scripts, improved dev server setup
- **Testing improvements**: Comprehensive testing checklist and cross-browser guidelines
- **Deployment scripts**: Updated deployment configurations and automation

#### 📦 **Build & Deployment**
- **Optimized builds**: Widget bundle ~3.6MB gzipped with all dependencies
- **Production-ready**: Complete Nginx/Apache2 configurations
- **Environment handling**: Better config management with environment variables
- **Health checks**: Comprehensive monitoring endpoints and status reporting

### Migration Notes

**From Previous Version:**
- Widget API remains the same - no breaking changes to embedding
- Configuration format unchanged - existing config.yaml files work
- All previous features enhanced, no functionality removed
- New demo mode automatically activates with placeholder tokens

**New Features to Test:**
1. ✅ Auto-expanding textarea in chat input
2. ✅ Long message truncation with expand/collapse
3. ✅ Enhanced form validation (message field now required)
4. ✅ Demo mode with simulated chat responses
5. ✅ Improved mobile responsiveness and touch targets
6. ✅ Custom scrollbars and refined visual design