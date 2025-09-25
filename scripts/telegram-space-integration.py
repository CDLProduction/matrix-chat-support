#!/usr/bin/env python3
"""
Telegram Space Integration

Integrates Telegram bot with Matrix Spaces architecture for proper organization.
Creates rooms within the appropriate Telegram spaces based on department selection.
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

class TelegramSpaceIntegration:
    def __init__(self, config_path: str, spaces_config_path: str):
        self.config_path = config_path
        self.spaces_config_path = spaces_config_path
        self.config = None
        self.spaces_config = None
        self.client = None
        self.matrix_session = None
        self.user_sessions = {}  # Track user states
        self.space_cache = {}  # Cache space IDs

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

            self.client = TelegramClient('telegram_space_integration', api_id, api_hash)
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

    async def ensure_telegram_space_hierarchy(self) -> str:
        """Ensure Telegram space hierarchy exists and return Telegram space ID"""
        try:
            # Check if we have cached space IDs
            if 'telegram' in self.space_cache:
                return self.space_cache['telegram']

            # First, ensure root space exists
            root_space_id = await self.ensure_root_space()

            # Then create/get Telegram space
            telegram_space_id = await self.ensure_telegram_space(root_space_id)

            self.space_cache['telegram'] = telegram_space_id
            return telegram_space_id

        except Exception as e:
            logger.error(f"Failed to ensure Telegram space hierarchy: {e}")
            raise

    async def ensure_root_space(self) -> str:
        """Ensure root space exists"""
        try:
            # Use admin credentials to create/get root space
            admin_token = self.config['departments'][0]['matrix']['access_token']  # Use first department's admin token
            homeserver = self.config['departments'][0]['matrix']['homeserver']

            # Try to get existing root space from spaces config
            root_config = self.spaces_config['spaces']['rootSpace']

            room_data = {
                "name": root_config['name'],
                "topic": root_config['topic'],
                "preset": "private_chat",
                "creation_content": {
                    "type": "m.space"
                }
            }

            headers = {
                "Authorization": f"Bearer {admin_token}",
                "Content-Type": "application/json"
            }

            url = f"{homeserver}/_matrix/client/v3/createRoom"

            async with self.matrix_session.post(url, json=room_data, headers=headers) as resp:
                if resp.status == 200:
                    result = await resp.json()
                    space_id = result.get('room_id')
                    logger.info(f"Created/ensured root space: {space_id}")
                    return space_id
                else:
                    error_text = await resp.text()
                    logger.error(f"Failed to create root space: {resp.status} - {error_text}")
                    raise Exception(f"Failed to create root space: {resp.status}")

        except Exception as e:
            logger.error(f"Error ensuring root space: {e}")
            raise

    async def ensure_telegram_space(self, root_space_id: str) -> str:
        """Ensure Telegram communication channel space exists"""
        try:
            # Use admin credentials
            admin_token = self.config['departments'][0]['matrix']['access_token']
            homeserver = self.config['departments'][0]['matrix']['homeserver']

            # Get Telegram space config
            telegram_config = None
            for channel in self.spaces_config['spaces']['communicationChannels']:
                if channel['id'] == 'telegram':
                    telegram_config = channel
                    break

            if not telegram_config:
                raise Exception("Telegram space configuration not found")

            room_data = {
                "name": telegram_config['name'],
                "topic": telegram_config['topic'],
                "preset": "private_chat",
                "creation_content": {
                    "type": "m.space"
                }
            }

            headers = {
                "Authorization": f"Bearer {admin_token}",
                "Content-Type": "application/json"
            }

            url = f"{homeserver}/_matrix/client/v3/createRoom"

            async with self.matrix_session.post(url, json=room_data, headers=headers) as resp:
                if resp.status == 200:
                    result = await resp.json()
                    space_id = result.get('room_id')
                    logger.info(f"Created/ensured Telegram space: {space_id}")

                    # Add Telegram space to root space
                    await self.add_space_to_parent(space_id, root_space_id, admin_token, homeserver)

                    return space_id
                else:
                    error_text = await resp.text()
                    logger.error(f"Failed to create Telegram space: {resp.status} - {error_text}")
                    raise Exception(f"Failed to create Telegram space: {resp.status}")

        except Exception as e:
            logger.error(f"Error ensuring Telegram space: {e}")
            raise

    async def add_space_to_parent(self, child_space_id: str, parent_space_id: str, access_token: str, homeserver: str):
        """Add child space to parent space"""
        try:
            headers = {
                "Authorization": f"Bearer {access_token}",
                "Content-Type": "application/json"
            }

            state_data = {
                "via": ["localhost"],
                "order": str(int(asyncio.get_event_loop().time() * 1000))
            }

            url = f"{homeserver}/_matrix/client/v3/rooms/{parent_space_id}/state/m.space.child/{child_space_id}"

            async with self.matrix_session.put(url, json=state_data, headers=headers) as resp:
                if resp.status == 200:
                    logger.info(f"Added space {child_space_id} to parent {parent_space_id}")
                else:
                    error_text = await resp.text()
                    logger.warning(f"Failed to add space to parent: {resp.status} - {error_text}")

        except Exception as e:
            logger.error(f"Error adding space to parent: {e}")

    async def create_telegram_room_in_space(self, department: Dict, telegram_user: User) -> Optional[str]:
        """Create a Matrix room within the Telegram space"""
        try:
            homeserver = department['matrix']['homeserver']
            access_token = department['matrix']['access_token']
            bot_user_id = department['matrix']['bot_user_id']

            # Ensure Telegram space exists
            telegram_space_id = await self.ensure_telegram_space_hierarchy()

            # Create room name following the pattern
            user_display = telegram_user.first_name or telegram_user.username or f"User_{telegram_user.id}"
            conversation_id = f"tg{telegram_user.id}"

            room_name = f"{user_display} (Telegram) - {department['name']} #{conversation_id}"

            room_data = {
                "name": room_name,
                "topic": f"Telegram conversation with {telegram_user.username or telegram_user.id} - {department['name']}",
                "preset": "private_chat",
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
                    logger.info(f"Created Matrix room {room_id} for Telegram user {telegram_user.id}")

                    # Add room to Telegram space
                    await self.add_room_to_space(room_id, telegram_space_id, access_token, homeserver)

                    # Invite support users to the room
                    await self.invite_support_users_to_room(room_id, department, homeserver, access_token)

                    return room_id
                else:
                    error_text = await resp.text()
                    logger.error(f"Failed to create Matrix room: {resp.status} - {error_text}")
                    return None

        except Exception as e:
            logger.error(f"Error creating Telegram room in space: {e}")
            return None

    async def add_room_to_space(self, room_id: str, space_id: str, access_token: str, homeserver: str):
        """Add room to space"""
        try:
            headers = {
                "Authorization": f"Bearer {access_token}",
                "Content-Type": "application/json"
            }

            state_data = {
                "via": ["localhost"],
                "order": str(int(asyncio.get_event_loop().time() * 1000))
            }

            url = f"{homeserver}/_matrix/client/v3/rooms/{space_id}/state/m.space.child/{room_id}"

            async with self.matrix_session.put(url, json=state_data, headers=headers) as resp:
                if resp.status == 200:
                    logger.info(f"Added room {room_id} to Telegram space {space_id}")
                else:
                    error_text = await resp.text()
                    logger.warning(f"Failed to add room to space: {resp.status} - {error_text}")

        except Exception as e:
            logger.error(f"Error adding room to space: {e}")

    async def invite_support_users_to_room(self, room_id: str, department: Dict, homeserver: str, access_token: str):
        """Invite support users to the room"""
        try:
            support_users = department['matrix'].get('support_users', [])

            for user_id in support_users:
                # Skip if it's the bot user (already in room as creator)
                if user_id == department['matrix']['bot_user_id']:
                    continue

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
                        logger.warning(f"Failed to invite {user_id} to room: {resp.status} - {error_text}")

        except Exception as e:
            logger.error(f"Error inviting support users to room: {e}")

    async def get_or_create_telegram_ghost(self, telegram_user: User, homeserver: str, access_token: str):
        """Create or get Matrix ghost user for Telegram user"""
        try:
            # Generate Matrix user ID for Telegram user
            ghost_user_id = f"@telegram_{telegram_user.id}:localhost"
            user_display = telegram_user.first_name or f"Telegram User {telegram_user.id}"

            # Check if user already exists by trying to get profile
            url = f"{homeserver}/_matrix/client/v3/profile/{ghost_user_id}"
            headers = {"Authorization": f"Bearer {access_token}"}

            async with self.matrix_session.get(url, headers=headers) as resp:
                if resp.status == 200:
                    return ghost_user_id  # User already exists

            # User doesn't exist, we'll use the formatted message approach
            # Creating actual Matrix users would require admin privileges
            return None

        except Exception as e:
            logger.debug(f"Ghost user creation/check failed: {e}")
            return None

    async def send_matrix_message(self, room_id: str, message: str, department: Dict, telegram_user: User):
        """Send a message to Matrix room"""
        try:
            homeserver = department['matrix']['homeserver']
            access_token = department['matrix']['access_token']

            user_display = telegram_user.first_name or 'Unknown'
            username = telegram_user.username or str(telegram_user.id)

            message_data = {
                "msgtype": "m.text",
                "body": f"**{user_display}** (@{username}):\n{message}",
                "format": "org.matrix.custom.html",
                "formatted_body": f"""
                <div style="border-left: 3px solid #0088cc; padding-left: 10px; margin: 5px 0;">
                    <strong style="color: #0088cc;">📱 {user_display}</strong>
                    <small style="color: #666;">(@{username})</small>
                    <br/>
                    <div style="margin-top: 5px;">{message}</div>
                </div>
                """.strip()
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

        # Create Matrix room in Telegram space
        room_id = await self.create_telegram_room_in_space(department, user)

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
                "You can now send your message and our team will respond shortly!\n\n"
                f"📍 Your conversation is organized in the **Telegram Support Space**"
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
        """Start the integration"""
        try:
            await self.load_configs()
            await self.initialize_telegram_client()
            await self.initialize_matrix_session()
            await self.setup_handlers()

            logger.info("Telegram Space Integration is running...")
            await self.client.run_until_disconnected()

        except Exception as e:
            logger.error(f"Integration startup failed: {e}")
            raise
        finally:
            if self.matrix_session:
                await self.matrix_session.close()

async def main():
    """Main entry point"""
    config_path = os.path.join(os.path.dirname(__file__), '..', 'config', 'telegram-router.yaml')
    spaces_config_path = os.path.join(os.path.dirname(__file__), '..', 'config', 'spaces.yaml')

    integration = TelegramSpaceIntegration(config_path, spaces_config_path)
    await integration.start()

if __name__ == "__main__":
    asyncio.run(main())