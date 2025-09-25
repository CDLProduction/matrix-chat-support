#!/usr/bin/env python3
"""
Telegram Department Selection Bot

Handles /start commands, department selection, and creates Matrix rooms in appropriate spaces.
Integrates with mautrix-telegram bridge for seamless message bridging.
"""

import asyncio
import logging
import os
import json
import yaml
from typing import Dict, List, Optional, Any
from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup, Bot
from telegram.ext import Application, CommandHandler, CallbackQueryHandler, MessageHandler, filters, ContextTypes
import aiohttp
import aiofiles
from datetime import datetime
import uuid

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

class TelegramDepartmentBot:
    def __init__(self, config_path: str, spaces_config_path: str):
        self.config_path = config_path
        self.spaces_config_path = spaces_config_path
        self.config = None
        self.spaces_config = None
        self.bot = None
        self.application = None
        self.matrix_session = None
        self.user_sessions = {}  # Track user states and department selections

        # Department configuration
        self.departments = {
            "technical": {
                "name": "🛠️ Technical Support",
                "description": "Technical issues, bugs, account problems",
                "matrix_users": ["@admin:localhost", "@support:localhost"],
                "space_name": "Telegram - Technical Support"
            },
            "commerce": {
                "name": "💰 Commerce/Sales",
                "description": "Product information, pricing, purchases",
                "matrix_users": ["@admin:localhost", "@support:localhost"],
                "space_name": "Telegram - Commerce"
            },
            "verification": {
                "name": "✅ Verification",
                "description": "Account verification, identity confirmation",
                "matrix_users": ["@admin:localhost", "@support:localhost"],
                "space_name": "Telegram - Verification"
            },
            "general": {
                "name": "ℹ️ General Inquiry",
                "description": "General questions and support",
                "matrix_users": ["@admin:localhost", "@support:localhost"],
                "space_name": "Telegram - General"
            }
        }

    async def load_configs(self):
        """Load configuration files"""
        try:
            # Load main config
            async with aiofiles.open(self.config_path, 'r') as f:
                content = await f.read()
                self.config = yaml.safe_load(content)

            # Load spaces config
            async with aiofiles.open(self.spaces_config_path, 'r') as f:
                content = await f.read()
                self.spaces_config = yaml.safe_load(content)

            logger.info("Configurations loaded successfully")
        except Exception as e:
            logger.error(f"Error loading configs: {e}")
            raise

    async def initialize_matrix_session(self):
        """Initialize Matrix client session"""
        try:
            # Get Matrix admin token for room creation (from first department)
            departments = self.config.get('departments', [])
            if not departments:
                logger.error("No departments found in config")
                return False

            # Use admin token from first department
            matrix_config = departments[0].get('matrix', {})
            self.matrix_token = matrix_config.get('admin_access_token') or matrix_config.get('access_token')
            self.matrix_homeserver = matrix_config.get('homeserver', 'http://localhost:8008')

            if not self.matrix_token:
                logger.error("No Matrix access token found in config")
                return False

            # Test Matrix connection
            async with aiohttp.ClientSession() as session:
                headers = {'Authorization': f'Bearer {self.matrix_token}'}
                async with session.get(f'{self.matrix_homeserver}/_matrix/client/v3/account/whoami', headers=headers) as resp:
                    if resp.status == 200:
                        data = await resp.json()
                        logger.info(f"Matrix session initialized for user: {data.get('user_id')}")
                        return True
                    else:
                        logger.error(f"Matrix connection failed: {resp.status}")
                        return False
        except Exception as e:
            logger.error(f"Error initializing Matrix session: {e}")
            return False

    async def start_command(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        """Handle /start command - show department selection"""
        user = update.effective_user
        chat_id = update.effective_chat.id

        logger.info(f"Received /start from user {user.id} ({user.username}) in chat {chat_id}")

        # Create department selection keyboard
        keyboard = []
        for dept_id, dept_info in self.departments.items():
            keyboard.append([InlineKeyboardButton(
                dept_info["name"],
                callback_data=f"dept_{dept_id}"
            )])

        reply_markup = InlineKeyboardMarkup(keyboard)

        welcome_message = (
            f"👋 Welcome to Support, {user.first_name}!\n\n"
            "Please select the department that best matches your inquiry:\n\n"
            "🛠️ **Technical Support** - Technical issues, bugs, account problems\n"
            "💰 **Commerce/Sales** - Product information, pricing, purchases\n"
            "✅ **Verification** - Account verification, identity confirmation\n"
            "ℹ️ **General Inquiry** - General questions and support\n\n"
            "After selecting a department, you'll be connected with our support team."
        )

        await update.message.reply_text(welcome_message, reply_markup=reply_markup, parse_mode='Markdown')

    async def department_callback(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        """Handle department selection callback"""
        query = update.callback_query
        await query.answer()

        user = query.from_user
        chat_id = query.message.chat_id
        dept_id = query.data.replace("dept_", "")

        if dept_id not in self.departments:
            await query.edit_message_text("❌ Invalid department selection. Please try again with /start")
            return

        dept_info = self.departments[dept_id]
        logger.info(f"User {user.id} selected department: {dept_id}")

        # Store user session
        self.user_sessions[user.id] = {
            "department": dept_id,
            "department_name": dept_info["name"],
            "chat_id": chat_id,
            "username": user.username or f"user_{user.id}",
            "first_name": user.first_name or "Unknown",
            "last_name": user.last_name or "",
            "started_at": datetime.now().isoformat(),
            "conversation_id": str(uuid.uuid4())[:8]
        }

        # Update message to show success
        success_message = (
            f"✅ **Department Selected: {dept_info['name']}**\n\n"
            f"You've been connected to our {dept_info['name'].replace('🛠️ ', '').replace('💰 ', '').replace('✅ ', '').replace('ℹ️ ', '')} team.\n\n"
            "**Please send your message now** and our support team will respond shortly. "
            "Feel free to include any relevant details about your inquiry.\n\n"
            "_Note: Your first message will create a secure support room where our team can assist you._"
        )

        await query.edit_message_text(success_message, parse_mode='Markdown')

    async def create_matrix_room(self, telegram_user_id: int, department_id: str) -> Optional[str]:
        """Create Matrix room in appropriate department space"""
        try:
            user_session = self.user_sessions[telegram_user_id]
            dept_info = self.departments[department_id]

            # Room name pattern from config
            room_name = f"{user_session['username']} (Telegram) - {dept_info['name']} #{user_session['conversation_id']}"

            # Create room
            async with aiohttp.ClientSession() as session:
                headers = {
                    'Authorization': f'Bearer {self.matrix_token}',
                    'Content-Type': 'application/json'
                }

                room_data = {
                    "visibility": "private",
                    "preset": "private_chat",
                    "name": room_name,
                    "topic": f"Support conversation with {user_session['first_name']} from Telegram - {dept_info['name']}",
                    "initial_state": [
                        {
                            "type": "m.room.power_levels",
                            "content": {
                                "users": {
                                    "@admin:localhost": 100,
                                    "@support:localhost": 50
                                },
                                "users_default": 0,
                                "events_default": 0,
                                "state_default": 50,
                                "invite": 50,
                                "kick": 50,
                                "ban": 50,
                                "redact": 50
                            }
                        },
                        {
                            "type": "fi.mau.telegram.department",
                            "state_key": "",
                            "content": {
                                "department_id": department_id,
                                "department_name": dept_info["name"],
                                "telegram_user_id": telegram_user_id,
                                "conversation_id": user_session["conversation_id"],
                                "created_at": user_session["started_at"]
                            }
                        }
                    ]
                }

                async with session.post(
                    f'{self.matrix_homeserver}/_matrix/client/v3/createRoom',
                    headers=headers,
                    json=room_data
                ) as resp:
                    if resp.status == 200:
                        data = await resp.json()
                        room_id = data['room_id']
                        logger.info(f"Created Matrix room {room_id} for user {telegram_user_id}")

                        # Invite support team members
                        for user_id in dept_info["matrix_users"]:
                            await self.invite_user_to_room(room_id, user_id)

                        return room_id
                    else:
                        error_text = await resp.text()
                        logger.error(f"Failed to create room: {resp.status} - {error_text}")
                        return None

        except Exception as e:
            logger.error(f"Error creating Matrix room: {e}")
            return None

    async def invite_user_to_room(self, room_id: str, user_id: str):
        """Invite a user to a Matrix room"""
        try:
            async with aiohttp.ClientSession() as session:
                headers = {
                    'Authorization': f'Bearer {self.matrix_token}',
                    'Content-Type': 'application/json'
                }

                invite_data = {"user_id": user_id}

                async with session.post(
                    f'{self.matrix_homeserver}/_matrix/client/v3/rooms/{room_id}/invite',
                    headers=headers,
                    json=invite_data
                ) as resp:
                    if resp.status == 200:
                        logger.info(f"Invited {user_id} to room {room_id}")
                    else:
                        logger.warning(f"Failed to invite {user_id} to room {room_id}: {resp.status}")

        except Exception as e:
            logger.error(f"Error inviting user to room: {e}")

    async def send_matrix_notification(self, room_id: str, telegram_user_id: int, department_id: str):
        """Send notification to Matrix room about new conversation"""
        try:
            user_session = self.user_sessions[telegram_user_id]
            dept_info = self.departments[department_id]

            message = {
                "msgtype": "m.notice",
                "body": f"🎯 New {dept_info['name']} conversation started\n\n"
                       f"👤 Customer: {user_session['first_name']} {user_session['last_name']}\n"
                       f"📱 Telegram: @{user_session['username']}\n"
                       f"🆔 User ID: {telegram_user_id}\n"
                       f"🏷️ Department: {dept_info['name']}\n"
                       f"🕐 Started: {user_session['started_at']}\n\n"
                       f"The customer will appear in this room when they send their first message."
            }

            async with aiohttp.ClientSession() as session:
                headers = {
                    'Authorization': f'Bearer {self.matrix_token}',
                    'Content-Type': 'application/json'
                }

                async with session.put(
                    f'{self.matrix_homeserver}/_matrix/client/v3/rooms/{room_id}/send/m.room.message/{uuid.uuid4()}',
                    headers=headers,
                    json=message
                ) as resp:
                    if resp.status == 200:
                        logger.info(f"Sent notification to room {room_id}")
                    else:
                        logger.warning(f"Failed to send notification: {resp.status}")

        except Exception as e:
            logger.error(f"Error sending Matrix notification: {e}")

    async def handle_message(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        """Handle regular messages from users who have already selected departments"""
        user = update.effective_user

        # Check if user has an active session
        if user.id not in self.user_sessions:
            # User hasn't selected a department yet
            await update.message.reply_text(
                "👋 Please start with /start to select a department and connect with our support team."
            )
            return

        # User has selected a department - log and let bridge handle the message
        dept_name = self.user_sessions[user.id]['department']
        logger.info(f"Message from user {user.id} ({user.username}) in department {dept_name}: \"{update.message.text[:50]}...\"")

        # Don't reply here - let the mautrix-telegram bridge handle the message
        # The bridge's relaybot configuration will create the portal and invite support staff

    async def initialize_bot(self):
        """Initialize the Telegram bot"""
        try:
            # Get bot token from config (social_media section)
            bot_token = None
            social_media = self.config.get('social_media', [])
            for platform in social_media:
                if platform.get('platform') == 'telegram' and platform.get('enabled'):
                    bot_token = platform.get('config', {}).get('bot_token')
                    break

            if not bot_token:
                logger.error("No bot token found in config")
                return False

            # Create application
            self.application = Application.builder().token(bot_token).build()

            # Add handlers
            self.application.add_handler(CommandHandler("start", self.start_command))
            self.application.add_handler(CallbackQueryHandler(self.department_callback, pattern="^dept_"))
            self.application.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, self.handle_message))

            logger.info("Telegram bot initialized successfully")
            return True

        except Exception as e:
            logger.error(f"Error initializing bot: {e}")
            return False

    async def run(self):
        """Run the bot"""
        try:
            logger.info("Starting Telegram Department Bot...")

            # Load configurations
            await self.load_configs()

            # Initialize Matrix session
            if not await self.initialize_matrix_session():
                logger.error("Failed to initialize Matrix session")
                return

            # Initialize bot
            if not await self.initialize_bot():
                logger.error("Failed to initialize Telegram bot")
                return

            # Start the bot
            logger.info("Bot started successfully. Listening for messages...")
            async with self.application:
                await self.application.start()
                await self.application.updater.start_polling(drop_pending_updates=True)

                # Keep the bot running
                try:
                    await asyncio.Event().wait()
                except KeyboardInterrupt:
                    logger.info("Bot stopped by keyboard interrupt")
                finally:
                    await self.application.updater.stop()
                    await self.application.stop()

        except KeyboardInterrupt:
            logger.info("Bot stopped by user")
        except Exception as e:
            logger.error(f"Error running bot: {e}")
        finally:
            logger.info("Bot shutdown complete")

async def main():
    """Main entry point"""
    config_path = "/home/cdl/Projects/matrix-chat-support/config/config.yaml"
    spaces_config_path = "/home/cdl/Projects/matrix-chat-support/config/spaces.yaml"

    bot = TelegramDepartmentBot(config_path, spaces_config_path)
    await bot.run()

if __name__ == "__main__":
    asyncio.run(main())