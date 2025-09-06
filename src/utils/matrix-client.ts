import { createClient, MatrixClient, Room, MatrixEvent, RoomEvent, ClientEvent } from 'matrix-js-sdk'
import { MatrixConfig, ChatMessage, UserDetails, Department, SpaceSessionContext, ChatSession } from '@/types'
import { getCurrentRoomId, setRoomId, setMatrixUserId, loadChatSession, updateChatSession, getDepartmentRoomId, getAllDepartmentRoomIds, clearDepartmentRoomId, setDepartmentRoomStatus, getDepartmentRoomInfo } from './chat-storage'
import { getUserFriendlyErrorMessage, logError, isRetryableError, ErrorContext } from './error-handler'
import { logRoomOperation, logDepartmentSwitch, createRoomSnapshot } from './room-operation-logger'
import { SpaceManager } from './space-manager'
import { ConfigManager } from './config-manager'

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
  private isReconnecting: boolean = false
  private reconnectingToDepartment: string | null = null
  private spaceManager: SpaceManager | null = null
  private configManager: ConfigManager | null = null

  constructor(config: MatrixConfig) {
    this.config = config
    this.initializeSpaceManagement()
  }

  /**
   * Initialize space management components
   */
  private async initializeSpaceManagement(): Promise<void> {
    try {
      this.configManager = new ConfigManager()
      await this.configManager.loadSpaceConfiguration()
      
      // SpaceManager will be initialized when we have a connected client
      console.log('[MatrixClient] Space configuration loaded successfully')
    } catch (error) {
      console.warn('[MatrixClient] Failed to load space configuration:', error)
      // Continue without space management - fallback to legacy behavior
    }
  }

  /**
   * Initialize SpaceManager with connected Matrix client
   */
  private async initializeSpaceManagerWithClient(): Promise<void> {
    if (!this.client || !this.configManager) {
      return
    }

    try {
      const spacesConfig = await this.configManager.loadSpaceConfiguration()
      this.spaceManager = new SpaceManager(this.client, spacesConfig)
      console.log('[MatrixClient] SpaceManager initialized successfully')
    } catch (error) {
      console.warn('[MatrixClient] Failed to initialize SpaceManager:', error)
      this.spaceManager = null
    }
  }

  /**
   * Organize newly created room in Matrix Spaces hierarchy
   */
  private async organizeRoomInSpaces(roomId: string, departmentInfo?: { name: string; id: string }): Promise<SpaceSessionContext | null> {
    if (!this.spaceManager) {
      console.log('[MatrixClient] SpaceManager not available, skipping space organization')
      return null
    }

    try {
      // Convert department info to Department type for space resolution
      const department: Department = departmentInfo ? {
        id: departmentInfo.id,
        name: departmentInfo.name,
        matrix: this.config,
        widget: {}
      } : {
        id: 'support',
        name: 'Support',
        matrix: this.config,
        widget: {}
      }

      // Resolve appropriate space context for this room (defaults to web-chat channel)
      const spaceContext = await this.spaceManager.resolveSpaceForRoom(department, 'web-chat')

      // Add room to the appropriate space based on department space configuration
      const targetSpaceId = spaceContext.departmentSpaceId || spaceContext.channelSpaceId
      if (targetSpaceId) {
        await this.spaceManager.addRoomToSpace(roomId, targetSpaceId)
        console.log('[MatrixClient] Room successfully organized in space hierarchy', {
          roomId,
          targetSpaceId,
          department: department.name,
          spaceHierarchy: spaceContext.spaceHierarchy
        })
      }

      // Store space context in the session for future use
      const session = loadChatSession()
      if (session) {
        const updatedSession: ChatSession = {
          ...session,
          spaceContext: spaceContext
        }
        updateChatSession(updatedSession)
      }

      return spaceContext
    } catch (error) {
      console.error('[MatrixClient] Failed to organize room in spaces:', error)
      // Continue without space organization - don't break room creation
      return null
    }
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
          originalError('Matrix client filter permission errors suppressed (guest user limitations - functionality not affected)')
          this.hasLoggedFilterSuppression = true
        }
      }
    }
    
  }

  /**
   * Creates or retrieves a guest user for the customer chat session
   */
  private async getOrCreateGuestUser(userDetails: UserDetails): Promise<{userId: string, accessToken: string}> {
    const session = loadChatSession()
    
    // Check if we already have guest credentials stored
    if (session.guestUserId && session.guestAccessToken) {
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
      

      return {
        userId: guestUserId,
        accessToken: loginData.access_token
      }
    } catch (error) {
      console.error('Failed to create guest user:', error)
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
      // Phase 4.1: Structured logging for connection operations
      const snapshot = createRoomSnapshot(
        this.currentRoomId,
        getAllDepartmentRoomIds(),
        departmentId,
        this.isReconnecting,
        !!this.client
      )

      logRoomOperation('info', 'Connection initiated', {
        operation: 'connect',
        departmentId,
        userId: this.config.userId,
        metadata: {
          hasUserDetails: !!userDetails,
          isReconnection: !!departmentId && !userDetails
        }
      }, snapshot)

      // Set reconnection state if connecting to a specific department
      if (departmentId && !userDetails) {
        this.isReconnecting = true
        this.reconnectingToDepartment = departmentId
      }
      
      let userId: string
      let accessToken: string
      
      if (userDetails) {
        // Create or get guest user for this customer session
        const guestData = await this.getOrCreateGuestUser(userDetails)
        userId = guestData.userId
        accessToken = guestData.accessToken
        
        this.guestUserId = userId
        this.guestAccessToken = accessToken
        
      } else {
        // Check if we're reconnecting with guest credentials (during page refresh)
        if (this.config.user_id && this.config.user_id.includes('guest_')) {
          userId = this.config.user_id
          accessToken = this.config.accessToken
          
          // Set guest properties for proper history loading
          this.guestUserId = userId
          this.guestAccessToken = accessToken
          
        } else {
          // Fallback to support bot (for room management operations)
          userId = await this.getSupportBotUserId()
          accessToken = this.config.accessToken
          
        }
      }
      
      this.client = createClient({
        baseUrl: this.config.homeserver,
        accessToken: accessToken,
        userId: userId
      })

      // Initialize SpaceManager with connected client
      await this.initializeSpaceManagerWithClient()

      // Suppress non-critical Matrix client filter errors to reduce console noise
      this.suppressMatrixFilterErrors()

      // Store Matrix user ID for session tracking
      setMatrixUserId(userId)

      this.client.on(RoomEvent.Timeline, this.handleTimelineEvent.bind(this))
      this.client.on(ClientEvent.Sync, this.handleSync.bind(this))
      
      // Auto-join rooms on invite (Matrix SDK best practice) - but be department-aware
      this.client.on(RoomEvent.MyMembership, (room, membership, prevMembership) => {
        if (membership === 'invite') {
          this.client!.joinRoom(room.roomId).then(() => {
            
            // CRITICAL FIX: Don't override currentRoomId during department reconnection
            if (this.isReconnecting && this.reconnectingToDepartment) {
            } else {
              // Safe to set as current room for new invitations
              this.currentRoomId = room.roomId
            }
          }).catch((error) => {
            console.error('Failed to auto-join room:', error)
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
          const hasAccess = await this.ensureRoomAccess(departmentRoomId, departmentId)
          if (hasAccess) {
            this.currentRoomId = departmentRoomId
          } else {
            setDepartmentRoomStatus(departmentId, departmentRoomId, 'invalid', 'access_lost') // Mark as invalid
          }
        } else {
        }
      } else {
        // Legacy/initial connection - try to restore any existing room
        const existingRoomId = getCurrentRoomId()
        if (existingRoomId) {
          const hasAccess = await this.verifyRoomAccess(existingRoomId)
          
          if (hasAccess) {
            this.currentRoomId = existingRoomId
          } else {
            setRoomId('')
          }
        } else {
        }
      }
      
      // Clear reconnection state after successful connection and room restoration
      if (this.isReconnecting) {
        this.isReconnecting = false
        this.reconnectingToDepartment = null
      }
      
      // Phase 3.1: Validate room state after connection
      if (departmentId) {
        const isValid = await this.validateAndRecoverRoomState(departmentId)
        if (!isValid) {
          console.warn('[CONNECT] Room state validation failed, may need re-invitation')
        }
      }
      
      // Phase 4.1: Log successful connection
      const finalSnapshot = createRoomSnapshot(
        this.currentRoomId,
        getAllDepartmentRoomIds(),
        departmentId,
        this.isReconnecting,
        !!this.client
      )

      logRoomOperation('info', 'Connection completed successfully', {
        operation: 'connect',
        departmentId,
        roomId: this.currentRoomId || undefined,
        userId: userId,
        metadata: {
          finalRoomId: this.currentRoomId,
          wasReconnecting: this.isReconnecting
        }
      }, finalSnapshot)
      
      this.notifyConnection(true)
    } catch (error) {
      // Phase 3.2: Context-aware error handling for connection
      const context: ErrorContext = {
        action: departmentId ? 'reconnection' : 'connection',
        originalError: error as Error,
        department: departmentId ? { id: departmentId, name: departmentId } as any : undefined
      }
      
      console.error('[CONNECT] Connection failed:', {
        departmentId,
        error: error,
        isReconnecting: this.isReconnecting,
        retryable: isRetryableError(error as Error)
      })
      
      this.notifyError(error as Error, context)
      throw error
    }
  }

  async disconnect(currentDepartmentId?: string): Promise<void> {
    if (this.client) {
      
      // Phase 4.1: Log disconnect operation with Strategy 2 context
      const preDisconnectSnapshot = createRoomSnapshot(
        this.currentRoomId,
        getAllDepartmentRoomIds(),
        currentDepartmentId,
        this.isReconnecting,
        !!this.client
      )

      if (currentDepartmentId) {
        logDepartmentSwitch('room_cleanup', null, currentDepartmentId, preDisconnectSnapshot, {
          totalRoomsBeforeCleanup: Object.keys(getAllDepartmentRoomIds()).length
        })
      }

      logRoomOperation('info', 'Disconnect initiated', {
        operation: 'disconnect',
        departmentId: currentDepartmentId,
        metadata: {
          strategy: currentDepartmentId ? 'Strategy2' : 'Legacy',
          preserveDepartment: currentDepartmentId
        }
      }, preDisconnectSnapshot)
      
      // Strategy 2: Leave non-current department rooms before disconnecting
      if (currentDepartmentId) {
        await this.leaveDepartmentRooms(currentDepartmentId)
      } else {
        // Legacy behavior: preserve all room memberships
      }
      
      // Remove all event listeners to prevent bleeding events
      this.client.removeAllListeners()
      
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
    
    // Clear reconnection state
    this.isReconnecting = false
    this.reconnectingToDepartment = null
    
    // Clear guest credentials but preserve room data
    this.guestUserId = null
    this.guestAccessToken = null
    
    this.notifyConnection(false)
  }

  async createOrJoinSupportRoom(userDetails: UserDetails, departmentInfo?: { name: string; id: string }, isDepartmentSwitch?: boolean): Promise<string> {
    if (!this.client) {
      throw new Error('Matrix client not connected')
    }

    try {
      const session = loadChatSession()
      
      // Strategy 2.1: Enhanced department room connection logic with re-invitation
      if (departmentInfo) {
        const roomInfo = getDepartmentRoomInfo(departmentInfo.id)
        
        if (roomInfo && roomInfo.status === 'left') {
          
          const reconnected = await this.rejoinExistingRoom(roomInfo.roomId, departmentInfo.id, departmentInfo.name)
          if (reconnected) {
            setDepartmentRoomStatus(departmentInfo.id, roomInfo.roomId, 'active', 'department_switch_return')
            return roomInfo.roomId
          } else {
            setDepartmentRoomStatus(departmentInfo.id, roomInfo.roomId, 'invalid', 'rejoin_failed')
          }
        } else if (roomInfo && roomInfo.status === 'active') {
          // Active room - verify access
          if (await this.verifyRoomAccess(roomInfo.roomId)) {
            this.currentRoomId = roomInfo.roomId
            
            // Send a message indicating user is returning to this department
            if (session.isReturningUser && session.conversationCount > 0) {
              await this.sendMessage(`I'm back to continue our conversation with ${departmentInfo.name}.`)
            }
            
            return roomInfo.roomId
          } else {
            setDepartmentRoomStatus(departmentInfo.id, roomInfo.roomId, 'invalid', 'access_lost')
          }
        } else if (roomInfo && roomInfo.status === 'invalid') {
        } else {
        }
      } else {
        // Legacy support (no department info) - check global room
        let targetRoomId = this.currentRoomId
        if (session.isReturningUser && !targetRoomId) {
          targetRoomId = getCurrentRoomId() || null
        }
        
        if (targetRoomId && await this.verifyRoomAccess(targetRoomId)) {
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

        // Phase 2: Matrix Spaces Integration - Organize room in space hierarchy
        await this.organizeRoomInSpaces(this.currentRoomId, departmentInfo)

        // Store room ID for future sessions
        setRoomId(this.currentRoomId)

        // Invite the guest user to the room
        await supportBotClient.invite(this.currentRoomId, currentUserId)
        
        // Now the guest user (our current client) needs to join the room
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
          await this.client.sendTextMessage(this.currentRoomId, userDetails.message)
        }
        
        
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

        // Phase 2: Matrix Spaces Integration - Organize room in space hierarchy
        await this.organizeRoomInSpaces(this.currentRoomId, departmentInfo)

        setRoomId(this.currentRoomId)
        
      }

      return this.currentRoomId
    } catch (error) {
      this.notifyError(error as Error)
      throw error
    }
  }

  async sendMessage(text: string): Promise<void> {
    if (!this.client || !this.currentRoomId) {
      console.error('[MESSAGE_SEND] No active room. Client:', !!this.client, 'Room:', this.currentRoomId)
      throw new Error('No active room to send message to')
    }
    
    // Phase 3.1: Validate room state before sending message
    const isValid = this.validateCurrentRoomId()
    if (!isValid) {
      console.warn('[MESSAGE_SEND] Room state validation failed, attempting recovery')
      const recovered = await this.validateAndRecoverRoomState()
      if (!recovered) {
        throw new Error('Room state corrupted and recovery failed - cannot send message')
      }
    }
    
    const sender = this.client.getUserId()

    try {
      await this.client.sendTextMessage(this.currentRoomId, text)
    } catch (error) {
      // Phase 3.2: Context-aware error handling for message sending
      const selectedDept = getCurrentRoomId() // Use room-based context for legacy support
      const context: ErrorContext = {
        action: 'message_send',
        originalError: error as Error,
        department: selectedDept ? { id: 'current', name: 'support' } as any : undefined
      }
      
      console.error('[MESSAGE_SEND] Failed:', {
        error: error,
        roomId: this.currentRoomId,
        retryable: isRetryableError(error as Error),
        userId: this.client?.getUserId()
      })
      
      this.notifyError(error as Error, context)
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
      console.warn('Timeline event received with no room context')
      return
    }
    
    if (!this.currentRoomId) {
      console.warn('Timeline event received but no currentRoomId set:', {
        eventRoom: room.roomId,
        eventType: event.getType()
      })
      return
    }
    
    if (room.roomId !== this.currentRoomId) {
      console.warn('Timeline event from different room (potential bleed):', {
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
      // Don't log duplicate skip - too noisy
      return
    }

    // For returning users, process messages during initial sync (this IS history restoration)
    // For new users, skip messages during initial sync to avoid processing old room history
    const session = loadChatSession()
    const isReturningUser = session.isReturningUser
    
    if (!this.initialSyncComplete && !isReturningUser) {
      this.processedMessageIds.add(eventId)
      // Don't log initial sync skip - too noisy
      return
    } else if (!this.initialSyncComplete && isReturningUser) {
      // Don't log returning user processing - too noisy
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
    
    // Only log important timeline events
    if (Date.now() - event.getTs() < 5000) { // Log only recent messages (< 5 seconds old)
    }
    
    // Simple approach: For returning users, always include customer messages during initial connection
    // This allows history restoration via timeline events
    const messageAge = Date.now() - event.getTs()
    const isRecentMessage = messageAge < (24 * 60 * 60 * 1000) // Less than 24 hours old
    const isInitialConnection = (Date.now() - this.connectionTimestamp) < 30000 // First 30 seconds after connection
    
    // For customer messages: ONLY include during explicit history loading
    // Never process customer messages via timeline during live chat to prevent duplication
    const shouldIncludeCustomerMessage = isCustomerMessage && this.isLoadingHistory
    
    if (isCustomerMessage && !shouldIncludeCustomerMessage) {
      this.processedMessageIds.add(eventId)
      return
    } else if (shouldIncludeCustomerMessage) {
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
    
    this.processedMessageIds.add(eventId)
    this.notifyMessage(message)
  }

  private handleSync(state: string): void {
    if (state === 'SYNCING') {
      this.notifyConnection(true)
    } else if (state === 'PREPARED') {
      // Initial sync is complete, now we can process new timeline events
      this.initialSyncComplete = true
    }
  }

  private notifyMessage(message: ChatMessage): void {
    this.messageCallbacks.forEach(callback => callback(message))
  }

  private notifyConnection(connected: boolean): void {
    this.connectionCallbacks.forEach(callback => callback(connected))
  }

  private notifyError(error: Error, context?: ErrorContext): void {
    // Phase 3.2: Enhanced error handling with context
    if (context) {
      logError(context, { currentRoomId: this.currentRoomId, clientConnected: !!this.client })
      
      // Provide user-friendly error message
      const userMessage = getUserFriendlyErrorMessage(context)
      if (userMessage) {
        // Create user-friendly error for callbacks
        const friendlyError = new Error(userMessage)
        ;(friendlyError as any).original = error
        ;(friendlyError as any).context = context
        this.errorCallbacks.forEach(callback => callback(friendlyError))
        return
      }
    }
    
    // Fallback to original error
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
            return true
        } else {
          return false
        }
      } else if (response.status === 404) {
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
      // Set flag to indicate we're loading history (affects timeline event handling)
      this.isLoadingHistory = true
      const currentUserId = this.client.getUserId()

      // Try to get messages from client cache first (if room is loaded)
      const room = this.client.getRoom(roomId)
      if (room && room.getLiveTimeline().getEvents().length > 0) {
        // Get the guest user ID from session for proper customer message identification
        const session = loadChatSession()
        const sessionGuestUserId = session.guestUserId || session.matrixUserId
        
        
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
          this.isLoadingHistory = false
          return messages
        }
      }

      // Fallback to API call (useful after page refresh when cache is empty)
      
      // Use appropriate access token based on current user
      const isGuestUser = currentUserId.includes('guest_')
      const accessToken = isGuestUser 
        ? (this.guestAccessToken || this.config.accessToken) // Fallback to config token during reconnection
        : this.config.accessToken
      
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

      // Get the guest user ID from session to properly identify customer messages
      const session = loadChatSession()
      const sessionGuestUserId = session.guestUserId || session.matrixUserId
      
      
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

      return messages
    } catch (error) {
      console.error('Failed to load message history:', error)
      throw error
    } finally {
      // Always reset the flag when history loading is complete
      this.isLoadingHistory = false
    }
  }

  /**
   * Joins an existing Matrix room (for reconnection purposes)
   */
  async joinRoom(roomId: string, departmentId?: string): Promise<void> {
    if (!this.client) {
      throw new Error('Matrix client not connected')
    }

    
    try {
      // First check if we're already in the room
      const room = this.client.getRoom(roomId)
      if (room && room.getMyMembership() === 'join') {
        this.currentRoomId = roomId
        return
      }

      // Join the room via Matrix API
      await this.client.joinRoom(roomId)
      const oldRoomId = this.currentRoomId
      this.currentRoomId = roomId
      
      // Strategy 2.1: Update storage with 'active' status for new rooms
      if (departmentId) {
        setDepartmentRoomStatus(departmentId, roomId, 'active', 'room_created')
      } else {
        // Legacy behavior - update global room storage
        setRoomId(roomId)
      }
      
      
    } catch (error: any) {
      console.error(`Failed to join room ${roomId}:`, error)
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
   * Gets all department rooms that the user is currently in
   * Used for Strategy 2 room cleanup during department switches
   */
  private async getAllDepartmentRooms(): Promise<string[]> {
    if (!this.client) {
      return []
    }

    const departmentRoomIds = getAllDepartmentRoomIds()
    const joinedRooms: string[] = []

    for (const [departmentId, roomId] of Object.entries(departmentRoomIds)) {
      if (roomId) {
        try {
          const room = this.client.getRoom(roomId)
          if (room && room.getMyMembership() === 'join') {
            joinedRooms.push(roomId)
          }
        } catch (error) {
          console.warn(`Error checking room ${roomId} for department ${departmentId}:`, error)
        }
      }
    }

    return joinedRooms
  }

  /**
   * Leaves a specific Matrix room
   * Used for Strategy 2 room cleanup
   */
  private async leaveRoom(roomId: string): Promise<void> {
    if (!this.client) {
      throw new Error('Matrix client not connected')
    }

    try {
      
      // Check if we're actually in the room
      const room = this.client.getRoom(roomId)
      if (!room || room.getMyMembership() !== 'join') {
        return
      }

      // Leave the room
      await this.client.leave(roomId)
      
    } catch (error: any) {
      console.error(`[LEAVE_ROOM] Failed to leave room ${roomId}:`, error)
      
      // Don't throw - we want to continue with other room operations
      // Room leave failures shouldn't break department switching
    }
  }

  /**
   * Leaves all department rooms except the specified current one
   * Core method for Strategy 2 implementation
   */
  private async leaveDepartmentRooms(excludeDepartmentId?: string): Promise<void> {
    if (!this.client) {
      return
    }

    try {
      
      const allDepartmentRooms = getAllDepartmentRoomIds()
      const leavePromises: Promise<void>[] = []

      for (const [deptId, roomId] of Object.entries(allDepartmentRooms)) {
        // Skip the current department room
        if (deptId === excludeDepartmentId) {
          continue
        }

        if (roomId) {
          
          // Strategy 2.1: Leave room but preserve in storage with 'left' status
          const leavePromise = this.leaveRoom(roomId).then(() => {
            setDepartmentRoomStatus(deptId, roomId, 'left', 'department_switch')
          }).catch((error) => {
            // Phase 3.2: Context-aware error handling for department cleanup
            const context: ErrorContext = {
              action: 'department_switch_room_creation', // This is part of department switching
              originalError: error as Error,
              department: { id: deptId, name: deptId } as any
            }
            
            logError(context, { 
              operation: 'room_cleanup', 
              excludedDepartment: excludeDepartmentId,
              roomId: roomId 
            })
            
            console.warn(`[LEAVE_DEPARTMENTS] Failed to clean up department ${deptId}:`, error)
            // Continue with other departments even if one fails
          })
          
          leavePromises.push(leavePromise)
        }
      }

      // Wait for all leave operations to complete (with individual error handling)
      if (leavePromises.length > 0) {
        await Promise.all(leavePromises)
      } else {
      }

    } catch (error) {
      // Phase 3.2: Context-aware error handling for Strategy 2 cleanup
      const context: ErrorContext = {
        action: 'department_switch_room_creation',
        originalError: error as Error,
        department: excludeDepartmentId ? { id: excludeDepartmentId, name: excludeDepartmentId } as any : undefined
      }
      
      logError(context, { 
        operation: 'strategy_2_cleanup', 
        excludedDepartment: excludeDepartmentId,
        totalRooms: Object.keys(getAllDepartmentRoomIds()).length
      })
      
      console.error('[LEAVE_DEPARTMENTS] Error during room cleanup:', {
        error: error,
        excludeDepartmentId,
        retryable: isRetryableError(error as Error)
      })
      // Don't throw - room cleanup failures shouldn't break department switching
    }
  }

  /**
   * Handles department room access - checks if user needs re-invitation
   * Returns true if user has access, false if re-invitation needed
   * Used for Strategy 2 when returning to previously left departments
   */
  private async handleDepartmentRoomAccess(departmentId: string, roomId: string): Promise<boolean> {
    if (!this.client) {
      return false
    }

    try {
      
      // First, verify if we still have access to the room
      const hasAccess = await this.verifyRoomAccess(roomId)
      
      if (hasAccess) {
        return true
      }
      
      // No access - need to request re-invitation
      const reinvited = await this.requestRoomReinvitation(roomId, departmentId, departmentId)
      
      return reinvited // Return whether re-invitation succeeded
      
    } catch (error) {
      console.error(`[ROOM_ACCESS] Error checking room access for ${departmentId}:`, error)
      return false
    }
  }


  /**
   * Enhanced room access verification with re-invitation handling
   * Returns true if user has access or successfully rejoined
   * Used in department reconnection flow
   */
  private async ensureRoomAccess(roomId: string, departmentId: string): Promise<boolean> {
    try {
      
      // First, try direct access verification
      const hasDirectAccess = await this.verifyRoomAccess(roomId)
      if (hasDirectAccess) {
        return true
      }

      // No direct access - attempt re-invitation
      const reinvited = await this.requestRoomReinvitation(roomId, departmentId, departmentId)
      if (!reinvited) {
        console.warn(`[ENSURE_ACCESS] Re-invitation failed for ${departmentId}`)
        return false
      }
      
      // Wait a moment for the invitation to be processed and auto-joined
      await new Promise(resolve => setTimeout(resolve, 2000))
      
      // Verify access after re-invitation
      const hasAccessAfterReinvite = await this.verifyRoomAccess(roomId)
      if (hasAccessAfterReinvite) {
        return true
      }
      
      console.warn(`[ENSURE_ACCESS] Re-invitation failed for ${departmentId}, may need new room`)
      return false
      
    } catch (error) {
      console.error(`[ENSURE_ACCESS] Error ensuring room access for ${departmentId}:`, error)
      return false
    }
  }

  /**
   * Phase 3.1: Room ID Validation and Recovery
   * Validates that currentRoomId matches expected department and recovers from corruption
   */
  
  /**
   * Validates that the current room ID matches the expected department
   * This helps detect room state corruption that could interfere with Strategy 2
   */
  private validateCurrentRoomId(expectedDepartmentId?: string): boolean {
    try {
      // If no department specified, just check if we have a valid current room
      if (!expectedDepartmentId) {
        const isValid = !!this.currentRoomId && this.currentRoomId.startsWith('!')
        return isValid
      }

      // Check if current room matches expected department room
      const expectedRoomId = getDepartmentRoomId(expectedDepartmentId)
      const currentMatches = this.currentRoomId === expectedRoomId
      
      // Additional validation: check if current room exists in storage at all
      const allDepartmentRooms = getAllDepartmentRoomIds()
      const currentRoomInStorage = Object.values(allDepartmentRooms).includes(this.currentRoomId || '')
      

      // Room is valid if:
      // 1. Current room matches expected department room, OR
      // 2. Current room is null/undefined (fresh start), OR  
      // 3. Current room exists somewhere in department storage (valid room, maybe different dept)
      const isValid = currentMatches || !this.currentRoomId || currentRoomInStorage

      if (!isValid) {
        console.warn(`[VALIDATE] Room ID validation failed:`, {
          issue: 'Current room ID not found in any department storage',
          currentRoomId: this.currentRoomId,
          expectedDepartmentId,
          expectedRoomId,
          suggestedAction: 'Room state recovery needed'
        })
      }

      return isValid

    } catch (error) {
      console.error(`[VALIDATE] Error during room ID validation:`, error)
      return false
    }
  }

  /**
   * Recovers from room state corruption by cleaning up invalid state
   * and restoring consistent room state for the specified department
   */
  private async recoverRoomState(departmentId: string): Promise<void> {
    try {

      // Step 1: Clear corrupted current room state
      const previousRoomId = this.currentRoomId
      this.currentRoomId = null

      // Step 2: Get the expected room for this department
      const expectedRoomId = getDepartmentRoomId(departmentId)

      if (expectedRoomId) {
        // Step 3: Verify access to the expected room
        const hasAccess = await this.verifyRoomAccess(expectedRoomId)
        
        if (hasAccess) {
          // Room exists and we have access - restore it
          this.currentRoomId = expectedRoomId
        } else {
          // Room exists in storage but we lost access - try re-invitation
          const accessRestored = await this.ensureRoomAccess(expectedRoomId, departmentId)
          
          if (accessRestored) {
            this.currentRoomId = expectedRoomId
          } else {
            // Re-invitation failed - clear invalid room from storage
            console.warn(`[RECOVER] Re-invitation failed, clearing invalid room from storage`)
            clearDepartmentRoomId(departmentId)
          }
        }
      } else {
        // No room exists for this department - this is normal for new conversations
      }

      // Step 4: Clean up any other corrupted room references
      if (previousRoomId && previousRoomId !== this.currentRoomId) {
        // Previous room was corrupted - run storage cleanup to remove invalid entries
        const allRooms = getAllDepartmentRoomIds()
        let foundCorruptedEntry = false
        
        for (const [deptId, roomId] of Object.entries(allRooms)) {
          if (roomId === previousRoomId && deptId !== departmentId) {
            clearDepartmentRoomId(deptId)
            foundCorruptedEntry = true
          }
        }
        
        if (foundCorruptedEntry) {
        }
      }


    } catch (error) {
      console.error(`[RECOVER] Room state recovery failed for ${departmentId}:`, error)
      
      // Fallback: ensure we're in a clean state even if recovery fails
      this.currentRoomId = null
    }
  }

  /**
   * Validates and recovers room state if needed
   * This is a public method that can be called during critical operations
   */
  async validateAndRecoverRoomState(expectedDepartmentId?: string): Promise<boolean> {
    try {

      // First, validate current room state
      const isValid = this.validateCurrentRoomId(expectedDepartmentId)
      
      if (isValid) {
        return true
      }

      // Room state is invalid - attempt recovery if we have a department context
      if (expectedDepartmentId) {
        await this.recoverRoomState(expectedDepartmentId)
        
        // Validate again after recovery
        const isValidAfterRecovery = this.validateCurrentRoomId(expectedDepartmentId)
        
        if (isValidAfterRecovery) {
          return true
        } else {
          console.warn(`[VALIDATE_RECOVER] Room state recovery was unsuccessful`)
          return false
        }
      } else {
        console.warn(`[VALIDATE_RECOVER] Cannot recover room state without department context`)
        return false
      }

    } catch (error) {
      console.error(`[VALIDATE_RECOVER] Error during validation and recovery:`, error)
      return false
    }
  }

  /**
   * Strategy 2.1: Attempts to rejoin an existing room that user previously left
   * Used when user returns to a department they were previously active in
   */
  private async rejoinExistingRoom(roomId: string, departmentId: string, departmentName: string): Promise<boolean> {
    if (!this.client) {
      return false
    }

    try {
      
      // Check if room still exists and is accessible
      const roomExists = await this.verifyRoomExists(roomId)
      if (!roomExists) {
        return false
      }
      
      // Try to get the room from the client
      const room = this.client.getRoom(roomId)
      if (!room) {
        return false
      }
      
      // Check current membership status
      const currentUserId = this.client.getUserId()
      if (!currentUserId) {
        return false
      }
      
      const membership = room.getMyMembership()
      
      if (membership === 'join') {
        // Already in the room
        this.currentRoomId = roomId
        await this.sendMessage(`I'm back to continue our conversation with ${departmentName}.`)
        return true
      } else if (membership === 'invite') {
        // We have an invitation, accept it
        await this.client.joinRoom(roomId)
        this.currentRoomId = roomId
        await this.sendMessage(`I'm back to continue our conversation with ${departmentName}.`)
        return true
      } else {
        // Need to request re-invitation via bot
        return await this.requestRoomReinvitation(roomId, departmentId, departmentName)
      }
      
    } catch (error) {
      console.error('[REJOIN] Error during rejoin attempt:', {
        roomId,
        departmentId,
        error: (error as Error).message
      })
      
      // Log structured error
      logRoomOperation('error', 'rejoin_existing_room', {
        roomId,
        departmentId,
        error: (error as Error).message,
        retryable: isRetryableError(error as Error)
      })
      
      return false
    }
  }
  
  /**
   * Strategy 2.1: Requests re-invitation to a room via the bot user
   */
  private async requestRoomReinvitation(roomId: string, departmentId: string, departmentName: string): Promise<boolean> {
    try {
      
      // Check if bot is configured
      if (!this.config.accessToken || !this.config.botUserId) {
        return false
      }
      
      const currentUserId = this.client?.getUserId()
      if (!currentUserId) {
        return false
      }
      
      // Make API call to invite user back to the room using bot credentials
      const inviteUrl = `${this.config.homeserver}/_matrix/client/r0/rooms/${encodeURIComponent(roomId)}/invite`
      
      const inviteResponse = await fetch(inviteUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.config.accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          user_id: currentUserId
        })
      })
      
      if (!inviteResponse.ok) {
        const errorData = await inviteResponse.json()
        return false
      }
      
      
      // Wait a moment for the invitation to arrive
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      // Try to join the room
      await this.client!.joinRoom(roomId)
      this.currentRoomId = roomId
      
      
      // Send welcome back message
      await this.sendMessage(`I'm back to continue our conversation with ${departmentName}.`)
      
      return true
      
    } catch (error) {
      console.error('[REINVITE] Error during re-invitation process:', {
        roomId,
        departmentId,
        error: (error as Error).message
      })
      
      return false
    }
  }
  
  /**
   * Strategy 2.1: Verifies if a room still exists on the server
   */
  private async verifyRoomExists(roomId: string): Promise<boolean> {
    try {
      if (!this.client) {
        return false
      }
      
      // Try to get room state to verify existence
      const stateUrl = `${this.config.homeserver}/_matrix/client/r0/rooms/${encodeURIComponent(roomId)}/state`
      
      const response = await fetch(stateUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.config.accessToken}`
        }
      })
      
      // Room exists if we can get state (even if we can't access it)
      return response.status !== 404
      
    } catch (error) {
      console.warn('[VERIFY_ROOM] Could not verify room existence:', roomId, error)
      return false
    }
  }

  /**
   * Starts a fresh conversation (clears current room)
   */
  startFreshConversation(): void {
    this.currentRoomId = null
    this.processedMessageIds.clear()
    this.initialSyncComplete = false
  }
}