#!/usr/bin/env node

/**
 * Telegram Department Router for Matrix Chat Support Widget
 *
 * This script handles department routing for Telegram users via the mautrix-telegram bridge.
 * It listens for Telegram bot commands and creates appropriate Matrix rooms in department spaces.
 */

const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');
const yaml = require('js-yaml');
const fs = require('fs');
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

      console.log(`📂 Loaded ${chatRoomMapping.size} chat-room mappings from storage`);
    }
  } catch (error) {
    console.error('❌ Failed to load mappings:', error.message);
  }
}

// Save mappings to file
function saveMappings() {
  try {
    const data = {
      chatRoomMapping: Object.fromEntries(chatRoomMapping),
      roomChatMapping: Object.fromEntries(roomChatMapping),
      lastUpdated: new Date().toISOString()
    };

    // Ensure data directory exists
    const dataDir = '../data';
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    fs.writeFileSync(MAPPINGS_FILE, JSON.stringify(data, null, 2));
    console.log(`💾 Saved ${chatRoomMapping.size} chat-room mappings to storage`);
  } catch (error) {
    console.error('❌ Failed to save mappings:', error.message);
  }
}

// Load configuration
const config = yaml.load(fs.readFileSync('../config/config.yaml', 'utf8'));

// Telegram-specific department space mapping
const TELEGRAM_DEPARTMENT_SPACES = {
  'support': {
    spaceId: null, // Will be created dynamically
    name: 'Telegram - General Support',
    matrixUser: '@support:localhost',
    command: '/start_support'
  },
  'tech_support': {
    spaceId: null, // Will be created dynamically
    name: 'Telegram - Tech Support',
    matrixUser: '@tech_support:localhost',
    command: '/start_tech'
  },
  'identification': {
    spaceId: null, // Will be created dynamically
    name: 'Telegram - Account Verification',
    matrixUser: '@identification:localhost',
    command: '/start_id'
  },
  'commerce': {
    spaceId: null, // Will be created dynamically
    name: 'Telegram - Sales & Commerce',
    matrixUser: '@commerce:localhost',
    command: '/start_commerce'
  }
};

// Main Telegram space
let MAIN_TELEGRAM_SPACE_ID = null;

// Matrix configuration
const MATRIX_HOMESERVER = config.matrix.homeserver;
const ADMIN_ACCESS_TOKEN = config.matrix.admin_access_token;

// Telegram bot configuration
const telegramConfig = config.social_media.find(sm => sm.platform === 'telegram');
const BOT_USERNAME = telegramConfig.config.bot_username;
const bot = new TelegramBot(telegramConfig.config.bot_token, { polling: true });

// Load existing mappings on startup
loadMappings();

// Create Telegram spaces if they don't exist
async function createTelegramSpaces() {
  console.log('🔧 Creating/ensuring Telegram spaces exist...');

  try {
    // Create main Telegram Support space
    if (!MAIN_TELEGRAM_SPACE_ID) {
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
    }

    // Create department subspaces within main Telegram space
    for (const [departmentId, department] of Object.entries(TELEGRAM_DEPARTMENT_SPACES)) {
      if (!department.spaceId) {
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
    }
  } catch (error) {
    console.error('❌ Error creating Telegram spaces:', error.message);
  }
}

// Ensure all department users are invited to their spaces
async function ensureDepartmentUsersInSpaces() {
  console.log('🔧 Ensuring department users are invited to their spaces...');

  for (const [departmentId, department] of Object.entries(TELEGRAM_DEPARTMENT_SPACES)) {
    try {
      // First invite the user to the space
      await axios.post(`${MATRIX_HOMESERVER}/_matrix/client/v3/rooms/${department.spaceId}/invite`, {
        user_id: department.matrixUser
      }, {
        headers: {
          'Authorization': `Bearer ${ADMIN_ACCESS_TOKEN}`,
          'Content-Type': 'application/json'
        }
      });
      console.log(`📧 Invited ${department.matrixUser} to space ${department.name}`);

      // Then auto-join them to the space (this requires the user's own token)
      const userTokenMap = {
        '@support:localhost': 'syt_c3VwcG9ydA_WuQVgMMyWokphzuvinDp_3qbzPn',
        '@tech_support:localhost': 'syt_dGVjaF9zdXBwb3J0_oxoDhiLmLaVQbuQeSOzb_4FaQ5b',
        '@identification:localhost': 'syt_aWRlbnRpZmljYXRpb24_eJHwCqgZbYIKjOEvVLQR_1z3PGG',
        '@commerce:localhost': 'syt_Y29tbWVyY2U_EwSCqQwYadpeXlDCkXAn_4VqJa8'
      };

      const userToken = userTokenMap[department.matrixUser];
      if (userToken) {
        try {
          await axios.post(`${MATRIX_HOMESERVER}/_matrix/client/v3/rooms/${department.spaceId}/join`, {
            server_name: 'localhost'
          }, {
            headers: {
              'Authorization': `Bearer ${userToken}`,
              'Content-Type': 'application/json'
            }
          });
          console.log(`✅ ${department.matrixUser} joined space ${department.name}`);
        } catch (joinError) {
          console.log(`ℹ️  ${department.matrixUser} join to ${department.name}: ${joinError.response?.data?.errcode || 'already joined'}`);
        }
      }

    } catch (error) {
      // User might already be in space or space might not exist, that's okay
      console.log(`ℹ️  ${department.matrixUser} invitation to ${department.name}: ${error.response?.data?.errcode || 'OK'}`);
    }
  }
}

// Create Telegram spaces and invite users
async function initializeTelegramSpaces() {
  await createTelegramSpaces();
  await ensureDepartmentUsersInSpaces();
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
    // Create room in Matrix
    const roomResponse = await axios.post(`${MATRIX_HOMESERVER}/_matrix/client/v3/createRoom`, {
      name: roomName,
      topic: roomTopic,
      visibility: 'private',
      preset: 'private_chat',
      invite: [department.matrixUser],
      initial_state: [{
        type: 'm.room.power_levels',
        content: {
          users: {
            '@admin:localhost': 100,
            [department.matrixUser]: 50
          }
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

    // Ensure department user is invited to the space so they can see hierarchy
    try {
      await axios.post(`${MATRIX_HOMESERVER}/_matrix/client/v3/rooms/${department.spaceId}/invite`, {
        user_id: department.matrixUser
      }, {
        headers: {
          'Authorization': `Bearer ${ADMIN_ACCESS_TOKEN}`,
          'Content-Type': 'application/json'
        }
      });
      console.log(`📧 Invited ${department.matrixUser} to space ${department.name}`);
    } catch (spaceInviteError) {
      // User might already be in space, that's okay
      if (!spaceInviteError.response?.data?.errcode?.includes('M_FORBIDDEN')) {
        console.log(`ℹ️  ${department.matrixUser} may already be in space ${department.name}`);
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
  const welcomeMessage = `
🎧 **Welcome to Customer Support!**

Please select the department that best matches your needs:

🎧 **/start_support** - General Support
Technical help and general inquiries

💼 **/start_tech** - Tech Support
Advanced technical assistance

🔒 **/start_id** - Account Verification
Identity verification and account issues

💰 **/start_commerce** - Sales & Commerce
Purchase questions and order support

Just tap one of the commands above to get started!
`;

  await bot.sendMessage(chatId, welcomeMessage, {
    parse_mode: 'Markdown',
    reply_markup: {
      inline_keyboard: [
        [
          { text: '🎧 General Support', callback_data: 'dept_support' },
          { text: '💼 Tech Support', callback_data: 'dept_tech_support' }
        ],
        [
          { text: '🔒 Account Verification', callback_data: 'dept_identification' },
          { text: '💰 Sales & Commerce', callback_data: 'dept_commerce' }
        ]
      ]
    }
  });
}

/**
 * Handle department selection
 */
async function handleDepartmentSelection(departmentId, telegramUser, chatId) {
  try {
    const department = TELEGRAM_DEPARTMENT_SPACES[departmentId];

    // Send confirmation message
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