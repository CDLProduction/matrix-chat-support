#!/bin/bash

# Matrix Chat Support Widget - Setup Script
# This script helps set up the widget for development and production

set -e

echo "🚀 Matrix Chat Support Widget Setup"
echo "===================================="

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 18+ first."
    echo "   Download from: https://nodejs.org/"
    exit 1
fi

# Check Node.js version
NODE_VERSION=$(node --version | cut -d'v' -f2)
REQUIRED_VERSION="18.0.0"

if [ "$(printf '%s\n' "$REQUIRED_VERSION" "$NODE_VERSION" | sort -V | head -n1)" = "$REQUIRED_VERSION" ]; then 
    echo "✅ Node.js version: $NODE_VERSION (OK)"
else
    echo "❌ Node.js version $NODE_VERSION is too old. Please install Node.js 18+ first."
    exit 1
fi

# Install dependencies
echo ""
echo "📦 Installing dependencies..."
npm install

if [ $? -ne 0 ]; then
    echo "❌ Failed to install dependencies"
    exit 1
fi

echo "✅ Dependencies installed successfully"

# Create production config if it doesn't exist
PROD_CONFIG="config/config.prod.yaml"
if [ ! -f "$PROD_CONFIG" ]; then
    echo ""
    echo "📝 Creating production configuration..."
    cp config/config.yaml "$PROD_CONFIG"
    echo "✅ Created $PROD_CONFIG (please edit it with your Matrix server details)"
else
    echo "⏭️  Production config already exists: $PROD_CONFIG"
fi

# Build the widget for production
echo ""
echo "🔨 Building widget for production..."
npm run build:widget

if [ $? -ne 0 ]; then
    echo "❌ Failed to build widget"
    exit 1
fi

echo "✅ Widget built successfully"

# Build demo application
echo ""
echo "🔨 Building demo application..."
npm run build

if [ $? -ne 0 ]; then
    echo "❌ Failed to build demo"
    exit 1
fi

echo "✅ Demo application built successfully"

# Set permissions
echo ""
echo "🔧 Setting up permissions..."
chmod +x scripts/*.sh
chmod 644 config/*.yaml
chmod 644 config/*.conf

# Check if PM2 is available for production process management
if command -v pm2 &> /dev/null; then
    echo ""
    echo "📋 PM2 is available for process management"
    echo "   You can use: npm run start:pm2"
else
    echo ""
    echo "💡 Consider installing PM2 for production process management:"
    echo "   npm install -g pm2"
fi

# Final setup complete
echo ""
echo "🎉 Setup complete!"
echo ""
echo "Next steps:"
echo "==========="
echo "1. Edit config/config.yaml with your Matrix server details:"
echo "   - homeserver: Your Matrix server URL"
echo "   - access_token: Access token for your support bot"
echo ""
echo "2. For development:"
echo "   npm run dev      # Start development server"
echo "   npm run serve    # Start config/API server"
echo ""
echo "3. For production:"
echo "   npm run serve    # Start the server"
echo "   # Or use PM2: pm2 start server/index.js --name matrix-chat-widget"
echo ""
echo "4. Test the widget:"
echo "   http://localhost:3000  # Development demo"
echo "   http://localhost:3001  # API server"
echo ""
echo "5. Embed in your website:"
echo "   <script src=\"http://your-domain.com/embed.js\"></script>"
echo ""
echo "📖 For more information, check CLAUDE.md"

# Check configuration
echo ""
echo "🔍 Checking configuration..."

if grep -q "YOUR_ACCESS_TOKEN_HERE" config/config.yaml; then
    echo "⚠️  Warning: Default access token detected in config.yaml"
    echo "   Please replace 'YOUR_ACCESS_TOKEN_HERE' with your actual Matrix access token"
fi

if grep -q "https://matrix.org" config/config.yaml; then
    echo "ℹ️  Using matrix.org as homeserver (you may want to change this)"
fi

echo ""
echo "✅ Setup completed successfully!"
echo "   Read CLAUDE.md for detailed documentation and deployment instructions."