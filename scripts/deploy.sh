#!/bin/bash

# Matrix Chat Support Widget - Production Deployment Script
# This script helps deploy the widget to a production server

set -e

echo "🚀 Matrix Chat Support Widget - Production Deployment"
echo "===================================================="

# Check if we're in the right directory
if [ ! -f "package.json" ] || [ ! -f "config/config.yaml" ]; then
    echo "❌ Error: This script must be run from the project root directory"
    exit 1
fi

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 18+ first."
    exit 1
fi

# Check if production config exists
PROD_CONFIG="config/config.prod.yaml"
if [ ! -f "$PROD_CONFIG" ]; then
    echo "❌ Production configuration not found: $PROD_CONFIG"
    echo "   Please copy config/config.yaml to $PROD_CONFIG and edit it with production values"
    exit 1
fi

echo "✅ Prerequisites check passed"

# Install/update dependencies
echo ""
echo "📦 Installing production dependencies..."
npm ci --only=production

# Type checking
echo ""
echo "🔍 Running type checks..."
npm run typecheck

if [ $? -ne 0 ]; then
    echo "❌ Type check failed. Please fix TypeScript errors before deploying."
    exit 1
fi

# Build widget and demo
echo ""
echo "🔨 Building widget for production..."
npm run build:widget

if [ $? -ne 0 ]; then
    echo "❌ Widget build failed"
    exit 1
fi

echo ""
echo "🔨 Building demo application..."
npm run build

if [ $? -ne 0 ]; then
    echo "❌ Demo build failed"
    exit 1
fi

# Test the built widget
echo ""
echo "🧪 Testing production build..."

# Start server in background for testing
cp "$PROD_CONFIG" "config/config.current.yaml"
node server/index.js &
SERVER_PID=$!

# Wait for server to start
sleep 2

# Test health endpoint
if curl -s "http://localhost:3001/health" > /dev/null; then
    echo "✅ Health check passed"
else
    echo "❌ Health check failed"
    kill $SERVER_PID 2>/dev/null
    exit 1
fi

# Test embed script
if curl -s "http://localhost:3001/embed.js" | grep -q "MatrixChatWidget"; then
    echo "✅ Embed script test passed"
else
    echo "❌ Embed script test failed"
    kill $SERVER_PID 2>/dev/null
    exit 1
fi

# Stop test server
kill $SERVER_PID 2>/dev/null
rm -f "config/config.current.yaml"

echo "✅ Production build tests passed"

# Create deployment package
echo ""
echo "📦 Creating deployment package..."

DEPLOY_DIR="matrix-chat-widget-deploy"
rm -rf "$DEPLOY_DIR"
mkdir -p "$DEPLOY_DIR"

# Copy necessary files for deployment
cp -r dist/ "$DEPLOY_DIR/"
cp -r server/ "$DEPLOY_DIR/"
cp -r config/ "$DEPLOY_DIR/"
cp package.json "$DEPLOY_DIR/"
cp package-lock.json "$DEPLOY_DIR/"
cp README.md "$DEPLOY_DIR/"
cp CLAUDE.md "$DEPLOY_DIR/"

# Create deployment-specific package.json (remove dev dependencies)
cd "$DEPLOY_DIR"
npm prune --production
cd ..

# Create deployment instructions
cat > "$DEPLOY_DIR/DEPLOY.md" << 'EOF'
# Deployment Instructions

This package contains the production-ready Matrix Chat Support Widget.

## Server Requirements
- Node.js 18+
- Matrix/Synapse server access
- Web server (Apache2/Nginx) for SSL termination (recommended)

## Quick Deploy

1. Copy all files to your server directory
2. Edit `config/config.yaml` with your Matrix server details
3. Install dependencies: `npm install`
4. Start the server: `npm start`
5. Configure your web server (see config/nginx.conf or config/apache2.conf)

## Configuration

Edit `config/config.yaml`:
- `homeserver`: Your Matrix server URL
- `access_token`: Bot user access token
- `cors_origins`: Add your domain(s)

## Web Server Setup

For Nginx: Use `config/nginx.conf` as a template
For Apache2: Use `config/apache2.conf` as a template

## Process Management

For production, use PM2:
```bash
npm install -g pm2
pm2 start server/index.js --name matrix-chat-widget
pm2 save
pm2 startup
```

## Testing

- Health: http://your-domain.com/health
- Widget: http://your-domain.com/embed.js
EOF

echo "✅ Deployment package created: $DEPLOY_DIR/"

# Create deployment archive
echo ""
echo "📦 Creating deployment archive..."
tar -czf "matrix-chat-widget-deploy.tar.gz" "$DEPLOY_DIR"

echo "✅ Deployment archive created: matrix-chat-widget-deploy.tar.gz"

echo ""
echo "🎉 Deployment preparation complete!"
echo ""
echo "Next steps:"
echo "==========="
echo "1. Copy matrix-chat-widget-deploy.tar.gz to your production server"
echo "2. Extract: tar -xzf matrix-chat-widget-deploy.tar.gz"
echo "3. Follow the instructions in DEPLOY.md"
echo ""
echo "For manual deployment, use the files in: $DEPLOY_DIR/"
echo ""
echo "🔗 Widget embed URL will be: https://your-domain.com/embed.js"