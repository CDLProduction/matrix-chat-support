import React, { useState, useEffect, useRef } from 'react'
import { MatrixChatClient } from '@/utils/matrix-client'
import { ChatMessage, UserDetails, MatrixChatWidgetProps, ChatState } from '@/types'
import styles from '@/styles/widget.module.css'

const ChatWidget: React.FC<MatrixChatWidgetProps> = ({ config, onError, onConnect, onMessage }) => {
  const [chatState, setChatState] = useState<ChatState>({
    isOpen: false,
    isConnected: false,
    isLoading: false,
    messages: [],
    userDetails: undefined,
    error: undefined,
    roomId: undefined
  })

  const [currentMessage, setCurrentMessage] = useState('')
  const [userForm, setUserForm] = useState<UserDetails>({
    name: '',
    email: '',
    phone: '',
    message: ''
  })

  const clientRef = useRef<MatrixChatClient | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

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
    
    if (!userForm.name.trim() || !userForm.email.trim()) {
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
          setChatState(prev => ({ ...prev, error: error.message, isLoading: false }))
          onError?.(error)
        })

        await clientRef.current.connect()
      }

      const roomId = await clientRef.current.createOrJoinSupportRoom(userForm)
      
      setChatState(prev => ({
        ...prev,
        isLoading: false,
        userDetails: userForm,
        roomId,
        messages: [{
          id: 'welcome',
          text: 'Chat started. A support agent will be with you shortly.',
          sender: 'support',
          timestamp: Date.now(),
          status: 'sent'
        }]
      }))

      onConnect?.(roomId)
    } catch (error) {
      setChatState(prev => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to start chat'
      }))
      onError?.(error instanceof Error ? error : new Error('Failed to start chat'))
    }
  }

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!currentMessage.trim() || !clientRef.current) {
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
  const cssClass = positionClass.replace('-', '') as keyof typeof styles

  return (
    <div className={`${styles.widgetContainer} ${styles[cssClass]}`}>
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

            {chatState.isLoading && (
              <div className={styles.loading}>
                <div className={styles.loadingSpinner}></div>
                Connecting to support...
              </div>
            )}

            {!chatState.userDetails && !chatState.isLoading && (
              <form className={styles.userForm} onSubmit={handleStartChat}>
                <p>{config.widget.greeting || 'Please provide your details to start chatting with our support team.'}</p>
                
                <div className={styles.formGroup}>
                  <label htmlFor="name">Name *</label>
                  <input
                    id="name"
                    type="text"
                    value={userForm.name}
                    onChange={(e) => handleFormChange('name', e.target.value)}
                    required
                  />
                </div>

                <div className={styles.formGroup}>
                  <label htmlFor="email">Email *</label>
                  <input
                    id="email"
                    type="email"
                    value={userForm.email}
                    onChange={(e) => handleFormChange('email', e.target.value)}
                    required
                  />
                </div>

                <div className={styles.formGroup}>
                  <label htmlFor="phone">Phone (optional)</label>
                  <input
                    id="phone"
                    type="tel"
                    value={userForm.phone}
                    onChange={(e) => handleFormChange('phone', e.target.value)}
                  />
                </div>

                <div className={styles.formGroup}>
                  <label htmlFor="message">How can we help you? (optional)</label>
                  <textarea
                    id="message"
                    value={userForm.message}
                    onChange={(e) => handleFormChange('message', e.target.value)}
                    placeholder={config.widget.placeholderText || 'Describe your issue...'}
                  />
                </div>

                <button 
                  type="submit" 
                  className={styles.submitButton}
                  disabled={!userForm.name.trim() || !userForm.email.trim()}
                >
                  Start Chat
                </button>
              </form>
            )}

            {chatState.userDetails && !chatState.isLoading && (
              <div className={styles.chatInterface}>
                <div className={styles.messagesContainer}>
                  {chatState.messages.map((message) => (
                    <div
                      key={message.id}
                      className={`${styles.message} ${
                        message.sender === 'user' ? styles.messageUser : styles.messageSupport
                      } ${message.status === 'error' ? styles.messageError : ''}`}
                    >
                      {message.text}
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
                  <input
                    type="text"
                    value={currentMessage}
                    onChange={(e) => setCurrentMessage(e.target.value)}
                    placeholder="Type your message..."
                    disabled={!chatState.isConnected}
                  />
                  <button 
                    type="submit" 
                    className={styles.sendButton}
                    disabled={!currentMessage.trim() || !chatState.isConnected}
                  >
                    Send
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