import { createClient, MatrixClient, Room, MatrixEvent, RoomEvent, ClientEvent } from 'matrix-js-sdk'
import { MatrixConfig, ChatMessage, UserDetails } from '@/types'
import { getCurrentRoomId, setRoomId, setMatrixUserId, loadChatSession, updateChatSession, getDepartmentRoomId, setDepartmentRoomId } from './chat-storage'

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
  private isLoadingHistory: boolean = false
  private connectionTimestamp: number = 0
  private hasLoggedFilterSuppression: boolean = false

  constructor(config: MatrixConfig) {
    this.config = config
  }

  /**
   * Suppresses non-critical Matrix client filter errors that don't affect functionality
   * These errors occur when guest users try to access sync filters they don't have permission for
   */
  private suppressMatrixFilterErrors(): void {
    // Store original console.error
    const originalError = console.error
    
    console.error = (...args: any[]) => {
      const message = args.join(' ')
      
      // Filter out specific Matrix filter permission errors
      const isFilterError = message.includes('Getting filter failed') && 
                           message.includes('M_FORBIDDEN') &&
                           message.includes('Cannot get filters for other users')
      
      // Only suppress filter errors, let all other errors through
      if (!isFilterError) {
        originalError.apply(console, args)
      } else {
        // Optionally log a single suppressed message to indicate filtering is working
        if (!this.hasLoggedFilterSuppression) {
          originalError('ℹ️ Matrix client filter permission errors suppressed (guest user limitations - functionality not affected)')
          this.hasLoggedFilterSuppression = true
        }
      }
    }
    
    console.log('🔇 Matrix client error filtering enabled for guest user session')
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
    // Use admin token from configuration for guest user creation
    const adminToken = this.config.adminAccessToken
    if (!adminToken) {
      throw new Error('Admin access token required for guest user creation')
    }
    return adminToken
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

  async connect(userDetails?: UserDetails, departmentId?: string): Promise<void> {
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
        // Check if we're reconnecting with guest credentials (during page refresh)
        if (this.config.user_id && this.config.user_id.includes('guest_')) {
          userId = this.config.user_id
          accessToken = this.config.accessToken
          
          // Set guest properties for proper history loading
          this.guestUserId = userId
          this.guestAccessToken = accessToken
          
          console.log('🔗 Reconnecting as guest user:', userId)
        } else {
          // Fallback to support bot (for room management operations)
          userId = await this.getSupportBotUserId()
          accessToken = this.config.accessToken
          
          console.log('🔗 Connecting as support bot:', userId)
        }
      }
      
      this.client = createClient({
        baseUrl: this.config.homeserver,
        accessToken: accessToken,
        userId: userId
      })

      // Suppress non-critical Matrix client filter errors to reduce console noise
      this.suppressMatrixFilterErrors()

      // Store Matrix user ID for session tracking
      setMatrixUserId(userId)

      this.client.on(RoomEvent.Timeline, this.handleTimelineEvent.bind(this))
      this.client.on(ClientEvent.Sync, this.handleSync.bind(this))
      
      // Auto-join rooms on invite (Matrix SDK best practice)
      this.client.on(RoomEvent.MyMembership, (room, membership, prevMembership) => {
        if (membership === 'invite') {
          console.log('🎟️ Auto-joining room on invitation:', room.roomId)
          this.client!.joinRoom(room.roomId).then(() => {
            console.log('✅ Auto-joined room:', room.roomId)
            this.currentRoomId = room.roomId
          }).catch((error) => {
            console.error('❌ Failed to auto-join room:', error)
          })
        }
      })

      await this.client.startClient()
      
      // Mark connection timestamp for timeline event filtering
      this.connectionTimestamp = Date.now()
      
      // For department switches, restore the specific department's room
      if (departmentId) {
        const departmentRoomId = getDepartmentRoomId(departmentId)
        if (departmentRoomId) {
          console.log('🏢 Restoring department-specific room:', departmentId, departmentRoomId)
          const hasAccess = await this.verifyRoomAccess(departmentRoomId)
          if (hasAccess) {
            this.currentRoomId = departmentRoomId
            console.log('✅ Successfully restored department room:', departmentRoomId)
          } else {
            console.log('❌ Lost access to department room:', departmentRoomId)
            setDepartmentRoomId(departmentId, '') // Clear invalid room
          }
        } else {
          console.log('🆕 No existing room for department:', departmentId)
        }
      } else {
        // Legacy/initial connection - try to restore any existing room
        const existingRoomId = getCurrentRoomId()
        console.log('🔍 ROOM RESTORE DEBUG - existingRoomId from storage:', existingRoomId)
        if (existingRoomId) {
          console.log('🔍 Checking existing room access:', existingRoomId, 'as user:', userId)
          const hasAccess = await this.verifyRoomAccess(existingRoomId)
          console.log('🔍 Room access result:', hasAccess)
          
          if (hasAccess) {
            this.currentRoomId = existingRoomId
            console.log('🔄 Restored existing room successfully:', existingRoomId)
          } else {
            console.log('🚫 Lost access to previous room, will create new one')
            setRoomId('')
          }
        } else {
          console.log('🔍 No existing room ID found in storage')
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
      console.log('🧹 Disconnecting Matrix client (preserving room memberships)...')
      
      // Remove all event listeners to prevent bleeding events
      this.client.removeAllListeners()
      
      // For department switching, DON'T leave rooms - just disconnect the client
      // This preserves room memberships so we can reconnect later
      console.log('💾 Preserving room memberships for department switching')
      
      // Stop the client connection
      this.client.stopClient()
      
      // Clear the client reference  
      this.client = null
    }
    
    // Clear internal state but preserve room information
    this.currentRoomId = null
    this.processedMessageIds.clear()
    this.initialSyncComplete = false
    this.isLoadingHistory = false
    this.connectionTimestamp = 0
    
    // Clear guest credentials but preserve room data
    this.guestUserId = null
    this.guestAccessToken = null
    
    console.log('✅ Matrix client disconnected (room memberships preserved)')
    this.notifyConnection(false)
  }

  async createOrJoinSupportRoom(userDetails: UserDetails, departmentInfo?: { name: string; id: string }, isDepartmentSwitch?: boolean): Promise<string> {
    if (!this.client) {
      throw new Error('Matrix client not connected')
    }

    try {
      const session = loadChatSession()
      console.log('🔍 CREATE/JOIN DEBUG - session:', {
        isReturningUser: session.isReturningUser,
        roomId: session.roomId,
        conversationCount: session.conversationCount
      })
      console.log('🔍 CREATE/JOIN DEBUG - currentRoomId:', this.currentRoomId)
      
      // Always check for department-specific room first (for both new and returning users)
      if (departmentInfo) {
        const departmentRoomId = getDepartmentRoomId(departmentInfo.id)
        if (departmentRoomId) {
          console.log('🏢 Found existing room for department:', departmentInfo.name, departmentRoomId)
          
          // Verify access to this department's room
          if (await this.verifyRoomAccess(departmentRoomId)) {
            console.log('✅ Successfully accessing department room:', departmentRoomId)
            this.currentRoomId = departmentRoomId
            
            // Send a message indicating user is returning to this department
            if (session.isReturningUser && session.conversationCount > 0) {
              await this.sendMessage(`I'm back to continue our conversation with ${departmentInfo.name}.`)
            }
            
            return departmentRoomId
          } else {
            console.log('❌ Lost access to department room, will create new one:', departmentRoomId)
            // Clear the invalid room ID from this department's storage
            setDepartmentRoomId(departmentInfo.id, '')
          }
        } else {
          console.log('🆕 No existing room found for department:', departmentInfo.name)
        }
      } else {
        // Legacy support (no department info) - check global room
        let targetRoomId = this.currentRoomId
        if (session.isReturningUser && !targetRoomId) {
          targetRoomId = getCurrentRoomId() || null
        }
        
        if (targetRoomId && await this.verifyRoomAccess(targetRoomId)) {
          console.log('🔄 Using existing legacy room:', targetRoomId)
          this.currentRoomId = targetRoomId
          
          if (session.isReturningUser && session.conversationCount > 0) {
            await this.sendMessage(`I'm back to continue our conversation.`)
          }
          
          return targetRoomId
        }
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
        
        // Create department-specific room name and topic
        const departmentPrefix = departmentInfo ? `${departmentInfo.name}` : 'Support'
        const roomOptions = {
          name: `${departmentPrefix}: ${userDetails.name}`,
          topic: `${departmentInfo ? `[${departmentInfo.name}] ` : ''}Customer: ${userDetails.name} (${userDetails.email}) - Guest: ${currentUserId}`,
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
        const departmentContext = departmentInfo ? `\nDepartment: ${departmentInfo.name} (${departmentInfo.id})` : ''
        const contextMessage = session.isReturningUser && session.conversationCount > 0
          ? `Returning customer: ${userDetails.name}\nPrevious conversations: ${session.conversationCount}${departmentContext}\n\nContact: ${userDetails.email}${userDetails.phone ? ` | ${userDetails.phone}` : ''}\n\nConnected as: ${currentUserId}`
          : `New customer: ${userDetails.name}${departmentContext}\nContact: ${userDetails.email}${userDetails.phone ? ` | ${userDetails.phone}` : ''}\n\nConnected as: ${currentUserId}`

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
        const departmentPrefix = departmentInfo ? `${departmentInfo.name}` : 'Support'
        const roomOptions = {
          name: `${departmentPrefix}: ${userDetails.name}`,
          topic: `${departmentInfo ? `[${departmentInfo.name}] ` : ''}Customer: ${userDetails.name} (${userDetails.email})`,
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
    // Enhanced filtering with debug logging for department switching issues  
    if (!room) {
      console.warn('⚠️ Timeline event received with no room context')
      return
    }
    
    if (!this.currentRoomId) {
      console.warn('⚠️ Timeline event received but no currentRoomId set:', {
        eventRoom: room.roomId,
        eventType: event.getType()
      })
      return
    }
    
    if (room.roomId !== this.currentRoomId) {
      console.warn('⚠️ Timeline event from different room (potential bleed):', {
        eventRoom: room.roomId,
        currentRoom: this.currentRoomId,
        eventType: event.getType()
      })
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

    // For returning users, process messages during initial sync (this IS history restoration)
    // For new users, skip messages during initial sync to avoid processing old room history
    const session = loadChatSession()
    const isReturningUser = session.isReturningUser
    
    if (!this.initialSyncComplete && !isReturningUser) {
      this.processedMessageIds.add(eventId)
      console.log('⚠️ Skipping message during initial sync (new user):', eventId)
      return
    } else if (!this.initialSyncComplete && isReturningUser) {
      console.log('📚 Processing message during initial sync (returning user):', eventId)
    }

    // Enhanced logic for handling user's own messages
    const currentUserId = this.client?.getUserId()
    const eventSender = event.getSender()
    
    // Get session data to identify all possible customer user IDs
    const sessionGuestUserId = session.guestUserId || session.matrixUserId
    
    // Check if this is a customer message (from any guest user)
    const isCustomerMessage = (
      eventSender === currentUserId ||
      eventSender === sessionGuestUserId ||
      eventSender?.includes('guest_')
    )
    
    console.log('🔍 TIMELINE EVENT DEBUG:', {
      eventId: eventId.substring(0, 20) + '...',
      eventSender: eventSender,
      currentUserId: currentUserId,
      sessionGuestUserId: sessionGuestUserId,
      isCustomerMessage: isCustomerMessage,
      isLoadingHistory: this.isLoadingHistory,
      messageText: content.body.substring(0, 30) + '...'
    })
    
    // Simple approach: For returning users, always include customer messages during initial connection
    // This allows history restoration via timeline events
    const messageAge = Date.now() - event.getTs()
    const isRecentMessage = messageAge < (24 * 60 * 60 * 1000) // Less than 24 hours old
    const isInitialConnection = (Date.now() - this.connectionTimestamp) < 30000 // First 30 seconds after connection
    
    // For customer messages: ONLY include during explicit history loading
    // Never process customer messages via timeline during live chat to prevent duplication
    const shouldIncludeCustomerMessage = isCustomerMessage && this.isLoadingHistory
    
    if (isCustomerMessage && !shouldIncludeCustomerMessage) {
      console.log('⚠️ Skipping customer message from timeline (prevents duplication during live chat):', eventId)
      this.processedMessageIds.add(eventId)
      return
    } else if (shouldIncludeCustomerMessage) {
      console.log('📚 Including customer message from timeline (history loading):', {
        eventId: eventId.substring(0, 20) + '...',
        isLoadingHistory: this.isLoadingHistory
      })
    }

    // Create message with proper sender attribution
    const message: ChatMessage = {
      id: eventId,
      text: content.body,
      sender: isCustomerMessage ? 'user' : 'support',
      timestamp: event.getTs(),
      status: 'sent'
    }

    const messageType = isCustomerMessage ? 'customer' : 'support'
    console.log(`📨 Processing ${messageType} message:`, { 
      eventId, 
      sender: eventSender, 
      currentUser: currentUserId,
      messageType: message.sender 
    })
    
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
    console.log('🔍 HISTORY DEBUG - loadMessageHistory called:', {
      roomId: roomId,
      limit: limit,
      clientConnected: !!this.client,
      currentRoomId: this.currentRoomId
    })
    
    if (!this.client) {
      throw new Error('Matrix client not connected')
    }

    try {
      // Set flag to indicate we're loading history (affects timeline event handling)
      this.isLoadingHistory = true
      console.log('🔄 Set isLoadingHistory = true for proper message restoration')
      const currentUserId = this.client.getUserId()

      // Try to get messages from client cache first (if room is loaded)
      const room = this.client.getRoom(roomId)
      if (room && room.getLiveTimeline().getEvents().length > 0) {
        // Get the guest user ID from session for proper customer message identification
        const session = loadChatSession()
        const sessionGuestUserId = session.guestUserId || session.matrixUserId
        
        console.log('🔍 CACHED MESSAGE DEBUG:', {
          currentUserId: currentUserId,
          sessionGuestUserId: sessionGuestUserId,
          roomId: roomId
        })
        
        const timeline = room.getLiveTimeline()
        const events = timeline.getEvents()
        
        const messages: ChatMessage[] = []
        for (const event of events.slice(-limit)) {
          if (event.getType() === 'm.room.message') {
            const content = event.getContent()
            if (content.msgtype === 'm.text') {
              const eventId = event.getId() || `${event.getTs()}-${Math.random()}`
              const eventSender = event.getSender()
              
              // Enhanced customer message detection (same logic as API fallback)
              const isCustomerMessage = (
                eventSender === currentUserId ||
                eventSender === sessionGuestUserId ||
                eventSender?.includes('guest_')
              )
              
              console.log('📚 Loading cached message:', {
                eventId: eventId.substring(0, 20) + '...',
                sender: eventSender,
                currentUserId: currentUserId,
                sessionGuestUserId: sessionGuestUserId,
                isCustomerMessage: isCustomerMessage,
                text: content.body.substring(0, 50) + '...'
              })
              
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
          this.isLoadingHistory = false
          console.log('🔄 Set isLoadingHistory = false - cached messages loaded')
          return messages
        }
      }

      // Fallback to API call (useful after page refresh when cache is empty)
      console.log('📡 Fetching message history via API for room:', roomId)
      console.log('🔍 HISTORY API DEBUG:', {
        roomId: roomId,
        currentUserId: currentUserId,
        isCurrentUserGuest: currentUserId.includes('guest_'),
        guestAccessToken: this.guestAccessToken ? 'Available' : 'Not available',
        supportAccessToken: this.config.accessToken ? 'Available' : 'Not available'
      })
      
      // Use appropriate access token based on current user
      const isGuestUser = currentUserId.includes('guest_')
      const accessToken = isGuestUser 
        ? (this.guestAccessToken || this.config.accessToken) // Fallback to config token during reconnection
        : this.config.accessToken
      
      if (!accessToken) {
        throw new Error('No access token available for message history loading')
      }
      
      console.log('🔑 Using access token for history API:', {
        isGuestUser,
        hasGuestAccessToken: !!this.guestAccessToken,
        usingConfigToken: !this.guestAccessToken,
        tokenPreview: accessToken.substring(0, 10) + '...'
      })
      
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

      // Get the guest user ID from session to properly identify customer messages
      const session = loadChatSession()
      const sessionGuestUserId = session.guestUserId || session.matrixUserId
      
      console.log('🔍 MESSAGE ATTRIBUTION DEBUG:', {
        currentUserId: currentUserId,
        sessionGuestUserId: sessionGuestUserId,
        totalMessages: data.chunk.length
      })
      
      // Process events in reverse order (API returns newest first with dir=b)
      for (const event of data.chunk.reverse()) {
        if (event.type === 'm.room.message' && event.content?.msgtype === 'm.text') {
          const eventId = event.event_id || `${event.origin_server_ts}-${Math.random()}`
          const eventSender = event.sender
          
          // Enhanced customer message detection:
          // 1. Current user check (for live sessions)
          // 2. Session guest user check (for restored sessions) 
          // 3. Guest user pattern check (for fallback)
          const isCustomerMessage = (
            eventSender === currentUserId ||
            eventSender === sessionGuestUserId ||
            eventSender?.includes('guest_')
          )
          
          console.log('📚 Processing message:', {
            eventId: eventId.substring(0, 20) + '...',
            sender: eventSender,
            currentUserId: currentUserId,
            sessionGuestUserId: sessionGuestUserId,
            isCustomerMessage: isCustomerMessage,
            text: event.content.body.substring(0, 50) + '...'
          })
          
          const message: ChatMessage = {
            id: eventId,
            text: event.content.body,
            sender: isCustomerMessage ? 'user' : 'support',
            timestamp: event.origin_server_ts,
            status: 'sent'
          }
          
          console.log('📝 Created message object:', {
            id: message.id.substring(0, 20) + '...',
            sender: message.sender,
            text: message.text.substring(0, 30) + '...'
          })
          
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
    } finally {
      // Always reset the flag when history loading is complete
      this.isLoadingHistory = false
      console.log('🔄 Set isLoadingHistory = false - history loading complete')
    }
  }

  /**
   * Joins an existing Matrix room (for reconnection purposes)
   */
  async joinRoom(roomId: string): Promise<void> {
    if (!this.client) {
      throw new Error('Matrix client not connected')
    }

    console.log(`🚪 Attempting to join room: ${roomId}`)
    
    try {
      // First check if we're already in the room
      const room = this.client.getRoom(roomId)
      if (room && room.getMyMembership() === 'join') {
        console.log(`✅ Already joined room: ${roomId}`)
        this.currentRoomId = roomId
        return
      }

      // Join the room via Matrix API
      await this.client.joinRoom(roomId)
      this.currentRoomId = roomId
      
      // Update storage
      setRoomId(roomId)
      
      console.log(`✅ Successfully joined room: ${roomId}`)
      
    } catch (error: any) {
      console.error(`❌ Failed to join room ${roomId}:`, error)
      throw new Error(`Failed to join room: ${error.message}`)
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