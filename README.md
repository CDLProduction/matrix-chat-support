# Matrix Chat Support Widget

A modern, embeddable chat support widget that integrates with Matrix/Synapse servers. Similar to Chatterbox functionality, this widget provides seamless customer support chat that can be embedded into any website.

## 📋 Prerequisites

- **Node.js 18+**: Required for building and running the server
- **Matrix Homeserver**: Access to a Matrix/Synapse server (or use demo mode)
- **Matrix Bot Account**: User account with access token for handling support conversations
- **Web Server** (Production): Apache2 or Nginx for production deployment

## 🚀 Development Installation

### 1. Clone and Setup

```bash
# Clone the repository
git clone <your-repo-url> matrix-chat-support
cd matrix-chat-support

# Install dependencies
npm install

# Run automated setup (creates config files and builds widget)
./scripts/setup.sh
```

### 2. Configure Matrix Server (Optional)

Edit `config/config.yaml` with your Matrix server details:

```yaml
matrix:
  homeserver: "https://matrix.your-server.com"
  access_token: "syt_xxx..."  # Your bot's access token
  support_room_id: "!roomid:server.com"  # Optional: existing support room
  bot_user_id: "@support:server.com"     # Optional: bot user ID

widget:
  title: "Support Chat"
  subtitle: "We're here to help!"
  brand_color: "#667eea"
  position: "bottom-right"
  greeting: "Hi! How can we help you today?"
```

**Note:** The widget works in demo mode without Matrix configuration!

### 3. Get Matrix Access Token

#### Option A: Element Web Console
1. Log in to Element Web as your support bot user
2. Go to Settings → Help & About
3. Scroll down to "Advanced" and copy the access token

#### Option B: Matrix API
```bash
curl -X POST https://your-matrix-server.com/_matrix/client/r0/login \
  -H 'Content-Type: application/json' \
  -d '{
    "type": "m.login.password",
    "user": "your-bot-username",
    "password": "your-bot-password"
  }'
```

### 4. Start Development

```bash
# Terminal 1: Start development demo
npm run dev        # Opens demo at http://localhost:3000

# Terminal 2: Start API server  
npm run serve      # API server at http://localhost:3001

# The widget works in full demo mode without Matrix server!
```

## 🏗️ Production Installation

### 1. Server Setup

```bash
# Clone and install on your server
git clone <your-repo-url> matrix-chat-support
cd matrix-chat-support
npm install

# Build the widget for production
npm run build
npm run build:widget
```

### 2. Configure Production

**Option A: Environment Variables (Recommended)**
```bash
export MATRIX_HOMESERVER="https://matrix.your-server.com"
export MATRIX_ACCESS_TOKEN="syt_xxx..."
export MATRIX_SUPPORT_ROOM_ID="!roomid:server.com"
export MATRIX_BOT_USER_ID="@support:server.com"
export PORT=3001
export NODE_ENV=production
```

**Option B: Update config.yaml**
```yaml
matrix:
  homeserver: "https://matrix.your-server.com"
  access_token: "syt_xxx..."
  support_room_id: "!roomid:server.com"
  bot_user_id: "@support:server.com"

widget:
  title: "Support Chat"
  subtitle: "We're here to help!"
  brand_color: "#667eea"
  position: "bottom-right"

server:
  port: 3001
  cors_origins: ["https://your-website.com"]
```

### 3. Deploy with Process Manager

**Using PM2 (Recommended):**
```bash
# Install PM2 globally
npm install -g pm2

# Start the application
pm2 start server/index.js --name matrix-chat-widget

# Save PM2 configuration
pm2 save

# Setup PM2 to start on boot
pm2 startup
```

**Using systemd:**
```bash
# Create service file
sudo nano /etc/systemd/system/matrix-chat-widget.service
```

```ini
[Unit]
Description=Matrix Chat Support Widget
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/path/to/matrix-chat-support
ExecStart=/usr/bin/node server/index.js
Restart=on-failure
Environment=NODE_ENV=production
Environment=PORT=3001

[Install]
WantedBy=multi-user.target
```

```bash
# Enable and start service
sudo systemctl enable matrix-chat-widget
sudo systemctl start matrix-chat-widget
```

### 4. Web Server Configuration

#### Nginx Configuration

Create `/etc/nginx/sites-available/matrix-chat-widget`:
```nginx
server {
    listen 80;
    server_name your-domain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name your-domain.com;

    ssl_certificate /path/to/ssl/cert.pem;
    ssl_certificate_key /path/to/ssl/private.key;

    # Security headers
    add_header X-Frame-Options DENY;
    add_header X-Content-Type-Options nosniff;
    add_header X-XSS-Protection "1; mode=block";

    # Serve widget files
    location /embed.js {
        proxy_pass http://127.0.0.1:3001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        
        # CORS headers for embedding
        add_header Access-Control-Allow-Origin *;
        add_header Access-Control-Allow-Methods "GET, OPTIONS";
        add_header Access-Control-Allow-Headers "Content-Type";
    }

    # API endpoints
    location /api/ {
        proxy_pass http://127.0.0.1:3001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    # Widget assets
    location /widget/ {
        proxy_pass http://127.0.0.1:3001;
        proxy_set_header Host $host;
        
        # Cache static assets
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

Enable the site:
```bash
sudo ln -s /etc/nginx/sites-available/matrix-chat-widget /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

#### Apache2 Configuration

Create `/etc/apache2/sites-available/matrix-chat-widget.conf`:
```apache
<VirtualHost *:80>
    ServerName your-domain.com
    Redirect permanent / https://your-domain.com/
</VirtualHost>

<VirtualHost *:443>
    ServerName your-domain.com
    
    SSLEngine on
    SSLCertificateFile /path/to/ssl/cert.pem
    SSLCertificateKeyFile /path/to/ssl/private.key
    
    # Security headers
    Header always set X-Frame-Options DENY
    Header always set X-Content-Type-Options nosniff
    Header always set X-XSS-Protection "1; mode=block"
    
    # Proxy to Node.js server
    ProxyPass /embed.js http://127.0.0.1:3001/embed.js
    ProxyPass /api/ http://127.0.0.1:3001/api/
    ProxyPass /widget/ http://127.0.0.1:3001/widget/
    
    ProxyPassReverse /embed.js http://127.0.0.1:3001/embed.js
    ProxyPassReverse /api/ http://127.0.0.1:3001/api/
    ProxyPassReverse /widget/ http://127.0.0.1:3001/widget/
    
    # CORS headers for embedding
    Header always set Access-Control-Allow-Origin "*"
    Header always set Access-Control-Allow-Methods "GET, OPTIONS"
    Header always set Access-Control-Allow-Headers "Content-Type"
</VirtualHost>
```

Enable required modules and site:
```bash
sudo a2enmod ssl rewrite headers proxy proxy_http expires
sudo a2ensite matrix-chat-widget
sudo systemctl reload apache2
```

## 📖 Documentation

See [CLAUDE.md](./CLAUDE.md) for complete documentation including:

- Installation and setup instructions
- Matrix server configuration
- Deployment guides for Apache2/Nginx
- API reference and customization options
- Troubleshooting guide

## 🌐 Embedding the Widget

### Simple Embedding (Recommended)

Add this single line to any webpage:

```html
<script src="https://your-domain.com/embed.js"></script>
```

### Advanced Embedding Options

#### Custom Container
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

#### Conditional Loading
```html
<script>
  // Only load widget on specific pages or conditions
  if (window.location.pathname.includes('/support') || localStorage.getItem('needHelp')) {
    const script = document.createElement('script');
    script.src = 'https://your-domain.com/embed.js';
    document.head.appendChild(script);
  }
</script>
```

#### Multiple Widget Instances
```html
<!-- Widget for sales inquiries -->
<div id="sales-widget"></div>

<!-- Widget for technical support -->
<div id="support-widget"></div>

<script>
  // Load different configurations for each widget
  const salesConfig = {
    widget: {
      title: "Sales Chat",
      greeting: "How can our sales team help you?",
      brand_color: "#28a745"
    }
  };
  
  const supportConfig = {
    widget: {
      title: "Technical Support", 
      greeting: "Need technical assistance?",
      brand_color: "#dc3545"
    }
  };
  
  // Initialize both widgets
  window.MatrixChatWidget.init(salesConfig, 'sales-widget');
  window.MatrixChatWidget.init(supportConfig, 'support-widget');
</script>
```

### Widget Configuration

The widget behavior can be customized by modifying `config/config.yaml`:

```yaml
widget:
  title: "Support Chat"                    # Header title
  subtitle: "We're here to help!"          # Header subtitle  
  brand_color: "#667eea"                   # Primary color (hex)
  position: "bottom-right"                 # Widget position
  greeting: "Hi! How can we help?"         # Initial greeting message
  placeholder_text: "Describe your issue" # Input placeholder
  show_timestamp: true                     # Show message timestamps
  auto_open: false                        # Auto-open widget on page load
  close_on_away: true                     # Close when user navigates away
```

#### Position Options
- `bottom-right` (default) - Bottom right corner
- `bottom-left` - Bottom left corner  
- `top-right` - Top right corner
- `top-left` - Top left corner
- `center` - Centered on screen (modal style)

#### Brand Color Examples
```yaml
brand_color: "#667eea"  # Indigo (default)
brand_color: "#28a745"  # Green
brand_color: "#dc3545"  # Red
brand_color: "#6f42c1"  # Purple
brand_color: "#fd7e14"  # Orange
```

### Testing Your Embedding

#### Local Testing
```bash
# Start your widget server
npm run serve

# Test embedding with the example file
open examples/embed-example.html

# Or create a simple test page
echo '<script src="http://localhost:3001/embed.js"></script>' > test.html && open test.html
```

#### Production Testing
```bash
# Test all widget endpoints
curl https://your-domain.com/embed.js          # Should return embed script
curl https://your-domain.com/api/config        # Should return JSON config
curl https://your-domain.com/widget/           # Should serve widget assets
curl https://your-domain.com/health            # Should return {"status":"ok"}

# Test CORS headers
curl -H "Origin: https://example.com" \
     -H "Access-Control-Request-Method: GET" \
     -H "Access-Control-Request-Headers: Content-Type" \
     -X OPTIONS https://your-domain.com/embed.js
```

### Integration Examples

#### WordPress
Add to your theme's `functions.php` or use a plugin:
```php
function add_matrix_chat_widget() {
    wp_enqueue_script('matrix-chat', 'https://your-domain.com/embed.js', array(), '1.0', true);
}
add_action('wp_enqueue_scripts', 'add_matrix_chat_widget');
```

#### React Application
```jsx
import { useEffect } from 'react';

function App() {
  useEffect(() => {
    // Load widget script
    const script = document.createElement('script');
    script.src = 'https://your-domain.com/embed.js';
    script.async = true;
    document.head.appendChild(script);

    // Cleanup
    return () => {
      document.head.removeChild(script);
    };
  }, []);

  return (
    <div className="App">
      {/* Your app content */}
    </div>
  );
}
```

#### Vue.js Application
```vue
<template>
  <div id="app">
    <!-- Your app content -->
  </div>
</template>

<script>
export default {
  name: 'App',
  mounted() {
    const script = document.createElement('script');
    script.src = 'https://your-domain.com/embed.js';
    script.async = true;
    document.head.appendChild(script);
  },
  beforeDestroy() {
    // Remove widget if needed
    const widgets = document.querySelectorAll('[id^="matrix-chat-widget"]');
    widgets.forEach(widget => widget.remove());
  }
};
</script>
```

#### Next.js Application
```jsx
// components/ChatWidget.js
import { useEffect } from 'react';

export default function ChatWidget() {
  useEffect(() => {
    const script = document.createElement('script');
    script.src = 'https://your-domain.com/embed.js';
    script.async = true;
    document.head.appendChild(script);

    return () => {
      if (document.head.contains(script)) {
        document.head.removeChild(script);
      }
    };
  }, []);

  return null;
}

// pages/_app.js
import ChatWidget from '../components/ChatWidget';

export default function App({ Component, pageProps }) {
  return (
    <>
      <Component {...pageProps} />
      <ChatWidget />
    </>
  );
}
```

## ✨ Features

- ✅ **Easy Integration**: Single script tag embedding into any website
- ✅ **Matrix/Synapse Compatible**: Works with any Matrix homeserver
- ✅ **Modern UI**: Professional chat interface with refined design
- ✅ **Demo Mode**: Fully functional without Matrix server setup
- ✅ **Customer Details Collection**: Name, email, and message requirements
- ✅ **Real-time Messaging**: Instant delivery using Matrix's sync API
- ✅ **Smart Message Handling**: Auto-expanding input, message truncation
- ✅ **Mobile Responsive**: Perfect on desktop, tablet, and mobile
- ✅ **Room Management**: Create new support rooms or join existing
- ✅ **Production Ready**: Complete deployment configs for Apache2/Nginx
- ✅ **TypeScript + React**: Type-safe architecture with modern tools
- ✅ **CSS Modules**: Scoped styling prevents conflicts when embedded

## 🛠️ Tech Stack

- **Frontend**: React 18 + TypeScript + Vite
- **Matrix**: matrix-js-sdk for protocol communication
- **Backend**: Node.js/Express for configuration API
- **Styling**: CSS Modules (scoped, no conflicts)
- **Build**: Optimized single-file widget bundle (~3.6MB gzipped)
- **Process Manager**: PM2 or systemd for production
- **Web Server**: Nginx or Apache2 with SSL/TLS

## 🚨 Troubleshooting

### Common Issues

**Widget not loading:**
- Check browser console for CORS errors
- Verify API server is running: `curl http://localhost:3001/health`
- Ensure embed.js URL is accessible
- Clear browser cache and reload

**Chat button not visible:**
- Check if positioning CSS is being overridden
- Verify z-index conflicts (widget uses z-index: 999999)
- Test in different browsers to isolate CSS conflicts

**Matrix connection fails:**
- Verify access token is valid: `curl -H "Authorization: Bearer TOKEN" https://matrix.server.com/_matrix/client/r0/account/whoami`
- Check homeserver URL format (include https://)
- Test with demo mode first (set access_token to "DEMO_MODE_NO_CONNECTION")

**Production deployment issues:**
- Verify all environment variables are set
- Check process manager logs: `pm2 logs matrix-chat-widget`
- Test web server proxy configuration
- Ensure SSL certificates are valid

### Getting Help

1. Check [CLAUDE.md](./CLAUDE.md) for detailed documentation
2. Review server logs for error messages
3. Test with demo mode to isolate Matrix server issues
4. Verify all prerequisites are installed

## 📄 License

MIT License - see LICENSE file for details.

## 🤝 Contributing

1. Fork the repository
2. Create feature branch: `git checkout -b feature/amazing-feature`
3. Test thoroughly in both demo and Matrix modes
4. Run linting: `npm run lint` (if available)
5. Commit changes: `git commit -m 'Add amazing feature'`
6. Push to branch: `git push origin feature/amazing-feature`
7. Open Pull Request

## 🙏 Acknowledgments

- **Matrix.org** - For the excellent Matrix protocol and JavaScript SDK
- **React Team** - For the fantastic React framework
- **Vite Team** - For the lightning-fast build tool