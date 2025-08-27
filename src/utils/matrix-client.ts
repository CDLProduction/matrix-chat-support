import { createClient, MatrixClient, Room, MatrixEvent, RoomEvent, ClientEvent } from 'matrix-js-sdk'
import { MatrixConfig, ChatMessage, UserDetails } from '@/types'
import { getCurrentRoomId, setRoomId, setMatrixUserId, loadChatSession, updateChatSession } from './chat-storage'

export class MatrixChatClient {
  private client: MatrixClient | null = null
  private config: MatrixConfig
  private currentRoomId: string | null = null
  private messageCallbacks: Array<(message: ChatMessage) => void> = []
  private connectionCallbacks: Array<(connected: boolean) => void> = []
  private errorCallbacks: Array<(error: Error) => void> = []
  private processedMessageIds: Set<string> = new Set()
  private initialSyncComplete: boolean = false
  private guestUserId: string | null = null
  private guestAccessToken: string | null = null

  constructor(config: MatrixConfig) {
    this.config = config
  }

  /**
   * Creates or retrieves a guest user for the customer chat session
   */
  private async getOrCreateGuestUser(userDetails: UserDetails): Promise<{userId: string, accessToken: string}> {
    const session = loadChatSession()
    
    // Check if we already have guest credentials stored
    if (session.guestUserId && session.guestAccessToken) {
      console.log('🔄 Using existing guest user:', session.guestUserId)
      return {
        userId: session.guestUserId,
        accessToken: session.guestAccessToken
      }
    }
    
    // Create new guest user
    const timestamp = Date.now()
    const randomId = Math.random().toString(36).substring(2, 8)
    const guestUsername = `guest_${timestamp}_${randomId}`
    const serverName = this.config.homeserver.replace(/https?:\/\//, '').split(':')[0]
    const guestUserId = `@${guestUsername}:${serverName}`
    const guestPassword = `temp_${timestamp}_${randomId}`
    
    console.log('👤 Creating guest user:', guestUserId)
    
    try {
      // Create user via admin API
      const adminToken = await this.getAdminToken()
      
      const createUserResponse = await fetch(`${this.config.homeserver}/_synapse/admin/v2/users/${guestUserId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${adminToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          password: guestPassword,
          admin: false,
          displayname: userDetails.name,
          user_type: null
        })
      })

      if (!createUserResponse.ok) {
        const errorData = await createUserResponse.json().catch(() => ({}))
        throw new Error(`Failed to create guest user: ${createUserResponse.status} - ${errorData.error || 'Unknown error'}`)
      }

      // Login as the guest user to get access token
      const loginResponse = await fetch(`${this.config.homeserver}/_matrix/client/r0/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          type: 'm.login.password',
          user: guestUsername,
          password: guestPassword
        })
      })

      if (!loginResponse.ok) {
        const errorData = await loginResponse.json().catch(() => ({}))
        throw new Error(`Failed to login guest user: ${loginResponse.status} - ${errorData.error || 'Unknown error'}`)
      }

      const loginData = await loginResponse.json()
      
      // Store guest credentials in session
      updateChatSession({
        guestUserId: guestUserId,
        guestAccessToken: loginData.access_token
      })
      
      console.log('✅ Guest user created successfully:', {
        userId: guestUserId,
        accessToken: loginData.access_token.substring(0, 20) + '...'
      })

      return {
        userId: guestUserId,
        accessToken: loginData.access_token
      }
    } catch (error) {
      console.error('❌ Failed to create guest user:', error)
      throw error
    }
  }

  /**
   * Gets admin token for user management operations
   * For now, we'll use a hardcoded admin token - in production this should be configurable
   */
  private async getAdminToken(): Promise<string> {
    // TODO: Make this configurable or get from environment
    return 'syt_YWRtaW4_GzfQPdeOSqBiiuYzLXpL_2nKVjT' // Admin token
  }

  /**
   * Gets support bot user ID from access token
   */
  private async getSupportBotUserId(): Promise<string> {
    if (!this.config.accessToken) {
      throw new Error('Support bot access token required')
    }

    const response = await fetch(`${this.config.homeserver}/_matrix/client/r0/account/whoami`, {
      headers: {
        'Authorization': `Bearer ${this.config.accessToken}`
      }
    })

    if (!response.ok) {
      throw new Error('Failed to get support bot user ID from access token')
    }

    const data = await response.json()
    return data.user_id
  }

  async connect(userDetails?: UserDetails): Promise<void> {
    try {
      let userId: string
      let accessToken: string
      
      if (userDetails) {
        // Create or get guest user for this customer session
        const guestData = await this.getOrCreateGuestUser(userDetails)
        userId = guestData.userId
        accessToken = guestData.accessToken
        
        this.guestUserId = userId
        this.guestAccessToken = accessToken
        
        console.log('🔗 Connecting as guest user:', userId)
      } else {
        // Fallback to support bot (for room management operations)
        userId = await this.getSupportBotUserId()
        accessToken = this.config.accessToken
        
        console.log('🔗 Connecting as support bot:', userId)
      }
      
      this.client = createClient({
        baseUrl: this.config.homeserver,
        accessToken: accessToken,
        userId: userId
      })

      // Store Matrix user ID for session tracking
      setMatrixUserId(userId)

      this.client.on(RoomEvent.Timeline, this.handleTimelineEvent.bind(this))
      this.client.on(ClientEvent.Sync, this.handleSync.bind(this))

      await this.client.startClient()
      
      // Try to restore existing room if available
      const existingRoomId = getCurrentRoomId()
      if (existingRoomId) {
        console.log('🔍 Checking existing room access:', existingRoomId)
        const hasAccess = await this.verifyRoomAccess(existingRoomId)
        
        if (hasAccess) {
          this.currentRoomId = existingRoomId
          console.log('🔄 Restored existing room successfully:', existingRoomId)
        } else {
          console.log('🚫 Lost access to previous room, will create new one')
          // Clear the invalid room ID from storage
          setRoomId('')
        }
      }
      
      this.notifyConnection(true)
    } catch (error) {
      this.notifyError(error as Error)
      throw error
    }
  }

  async disconnect(): Promise<void> {
    if (this.client) {
      this.client.stopClient()
      this.client = null
    }
    this.currentRoomId = null
    this.processedMessageIds.clear()
    this.initialSyncComplete = false
    this.notifyConnection(false)
  }

  async createOrJoinSupportRoom(userDetails: UserDetails): Promise<string> {
    if (!this.client) {
      throw new Error('Matrix client not connected')
    }

    try {
      const session = loadChatSession()
      
      // Check if user already has a room and it's accessible
      if (this.currentRoomId && await this.verifyRoomAccess(this.currentRoomId)) {
        console.log('🔄 Using existing room:', this.currentRoomId)
        
        // Send a message indicating user is returning
        if (session.isReturningUser && session.conversationCount > 0) {
          await this.sendMessage(`I'm back to continue our conversation.`)
        }
        
        return this.currentRoomId
      }

      // Use configured shared room if available
      if (this.config.supportRoomId) {
        const room = this.client.getRoom(this.config.supportRoomId)
        if (room) {
          this.currentRoomId = this.config.supportRoomId
          setRoomId(this.currentRoomId)
          return this.config.supportRoomId
        }
      }

      // For new rooms, we need to create as support bot, then invite guest user
      const currentUserId = this.client.getUserId()
      const isGuestUser = currentUserId?.includes('guest_')
      
      if (isGuestUser) {
        // We're connected as guest user, need to create room via support bot
        console.log('🏗️ Creating room via support bot and inviting guest user')
        
        // Create temporary support bot client for room creation
        const supportBotClient = createClient({
          baseUrl: this.config.homeserver,
          accessToken: this.config.accessToken,
          userId: await this.getSupportBotUserId()
        })
        
        const roomOptions = {
          name: `Support: ${userDetails.name}`,
          topic: `Customer: ${userDetails.name} (${userDetails.email}) - Guest: ${currentUserId}`,
          initial_state: [
            {
              type: 'm.room.guest_access',
              content: { guest_access: 'can_join' }
            },
            {
              type: 'm.room.join_rules',
              content: { join_rule: 'invite' }
            }
          ]
        }

        const response = await supportBotClient.createRoom(roomOptions)
        this.currentRoomId = response.room_id

        // Store room ID for future sessions
        setRoomId(this.currentRoomId)

        // Invite the guest user to the room
        console.log('📨 Inviting guest user to room:', currentUserId)
        await supportBotClient.invite(this.currentRoomId, currentUserId)
        
        // Now the guest user (our current client) needs to join the room
        console.log('🚪 Guest user joining room as:', currentUserId)
        await this.client.joinRoom(this.currentRoomId)
        
        // Wait a moment for the join to fully complete
        await new Promise(resolve => setTimeout(resolve, 1000))
        
        // Invite configured support users/bots
        if (this.config.botUserId && this.config.botUserId !== await this.getSupportBotUserId()) {
          try {
            await supportBotClient.invite(this.currentRoomId, this.config.botUserId)
          } catch (error) {
            console.warn('Failed to invite additional bot user:', error)
          }
        }

        // Send initial context message as support bot
        const contextMessage = session.isReturningUser && session.conversationCount > 0
          ? `Returning customer: ${userDetails.name}\nPrevious conversations: ${session.conversationCount}\n\nContact: ${userDetails.email}${userDetails.phone ? ` | ${userDetails.phone}` : ''}\n\nConnected as: ${currentUserId}`
          : `New customer: ${userDetails.name}\nContact: ${userDetails.email}${userDetails.phone ? ` | ${userDetails.phone}` : ''}\n\nConnected as: ${currentUserId}`

        await supportBotClient.sendTextMessage(this.currentRoomId, contextMessage)
        
        // Wait another moment before sending customer message
        await new Promise(resolve => setTimeout(resolve, 500))
        
        // Now send the initial customer message as the guest user
        if (userDetails.message && userDetails.message.trim()) {
          console.log('📝 Sending initial customer message as guest user')
          await this.client.sendTextMessage(this.currentRoomId, userDetails.message)
        }
        
        console.log('✨ Created new room via support bot:', this.currentRoomId)
        console.log('👤 Guest user joined room:', currentUserId)
        
      } else {
        // We're connected as support bot, create room normally
        const roomOptions = {
          name: `Support: ${userDetails.name}`,
          topic: `Customer: ${userDetails.name} (${userDetails.email})`,
          initial_state: [
            {
              type: 'm.room.guest_access',
              content: { guest_access: 'can_join' }
            }
          ]
        }

        const response = await this.client.createRoom(roomOptions)
        this.currentRoomId = response.room_id
        setRoomId(this.currentRoomId)
        
        console.log('✨ Created new room as support bot:', this.currentRoomId)
      }

      return this.currentRoomId
    } catch (error) {
      this.notifyError(error as Error)
      throw error
    }
  }

  async sendMessage(text: string): Promise<void> {
    if (!this.client || !this.currentRoomId) {
      throw new Error('No active room to send message to')
    }

    try {
      await this.client.sendTextMessage(this.currentRoomId, text)
    } catch (error) {
      this.notifyError(error as Error)
      throw error
    }
  }

  onMessage(callback: (message: ChatMessage) => void): void {
    this.messageCallbacks.push(callback)
  }

  onConnection(callback: (connected: boolean) => void): void {
    this.connectionCallbacks.push(callback)
  }

  onError(callback: (error: Error) => void): void {
    this.errorCallbacks.push(callback)
  }


  private handleTimelineEvent(event: MatrixEvent, room: Room | undefined): void {
    if (!room || !this.currentRoomId || room.roomId !== this.currentRoomId) {
      return
    }

    if (event.getType() !== 'm.room.message') {
      return
    }

    const content = event.getContent()
    if (content.msgtype !== 'm.text') {
      return
    }

    const eventId = event.getId()
    if (!eventId) {
      return
    }

    // Skip if we've already processed this message (prevents duplicates from history loading)
    if (this.processedMessageIds.has(eventId)) {
      console.log('⚠️ Skipping already processed message:', eventId)
      return
    }

    // Only process new messages after initial sync to avoid duplicating history
    if (!this.initialSyncComplete) {
      this.processedMessageIds.add(eventId)
      console.log('⚠️ Skipping message during initial sync:', eventId)
      return
    }

    // For user's own messages, skip timeline events to prevent duplication with UI-added messages
    const currentUserId = this.client?.getUserId()
    const eventSender = event.getSender()
    
    if (eventSender === currentUserId) {
      console.log('⚠️ Skipping own message from timeline to prevent duplication:', eventId)
      this.processedMessageIds.add(eventId)
      return
    }

    // Now with guest users, the logic is:
    // - Messages from guest_* users = 'user' (customer messages)
    // - Messages from other users (admin, support, etc.) = 'support' (support agent responses)
    const isCustomerMessage = eventSender?.includes('guest_') || false
    
    const message: ChatMessage = {
      id: eventId,
      text: content.body,
      sender: isCustomerMessage ? 'user' : 'support',
      timestamp: event.getTs(),
      status: 'sent'
    }

    console.log('📨 Processing support message:', { eventId, sender: eventSender, currentUser: currentUserId })
    this.processedMessageIds.add(eventId)
    this.notifyMessage(message)
  }

  private handleSync(state: string): void {
    if (state === 'SYNCING') {
      this.notifyConnection(true)
    } else if (state === 'PREPARED') {
      // Initial sync is complete, now we can process new timeline events
      this.initialSyncComplete = true
      console.log('🔄 Matrix sync complete - ready for new messages')
    }
  }

  private notifyMessage(message: ChatMessage): void {
    this.messageCallbacks.forEach(callback => callback(message))
  }

  private notifyConnection(connected: boolean): void {
    this.connectionCallbacks.forEach(callback => callback(connected))
  }

  private notifyError(error: Error): void {
    this.errorCallbacks.forEach(callback => callback(error))
  }

  /**
   * Verifies if the user still has access to a room
   * Uses direct API call to avoid relying on client cache after page refresh
   */
  async verifyRoomAccess(roomId: string): Promise<boolean> {
    if (!this.client) {
      return false
    }

    try {
      const currentUserId = this.client.getUserId()
      if (!currentUserId) {
        console.warn('No current user ID available for room verification')
        return false
      }
      
      // For guest users, use their access token; for support bot, use support token
      const isGuestUser = currentUserId.includes('guest_')
      const accessToken = isGuestUser ? this.guestAccessToken : this.config.accessToken
      
      if (!accessToken) {
        console.warn('No access token available for room verification')
        return false
      }
      
      // Make direct API call to check room membership
      const response = await fetch(`${this.config.homeserver}/_matrix/client/r0/rooms/${roomId}/state/m.room.member/${currentUserId}`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      })

      if (response.ok) {
        const membershipData = await response.json()
        const isJoined = membershipData.membership === 'join'
        
        if (isJoined) {
          console.log('✅ Room access verified via API:', roomId, 'for user:', currentUserId)
          return true
        } else {
          console.log('🚫 User membership status:', membershipData.membership, 'for room:', roomId, 'user:', currentUserId)
          return false
        }
      } else if (response.status === 404) {
        console.log('🚫 Room not found or no access:', roomId, 'for user:', currentUserId)
        return false
      } else {
        console.warn('Room access verification failed with status:', response.status, 'for user:', currentUserId)
        return false
      }
    } catch (error) {
      console.warn('Failed to verify room access via API:', error)
      return false
    }
  }

  /**
   * Loads message history from a room
   * Uses direct API call to work properly after page refresh
   */
  async loadMessageHistory(roomId: string, limit: number = 50): Promise<ChatMessage[]> {
    if (!this.client) {
      throw new Error('Matrix client not connected')
    }

    try {
      const currentUserId = await this.getUserId()

      // Try to get messages from client cache first (if room is loaded)
      const room = this.client.getRoom(roomId)
      if (room && room.getLiveTimeline().getEvents().length > 0) {
        const timeline = room.getLiveTimeline()
        const events = timeline.getEvents()
        
        const messages: ChatMessage[] = []
        for (const event of events.slice(-limit)) {
          if (event.getType() === 'm.room.message') {
            const content = event.getContent()
            if (content.msgtype === 'm.text') {
              const eventId = event.getId() || `${event.getTs()}-${Math.random()}`
              const eventSender = event.getSender()
              const isUserMessage = eventSender === currentUserId
              
              console.log('📚 Loading cached message:', {
                eventId: eventId.substring(0, 20) + '...',
                sender: eventSender,
                currentUserId: currentUserId,
                isUserMessage,
                text: content.body.substring(0, 50) + '...'
              })
              
              // With guest user architecture:
              // Messages from guest_* users = 'user' (customer messages)
              // Messages from other users (admin, support, etc.) = 'support' (support agent responses)
              const isCustomerMessage = eventSender?.includes('guest_') || false
              
              const message: ChatMessage = {
                id: eventId,
                text: content.body,
                sender: isCustomerMessage ? 'user' : 'support',
                timestamp: event.getTs(),
                status: 'sent'
              }
              
              // Mark this message as processed to prevent timeline event duplication
              this.processedMessageIds.add(eventId)
              messages.push(message)
            }
          }
        }
        
        if (messages.length > 0) {
          console.log(`📚 Loaded ${messages.length} messages from client cache`)
          return messages
        }
      }

      // Fallback to API call (useful after page refresh when cache is empty)
      console.log('📡 Fetching message history via API for room:', roomId)
      
      // Use appropriate access token based on current user
      const isGuestUser = currentUserId.includes('guest_')
      const accessToken = isGuestUser ? this.guestAccessToken : this.config.accessToken
      
      if (!accessToken) {
        throw new Error('No access token available for message history loading')
      }
      
      const response = await fetch(`${this.config.homeserver}/_matrix/client/r0/rooms/${roomId}/messages?limit=${limit}&dir=b`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      })

      if (!response.ok) {
        throw new Error(`Failed to fetch room messages: ${response.status} ${response.statusText}`)
      }

      const data = await response.json()
      const messages: ChatMessage[] = []

      // Process events in reverse order (API returns newest first with dir=b)
      for (const event of data.chunk.reverse()) {
        if (event.type === 'm.room.message' && event.content?.msgtype === 'm.text') {
          const eventId = event.event_id || `${event.origin_server_ts}-${Math.random()}`
          const isUserMessage = event.sender === currentUserId
          
          console.log('📚 Loading message:', {
            eventId: eventId.substring(0, 20) + '...',
            sender: event.sender,
            currentUserId: currentUserId,
            isUserMessage,
            text: event.content.body.substring(0, 50) + '...'
          })
          
          // With guest user architecture:
          // Messages from guest_* users = 'user' (customer messages)
          // Messages from other users (admin, support, etc.) = 'support' (support agent responses)
          const isCustomerMessage = event.sender?.includes('guest_') || false
          
          const message: ChatMessage = {
            id: eventId,
            text: event.content.body,
            sender: isCustomerMessage ? 'user' : 'support',
            timestamp: event.origin_server_ts,
            status: 'sent'
          }
          
          // Mark this message as processed to prevent timeline event duplication
          this.processedMessageIds.add(eventId)
          messages.push(message)
        }
      }

      console.log(`📚 Loaded ${messages.length} messages via API`)
      return messages
    } catch (error) {
      console.error('Failed to load message history:', error)
      throw error
    }
  }

  /**
   * Gets the current room ID if available
   */
  getCurrentRoomId(): string | null {
    return this.currentRoomId
  }

  /**
   * Sets the current room ID (useful for resuming sessions)
   */
  setCurrentRoomId(roomId: string): void {
    this.currentRoomId = roomId
  }

  /**
   * Starts a fresh conversation (clears current room)
   */
  startFreshConversation(): void {
    this.currentRoomId = null
    this.processedMessageIds.clear()
    this.initialSyncComplete = false
    console.log('🆕 Started fresh conversation - room cleared')
  }
}