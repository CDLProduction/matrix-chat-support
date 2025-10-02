import React, { useState, useEffect, useRef } from 'react'
import { MatrixChatClient } from '@/utils/matrix-client'
import { ChatMessage, UserDetails, MatrixChatWidgetProps, ChatState } from '@/types'
import { 
  loadChatSession, 
  updateUserDetails, 
  incrementConversationCount, 
  clearChatSession, 
  getSessionInfo,
  setSelectedDepartment,
  getSelectedDepartment,
  setDepartmentRoomId,
  getDepartmentRoomId,
  incrementDepartmentConversationCount,
  setRoomId
} from '@/utils/chat-storage'
import { getUserFriendlyErrorMessage, validateWidgetConfig, logError, isRetryableError } from '@/utils/error-handler'
import DepartmentSelector from './DepartmentSelector'
import CommunicationChannelSelector from './CommunicationChannelSelector'
import SocialMediaIntegration from './SocialMediaIntegration'
import UserDetailsForm from './UserDetailsForm'
import ChatInterface from './ChatInterface'
import styles from '@/styles/widget.module.css'

const ChatWidget: React.FC<MatrixChatWidgetProps> = ({ config, onError, onConnect, onMessage, onDepartmentSelect, onSpaceContext }) => {
  // Initialize state with proper step based on configuration
  const initialStep = config.departments && config.departments.length > 0 ? 'department-selection' : 'user-form'
  
  const [chatState, setChatState] = useState<ChatState>({
    currentStep: initialStep,
    selectedDepartment: undefined,
    selectedChannel: undefined,
    selectedSocialMedia: undefined,
    isOpen: false,
    isConnected: false,
    isLoading: false,
    messages: [],
    userDetails: undefined,
    error: undefined,
    roomId: undefined,
    session: undefined,
    isLoadingHistory: false,
    matrixClient: undefined
  })
  const [successMessage, setSuccessMessage] = useState<string | undefined>()

  const [currentMessage, setCurrentMessage] = useState('')
  const [userForm, setUserForm] = useState<UserDetails>({
    name: '',
    email: '',
    phone: '',
    message: ''
  })

  const clientRef = useRef<MatrixChatClient | null>(null)

  // Call onSpaceContext callback when space context becomes available
  useEffect(() => {
    if (chatState.session?.spaceContext && onSpaceContext) {
      onSpaceContext(chatState.session.spaceContext)
    }
  }, [chatState.session?.spaceContext, onSpaceContext])

  // Helper function to get effective matrix config (department-specific or legacy)
  const getEffectiveMatrixConfig = () => {
    if (chatState.selectedDepartment) {
      return chatState.selectedDepartment.matrix
    }
    // Fallback to legacy config for backward compatibility
    return config.matrix!
  }

  // Helper function to get effective widget config (department-specific or legacy)
  const getEffectiveWidgetConfig = () => {
    if (chatState.selectedDepartment) {
      return {
        greeting: chatState.selectedDepartment.widget.greeting || config.widget.greeting,
        placeholderText: chatState.selectedDepartment.widget.placeholderText || config.widget.placeholderText
      }
    }
    return {
      greeting: config.widget.greeting,
      placeholderText: config.widget.placeholderText
    }
  }

  // Department selection handler
  const handleDepartmentSelect = (department: any) => {
    // Store department selection in persistent storage
    setSelectedDepartment(department)

    setChatState(prev => ({
      ...prev,
      selectedDepartment: department,
      currentStep: 'channel-selection',
      selectedChannel: undefined,
      selectedSocialMedia: undefined,
      error: undefined
    }))

    onDepartmentSelect?.(department)
  }

  // Communication channel selection handler
  const handleChannelSelect = async (channel: any) => {
    setChatState(prev => ({
      ...prev,
      selectedChannel: channel,
      selectedSocialMedia: channel.socialMedia,
      error: undefined
    }))

    // For web-chat channel with existing userDetails, attempt reconnection
    if (channel.type === 'web' && chatState.userDetails && chatState.selectedDepartment) {
      const departmentRoomId = getDepartmentRoomId(chatState.selectedDepartment.id)
      const session = loadChatSession()

      // Check if we have a room to reconnect to
      if (departmentRoomId && session.roomId) {
        console.log('[CHANNEL_SELECT] Existing user returning to department, attempting reconnection...')

        // Show loading state
        setChatState(prev => ({
          ...prev,
          currentStep: 'user-form',  // Temporary state while connecting
          isLoading: true
        }))

        // Attempt reconnection
        const success = await attemptReconnection(chatState.selectedDepartment, session)

        if (!success) {
          // Reconnection failed - show form to start fresh
          setChatState(prev => ({
            ...prev,
            currentStep: 'user-form',
            isLoading: false,
            error: 'Could not restore your previous conversation. Starting a new chat.'
          }))
        }
        // If success, attemptReconnection already set currentStep: 'chat'
      } else {
        // No existing room - go to form to create new chat
        console.log('[CHANNEL_SELECT] No existing room found, showing form for new chat')
        setChatState(prev => ({
          ...prev,
          currentStep: 'user-form'
        }))
      }
    } else if (channel.type === 'social') {
      // Social media channel
      setChatState(prev => ({
        ...prev,
        currentStep: 'social-media-setup'
      }))
    } else {
      // Web chat for new user or no existing room
      setChatState(prev => ({
        ...prev,
        currentStep: 'user-form'
      }))
    }
  }

  // Social media selection handler
  const handleSocialMediaContinue = () => {
    // For social media, we close the widget since the user is being redirected
    setChatState(prev => ({ ...prev, isOpen: false }))
  }

  // Back navigation handlers
  const handleBackToDepartments = () => {
    setChatState(prev => ({
      ...prev,
      currentStep: 'department-selection',
      selectedChannel: undefined,
      selectedSocialMedia: undefined
    }))
  }

  const handleBackToChannels = () => {
    setChatState(prev => ({
      ...prev,
      currentStep: 'channel-selection',
      selectedSocialMedia: undefined
    }))
  }

  // Get available communication channels
  const getCommunicationChannels = () => {
    const channels = []

    // Add web chat option
    channels.push({
      type: 'web' as const,
      id: 'web-chat',
      name: 'Web Chat',
      description: 'Start a conversation right here in your browser',
      icon: '💬',
      color: '#4F46E5',
      available: true
    })

    // Add social media channels if configured
    if (config.socialMedia) {
      config.socialMedia.forEach(socialChannel => {
        if (socialChannel.enabled) {
          channels.push({
            type: 'social' as const,
            id: socialChannel.id,
            name: socialChannel.name,
            description: `Continue on ${socialChannel.platform}`,
            icon: socialChannel.icon,
            color: socialChannel.color,
            available: true,
            socialMedia: socialChannel
          })
        }
      })
    }

    return channels
  }

  // Initialize session on component mount
  useEffect(() => {
    // Validate configuration first
    const configErrors = validateWidgetConfig(config)
    if (configErrors.length > 0) {
      console.error('🚨 Widget configuration errors:', configErrors)
      setChatState(prev => ({ 
        ...prev, 
        error: `Configuration error: ${configErrors[0]}` 
      }))
      return
    }
    
    const session = loadChatSession()
    setChatState(prev => ({ 
      ...prev, 
      session,
      // Restore user details from session to fix white screen bug on refresh
      userDetails: session.userDetails
    }))
    
    // Pre-fill form if user has previous details
    if (session.userDetails) {
      setUserForm(session.userDetails)
    }
    
    // Restore selected department if user is returning
    const storedDepartment = getSelectedDepartment()
    if (storedDepartment && config.departments) {
      // Find the department in current config to make sure it still exists
      const validDepartment = config.departments.find(d => d.id === storedDepartment.id)
      if (validDepartment) {
        // Don't show chat UI yet - keep in loading state during reconnection
        setChatState(prev => ({
          ...prev,
          selectedDepartment: validDepartment,
          currentStep: 'user-form',  // Stay in form state while reconnecting
          isLoading: session.userDetails ? true : false,  // Show loading if reconnecting
          error: undefined
        }))

        // Attempt to reconnect if user has existing session with room
        if (session.userDetails && session.roomId) {
          attemptReconnection(validDepartment, session).then((success) => {
            if (!success) {
              // Reconnection failed - show error and allow fresh start
              setChatState(prev => ({
                ...prev,
                isLoading: false,
                currentStep: 'user-form',
                error: 'Could not restore your previous conversation. Please start a new chat.'
              }))
            }
            // If success, attemptReconnection already updated the state
          }).catch((error) => {
            console.error('[WIDGET] Reconnection error:', error)
            setChatState(prev => ({
              ...prev,
              isLoading: false,
              currentStep: 'user-form',
              error: 'Failed to restore conversation. Please start a new chat.'
            }))
          })
        }
      } else {
        console.warn('⚠️ Stored department no longer exists in config:', storedDepartment.id)
        // Clear invalid department selection
        setChatState(prev => ({
          ...prev,
          selectedDepartment: undefined,
          currentStep: 'department-selection'
        }))
      }
    } else if (session.userDetails && session.roomId && !config.departments) {
      // Legacy mode reconnection - no departments
      setChatState(prev => ({
        ...prev,
        isLoading: true,
        error: undefined
      }))

      attemptLegacyReconnection(session).then((success) => {
        if (!success) {
          setChatState(prev => ({
            ...prev,
            isLoading: false,
            error: 'Could not restore your previous conversation. Please start a new chat.'
          }))
        }
      }).catch((error) => {
        console.error('[WIDGET] Legacy reconnection error:', error)
        setChatState(prev => ({
          ...prev,
          isLoading: false,
          error: 'Failed to restore conversation. Please start a new chat.'
        }))
      })
    }

  }, [])

  // Handle edge case: userDetails exist but no client when in user-form step
  // This catches scenarios where reconnection didn't trigger properly
  useEffect(() => {
    // Only trigger if:
    // 1. We're in user-form step
    // 2. User details exist (returning user)
    // 3. Selected department exists
    // 4. No loading in progress
    // 5. No Matrix client (disconnected state)
    if (
      chatState.currentStep === 'user-form' &&
      chatState.userDetails &&
      chatState.selectedDepartment &&
      !chatState.isLoading &&
      !chatState.matrixClient
    ) {
      console.log('[EDGE_CASE] Detected returning user without client, checking for reconnection...')

      const departmentRoomId = getDepartmentRoomId(chatState.selectedDepartment.id)
      const session = loadChatSession()

      if (departmentRoomId && session.roomId) {
        console.log('[EDGE_CASE] Triggering reconnection...')
        setChatState(prev => ({ ...prev, isLoading: true }))

        attemptReconnection(chatState.selectedDepartment, session).then((success) => {
          if (!success) {
            setChatState(prev => ({
              ...prev,
              isLoading: false,
              error: 'Could not restore conversation. Please fill the form to start a new chat.'
            }))
          }
        }).catch((error) => {
          console.error('[EDGE_CASE] Reconnection error:', error)
          setChatState(prev => ({
            ...prev,
            isLoading: false,
            error: 'Failed to restore conversation. Please fill the form to start a new chat.'
          }))
        })
      }
    }
  }, [chatState.currentStep, chatState.userDetails, chatState.selectedDepartment, chatState.matrixClient, chatState.isLoading])

  // Attempt to reconnect to existing chat session
  const attemptReconnection = async (department: any, session: any): Promise<boolean> => {
    try {
      setChatState(prev => ({
        ...prev,
        isLoading: true,
        currentStep: 'user-form',  // Keep in form state during reconnection
        error: undefined
      }))

      // Get the department-specific room ID
      const departmentRoomId = getDepartmentRoomId(department.id)

      // Validate we have required data
      if (!departmentRoomId || !session.userDetails) {
        console.warn('[RECONNECT] Missing required data for reconnection')
        return false
      }

      // For reconnection, use the guest credentials stored in session
      // This ensures we see the full conversation from the customer's perspective
      let matrixConfig: any
      if (session.guestAccessToken && session.guestUserId) {
        matrixConfig = {
          ...department.matrix,
          access_token: session.guestAccessToken,
          user_id: session.guestUserId
        }
      } else {
        console.warn('[RECONNECT] No guest credentials available')
        return false
      }

      const client = new MatrixChatClient(matrixConfig)

      // Pass department ID to connect for proper room restoration
      await client.connect(session.userDetails, department.id)
      clientRef.current = client

      // Set up message handlers for this department's client
      client.onMessage((message) => {
        setChatState(prev => ({
          ...prev,
          messages: [...prev.messages, message]
        }))
        onMessage?.(message)
      })

      client.onConnection((connected) => {
        setChatState(prev => ({ ...prev, isConnected: connected }))
      })

      // Check if client has valid room after connect
      const clientRoomId = client.getCurrentRoomId()
      if (!clientRoomId || clientRoomId !== departmentRoomId) {
        console.warn('[RECONNECT] Client connected but room restoration failed')
        return false
      }

      console.log('🗳 [RECONNECT] Room restored successfully:', {
        department_id: department.id,
        room_id: clientRoomId
      })

      // Load message history
      setChatState(prev => ({
        ...prev,
        isLoadingHistory: true
      }))

      const messages = await client.loadMessageHistory(clientRoomId)

      // SUCCESS: Update state with all required fields
      setChatState(prev => ({
        ...prev,
        isConnected: true,
        isLoading: false,
        isLoadingHistory: false,
        matrixClient: client,
        messages: messages || [],      // Always set messages
        roomId: clientRoomId,
        currentStep: 'chat',            // NOW show chat interface
        error: undefined
      }))

      // Ensure department room ID is stored
      setDepartmentRoomId(department.id, clientRoomId)

      onConnect?.({
        roomId: clientRoomId,
        isReconnection: true,
        department: department.name
      })

      return true  // Signal success

    } catch (error: any) {
      console.error('❌ [RECONNECT] Reconnection failed:', error)

      const userFriendlyMessage = getUserFriendlyErrorMessage({
        department,
        action: 'reconnection',
        originalError: error
      })

      // PROPER error handling - clean up broken state
      setChatState(prev => ({
        ...prev,
        isLoading: false,
        isLoadingHistory: false,
        isConnected: false,          // Don't lie to user
        matrixClient: undefined,      // Clear broken client
        roomId: undefined,
        messages: [],                 // Clear messages
        currentStep: 'user-form',     // Go back to form
        error: userFriendlyMessage || 'Failed to restore conversation. Please start a new chat.'
      }))

      // Clean up broken client
      if (clientRef.current) {
        try {
          await clientRef.current.disconnect()
        } catch (disconnectError) {
          console.warn('[RECONNECT] Error during cleanup:', disconnectError)
        }
        clientRef.current = null
      }

      logError('Reconnection failed', error, {
        departmentId: department.id,
        departmentRoomId: getDepartmentRoomId(department.id)
      })

      return false  // Signal failure
    }
  }

  // Attempt to reconnect in legacy mode (no departments)
  const attemptLegacyReconnection = async (session: any): Promise<boolean> => {
    try {
      setChatState(prev => ({
        ...prev,
        isLoading: true,
        error: undefined
      }))

      // Validate we have required data
      if (!session.roomId || !session.userDetails) {
        console.warn('[LEGACY_RECONNECT] Missing required data for reconnection')
        return false
      }

      // For legacy reconnection, also use the guest credentials from session
      let matrixConfig: any
      if (session.guestAccessToken && session.guestUserId) {
        matrixConfig = {
          ...config.matrix!,
          access_token: session.guestAccessToken,
          user_id: session.guestUserId
        }
      } else {
        console.warn('[LEGACY_RECONNECT] No guest credentials available')
        return false
      }

      const client = new MatrixChatClient(matrixConfig)
      await client.connect()
      clientRef.current = client

      // Check if client has valid room after connect
      const clientRoomId = client.getCurrentRoomId()
      if (!clientRoomId || clientRoomId !== session.roomId) {
        console.warn('[LEGACY_RECONNECT] Client connected but room restoration failed')
        return false
      }

      // Load message history
      setChatState(prev => ({
        ...prev,
        isLoadingHistory: true
      }))

      const messages = await client.loadMessageHistory(session.roomId)

      // SUCCESS: Update state with all required fields
      setChatState(prev => ({
        ...prev,
        isConnected: true,
        isLoading: false,
        isLoadingHistory: false,
        matrixClient: client,
        messages: messages || [],
        roomId: session.roomId,
        currentStep: 'chat',  // Now show chat view
        error: undefined
      }))

      onConnect?.({
        roomId: session.roomId,
        isReconnection: true,
        isLegacyMode: true
      })

      return true  // Signal success

    } catch (error: any) {
      console.error('❌ [LEGACY_RECONNECT] Legacy reconnection failed:', error)

      const userFriendlyMessage = getUserFriendlyErrorMessage({
        department: null,
        action: 'reconnection',
        originalError: error
      })

      // PROPER error handling - clean up broken state
      setChatState(prev => ({
        ...prev,
        isLoading: false,
        isLoadingHistory: false,
        isConnected: false,
        matrixClient: undefined,
        roomId: undefined,
        messages: [],
        error: userFriendlyMessage || 'Failed to restore conversation. Please start a new chat.'
      }))

      // Clean up broken client
      if (clientRef.current) {
        try {
          await clientRef.current.disconnect()
        } catch (disconnectError) {
          console.warn('[LEGACY_RECONNECT] Error during cleanup:', disconnectError)
        }
        clientRef.current = null
      }

      logError('Legacy reconnection failed', error, {
        sessionRoomId: session.roomId
      })

      return false  // Signal failure
    }
  }

  const handleOpenChat = () => {
    setChatState(prev => ({ ...prev, isOpen: true }))
  }

  const handleCloseChat = () => {
    setChatState(prev => ({ 
      ...prev, 
      isOpen: false, 
      error: undefined 
    }))
  }

  // Handle department switching - preserve current session and go back to department selection
  const handleSwitchDepartment = async () => {
    
    // Save current department's room ID before switching
    if (chatState.selectedDepartment && chatState.roomId) {
      setDepartmentRoomId(chatState.selectedDepartment.id, chatState.roomId)
    }
    
    // Disconnect current Matrix client to clean up connections using Strategy 2
    if (clientRef.current) {
      // Pass current department ID to trigger Strategy 2 room cleanup
      await clientRef.current.disconnect(chatState.selectedDepartment?.id)
      clientRef.current = null
    }
    
    // Reset UI state to go back to department selection
    // Session data (room IDs, user details) are preserved in storage
    setChatState(prev => ({
      ...prev,
      currentStep: 'department-selection',
      selectedDepartment: undefined,
      selectedChannel: undefined,        // CRITICAL: Clear channel selection
      selectedSocialMedia: undefined,    // CRITICAL: Clear social media selection
      roomId: undefined,
      isConnected: false,
      matrixClient: undefined,
      messages: [], // Clear current messages from UI
      error: undefined
      // IMPORTANT: Keep userDetails to prevent white screen bug
      // userDetails: prev.userDetails (already preserved by not modifying it)
    }))
    
  }

  // Helper function for department switching - starts chat with existing user details
  const handleStartChatForDepartmentSwitch = async (userDetails: UserDetails, department: any) => {
    
    if (!userDetails.name.trim() || !userDetails.email.trim()) {
      console.error('❌ Invalid user details for department switch')
      return
    }

    if (!department) {
      console.error('❌ No department provided for switch')
      return
    }

    setChatState(prev => ({ ...prev, isLoading: true, error: undefined }))

    try {
      // Use department-specific matrix config for department switching
      const effectiveMatrixConfig = department.matrix
      
      
      // Always create a new client for department switching to avoid state conflicts
      if (clientRef.current) {
        // For department switching, pass the new department ID to preserve its room while cleaning others
        await clientRef.current.disconnect(department.id)
        clientRef.current = null
      }
      
      clientRef.current = new MatrixChatClient(effectiveMatrixConfig)
      
      // Clear any old room state to prevent message cross-contamination
      clientRef.current.startFreshConversation()
      
      // IMPORTANT: Clear global room storage to prevent connecting to old department's room
      setRoomId('') // Clear the global room ID so connect() doesn't restore wrong room
      
      clientRef.current.onMessage((message) => {
        setChatState(prev => ({
          ...prev,
          messages: [...prev.messages, message]
        }))
        onMessage?.(message)
      })

      clientRef.current.onConnection((connected) => {
        setChatState(prev => ({ ...prev, isConnected: connected }))
      })

      setChatState(prev => ({ ...prev, matrixClient: clientRef.current! }))

      // Connect the client before creating room (with department-specific restoration)
      await clientRef.current.connect(userDetails, department.id /* departmentId for room restoration */)

      // Create new room for this department using the correct method
      // Pass isDepartmentSwitch=true to ensure we create a new room instead of trying to reuse existing ones
      const roomId = await clientRef.current.createOrJoinSupportRoom(
        userDetails, 
        { name: department.name, id: department.id },
        true // isDepartmentSwitch - always create new room for department switches
      )


      // Store room ID for the department
      setDepartmentRoomId(department.id, roomId)
      
      // Increment conversation count for analytics (department-aware)
      incrementDepartmentConversationCount(department.id)

      setChatState(prev => ({
        ...prev,
        isLoading: false,
        userDetails: userDetails,
        roomId,
        messages: [], // Start fresh for new department
        session: loadChatSession(), // Refresh session data
        currentStep: 'chat'
      }))

      onConnect?.(roomId)
    } catch (error) {
      // Log error with detailed context
      logError({
        department: department,
        action: 'department_switch_room_creation',
        originalError: error instanceof Error ? error : new Error(String(error))
      }, { userDetails: { name: userDetails.name, email: userDetails.email } })

      // Show user-friendly error
      const userFriendlyMessage = getUserFriendlyErrorMessage({
        department: department,
        action: 'department_switch_room_creation',
        originalError: error
      })

      setChatState(prev => ({
        ...prev,
        isLoading: false,
        error: userFriendlyMessage
      }))
    }
  }

  const handleStartChat = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!userForm.name.trim() || !userForm.email.trim() || !userForm.message?.trim()) {
      return
    }

    setChatState(prev => ({ ...prev, isLoading: true, error: undefined }))

    try {
      const effectiveMatrixConfig = getEffectiveMatrixConfig()
      
      if (!clientRef.current) {
        clientRef.current = new MatrixChatClient(effectiveMatrixConfig)
        
        clientRef.current.onMessage((message) => {
          setChatState(prev => ({
            ...prev,
            messages: [...prev.messages, message]
          }))
          onMessage?.(message)
        })

        clientRef.current.onConnection((connected) => {
          setChatState(prev => ({ ...prev, isConnected: connected }))
        })

        clientRef.current.onError((error) => {
          // Log error with context
          logError({
            department: chatState.selectedDepartment,
            action: 'connection',
            originalError: error
          })
          
          // Get department-specific error message
          const userFriendlyMessage = getUserFriendlyErrorMessage({
            department: chatState.selectedDepartment,
            action: 'connection',
            originalError: error
          })
          
          // Handle "already in room" as success case
          if (error.message.includes('already in the room')) {
            const departmentName = chatState.selectedDepartment?.name || 'support'
            setSuccessMessage(`Connected successfully to ${departmentName}! You can start chatting now.`)
            setChatState(prev => ({ ...prev, isLoading: false, isConnected: true, error: undefined }))
            setTimeout(() => setSuccessMessage(undefined), 3000)
            return
          }
          
          // Only set error if we have a message to show
          if (userFriendlyMessage) {
            setChatState(prev => ({ ...prev, error: userFriendlyMessage, isLoading: false }))
          } else {
            // Empty message means it was handled as success case
            setChatState(prev => ({ ...prev, isLoading: false }))
          }
          
          onError?.(error)
        })

        await clientRef.current.connect(userForm)
      }

      // Update user details in persistent storage
      updateUserDetails(userForm)
      
      const roomId = await clientRef.current.createOrJoinSupportRoom(
        userForm,
        chatState.selectedDepartment ? {
          name: chatState.selectedDepartment.name,
          id: chatState.selectedDepartment.id
        } : undefined
      )
      
      // Check if this is a returning user with existing history
      const session = loadChatSession()
      let messages: ChatMessage[] = []
      
      
      // Load history if user is returning and we have a room (either new or from session)
      if (session.isReturningUser && (roomId || session.roomId)) {
        const historyRoomId = roomId || session.roomId!
        try {
          setChatState(prev => ({ ...prev, isLoadingHistory: true }))
          
          
          // Try to load existing message history
          const historyMessages = await clientRef.current.loadMessageHistory(historyRoomId, 50)
          
          if (historyMessages.length > 0) {
            messages = historyMessages
          } else {
            // No history found - messages will arrive via Matrix timeline events
            // Don't create fake messages, let the real Matrix messages populate the chat
            messages = []
          }
        } catch (error) {
          console.warn('Failed to load message history:', error)
          // Fall back to empty messages - Matrix will populate via timeline events
          messages = []
        } finally {
          setChatState(prev => ({ ...prev, isLoadingHistory: false }))
        }
      } else {
        // New user - let Matrix populate messages via timeline events
        messages = []
      }

      // Store room ID for the department (or legacy storage if no department)
      if (chatState.selectedDepartment) {
        setDepartmentRoomId(chatState.selectedDepartment.id, roomId)
      }
      
      // Increment conversation count for analytics (department-aware)
      incrementDepartmentConversationCount(chatState.selectedDepartment?.id)
      
      // If we have an initial message and no history, add it to the UI
      if (userForm.message && userForm.message.trim() && messages.length === 0) {
        const initialMessage: ChatMessage = {
          id: `initial-${Date.now()}`,
          text: userForm.message,
          sender: 'user',
          timestamp: Date.now(),
          status: 'sent'
        }
        messages = [initialMessage]
      }

      setChatState(prev => ({
        ...prev,
        isLoading: false,
        userDetails: userForm,
        roomId,
        messages,
        session: loadChatSession(), // Refresh session data
        currentStep: 'chat'
      }))

      onConnect?.(roomId)
    } catch (error) {
      // Log error with detailed context
      logError({
        department: chatState.selectedDepartment,
        action: 'room_creation',
        originalError: error instanceof Error ? error : new Error(String(error))
      }, { userForm: { name: userForm.name, email: userForm.email } })

      // In demo mode, show a nice demo experience instead of an error
      const effectiveMatrixConfig = getEffectiveMatrixConfig()
      if (effectiveMatrixConfig?.accessToken === 'DEMO_MODE_NO_CONNECTION') {
        setChatState(prev => ({
          ...prev,
          isLoading: false,
          userDetails: userForm,
          roomId: 'demo-room',
          currentStep: 'chat',
          messages: [
            {
              id: 'user-initial',
              text: userForm.message || '',
              sender: 'user',
              timestamp: Date.now() - 1000,
              status: 'sent'
            },
            {
              id: 'demo-message',
              text: '👋 This is a demo of the chat interface! In production, this would connect to your Matrix server and enable real-time support chat.',
              sender: 'support',
              timestamp: Date.now(),
              status: 'sent'
            },
            {
              id: 'demo-message-2',
              text: 'Try typing a message in the box below to see how the chat would work!',
              sender: 'support',
              timestamp: Date.now() + 1000,
              status: 'sent'
            }
          ]
        }))
        // In demo mode, simulate connected state
        setChatState(prev => ({ ...prev, isConnected: true }))
        onConnect?.('demo-room')
      } else {
        // Get department-specific error message
        const userFriendlyMessage = getUserFriendlyErrorMessage({
          department: chatState.selectedDepartment,
          action: 'room_creation',
          originalError: error instanceof Error ? error : new Error(String(error))
        })
        
        setChatState(prev => ({
          ...prev,
          isLoading: false,
          error: userFriendlyMessage
        }))
        onError?.(error instanceof Error ? error : new Error('Failed to start chat'))
      }
    }
  }

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!currentMessage.trim()) {
      return
    }

    const messageText = currentMessage.trim()
    const messageId = `${Date.now()}-${Math.random()}`
    
    const userMessage: ChatMessage = {
      id: messageId,
      text: messageText,
      sender: 'user',
      timestamp: Date.now(),
      status: 'sending'
    }

    setChatState(prev => ({
      ...prev,
      messages: [...prev.messages, userMessage]
    }))

    setCurrentMessage('')

    // In demo mode, simulate a response
    const effectiveMatrixConfig = getEffectiveMatrixConfig()
    if (effectiveMatrixConfig?.accessToken === 'DEMO_MODE_NO_CONNECTION') {
      // Mark message as sent
      setTimeout(() => {
        setChatState(prev => ({
          ...prev,
          messages: prev.messages.map(msg =>
            msg.id === messageId ? { ...msg, status: 'sent' } : msg
          )
        }))
        
        // Simulate support response after delay
        setTimeout(() => {
          const responses = [
            "Thanks for your message! I can help you with that.",
            "I understand your concern. Let me look into this for you.",
            "That's a great question! Here's what I can tell you...",
            "I'm here to help! Can you provide a bit more detail?",
            "I see what you mean. This is a common question we get."
          ]
          
          const randomResponse = responses[Math.floor(Math.random() * responses.length)]
          
          setChatState(prev => ({
            ...prev,
            messages: [...prev.messages, {
              id: `demo-response-${Date.now()}`,
              text: randomResponse,
              sender: 'support',
              timestamp: Date.now(),
              status: 'sent'
            }]
          }))
        }, 1500)
        
      }, 500)
      return
    }

    // Real Matrix integration
    if (!clientRef.current) {
      console.error('❌ [WIDGET_SEND] No Matrix client available')
      setChatState(prev => ({
        ...prev,
        messages: prev.messages.map(msg =>
          msg.id === messageId ? { ...msg, status: 'error' } : msg
        )
      }))
      return
    }

    console.log('📧 [WIDGET_SEND] Preparing to send message:', {
      department_id: chatState.selectedDepartment?.id,
      department_name: chatState.selectedDepartment?.name,
      room_id: chatState.roomId,
      has_client: !!clientRef.current,
      message_length: messageText.length
    })

    try {
      await clientRef.current.sendMessage(messageText)
      
      setChatState(prev => ({
        ...prev,
        messages: prev.messages.map(msg =>
          msg.id === messageId ? { ...msg, status: 'sent' } : msg
        )
      }))
    } catch (error) {
      // Log message sending error
      logError({
        department: chatState.selectedDepartment,
        action: 'message_send',
        originalError: error instanceof Error ? error : new Error(String(error))
      })
      
      setChatState(prev => ({
        ...prev,
        messages: prev.messages.map(msg =>
          msg.id === messageId ? { ...msg, status: 'error' } : msg
        )
      }))
      
      // Show user-friendly error message temporarily
      const userFriendlyMessage = getUserFriendlyErrorMessage({
        department: chatState.selectedDepartment,
        action: 'message_send',
        originalError: error instanceof Error ? error : new Error(String(error))
      })
      
      setChatState(prev => ({ ...prev, error: userFriendlyMessage }))
      setTimeout(() => {
        setChatState(prev => ({ ...prev, error: undefined }))
      }, 5000)
    }
  }

  const handleFormChange = (field: keyof UserDetails, value: string) => {
    setUserForm(prev => ({ ...prev, [field]: value }))
  }

  const handleSessionReset = () => {
    clearChatSession()
    const newSession = loadChatSession()
    setChatState(prev => ({ ...prev, session: newSession }))
    setUserForm({ name: '', email: '', phone: '', message: '' })
  }

  const handleDepartmentChange = () => {
    setChatState(prev => ({ 
      ...prev, 
      currentStep: 'department-selection', 
      selectedDepartment: undefined 
    }))
  }

  const positionClass = config.widget.position || 'bottom-right'
  
  const getPositionClass = () => {
    switch (positionClass) {
      case 'bottom-right': return styles.bottomRight
      case 'bottom-left': return styles.bottomLeft
      case 'top-right': return styles.topRight
      case 'top-left': return styles.topLeft
      default: return styles.bottomRight
    }
  }

  return (
    <div className={`${styles.widgetContainer} ${getPositionClass()}`}>
      {!chatState.isOpen && (
        <button 
          className={styles.chatButton} 
          onClick={handleOpenChat}
          aria-label="Open support chat"
        >
          <svg className={styles.chatButtonIcon} viewBox="0 0 24 24">
            <path d="M20 2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h4l4 4 4-4h4c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/>
          </svg>
        </button>
      )}

      {chatState.isOpen && (
        <div className={styles.chatModal}>
          <header className={styles.modalHeader}>
            <div className={styles.headerContent}>
              <div className={styles.headerText}>
                <h3>{config.widget.title || 'Support Chat'}</h3>
                {chatState.selectedDepartment && chatState.currentStep !== 'department-selection' ? (
                  <div className={styles.departmentInfo}>
                    <span className={styles.departmentName}>
                      {chatState.selectedDepartment.icon} {chatState.selectedDepartment.name}
                    </span>
                    {config.departments && config.departments.length > 1 && (
                      <button
                        className={styles.switchDepartmentBtn}
                        onClick={handleSwitchDepartment}
                        aria-label="Switch department"
                      >
                        Switch
                      </button>
                    )}
                  </div>
                ) : (
                  <p>{config.widget.subtitle || 'We\'re here to help!'}</p>
                )}
              </div>
              <button 
                className={styles.closeButton} 
                onClick={handleCloseChat}
                aria-label="Close chat"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
                </svg>
              </button>
            </div>
          </header>

          <div className={styles.modalContent}>
            {chatState.error && (
              <div className={styles.errorContainer}>
                <div className={styles.error}>
                  {chatState.error}
                </div>
                {/* Space-aware error guidance */}
                {chatState.error.includes('space') && (
                  <div className={styles.spaceErrorGuidance}>
                    <svg className={styles.spaceErrorIcon} width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M11 15h2v2h-2zm0-8h2v6h-2zm.99-5C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8z"/>
                    </svg>
                    <div>
                      <strong>Space Organization:</strong> Your conversation will still be created successfully, just without the enhanced space organization features.
                    </div>
                  </div>
                )}
              </div>
            )}

            {successMessage && (
              <div className={styles.success || 'success'}>
                {successMessage}
              </div>
            )}

            {chatState.isLoading && (
              <div className={styles.loading}>
                <div className={styles.loadingSpinner}></div>
                Connecting to support...
              </div>
            )}

            {chatState.currentStep === 'department-selection' && config.departments && (
              <DepartmentSelector
                departments={config.departments}
                config={config.widget.departmentSelection || {}}
                onSelect={handleDepartmentSelect}
                onClose={handleCloseChat}
              />
            )}

            {chatState.currentStep === 'channel-selection' && chatState.selectedDepartment && (
              <CommunicationChannelSelector
                channels={getCommunicationChannels()}
                selectedDepartment={chatState.selectedDepartment}
                onChannelSelect={handleChannelSelect}
                onBack={handleBackToDepartments}
              />
            )}

            {chatState.currentStep === 'social-media-setup' && chatState.selectedSocialMedia && chatState.selectedDepartment && (
              <SocialMediaIntegration
                channel={chatState.selectedSocialMedia}
                department={chatState.selectedDepartment}
                onClose={handleCloseChat}
                onBack={handleBackToChannels}
              />
            )}

            {chatState.currentStep === 'user-form' && !chatState.userDetails && !chatState.isLoading && (
              <UserDetailsForm
                userForm={userForm}
                selectedDepartment={chatState.selectedDepartment}
                session={chatState.session}
                greeting={getEffectiveWidgetConfig().greeting}
                placeholderText={getEffectiveWidgetConfig().placeholderText}
                isLoading={chatState.isLoading}
                onFormChange={handleFormChange}
                onSubmit={handleStartChat}
                onSessionReset={handleSessionReset}
              />
            )}

            {chatState.userDetails && !chatState.isLoading && (
              <ChatInterface
                messages={chatState.messages}
                currentMessage={currentMessage}
                isConnected={chatState.isConnected}
                isLoadingHistory={chatState.isLoadingHistory}
                session={chatState.session}
                selectedDepartment={chatState.selectedDepartment}
                onMessageChange={setCurrentMessage}
                onSendMessage={handleSendMessage}
                onSwitchDepartment={config.departments ? handleSwitchDepartment : undefined}
              />
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default ChatWidget