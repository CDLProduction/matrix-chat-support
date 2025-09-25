#!/bin/bash

# Telegram Department Router Setup Script

set -e

echo "🚀 Setting up Telegram Department Router..."

# Check if Python 3 is available
if ! command -v python3 &> /dev/null; then
    echo "❌ Python 3 is required but not installed."
    exit 1
fi

# Create virtual environment if it doesn't exist
if [ ! -d "telegram-router-env" ]; then
    echo "📦 Creating Python virtual environment..."
    python3 -m venv telegram-router-env
fi

# Activate virtual environment
echo "🔧 Activating virtual environment..."
source telegram-router-env/bin/activate

# Install dependencies
echo "📚 Installing Python dependencies..."
pip install --upgrade pip
pip install -r requirements.txt

echo "✅ Setup complete!"
echo ""
echo "To start the Telegram Department Router:"
echo "  1. Activate the virtual environment: source scripts/telegram-router-env/bin/activate"
echo "  2. Run the bot: python scripts/telegram-department-router.py"
echo ""
echo "The bot will:"
echo "  • Handle department selection via inline keyboard"
echo "  • Route /start commands with department parameters"
echo "  • Create department-specific Matrix rooms"
echo "  • Forward messages between Telegram and Matrix"
echo ""
echo "Test with these commands in Telegram:"
echo "  /start                    - Show department selection"
echo "  /start support           - Go directly to General Support"
echo "  /start tech_support      - Go directly to Tech Support"
echo "  /start identification    - Go directly to Account Verification"
echo "  /start commerce          - Go directly to Sales & Commerce"