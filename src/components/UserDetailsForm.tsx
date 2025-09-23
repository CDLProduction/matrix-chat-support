import React from 'react'
import { UserDetails, Department, ChatSession } from '@/types'
import { clearChatSession, loadChatSession } from '@/utils/chat-storage'
import styles from '@/styles/widget.module.css'

interface UserDetailsFormProps {
  userForm: UserDetails
  selectedDepartment?: Department
  session?: ChatSession
  greeting?: string
  placeholderText?: string
  isLoading?: boolean
  onFormChange: (field: keyof UserDetails, value: string) => void
  onSubmit: (e: React.FormEvent) => void
  onSessionReset?: () => void
}

const UserDetailsForm: React.FC<UserDetailsFormProps> = ({
  userForm,
  selectedDepartment,
  session,
  greeting,
  placeholderText,
  isLoading,
  onFormChange,
  onSubmit,
  onSessionReset
}) => {
  const isFormValid = userForm.name.trim() && userForm.email.trim() && userForm.message?.trim()

  return (
    <form className={styles.userForm} onSubmit={onSubmit}>
      <div style={{ marginBottom: '8px' }}>

        <p style={{ margin: '0 0 16px 0', color: '#555', lineHeight: '1.4', fontSize: '14px' }}>
          {greeting || 'Hi! We\'d love to help. Please share your details and message to get started.'}
        </p>
        
        {/* Returning user indicator */}
        {session?.isReturningUser && session?.conversationCount > 0 && (
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
                You've had {session.conversationCount} previous conversation{session.conversationCount !== 1 ? 's' : ''} with our support team.
                <br />
                {onSessionReset && (
                  <button 
                    type="button"
                    onClick={onSessionReset}
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
                )}
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
          onChange={(e) => onFormChange('name', e.target.value)}
          placeholder="Enter your full name"
          required
          disabled={isLoading}
        />
      </div>

      <div className={styles.formGroup}>
        <label htmlFor="email">Email Address *</label>
        <input
          id="email"
          type="email"
          value={userForm.email}
          onChange={(e) => onFormChange('email', e.target.value)}
          placeholder="your.email@example.com"
          required
          disabled={isLoading}
        />
      </div>

      <div className={styles.formGroup}>
        <label htmlFor="phone">Phone Number</label>
        <input
          id="phone"
          type="tel"
          value={userForm.phone}
          onChange={(e) => onFormChange('phone', e.target.value)}
          placeholder="+1 (555) 123-4567"
          disabled={isLoading}
        />
      </div>

      <div className={styles.formGroup}>
        <label htmlFor="message">Your Message *</label>
        <textarea
          id="message"
          value={userForm.message}
          onChange={(e) => onFormChange('message', e.target.value)}
          placeholder={placeholderText || 'How can we help you today? Please describe your question or issue...'}
          required
          disabled={isLoading}
        />
      </div>

      <button 
        type="submit" 
        className={styles.submitButton}
        disabled={!isFormValid || isLoading}
      >
        <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
          Send Message
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M2,21L23,12L2,3V10L17,12L2,14V21Z"/>
          </svg>
        </span>
      </button>
    </form>
  )
}

export default UserDetailsForm