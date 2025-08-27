import React, { useState, useEffect, useRef } from 'react'
import { MatrixChatClient } from '@/utils/matrix-client'
import { ChatMessage, UserDetails, MatrixChatWidgetProps, ChatState } from '@/types'
import { loadChatSession, updateUserDetails, incrementConversationCount, isReturningUser, clearChatSession, getSessionInfo } from '@/utils/chat-storage'
import LongMessage from './LongMessage'
import styles from '@/styles/widget.module.css'

const ChatWidget: React.FC<MatrixChatWidgetProps> = ({ config, onError, onConnect, onMessage }) => {
  const [chatState, setChatState] = useState<ChatState>({
    isOpen: false,
    isConnected: false,
    isLoading: false,
    messages: [],
    userDetails: undefined,
    error: undefined,
    roomId: undefined,
    session: undefined,
    isLoadingHistory: false
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
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  // Initialize session on component mount
  useEffect(() => {
    const session = loadChatSession()
    setChatState(prev => ({ ...prev, session }))
    
    // Pre-fill form if user has previous details
    if (session.userDetails) {
      setUserForm(session.userDetails)
    }
    
    console.log('🔄 Session initialized:', getSessionInfo())
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [chatState.messages])

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

  const handleStartChat = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!userForm.name.trim() || !userForm.email.trim() || !userForm.message.trim()) {
      return
    }

    setChatState(prev => ({ ...prev, isLoading: true, error: undefined }))

    try {
      if (!clientRef.current) {
        clientRef.current = new MatrixChatClient(config.matrix)
        
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
          let userFriendlyMessage = error.message
          
          // Transform technical Matrix errors into user-friendly messages
          if (error.message.includes('already in the room')) {
            // Don't treat this as an error - it's actually success
            setSuccessMessage('Connected successfully! You can start chatting now.')
            setChatState(prev => ({ ...prev, isLoading: false, isConnected: true, error: undefined }))
            // Clear success message after 3 seconds
            setTimeout(() => setSuccessMessage(undefined), 3000)
            return
          } else if (error.message.includes('M_FORBIDDEN')) {
            userFriendlyMessage = 'Unable to connect to support chat. Please try again later.'
          } else if (error.message.includes('Failed to get user ID')) {
            userFriendlyMessage = 'Connection issue. Please refresh the page and try again.'
          } else if (error.message.includes('Network')) {
            userFriendlyMessage = 'Network connection problem. Please check your internet and try again.'
          }
          
          setChatState(prev => ({ ...prev, error: userFriendlyMessage, isLoading: false }))
          onError?.(error)
        })

        await clientRef.current.connect(userForm)
      }

      // Update user details in persistent storage
      updateUserDetails(userForm)
      
      const roomId = await clientRef.current.createOrJoinSupportRoom(userForm)
      
      // Check if this is a returning user with existing history
      const session = loadChatSession()
      let messages: ChatMessage[] = []
      
      if (session.isReturningUser && roomId) {
        try {
          setChatState(prev => ({ ...prev, isLoadingHistory: true }))
          
          // Try to load existing message history
          const historyMessages = await clientRef.current.loadMessageHistory(roomId, 50)
          
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

      // Increment conversation count for analytics
      incrementConversationCount()
      
      setChatState(prev => ({
        ...prev,
        isLoading: false,
        userDetails: userForm,
        roomId,
        messages,
        session: loadChatSession() // Refresh session data
      }))

      onConnect?.(roomId)
    } catch (error) {
      // In demo mode, show a nice demo experience instead of an error
      if (config.matrix.accessToken === 'DEMO_MODE_NO_CONNECTION') {
        setChatState(prev => ({
          ...prev,
          isLoading: false,
          userDetails: userForm,
          roomId: 'demo-room',
          messages: [
            {
              id: 'user-initial',
              text: userForm.message,
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
        setChatState(prev => ({
          ...prev,
          isLoading: false,
          error: error instanceof Error ? error.message : 'Failed to start chat'
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
    
    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = '36px'
    }

    // In demo mode, simulate a response
    if (config.matrix.accessToken === 'DEMO_MODE_NO_CONNECTION') {
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
      setChatState(prev => ({
        ...prev,
        messages: prev.messages.map(msg =>
          msg.id === messageId ? { ...msg, status: 'error' } : msg
        )
      }))
    }
  }

  const handleFormChange = (field: keyof UserDetails, value: string) => {
    setUserForm(prev => ({ ...prev, [field]: value }))
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
              <div className={styles.success}>
                {successMessage}
              </div>
            )}

            {chatState.isLoading && (
              <div className={styles.loading}>
                <div className={styles.loadingSpinner}></div>
                Connecting to support...
              </div>
            )}

            {!chatState.userDetails && !chatState.isLoading && (
              <form className={styles.userForm} onSubmit={handleStartChat}>
                <div style={{ marginBottom: '8px' }}>
                  <p style={{ margin: '0 0 16px 0', color: '#555', lineHeight: '1.4', fontSize: '14px' }}>
                    {config.widget.greeting || 'Hi! We\'d love to help. Please share your details and message to get started.'}
                  </p>
                  
                  {/* Returning user indicator */}
                  {chatState.session?.isReturningUser && chatState.session?.conversationCount > 0 && (
                    <div style={{
                      background: 'linear-gradient(135deg, #f0fff4 0%, #c6f6d5 100%)',
                      border: '1px solid #9ae6b4',
                      borderRadius: '8px',
                      padding: '12px 16px',
                      marginBottom: '16px',
                      fontSize: '13px',
                      color: '#2f855a'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                        <span style={{ fontSize: '14px' }}>👋</span>
                        <div>
                          <strong>Welcome back!</strong><br />
                          You've had {chatState.session.conversationCount} previous conversation{chatState.session.conversationCount !== 1 ? 's' : ''} with our support team.
                          <br />
                          <button 
                            type="button"
                            onClick={() => {
                              clearChatSession();
                              const newSession = loadChatSession();
                              setChatState(prev => ({ ...prev, session: newSession }));
                              setUserForm({ name: '', email: '', phone: '', message: '' });
                            }}
                            style={{
                              background: 'none',
                              border: 'none',
                              color: '#2f855a',
                              textDecoration: 'underline',
                              cursor: 'pointer',
                              fontSize: '12px',
                              marginTop: '4px',
                              padding: '0'
                            }}
                          >
                            Start fresh conversation
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
                
                <div className={styles.formGroup}>
                  <label htmlFor="name">Your Name *</label>
                  <input
                    id="name"
                    type="text"
                    value={userForm.name}
                    onChange={(e) => handleFormChange('name', e.target.value)}
                    placeholder="Enter your full name"
                    required
                  />
                </div>

                <div className={styles.formGroup}>
                  <label htmlFor="email">Email Address *</label>
                  <input
                    id="email"
                    type="email"
                    value={userForm.email}
                    onChange={(e) => handleFormChange('email', e.target.value)}
                    placeholder="your.email@example.com"
                    required
                  />
                </div>

                <div className={styles.formGroup}>
                  <label htmlFor="phone">Phone Number</label>
                  <input
                    id="phone"
                    type="tel"
                    value={userForm.phone}
                    onChange={(e) => handleFormChange('phone', e.target.value)}
                    placeholder="+1 (555) 123-4567"
                  />
                </div>

                <div className={styles.formGroup}>
                  <label htmlFor="message">Your Message *</label>
                  <textarea
                    id="message"
                    value={userForm.message}
                    onChange={(e) => handleFormChange('message', e.target.value)}
                    placeholder={config.widget.placeholderText || 'How can we help you today? Please describe your question or issue...'}
                    required
                  />
                </div>

                <button 
                  type="submit" 
                  className={styles.submitButton}
                  disabled={!userForm.name.trim() || !userForm.email.trim() || !userForm.message.trim()}
                >
                  <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                    Send Message
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M2,21L23,12L2,3V10L17,12L2,14V21Z"/>
                    </svg>
                  </span>
                </button>
              </form>
            )}

            {chatState.userDetails && !chatState.isLoading && (
              <div className={styles.chatInterface}>
                <div className={styles.messagesContainer}>
                  {/* History loading indicator */}
                  {chatState.isLoadingHistory && (
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: '20px',
                      color: '#666',
                      fontSize: '14px',
                      fontStyle: 'italic'
                    }}>
                      <div style={{
                        width: '16px',
                        height: '16px',
                        border: '2px solid #ddd',
                        borderTop: '2px solid #4F46E5',
                        borderRadius: '50%',
                        animation: 'spin 1s linear infinite',
                        marginRight: '8px'
                      }}></div>
                      Loading conversation history...
                    </div>
                  )}
                  
                  {/* Conversation history indicator */}
                  {chatState.session?.isReturningUser && chatState.messages.length > 2 && !chatState.isLoadingHistory && (
                    <div style={{
                      textAlign: 'center',
                      padding: '12px',
                      fontSize: '12px',
                      color: '#666',
                      borderBottom: '1px solid #e2e8f0',
                      marginBottom: '16px',
                      fontStyle: 'italic'
                    }}>
                      📚 Previous conversation history loaded
                    </div>
                  )}
                  
                  {chatState.messages.map((message) => (
                    <div
                      key={message.id}
                      className={`${styles.message} ${
                        message.sender === 'user' ? styles.messageUser : styles.messageSupport
                      } ${message.status === 'error' ? styles.messageError : ''}`}
                    >
                      <LongMessage 
                        text={message.text} 
                        maxLength={300}
                      />
                      {message.status && message.sender === 'user' && (
                        <div className={styles.messageStatus}>
                          {message.status === 'sending' ? 'Sending...' : 
                           message.status === 'error' ? 'Failed to send' : ''}
                        </div>
                      )}
                    </div>
                  ))}
                  <div ref={messagesEndRef} />
                </div>

                <form className={styles.chatInput} onSubmit={handleSendMessage}>
                  <textarea
                    ref={textareaRef}
                    value={currentMessage}
                    onChange={(e) => {
                      setCurrentMessage(e.target.value)
                      // Auto-resize textarea with proper constraints
                      const textarea = e.target as HTMLTextAreaElement
                      textarea.style.height = '36px' // Reset to min height
                      const newHeight = Math.min(Math.max(textarea.scrollHeight, 36), 100)
                      textarea.style.height = newHeight + 'px'
                    }}
                    onKeyDown={(e) => {
                      // Send on Enter (but allow Shift+Enter for new lines)
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault()
                        if (currentMessage.trim() && chatState.isConnected) {
                          handleSendMessage(e as any)
                        }
                      }
                    }}
                    placeholder="Type your message... (Enter to send, Shift+Enter for new line)"
                    disabled={!chatState.isConnected}
                    rows={1}
                    style={{ 
                      height: '36px',
                      minHeight: '36px',
                      maxHeight: '100px'
                    }}
                  />
                  <button 
                    type="submit" 
                    className={styles.sendButton}
                    disabled={!currentMessage.trim() || !chatState.isConnected}
                    title="Send message"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M2,21L23,12L2,3V10L17,12L2,14V21Z"/>
                    </svg>
                  </button>
                </form>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default ChatWidget