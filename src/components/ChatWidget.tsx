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
import UserDetailsForm from './UserDetailsForm'
import ChatInterface from './ChatInterface'
import styles from '@/styles/widget.module.css'

const ChatWidget: React.FC<MatrixChatWidgetProps> = ({ config, onError, onConnect, onMessage, onDepartmentSelect }) => {
  // Initialize state with proper step based on configuration
  const initialStep = config.departments && config.departments.length > 0 ? 'department-selection' : 'user-form'
  
  const [chatState, setChatState] = useState<ChatState>({
    currentStep: initialStep,
    selectedDepartment: undefined,
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
    
    // Check if user already has details (department switching scenario)
    const hasUserDetails = chatState.session?.userDetails || chatState.userDetails
    
    // Check if this department has a previous conversation with THIS department's bot
    const departmentRoomId = getDepartmentRoomId(department.id)
    
    const nextStep = hasUserDetails ? 'chat' : 'user-form'
    
    console.log('🏢 Department selected:', {
      department: department.name,
      hasUserDetails: !!hasUserDetails,
      hasPreviousRoom: !!departmentRoomId,
      nextStep
    })
    
    setChatState(prev => ({
      ...prev,
      selectedDepartment: department,
      currentStep: nextStep,
      // IMPORTANT: Only use departmentRoomId if it exists for THIS department
      // For department switches, create new rooms to avoid permission issues
      roomId: departmentRoomId || undefined,
      messages: [], // Start with empty messages, will be loaded if room exists
      error: undefined,
      // Ensure userDetails are set if they exist (for department switching)
      userDetails: hasUserDetails ? (prev.userDetails || prev.session?.userDetails) : prev.userDetails
    }))
    
    // If user has details and we're going to chat, attempt reconnection
    if (hasUserDetails && nextStep === 'chat') {
      if (departmentRoomId) {
        console.log('🔄 Attempting reconnection to existing department room...')
        setTimeout(() => attemptReconnection(department, chatState.session!), 1000)
      } else {
        console.log('🆕 Starting new conversation in this department - creating new room...')
        // For department switching: user has details but no room for this department
        // Start chat directly (will create new room with existing user details)
        setTimeout(() => {
          const userDetails = hasUserDetails === true ? (chatState.userDetails || chatState.session?.userDetails) : hasUserDetails
          if (userDetails) {
            handleStartChatForDepartmentSwitch(userDetails, department)
          }
        }, 500)
      }
    }
    
    onDepartmentSelect?.(department)
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
        setChatState(prev => ({
          ...prev,
          selectedDepartment: validDepartment,
          currentStep: session.userDetails ? 'chat' : 'user-form'
        }))
        console.log('🔄 Restored department selection:', validDepartment.name)
        
        // Attempt to reconnect if user has existing session with room
        if (session.userDetails && session.roomId) {
          console.log('🔄 Attempting to reconnect to existing chat session...', {
            department: validDepartment.name,
            roomId: session.roomId,
            hasUserDetails: !!session.userDetails
          })
          setTimeout(() => attemptReconnection(validDepartment, session), 1000)
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
      console.log('🔄 Attempting to reconnect to legacy chat session...', {
        roomId: session.roomId,
        hasUserDetails: !!session.userDetails
      })
      setTimeout(() => attemptLegacyReconnection(session), 1000)
    }
    
    console.log('🔄 Session initialized:', getSessionInfo())
  }, [])

  // Attempt to reconnect to existing chat session
  const attemptReconnection = async (department: any, session: any) => {
    try {
      setChatState(prev => ({ 
        ...prev, 
        isLoading: true, 
        error: undefined 
      }))
      
      // Get the department-specific room ID
      const departmentRoomId = getDepartmentRoomId(department.id)
      
      console.log('🔄 Reconnecting to Matrix with stored session...', {
        hasGuestToken: !!session.guestAccessToken,
        hasGuestUserId: !!session.guestUserId,
        departmentRoomId: departmentRoomId,
        departmentName: department.name,
        departmentId: department.id
      })
      
      // For reconnection, use the guest credentials stored in session
      // This ensures we see the full conversation from the customer's perspective
      let matrixConfig: any
      if (session.guestAccessToken && session.guestUserId) {
        matrixConfig = {
          ...department.matrix,
          access_token: session.guestAccessToken,
          user_id: session.guestUserId
        }
        console.log('🔄 Using guest credentials for reconnection:', session.guestUserId)
      } else {
        // Fallback to bot credentials if no guest credentials available
        matrixConfig = department.matrix
        console.log('⚠️ No guest credentials found, using bot credentials as fallback')
      }
      
      const client = new MatrixChatClient(matrixConfig)
      // Pass department ID to connect for proper room restoration
      await client.connect(session.userDetails, department.id)
      clientRef.current = client
      
      // Try to rejoin the department-specific room
      if (departmentRoomId) {
        console.log('🔄 Rejoining department room:', departmentRoomId)
        try {
          await client.joinRoom(departmentRoomId)
          
          // Load message history
          setChatState(prev => ({ 
            ...prev, 
            isLoadingHistory: true 
          }))
          
          const messages = await client.loadMessageHistory(departmentRoomId)
          
          setChatState(prev => ({
            ...prev,
            isConnected: true,
            isLoading: false,
            isLoadingHistory: false,
            matrixClient: client,
            messages: messages || [],
            roomId: departmentRoomId
          }))
          
          console.log('✅ Reconnected successfully to existing room')
          onConnect?.({ 
            roomId: departmentRoomId, 
            isReconnection: true,
            department: department.name 
          })
          
        } catch (roomError: any) {
          console.warn('⚠️ Could not rejoin existing room, will need to create new one:', roomError.message)
          // Don't set error here - just clear the room info so user can start fresh
          setChatState(prev => ({
            ...prev,
            isConnected: true,
            isLoading: false,
            matrixClient: client,
            roomId: undefined // Clear invalid room
          }))
        }
      } else {
        // No room to rejoin, but client is connected
        setChatState(prev => ({
          ...prev,
          isConnected: true,
          isLoading: false,
          matrixClient: client
        }))
        console.log('✅ Matrix client reconnected (no room to rejoin)')
      }
      
    } catch (error: any) {
      console.error('❌ Reconnection failed:', error)
      
      const userFriendlyMessage = getUserFriendlyErrorMessage({
        department,
        action: 'reconnection',
        originalError: error
      })
      
      setChatState(prev => ({
        ...prev,
        isLoading: false,
        error: userFriendlyMessage
      }))
      
      logError('Reconnection failed', error, { 
        departmentId: department.id,
        departmentRoomId: departmentRoomId 
      })
    }
  }

  // Attempt to reconnect in legacy mode (no departments)
  const attemptLegacyReconnection = async (session: any) => {
    try {
      setChatState(prev => ({ 
        ...prev, 
        isLoading: true, 
        error: undefined 
      }))
      
      console.log('🔄 Reconnecting to Matrix in legacy mode...', {
        hasGuestToken: !!session.guestAccessToken,
        hasGuestUserId: !!session.guestUserId,
        roomId: session.roomId
      })
      
      // For legacy reconnection, also use the guest credentials from session
      let matrixConfig: any
      if (session.guestAccessToken && session.guestUserId) {
        matrixConfig = {
          ...config.matrix!,
          access_token: session.guestAccessToken,
          user_id: session.guestUserId
        }
        console.log('🔄 Using guest credentials for legacy reconnection:', session.guestUserId)
      } else {
        // Fallback to bot credentials if no guest credentials available
        matrixConfig = config.matrix!
        console.log('⚠️ No guest credentials found, using bot credentials as fallback')
      }
      
      const client = new MatrixChatClient(matrixConfig)
      await client.connect()
      clientRef.current = client
      
      // Try to rejoin the existing room
      if (session.roomId) {
        console.log('🔄 Rejoining legacy room:', session.roomId)
        try {
          await client.joinRoom(session.roomId)
          
          // Load message history
          setChatState(prev => ({ 
            ...prev, 
            isLoadingHistory: true 
          }))
          
          const messages = await client.loadMessageHistory(session.roomId)
          
          setChatState(prev => ({
            ...prev,
            isConnected: true,
            isLoading: false,
            isLoadingHistory: false,
            matrixClient: client,
            messages: messages || [],
            roomId: session.roomId,
            currentStep: 'chat' // Ensure we go to chat view
          }))
          
          console.log('✅ Legacy mode reconnected successfully')
          onConnect?.({ 
            roomId: session.roomId, 
            isReconnection: true,
            isLegacyMode: true 
          })
          
        } catch (roomError: any) {
          console.warn('⚠️ Could not rejoin legacy room:', roomError.message)
          setChatState(prev => ({
            ...prev,
            isConnected: true,
            isLoading: false,
            matrixClient: client,
            roomId: undefined,
            currentStep: 'chat' // Still go to chat view so user can send new message
          }))
        }
      }
      
    } catch (error: any) {
      console.error('❌ Legacy reconnection failed:', error)
      
      const userFriendlyMessage = getUserFriendlyErrorMessage({
        department: null,
        action: 'reconnection',
        originalError: error
      })
      
      setChatState(prev => ({
        ...prev,
        isLoading: false,
        error: userFriendlyMessage
      }))
      
      logError('Legacy reconnection failed', error, { 
        sessionRoomId: session.roomId 
      })
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
    console.log('🔄 Switching departments...', {
      currentDepartment: chatState.selectedDepartment?.name,
      currentRoomId: chatState.roomId,
      messageCount: chatState.messages.length
    })
    
    // Save current department's room ID before switching
    if (chatState.selectedDepartment && chatState.roomId) {
      setDepartmentRoomId(chatState.selectedDepartment.id, chatState.roomId)
      console.log(`💾 Saved room ${chatState.roomId} for department ${chatState.selectedDepartment.name}`)
    }
    
    // Disconnect current Matrix client to clean up connections
    if (clientRef.current) {
      console.log('🧹 Properly disconnecting Matrix client before switch...')
      await clientRef.current.disconnect()
      clientRef.current = null
    }
    
    // Reset UI state to go back to department selection
    // Session data (room IDs, user details) are preserved in storage
    setChatState(prev => ({
      ...prev,
      currentStep: 'department-selection',
      selectedDepartment: undefined,
      roomId: undefined,
      isConnected: false,
      matrixClient: undefined,
      messages: [], // Clear current messages from UI
      error: undefined
      // IMPORTANT: Keep userDetails to prevent white screen bug
      // userDetails: prev.userDetails (already preserved by not modifying it)
    }))
    
    console.log('✅ Returned to department selection - previous conversations preserved')
  }

  // Helper function for department switching - starts chat with existing user details
  const handleStartChatForDepartmentSwitch = async (userDetails: UserDetails, department: any) => {
    console.log('🔄 Starting department switch room creation:', {
      userDetails: { name: userDetails.name, email: userDetails.email },
      department: department?.name,
      departmentId: department?.id,
      chatStateDepartment: chatState.selectedDepartment?.name
    })
    
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
      
      console.log('🔍 DEPARTMENT SWITCH DEBUG:', {
        departmentName: department.name,
        departmentId: department.id,
        homeserver: effectiveMatrixConfig?.homeserver,
        botUserId: effectiveMatrixConfig?.bot_user_id,
        accessTokenPreview: effectiveMatrixConfig?.access_token?.substring(0, 20) + '...',
        fullConfig: effectiveMatrixConfig
      })
      
      // Always create a new client for department switching to avoid state conflicts
      if (clientRef.current) {
        console.log('🧹 Disconnecting old Matrix client...')
        await clientRef.current.disconnect()
        clientRef.current = null
      }
      
      console.log('🔧 Creating new Matrix client for department:', department.name)
      clientRef.current = new MatrixChatClient(effectiveMatrixConfig)
      
      // Clear any old room state to prevent message cross-contamination
      clientRef.current.startFreshConversation()
      
      // IMPORTANT: Clear global room storage to prevent connecting to old department's room
      console.log('🧹 Clearing global room storage to prevent department cross-contamination')
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
      console.log('⏳ Connecting Matrix client for department switch...')
      await clientRef.current.connect(userDetails, department.id /* departmentId for room restoration */)

      // Create new room for this department using the correct method
      // Pass isDepartmentSwitch=true to ensure we create a new room instead of trying to reuse existing ones
      const roomId = await clientRef.current.createOrJoinSupportRoom(
        userDetails, 
        { name: department.name, id: department.id },
        true // isDepartmentSwitch - always create new room for department switches
      )

      console.log('✅ New department room created:', {
        roomId,
        department: department.name,
        user: userDetails.name
      })

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
      
      console.log('🔍 HISTORY DEBUG - Session info:', {
        isReturningUser: session.isReturningUser,
        roomId: roomId,
        sessionRoomId: session.roomId,
        conversationCount: session.conversationCount,
        conditionMet: session.isReturningUser && roomId,
        shouldLoadHistory: session.isReturningUser && (roomId || session.roomId)
      })
      
      // Load history if user is returning and we have a room (either new or from session)
      if (session.isReturningUser && (roomId || session.roomId)) {
        const historyRoomId = roomId || session.roomId!
        try {
          setChatState(prev => ({ ...prev, isLoadingHistory: true }))
          
          console.log('🔍 HISTORY LOADING - Attempting to load from room:', historyRoomId)
          
          // Try to load existing message history
          const historyMessages = await clientRef.current.loadMessageHistory(historyRoomId, 50)
          
          if (historyMessages.length > 0) {
            messages = historyMessages
            console.log('📚 Loaded conversation history:', historyMessages.length, 'messages')
          } else {
            // No history found - messages will arrive via Matrix timeline events
            // Don't create fake messages, let the real Matrix messages populate the chat
            messages = []
            console.log('📪 No existing history, starting fresh conversation')
          }
        } catch (error) {
          console.warn('Failed to load message history:', error)
          // Fall back to empty messages - Matrix will populate via timeline events
          messages = []
          console.log('📪 History loading failed, starting fresh')
        } finally {
          setChatState(prev => ({ ...prev, isLoadingHistory: false }))
        }
      } else {
        // New user - let Matrix populate messages via timeline events
        messages = []
        console.log('👤 New user conversation starting')
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
        console.log('📝 Added initial message to UI:', userForm.message)
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
      setChatState(prev => ({
        ...prev,
        messages: prev.messages.map(msg =>
          msg.id === messageId ? { ...msg, status: 'error' } : msg
        )
      }))
      return
    }

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
            <div className={styles.headerText}>
              <h3>{config.widget.title || 'Support Chat'}</h3>
              <p>{config.widget.subtitle || 'We\'re here to help!'}</p>
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
          </header>

          <div className={styles.modalContent}>
            {chatState.error && (
              <div className={styles.error}>
                {chatState.error}
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
                onDepartmentChange={config.departments ? handleDepartmentChange : undefined}
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