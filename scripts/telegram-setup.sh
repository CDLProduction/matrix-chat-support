#!/bin/bash

# Telegram-Matrix Integration Setup Script
# This script sets up the working Telegram integration implementation

set -e

echo "🚀 Setting up Telegram-Matrix Integration..."

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker is not running. Please start Docker first."
    exit 1
fi

# Check if required files exist
if [ ! -f "../config/config.yaml" ]; then
    echo "❌ config/config.yaml not found. Please ensure you have the proper configuration."
    exit 1
fi

if [ ! -f "../mautrix-telegram/config.yaml" ]; then
    echo "❌ mautrix-telegram/config.yaml not found. Please run docker setup first."
    exit 1
fi

# Install Node.js dependencies for department router
echo "📦 Installing Node.js dependencies..."
if [ ! -f "package.json" ]; then
    npm init -y
    npm install node-telegram-bot-api axios js-yaml eventsource
else
    npm install
fi

# Create data directory if it doesn't exist
mkdir -p ../data

# Check if mautrix-telegram is running
echo "🔍 Checking Docker services..."
if ! docker compose ps | grep -q "mautrix-telegram.*Up"; then
    echo "⚠️  mautrix-telegram service is not running. Starting..."
    docker compose up -d mautrix-telegram
    sleep 5
fi

# Verify bot token configuration
echo "🔧 Verifying mautrix-telegram configuration..."
if grep -q "bot_token: 8497512931" ../mautrix-telegram/config.yaml; then
    echo "❌ Bot token conflict detected in mautrix-telegram config!"
    echo "   Please comment out or disable the bot_token in mautrix-telegram/config.yaml"
    echo "   This is critical to prevent conflicts with department router."
    exit 1
fi

# Check if relaybot invite list is empty
if ! grep -A 5 "private_chat:" ../mautrix-telegram/config.yaml | grep -q "invite: \[\]"; then
    echo "⚠️  Warning: relaybot invite list should be empty to prevent auto-portal creation"
fi

# Verify department router configuration
echo "🔍 Verifying department router..."
if [ ! -f "telegram-department-router.js" ]; then
    echo "❌ telegram-department-router.js not found!"
    exit 1
fi

# Check if TELEGRAM_DEPARTMENT_SPACES is defined
if ! grep -q "TELEGRAM_DEPARTMENT_SPACES" telegram-department-router.js; then
    echo "❌ telegram-department-router.js appears to be outdated. Please use the latest version."
    exit 1
fi

echo "✅ Pre-flight checks completed!"

# Test Matrix API connectivity
echo "🔗 Testing Matrix API connectivity..."
ADMIN_TOKEN=$(grep admin_access_token ../config/config.yaml | head -1 | cut -d'"' -f2)
if curl -s -H "Authorization: Bearer $ADMIN_TOKEN" "http://localhost:8008/_matrix/client/v3/account/whoami" > /dev/null; then
    echo "✅ Matrix API connectivity confirmed"
else
    echo "❌ Cannot connect to Matrix API. Please check if Synapse is running."
    exit 1
fi

# Test Telegram bot token
echo "🤖 Testing Telegram bot connectivity..."
BOT_TOKEN=$(grep bot_token ../config/config.yaml | cut -d'"' -f2)
if curl -s "https://api.telegram.org/bot$BOT_TOKEN/getMe" | grep -q "ok.*true"; then
    echo "✅ Telegram bot connectivity confirmed"
else
    echo "❌ Cannot connect to Telegram API. Please check bot token."
    exit 1
fi

echo ""
echo "🎉 Setup verification completed successfully!"
echo ""
echo "📋 Next steps:"
echo "1. Start the department router:"
echo "   cd scripts && node telegram-department-router.js"
echo ""
echo "2. Test with Telegram:"
echo "   - Message @QWMatrixTestBot"
echo "   - Use /start_support command"
echo "   - Verify room appears under 'Telegram Support' space"
echo ""
echo "3. Monitor logs for issues:"
echo "   - Department router console output"
echo "   - docker compose logs mautrix-telegram"
echo ""
echo "📖 For complete documentation, see: TELEGRAM_IMPLEMENTATION.md"
echo ""
echo "✅ Ready for production use!"