#!/usr/bin/env python3
"""
Telegram Department Router Bot

This bot handles department-specific routing for the Matrix chat support widget.
It intercepts messages to the Telegram bot and routes them to specific Matrix rooms
based on department selection.
"""

import asyncio
import logging
import os
import json
import yaml
from typing import Dict, List, Optional
from telethon import TelegramClient, events, Button
from telethon.types import User
import aiohttp
import aiofiles

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

class DepartmentRouter:
    def __init__(self, config_path: str):
        self.config_path = config_path
        self.config = None
        self.client = None
        self.matrix_session = None
        self.user_sessions = {}  # Track user states

    async def load_config(self):
        """Load configuration from YAML file"""
        try:
            async with aiofiles.open(self.config_path, 'r') as f:
                content = await f.read()
                self.config = yaml.safe_load(content)
                logger.info("Configuration loaded successfully")
        except Exception as e:
            logger.error(f"Failed to load config: {e}")
            raise

    async def initialize_telegram_client(self):
        """Initialize Telegram client"""
        try:
            # Get bot credentials from config
            bot_token = self.config['telegram']['bot_token']
            api_id = self.config['telegram']['api_id']
            api_hash = self.config['telegram']['api_hash']

            self.client = TelegramClient('department_router_bot', api_id, api_hash)
            await self.client.start(bot_token=bot_token)

            logger.info("Telegram client initialized successfully")
        except Exception as e:
            logger.error(f"Failed to initialize Telegram client: {e}")
            raise

    async def initialize_matrix_session(self):
        """Initialize Matrix session for API calls"""
        try:
            self.matrix_session = aiohttp.ClientSession()
            logger.info("Matrix session initialized")
        except Exception as e:
            logger.error(f"Failed to initialize Matrix session: {e}")
            raise

    def get_department_by_id(self, dept_id: str) -> Optional[Dict]:
        """Get department configuration by ID"""
        for dept in self.config['departments']:
            if dept['id'] == dept_id:
                return dept
        return None

    def get_departments_keyboard(self) -> List[List[Button]]:
        """Create inline keyboard with department options"""
        buttons = []
        for dept in self.config['departments']:
            button_text = f"{dept['icon']} {dept['name']}"
            callback_data = f"dept_{dept['id']}"
            buttons.append([Button.inline(button_text, callback_data)])
        return buttons

    async def create_matrix_room(self, department: Dict, telegram_user: User) -> Optional[str]:
        """Create a Matrix room for the conversation"""
        try:
            homeserver = department['matrix']['homeserver']
            access_token = department['matrix']['access_token']
            bot_user_id = department['matrix']['bot_user_id']

            # Simplified room creation payload
            user_display = telegram_user.first_name or telegram_user.username or f"User_{telegram_user.id}"
            room_data = {
                "name": f"Telegram Support - {department['name']} - {user_display}",
                "topic": f"Support conversation from Telegram user {telegram_user.username or telegram_user.id}",
                "preset": "private_chat",
                "is_direct": True,
                "creation_content": {
                    "m.federate": False
                }
            }

            headers = {
                "Authorization": f"Bearer {access_token}",
                "Content-Type": "application/json"
            }

            url = f"{homeserver}/_matrix/client/v3/createRoom"

            async with self.matrix_session.post(url, json=room_data, headers=headers) as resp:
                if resp.status == 200:
                    result = await resp.json()
                    room_id = result.get('room_id')
                    logger.info(f"Created Matrix room {room_id} for department {department['id']}")

                    # Invite the department bot user separately
                    await self.invite_to_room(room_id, bot_user_id, department)

                    return room_id
                else:
                    error_text = await resp.text()
                    logger.error(f"Failed to create Matrix room: {resp.status} - {error_text}")
                    return None

        except Exception as e:
            logger.error(f"Error creating Matrix room: {e}")
            return None

    async def invite_to_room(self, room_id: str, user_id: str, department: Dict):
        """Invite a user to a Matrix room"""
        try:
            homeserver = department['matrix']['homeserver']
            access_token = department['matrix']['access_token']

            invite_data = {
                "user_id": user_id
            }

            headers = {
                "Authorization": f"Bearer {access_token}",
                "Content-Type": "application/json"
            }

            url = f"{homeserver}/_matrix/client/v3/rooms/{room_id}/invite"

            async with self.matrix_session.post(url, json=invite_data, headers=headers) as resp:
                if resp.status == 200:
                    logger.info(f"Invited {user_id} to room {room_id}")
                else:
                    error_text = await resp.text()
                    logger.error(f"Failed to invite {user_id} to room: {resp.status} - {error_text}")

        except Exception as e:
            logger.error(f"Error inviting user to room: {e}")

    async def send_matrix_message(self, room_id: str, message: str, department: Dict, telegram_user: User):
        """Send a message to Matrix room"""
        try:
            homeserver = department['matrix']['homeserver']
            access_token = department['matrix']['access_token']

            message_data = {
                "msgtype": "m.text",
                "body": f"[Telegram User: {telegram_user.first_name or 'Unknown'} (@{telegram_user.username or telegram_user.id})] {message}",
                "format": "org.matrix.custom.html",
                "formatted_body": f"<b>Telegram User:</b> {telegram_user.first_name or 'Unknown'} (@{telegram_user.username or telegram_user.id})<br/>{message}"
            }

            headers = {
                "Authorization": f"Bearer {access_token}",
                "Content-Type": "application/json"
            }

            url = f"{homeserver}/_matrix/client/v3/rooms/{room_id}/send/m.room.message"

            async with self.matrix_session.post(url, json=message_data, headers=headers) as resp:
                if resp.status == 200:
                    logger.info(f"Sent message to Matrix room {room_id}")
                else:
                    logger.error(f"Failed to send Matrix message: {resp.status}")

        except Exception as e:
            logger.error(f"Error sending Matrix message: {e}")

    async def handle_start_command(self, event, department_id: str = None):
        """Handle /start command with optional department"""
        user = await event.get_sender()
        user_id = user.id

        if department_id:
            # Direct department selection from widget
            department = self.get_department_by_id(department_id)
            if department:
                await self.select_department(event, department, user)
                return

        # Show department selection
        welcome_message = (
            f"👋 Welcome {user.first_name or 'there'}!\n\n"
            "I'm your support bot. Please select the department you'd like to contact:"
        )

        keyboard = self.get_departments_keyboard()

        await event.respond(welcome_message, buttons=keyboard)
        self.user_sessions[user_id] = {"state": "selecting_department"}

    async def select_department(self, event, department: Dict, user: User):
        """Handle department selection"""
        user_id = user.id

        # Create Matrix room for this conversation
        room_id = await self.create_matrix_room(department, user)

        if room_id:
            # Store user session
            self.user_sessions[user_id] = {
                "state": "chatting",
                "department": department,
                "matrix_room_id": room_id
            }

            # Send confirmation
            confirmation_message = (
                f"✅ Connected to {department['icon']} **{department['name']}**\n\n"
                f"{department['description']}\n\n"
                "You can now send your message and our team will respond shortly!"
            )

            await event.respond(confirmation_message)

            # Send initial message to Matrix room
            initial_message = f"New Telegram conversation started with user {user.first_name or 'Unknown'} (@{user.username or user.id})"
            await self.send_matrix_message(room_id, initial_message, department, user)
        else:
            await event.respond("❌ Sorry, I couldn't connect you to that department. Please try again later.")

    async def handle_callback_query(self, event):
        """Handle inline keyboard button presses"""
        user = await event.get_sender()
        data = event.data.decode('utf-8')

        if data.startswith('dept_'):
            department_id = data[5:]  # Remove 'dept_' prefix
            department = self.get_department_by_id(department_id)

            if department:
                await event.edit(f"Connecting you to {department['icon']} {department['name']}...")
                await self.select_department(event, department, user)
            else:
                await event.edit("❌ Department not found. Please try again.")

    async def handle_message(self, event):
        """Handle regular messages"""
        user = await event.get_sender()
        user_id = user.id
        message_text = event.message.message

        # Check if user has an active session
        if user_id in self.user_sessions:
            session = self.user_sessions[user_id]

            if session["state"] == "chatting":
                # Forward message to Matrix room
                department = session["department"]
                room_id = session["matrix_room_id"]
                await self.send_matrix_message(room_id, message_text, department, user)
                return

        # No active session, start department selection
        await self.handle_start_command(event)

    async def setup_handlers(self):
        """Setup event handlers"""
        @self.client.on(events.NewMessage(pattern='/start'))
        async def start_handler(event):
            # Parse department from command if present
            command_text = event.message.message
            parts = command_text.split(' ', 1)
            department_id = parts[1] if len(parts) > 1 else None

            await self.handle_start_command(event, department_id)

        @self.client.on(events.CallbackQuery())
        async def callback_handler(event):
            await self.handle_callback_query(event)

        @self.client.on(events.NewMessage())
        async def message_handler(event):
            # Skip if it's a command
            if event.message.message.startswith('/'):
                return

            await self.handle_message(event)

        logger.info("Event handlers setup complete")

    async def start(self):
        """Start the bot"""
        try:
            await self.load_config()
            await self.initialize_telegram_client()
            await self.initialize_matrix_session()
            await self.setup_handlers()

            logger.info("Department Router Bot is running...")
            await self.client.run_until_disconnected()

        except Exception as e:
            logger.error(f"Bot startup failed: {e}")
            raise
        finally:
            if self.matrix_session:
                await self.matrix_session.close()

async def main():
    """Main entry point"""
    config_path = os.path.join(os.path.dirname(__file__), '..', 'config', 'telegram-router.yaml')

    router = DepartmentRouter(config_path)
    await router.start()

if __name__ == "__main__":
    asyncio.run(main())