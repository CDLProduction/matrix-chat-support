import React, { useRef, useEffect } from 'react'
import { ChatMessage, ChatSession, Department } from '@/types'
import LongMessage from './LongMessage'
import styles from '@/styles/widget.module.css'

interface ChatInterfaceProps {
  messages: ChatMessage[]
  currentMessage: string
  isConnected: boolean
  isLoadingHistory?: boolean
  session?: ChatSession
  selectedDepartment?: Department
  onMessageChange: (message: string) => void
  onSendMessage: (e: React.FormEvent) => void
  onSwitchDepartment?: () => void
}

const ChatInterface: React.FC<ChatInterfaceProps> = ({
  messages,
  currentMessage,
  isConnected,
  isLoadingHistory,
  session,
  selectedDepartment,
  onMessageChange,
  onSendMessage,
  onSwitchDepartment
}) => {
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onMessageChange(e.target.value)
    // Auto-resize textarea with proper constraints
    const textarea = e.target as HTMLTextAreaElement
    textarea.style.height = '36px' // Reset to min height
    const newHeight = Math.min(Math.max(textarea.scrollHeight, 36), 100)
    textarea.style.height = newHeight + 'px'
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Send on Enter (but allow Shift+Enter for new lines)
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (currentMessage.trim() && isConnected) {
        onSendMessage(e as any)
      }
    }
  }

  return (
    <div className={styles.chatInterface}>
      <div className={styles.messagesContainer}>
        {/* History loading indicator */}
        {isLoadingHistory && (
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
        {session?.isReturningUser && messages.length > 2 && !isLoadingHistory && (
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

        
        {/* Messages */}
        {messages.map((message) => (
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

      <form className={styles.chatInput} onSubmit={onSendMessage}>
        <textarea
          ref={textareaRef}
          value={currentMessage}
          onChange={handleTextareaChange}
          onKeyDown={handleKeyDown}
          placeholder="Type your message..."
          disabled={!isConnected}
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
          disabled={!currentMessage.trim() || !isConnected}
          title="Send message"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M2,21L23,12L2,3V10L17,12L2,14V21Z"/>
          </svg>
        </button>
      </form>
    </div>
  )
}

export default ChatInterface