#!/bin/bash

# Start Telegram Department Bot
cd /Users/cdl/Projects/matrix-chat-support
source telegram_env/bin/activate

echo "Starting Telegram Department Bot..."
python3 scripts/telegram-department-bot.py