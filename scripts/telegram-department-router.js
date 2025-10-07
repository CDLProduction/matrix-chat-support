#!/usr/bin/env node

/**
 * Telegram Department Router for Matrix Chat Support Widget
 *
 * This script handles department routing for Telegram users via the mautrix-telegram bridge.
 * It listens for Telegram bot commands and creates appropriate Matrix rooms in department spaces.
 */

import TelegramBot from 'node-telegram-bot-api';
import axios from 'axios';
import yaml from 'js-yaml';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { createRequire } from 'module';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const require = createRequire(import.meta.url);

// Import CommonJS modules using require
const EventSource = require('eventsource');

// Store mapping between Telegram chats and Matrix rooms
const chatRoomMapping = new Map(); // telegramChatId -> { roomId, departmentId, userId }
const roomChatMapping = new Map(); // roomId -> telegramChatId

// Persistent storage for mappings
const MAPPINGS_FILE = '../data/chat-room-mappings.json';

// Load mappings from file
function loadMappings() {
  try {
    if (fs.existsSync(MAPPINGS_FILE)) {
      const data = JSON.parse(fs.readFileSync(MAPPINGS_FILE, 'utf8'));

      // Restore chatRoomMapping
      if (data.chatRoomMapping) {
        for (const [chatId, mapping] of Object.entries(data.chatRoomMapping)) {
          chatRoomMapping.set(parseInt(chatId), mapping);
        }
      }

      // Restore roomChatMapping
      if (data.roomChatMapping) {
        for (const [roomId, chatId] of Object.entries(data.roomChatMapping)) {
          roomChatMapping.set(roomId, parseInt(chatId));
        }
      }

      // Restore Telegram space IDs
      if (data.telegramSpaces) {
        if (data.telegramSpaces.mainSpaceId) {
          MAIN_TELEGRAM_SPACE_ID = data.telegramSpaces.mainSpaceId;
          console.log(`📂 Restored main Telegram space: ${MAIN_TELEGRAM_SPACE_ID}`);
        }

        if (data.telegramSpaces.departmentSpaces) {
          for (const [deptId, spaceId] of Object.entries(data.telegramSpaces.departmentSpaces)) {
            if (TELEGRAM_DEPARTMENT_SPACES[deptId]) {
              TELEGRAM_DEPARTMENT_SPACES[deptId].spaceId = spaceId;
              console.log(`📂 Restored ${deptId} space: ${spaceId}`);
            }
          }
        }
      }

      console.log(`📂 Loaded ${chatRoomMapping.size} chat-room mappings from storage`);
    }
  } catch (error) {
    console.error('❌ Failed to load mappings:', error.message);
  }
}

// Save mappings to file
function saveMappings() {
  try {
    // Build department spaces object
    const departmentSpaces = {};
    for (const [deptId, department] of Object.entries(TELEGRAM_DEPARTMENT_SPACES)) {
      if (department.spaceId) {
        departmentSpaces[deptId] = department.spaceId;
      }
    }

    const data = {
      chatRoomMapping: Object.fromEntries(chatRoomMapping),
      roomChatMapping: Object.fromEntries(roomChatMapping),
      telegramSpaces: {
        mainSpaceId: MAIN_TELEGRAM_SPACE_ID,
        departmentSpaces: departmentSpaces
      },
      lastUpdated: new Date().toISOString()
    };

    // Ensure data directory exists
    const dataDir = '../data';
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    fs.writeFileSync(MAPPINGS_FILE, JSON.stringify(data, null, 2));
    console.log(`💾 Saved ${chatRoomMapping.size} chat-room mappings and ${Object.keys(departmentSpaces).length} spaces to storage`);
  } catch (error) {
    console.error('❌ Failed to save mappings:', error.message);
  }
}

// Load configuration
const config = yaml.load(fs.readFileSync(path.join(__dirname, '../config/config.yaml'), 'utf8'));

// Build Telegram department spaces from config.yaml departments
const TELEGRAM_DEPARTMENT_SPACES = {};

if (config.departments && Array.isArray(config.departments)) {
  config.departments.forEach(dept => {
    // Find the Telegram command for this department from social_media config
    let command = `/start_${dept.id}`;
    if (config.social_media && Array.isArray(config.social_media)) {
      const telegramConfig = config.social_media.find(sm => sm.platform === 'telegram');
      if (telegramConfig && telegramConfig.config.departments) {
        const deptConfig = telegramConfig.config.departments.find(d => d.department_id === dept.id);
        if (deptConfig) {
          command = deptConfig.command;
        }
      }
    }

    TELEGRAM_DEPARTMENT_SPACES[dept.id] = {
      spaceId: null, // Will be created dynamically
      name: `Telegram - ${dept.name}`,
      matrixUser: dept.matrix.bot_user_id,
      departmentUsers: dept.matrix.department_users || [],
      command: command
    };
  });
  console.log(`📋 Loaded ${Object.keys(TELEGRAM_DEPARTMENT_SPACES).length} departments from config`);
} else {
  console.error('❌ No departments found in config.yaml');
  process.exit(1);
}

// Main Telegram space
let MAIN_TELEGRAM_SPACE_ID = null;

// Matrix configuration
const MATRIX_HOMESERVER = config.matrix.homeserver;
const ADMIN_ACCESS_TOKEN = config.matrix.admin_access_token;

// Telegram bot configuration
const telegramConfig = config.social_media.find(sm => sm.platform === 'telegram');
const BOT_USERNAME = telegramConfig.config.bot_username;
const bot = new TelegramBot(telegramConfig.config.bot_token, { polling: true });

// Create Telegram spaces if they don't exist
async function createTelegramSpaces() {
  console.log('🔧 Creating/ensuring Telegram spaces exist...');

  try {
    // Create main Telegram Support space (or use existing)
    if (!MAIN_TELEGRAM_SPACE_ID) {
      console.log('📝 Creating new main Telegram Support space...');
      const mainSpaceResponse = await axios.post(`${MATRIX_HOMESERVER}/_matrix/client/v3/createRoom`, {
        name: 'Telegram Support',
        topic: 'Main space for all Telegram customer support conversations',
        creation_content: { type: 'm.space' },
        power_level_content_override: {
          users: {
            '@admin:localhost': 100,
            '@support:localhost': 50,
            '@tech_support:localhost': 50,
            '@identification:localhost': 50,
            '@commerce:localhost': 50
          }
        },
        initial_state: [
          {
            type: 'm.room.history_visibility',
            content: { history_visibility: 'shared' }
          },
          {
            type: 'm.room.guest_access',
            content: { guest_access: 'can_join' }
          },
          {
            type: 'm.room.join_rules',
            content: { join_rule: 'invite' }
          }
        ]
      }, {
        headers: {
          'Authorization': `Bearer ${ADMIN_ACCESS_TOKEN}`,
          'Content-Type': 'application/json'
        }
      });

      MAIN_TELEGRAM_SPACE_ID = mainSpaceResponse.data.room_id;
      console.log(`✅ Created main Telegram Support space: ${MAIN_TELEGRAM_SPACE_ID}`);
    } else {
      console.log(`♻️  Reusing existing main Telegram Support space: ${MAIN_TELEGRAM_SPACE_ID}`);
    }

    // Create department subspaces within main Telegram space
    for (const [departmentId, department] of Object.entries(TELEGRAM_DEPARTMENT_SPACES)) {
      if (!department.spaceId) {
        console.log(`📝 Creating new department space: ${department.name}...`);
      } else {
        console.log(`♻️  Reusing existing department space: ${department.name} (${department.spaceId})`);
        continue; // Skip creation if space already exists
      }
      const subSpaceResponse = await axios.post(`${MATRIX_HOMESERVER}/_matrix/client/v3/createRoom`, {
        name: department.name,
        topic: `Telegram support space for ${department.name}`,
        creation_content: { type: 'm.space' },
        power_level_content_override: {
          users: {
            '@admin:localhost': 100,
            [department.matrixUser]: 60
          }
        },
        initial_state: [
          {
            type: 'm.room.history_visibility',
            content: { history_visibility: 'shared' }
          },
          {
            type: 'm.room.guest_access',
            content: { guest_access: 'can_join' }
          },
          {
            type: 'm.room.join_rules',
            content: { join_rule: 'invite' }
          }
        ]
      }, {
        headers: {
          'Authorization': `Bearer ${ADMIN_ACCESS_TOKEN}`,
          'Content-Type': 'application/json'
        }
      });

      department.spaceId = subSpaceResponse.data.room_id;
      console.log(`✅ Created department space: ${department.name} (${department.spaceId})`);

      // Add department space as child of main Telegram space
      await axios.put(`${MATRIX_HOMESERVER}/_matrix/client/v3/rooms/${MAIN_TELEGRAM_SPACE_ID}/state/m.space.child/${department.spaceId}`, {
        via: ['localhost'],
        suggested: true,
        order: departmentId
      }, {
        headers: {
          'Authorization': `Bearer ${ADMIN_ACCESS_TOKEN}`,
          'Content-Type': 'application/json'
        }
      });

      // Set parent relationship
      await axios.put(`${MATRIX_HOMESERVER}/_matrix/client/v3/rooms/${department.spaceId}/state/m.space.parent/${MAIN_TELEGRAM_SPACE_ID}`, {
        via: ['localhost'],
        canonical: true
      }, {
        headers: {
          'Authorization': `Bearer ${ADMIN_ACCESS_TOKEN}`,
          'Content-Type': 'application/json'
        }
      });
    }
  } catch (error) {
    console.error('❌ Error creating Telegram spaces:', error.message);
  }
}

// Ensure all department users are invited to their spaces
async function ensureDepartmentUsersInSpaces() {
  console.log('🔧 Ensuring department users are invited to their spaces...');

  for (const [departmentId, department] of Object.entries(TELEGRAM_DEPARTMENT_SPACES)) {
    // Find the department config to get access token
    const deptConfig = config.departments.find(d => d.id === departmentId);
    if (!deptConfig) {
      console.log(`⚠️  Department ${departmentId} not found in config`);
      continue;
    }

    // Invite all department users to the space
    const usersToInvite = department.departmentUsers || [];
    if (usersToInvite.length === 0) {
      console.log(`⚠️  No users configured for ${department.name}`);
      continue;
    }

    for (const userId of usersToInvite) {
      try {
        // Invite the user to the space using admin token
        await axios.post(`${MATRIX_HOMESERVER}/_matrix/client/v3/rooms/${department.spaceId}/invite`, {
          user_id: userId
        }, {
          headers: {
            'Authorization': `Bearer ${ADMIN_ACCESS_TOKEN}`,
            'Content-Type': 'application/json'
          }
        });
        console.log(`📧 Invited ${userId} to space ${department.name}`);

        // Auto-join using the department's access token (first user's token)
        if (userId === deptConfig.matrix.bot_user_id) {
          try {
            await axios.post(`${MATRIX_HOMESERVER}/_matrix/client/v3/rooms/${department.spaceId}/join`, {}, {
              headers: {
                'Authorization': `Bearer ${deptConfig.matrix.access_token}`,
                'Content-Type': 'application/json'
              }
            });
            console.log(`✅ ${userId} joined space ${department.name}`);
          } catch (joinError) {
            console.log(`ℹ️  ${userId} join to ${department.name}: ${joinError.response?.data?.errcode || 'already joined'}`);
          }
        }
      } catch (error) {
        console.log(`ℹ️  ${userId} invitation to ${department.name}: ${error.response?.data?.errcode || 'OK'}`);
      }
    }
  }
}

// Create Telegram spaces and invite users
async function initializeTelegramSpaces() {
  // Load existing mappings and spaces first
  loadMappings();

  // Create or ensure spaces exist
  await createTelegramSpaces();
  await ensureDepartmentUsersInSpaces();

  // Save updated spaces
  saveMappings();
}

// Run space setup
initializeTelegramSpaces();

console.log('🤖 Telegram Department Router started');
console.log('📱 Bot username:', telegramConfig.config.bot_username);
console.log('🏠 Matrix homeserver:', MATRIX_HOMESERVER);

/**
 * Create a Matrix room in a specific department space
 */
async function createDepartmentRoom(departmentId, telegramUser, telegramChatId) {
  const department = TELEGRAM_DEPARTMENT_SPACES[departmentId];
  if (!department) {
    throw new Error(`Unknown department: ${departmentId}`);
  }

  const roomName = `Telegram Chat - ${telegramUser.first_name || telegramUser.username || telegramChatId}`;
  const roomTopic = `Support chat with Telegram user @${telegramUser.username || telegramUser.first_name} (${telegramChatId})`;

  try {
    // Prepare list of users to invite during room creation
    const usersToInvite = department.departmentUsers || [department.matrixUser];

    // Build power levels for all department users
    const powerLevelUsers = {
      '@admin:localhost': 100
    };
    usersToInvite.forEach(userId => {
      powerLevelUsers[userId] = 50;
    });

    // Create room in Matrix - invite ALL department users from the start
    const roomResponse = await axios.post(`${MATRIX_HOMESERVER}/_matrix/client/v3/createRoom`, {
      name: roomName,
      topic: roomTopic,
      visibility: 'private',
      preset: 'private_chat',
      invite: usersToInvite,  // Invite ALL department users at room creation
      initial_state: [{
        type: 'm.room.power_levels',
        content: {
          users: powerLevelUsers
        }
      }]
    }, {
      headers: {
        'Authorization': `Bearer ${ADMIN_ACCESS_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });

    const roomId = roomResponse.data.room_id;
    console.log(`✅ Created room ${roomId} for ${telegramUser.username || telegramChatId} in ${department.name}`);

    // Add room to department space
    await axios.put(`${MATRIX_HOMESERVER}/_matrix/client/v3/rooms/${department.spaceId}/state/m.space.child/${roomId}`, {
      via: ['localhost'],
      suggested: true,
      order: new Date().getTime().toString()
    }, {
      headers: {
        'Authorization': `Bearer ${ADMIN_ACCESS_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });

    // Also set the parent space relationship
    await axios.put(`${MATRIX_HOMESERVER}/_matrix/client/v3/rooms/${roomId}/state/m.space.parent/${department.spaceId}`, {
      via: ['localhost'],
      canonical: true
    }, {
      headers: {
        'Authorization': `Bearer ${ADMIN_ACCESS_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });

    // Users already invited during room creation, now ensure they're in the department space
    console.log(`📧 Ensuring ${usersToInvite.length} department users are in space ${department.name}...`);

    for (const userId of usersToInvite) {
      try {
        await axios.post(`${MATRIX_HOMESERVER}/_matrix/client/v3/rooms/${department.spaceId}/invite`, {
          user_id: userId
        }, {
          headers: {
            'Authorization': `Bearer ${ADMIN_ACCESS_TOKEN}`,
            'Content-Type': 'application/json'
          }
        });
        console.log(`  ✅ Invited ${userId} to space ${department.name}`);
      } catch (spaceInviteError) {
        // User might already be in space, that's okay
        if (!spaceInviteError.response?.data?.errcode?.includes('M_FORBIDDEN')) {
          console.log(`  ℹ️  ${userId} already in space ${department.name}`);
        }
      }
    }

    // Invite observer user if configured (read-only access)
    if (config.observer && config.observer.enabled && config.observer.auto_invite) {
      try {
        // Invite observer to the room
        await axios.post(`${MATRIX_HOMESERVER}/_matrix/client/v3/rooms/${roomId}/invite`, {
          user_id: config.observer.user_id
        }, {
          headers: {
            'Authorization': `Bearer ${ADMIN_ACCESS_TOKEN}`,
            'Content-Type': 'application/json'
          }
        });

        // Set read-only permissions for observer
        // Get current power levels
        const powerLevelsResponse = await axios.get(
          `${MATRIX_HOMESERVER}/_matrix/client/v3/rooms/${roomId}/state/m.room.power_levels/`,
          {
            headers: { 'Authorization': `Bearer ${ADMIN_ACCESS_TOKEN}` }
          }
        );

        const powerLevels = powerLevelsResponse.data;
        powerLevels.users = powerLevels.users || {};
        powerLevels.users[config.observer.user_id] = 0;  // Observer has level 0
        powerLevels.events_default = 50;  // Requires level 50 to send messages

        // Update power levels
        await axios.put(
          `${MATRIX_HOMESERVER}/_matrix/client/v3/rooms/${roomId}/state/m.room.power_levels/`,
          powerLevels,
          {
            headers: {
              'Authorization': `Bearer ${ADMIN_ACCESS_TOKEN}`,
              'Content-Type': 'application/json'
            }
          }
        );

        console.log(`👁️  Observer invited to room ${roomId} (read-only)`);
      } catch (observerError) {
        console.error('⚠️  Failed to invite observer:', observerError.response?.data || observerError.message);
      }
    }

    console.log(`🏢 Added room to ${department.name} space`);

    return {
      roomId,
      departmentName: department.name,
      spaceId: department.spaceId
    };

  } catch (error) {
    console.error('❌ Error creating department room:', error.response?.data || error.message);
    throw error;
  }
}

/**
 * Send welcome message and department selection
 */
async function sendWelcomeMessage(chatId) {
  // Build dynamic welcome message from configured departments
  let welcomeMessage = `🎧 *Welcome to Customer Support!*\n\nPlease select the department that best matches your needs:\n`;

  // Add each department dynamically
  const departments = config.departments || [];
  departments.forEach(dept => {
    const command = TELEGRAM_DEPARTMENT_SPACES[dept.id]?.command || `/start_${dept.id}`;
    const icon = dept.icon || '🎧';
    welcomeMessage += `\n${icon} *${dept.name}*\n${dept.description || ''}\nCommand: ${command}\n`;
  });

  welcomeMessage += `\nJust tap one of the buttons below or type a command to get started!`;

  // Build inline keyboard buttons dynamically
  const inlineKeyboard = [];
  let currentRow = [];

  departments.forEach((dept, index) => {
    const icon = dept.icon || '🎧';
    currentRow.push({
      text: `${icon} ${dept.name}`,
      callback_data: `dept_${dept.id}`
    });

    // Create rows of 2 buttons each
    if (currentRow.length === 2 || index === departments.length - 1) {
      inlineKeyboard.push([...currentRow]);
      currentRow = [];
    }
  });

  await bot.sendMessage(chatId, welcomeMessage, {
    reply_markup: {
      inline_keyboard: inlineKeyboard
    }
  });
}

/**
 * Verify room still exists and is accessible
 */
async function verifyRoomAccess(roomId) {
  try {
    // Simple check to verify room exists and is accessible
    await axios.get(`${MATRIX_HOMESERVER}/_matrix/client/v3/rooms/${roomId}/state`, {
      headers: {
        'Authorization': `Bearer ${ADMIN_ACCESS_TOKEN}`
      }
    });
    return true;
  } catch (error) {
    console.error(`❌ Room ${roomId} is not accessible:`, error.response?.data || error.message);
    return false;
  }
}

/**
 * Handle department selection
 */
async function handleDepartmentSelection(departmentId, telegramUser, chatId) {
  try {
    const department = TELEGRAM_DEPARTMENT_SPACES[departmentId];

    // Check if this user already has an existing room mapping
    const existingMapping = chatRoomMapping.get(chatId);

    if (existingMapping && existingMapping.roomId) {
      // User is returning to an existing conversation
      console.log(`🔄 User ${telegramUser.username || chatId} returning to existing room ${existingMapping.roomId}`);

      // Verify room is still accessible
      const roomAccessible = await verifyRoomAccess(existingMapping.roomId);

      if (roomAccessible) {
        // Ensure all department users are invited (fix for rooms created before multi-user fix)
        const usersToInvite = department.departmentUsers || [department.matrixUser];
        console.log(`🔧 Ensuring ${usersToInvite.length} department users are in room ${existingMapping.roomId}...`);

        for (const userId of usersToInvite) {
          try {
            await axios.post(`${MATRIX_HOMESERVER}/_matrix/client/v3/rooms/${existingMapping.roomId}/invite`, {
              user_id: userId
            }, {
              headers: {
                'Authorization': `Bearer ${ADMIN_ACCESS_TOKEN}`,
                'Content-Type': 'application/json'
              }
            });
            console.log(`  ✅ Invited ${userId} to room`);
          } catch (inviteError) {
            // User might already be in room, that's okay
            if (inviteError.response?.data?.errcode === 'M_FORBIDDEN' || inviteError.response?.data?.error?.includes('already in the room')) {
              console.log(`  ℹ️  ${userId} already in room`);
            } else {
              console.warn(`  ⚠️  Failed to invite ${userId}:`, inviteError.response?.data?.error || inviteError.message);
            }
          }

          // Also ensure user is in department space
          try {
            await axios.post(`${MATRIX_HOMESERVER}/_matrix/client/v3/rooms/${department.spaceId}/invite`, {
              user_id: userId
            }, {
              headers: {
                'Authorization': `Bearer ${ADMIN_ACCESS_TOKEN}`,
                'Content-Type': 'application/json'
              }
            });
            console.log(`  ✅ Invited ${userId} to space`);
          } catch (spaceError) {
            if (spaceError.response?.data?.errcode === 'M_FORBIDDEN' || spaceError.response?.data?.error?.includes('already in the room')) {
              console.log(`  ℹ️  ${userId} already in space`);
            }
          }
        }

        // Also invite observer if configured
        if (config.observer && config.observer.enabled && config.observer.auto_invite) {
          try {
            await axios.post(`${MATRIX_HOMESERVER}/_matrix/client/v3/rooms/${existingMapping.roomId}/invite`, {
              user_id: config.observer.user_id
            }, {
              headers: {
                'Authorization': `Bearer ${ADMIN_ACCESS_TOKEN}`,
                'Content-Type': 'application/json'
              }
            });
            console.log(`  👁️  Invited observer to room`);
          } catch (observerError) {
            if (!observerError.response?.data?.error?.includes('already in the room')) {
              console.warn(`  ⚠️  Failed to invite observer:`, observerError.response?.data?.error);
            }
          }
        }

        // Simply reconnect without showing history (both sides already have it)
        await bot.sendMessage(chatId, `
✅ **Reconnected to ${department.name}**

Your conversation has been restored. You can continue chatting with our support team.
`, { parse_mode: 'Markdown' });

        console.log(`✅ Reconnected user to existing room ${existingMapping.roomId}`);

        return {
          roomId: existingMapping.roomId,
          departmentName: department.name,
          spaceId: department.spaceId
        };
      } else {
        // Room no longer accessible, clear mapping and create new room
        console.log(`⚠️  Room ${existingMapping.roomId} no longer accessible, creating new room`);
        chatRoomMapping.delete(chatId);
        roomChatMapping.delete(existingMapping.roomId);
        saveMappings();
        // Fall through to create new room
      }
    }

    // New conversation - create room
    await bot.sendMessage(chatId, `
✅ **Connected to ${department.name}**

Your conversation is now being handled by our ${department.name} team. A support representative will be with you shortly.

You can now send your messages directly, and they will be forwarded to our support team on Matrix.
`, { parse_mode: 'Markdown' });

    // Create Matrix room for this conversation
    const roomInfo = await createDepartmentRoom(departmentId, telegramUser, chatId);

    // Send initial message to Matrix room
    await axios.put(`${MATRIX_HOMESERVER}/_matrix/client/v3/rooms/${roomInfo.roomId}/send/m.room.message/${Date.now()}`, {
      msgtype: 'm.notice',
      body: `New Telegram conversation started\nUser: ${telegramUser.first_name || ''} ${telegramUser.last_name || ''} (@${telegramUser.username || 'N/A'})\nTelegram ID: ${chatId}\nDepartment: ${department.name}`
    }, {
      headers: {
        'Authorization': `Bearer ${ADMIN_ACCESS_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });

    // Store mapping for message forwarding
    chatRoomMapping.set(chatId, {
      roomId: roomInfo.roomId,
      departmentId: departmentId,
      userId: telegramUser.id,
      username: telegramUser.username || telegramUser.first_name || chatId
    });

    // Store reverse mapping for Matrix-to-Telegram forwarding
    roomChatMapping.set(roomInfo.roomId, chatId);

    // Save mappings to persistent storage
    saveMappings();

    console.log(`🎯 User ${telegramUser.username || chatId} connected to ${department.name}`);

    return roomInfo;

  } catch (error) {
    console.error('❌ Error handling department selection:', error);
    await bot.sendMessage(chatId, '❌ Sorry, there was an error connecting you to support. Please try again.');
  }
}

// Bot command handlers
bot.onText(/\/start/, async (msg) => {
  await sendWelcomeMessage(msg.chat.id);
});

bot.onText(/\/help/, async (msg) => {
  await sendWelcomeMessage(msg.chat.id);
});

// Department command handlers
Object.values(TELEGRAM_DEPARTMENT_SPACES).forEach(dept => {
  bot.onText(new RegExp(dept.command), async (msg) => {
    const departmentId = Object.keys(TELEGRAM_DEPARTMENT_SPACES).find(key =>
      TELEGRAM_DEPARTMENT_SPACES[key].command === dept.command
    );
    await handleDepartmentSelection(departmentId, msg.from, msg.chat.id);
  });
});

// Inline keyboard callbacks
bot.on('callback_query', async (callbackQuery) => {
  const message = callbackQuery.message;
  const data = callbackQuery.data;

  if (data.startsWith('dept_')) {
    const departmentId = data.replace('dept_', '');
    await handleDepartmentSelection(departmentId, callbackQuery.from, message.chat.id);

    // Answer the callback query
    await bot.answerCallbackQuery(callbackQuery.id);
  }
});

// Handle regular messages for bridging
bot.on('message', async (msg) => {
  // Skip if it's a command (already handled by onText handlers)
  if (msg.text && msg.text.startsWith('/')) {
    return;
  }

  // Skip if it's a callback query response
  if (msg.reply_to_message) {
    return;
  }

  const chatId = msg.chat.id;
  const mapping = chatRoomMapping.get(chatId);

  if (mapping && msg.text) {
    // Forward message to Matrix room
    try {
      await axios.put(`${MATRIX_HOMESERVER}/_matrix/client/v3/rooms/${mapping.roomId}/send/m.room.message/${Date.now()}`, {
        msgtype: 'm.text',
        body: msg.text,
        format: 'org.matrix.custom.html',
        formatted_body: `<strong>${mapping.username}:</strong> ${msg.text}`
      }, {
        headers: {
          'Authorization': `Bearer ${ADMIN_ACCESS_TOKEN}`,
          'Content-Type': 'application/json'
        }
      });

      console.log(`📨 Forwarded message from ${mapping.username} to Matrix room ${mapping.roomId}`);
    } catch (error) {
      console.error('❌ Error forwarding message to Matrix:', error.response?.data || error.message);
    }
  }
});

// Track start time to prevent processing historical messages
const ROUTER_START_TIME = Date.now();
const processedMessages = new Set(); // Prevent duplicate processing

// Matrix Event Stream for Matrix-to-Telegram bridging
async function startMatrixEventStream() {
  try {
    // Get initial sync token and skip historical messages
    const syncResponse = await axios.get(`${MATRIX_HOMESERVER}/_matrix/client/v3/sync?filter={"room":{"timeline":{"limit":0}}}`, {
      headers: {
        'Authorization': `Bearer ${ADMIN_ACCESS_TOKEN}`
      }
    });

    let nextBatch = syncResponse.data.next_batch;
    console.log('🔄 Starting Matrix event stream (only new messages)...');

    // Start long polling for new events
    setInterval(async () => {
      try {
        const syncResponse = await axios.get(`${MATRIX_HOMESERVER}/_matrix/client/v3/sync?since=${nextBatch}&timeout=30000`, {
          headers: {
            'Authorization': `Bearer ${ADMIN_ACCESS_TOKEN}`
          },
          timeout: 35000
        });

        nextBatch = syncResponse.data.next_batch;

        // Process room events
        if (syncResponse.data.rooms && syncResponse.data.rooms.join) {
          for (const [roomId, roomData] of Object.entries(syncResponse.data.rooms.join)) {
            if (roomData.timeline && roomData.timeline.events) {
              for (const event of roomData.timeline.events) {
                if (event.type === 'm.room.message' && event.content && event.content.msgtype === 'm.text') {
                  // Only process messages newer than router start time
                  if (event.origin_server_ts > ROUTER_START_TIME) {
                    // Prevent duplicate processing
                    if (!processedMessages.has(event.event_id)) {
                      processedMessages.add(event.event_id);
                      await handleMatrixMessage(roomId, event);
                    }
                  }
                }
              }
            }
          }
        }
      } catch (error) {
        if (error.code !== 'ECONNABORTED') {
          console.error('❌ Matrix sync error:', error.message);
        }
      }
    }, 5000); // Reduced frequency to 5 seconds

  } catch (error) {
    console.error('❌ Failed to start Matrix event stream:', error.message);
  }
}

// Handle Matrix messages and forward to Telegram
async function handleMatrixMessage(roomId, event) {
  const telegramChatId = roomChatMapping.get(roomId);

  if (!telegramChatId) {
    return; // No Telegram chat mapped to this room
  }

  // Enhanced filtering to prevent spam and loops
  const sender = event.sender;
  const messageBody = event.content.body;

  // Skip bot messages, system messages, and our own messages
  if (
    sender.includes('telegram_') ||
    sender.includes(BOT_USERNAME.toLowerCase()) ||
    sender === '@admin:localhost' ||
    messageBody.includes('New Telegram conversation started') ||
    messageBody.includes('User:') ||
    messageBody.includes('Telegram ID:') ||
    messageBody.includes('Department:') ||
    event.content.msgtype === 'm.notice'
  ) {
    return;
  }

  try {
    const senderName = sender.replace('@', '').replace(':localhost', '');

    // Simple message format - no special formatting to avoid issues
    const message = `${senderName}: ${messageBody}`;

    await bot.sendMessage(telegramChatId, message);
    console.log(`📨 Forwarded Matrix message from ${senderName} to Telegram chat ${telegramChatId}`);
  } catch (error) {
    console.error('❌ Error forwarding Matrix message to Telegram:', error.message);
  }
}

// Error handling
bot.on('error', (error) => {
  console.error('🚨 Telegram Bot Error:', error);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('🛑 Shutting down Telegram Department Router...');
  saveMappings();
  bot.stopPolling();
  process.exit(0);
});

console.log('🤖 Telegram Department Router started');
console.log(`📱 Bot username: ${BOT_USERNAME}`);
console.log(`🏠 Matrix homeserver: ${MATRIX_HOMESERVER}`);
console.log('🚀 Department Router is ready to handle Telegram users!');

// Start Matrix event stream for bidirectional messaging
startMatrixEventStream();