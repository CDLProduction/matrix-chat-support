import React from 'react'
import { SocialMediaChannel, Department } from '@/types'
import styles from '@/styles/widget.module.css'

interface SocialMediaIntegrationProps {
  channel: SocialMediaChannel
  department: Department
  onClose: () => void
  onBack: () => void
}

const SocialMediaIntegration: React.FC<SocialMediaIntegrationProps> = ({
  channel,
  department,
  onClose,
  onBack
}) => {
  const handlePlatformRedirect = () => {
    let url = ''
    const botUsername = channel.config.botUsername
    const departmentMapping = channel.config.departments?.find(d => d.departmentId === department.id)
    const command = departmentMapping?.command || '/start'

    switch (channel.platform) {
      case 'telegram':
        if (botUsername) {
          // Create deep link to start bot with department command
          url = `https://t.me/${botUsername}?start=${department.id}`
        }
        break
      case 'whatsapp':
        // WhatsApp integration would go here
        break
      default:
        console.warn('Platform not implemented:', channel.platform)
        return
    }

    if (url) {
      window.open(url, '_blank')
      // Close widget after successful redirect
      setTimeout(() => onClose(), 1000)
    }
  }

  const getTelegramBotUrl = () => {
    const botUsername = channel.config.botUsername
    if (botUsername && channel.platform === 'telegram') {
      return `https://t.me/${botUsername}?start=${department.id}`
    }
    return ''
  }

  const getDepartmentCommand = () => {
    const departmentMapping = channel.config.departments?.find(d => d.departmentId === department.id)
    return departmentMapping?.command || '/start'
  }

  return (
    <div className={styles.socialMediaIntegration}>
      <div className={styles.selectorHeader}>
        <button
          className={styles.backButton}
          onClick={onBack}
          aria-label="Go back to channel selection"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M19 12H5M12 19l-7-7 7-7"/>
          </svg>
        </button>
        <div>
          <h3 className={styles.selectorTitle}>
            Connect via {channel.name}
          </h3>
          <p className={styles.selectorSubtitle}>
            Chat with us on {channel.platform}
          </p>
        </div>
      </div>

      <div className={styles.socialMediaCard}>
        <div style={{
          padding: '24px',
          display: 'flex',
          flexDirection: 'column',
          gap: '20px'
        }}>
          <p style={{
            margin: '0',
            fontSize: '15px',
            lineHeight: '1.6',
            color: '#374151',
            textAlign: 'center'
          }}>
            Click the button below to open {channel.platform} and start chatting with our support team.
          </p>

          <button
            onClick={handlePlatformRedirect}
            style={{
              backgroundColor: channel.color || '#0088cc',
              color: 'white',
              border: 'none',
              padding: '14px 24px',
              borderRadius: '8px',
              fontSize: '16px',
              fontWeight: '600',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              transition: 'all 0.2s ease',
              boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-1px)'
              e.currentTarget.style.boxShadow = '0 4px 8px rgba(0,0,0,0.15)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)'
              e.currentTarget.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)'
            }}
          >
            <span style={{ fontSize: '18px' }}>{channel.icon}</span>
            Open {channel.name}
          </button>

          <button
            onClick={onBack}
            style={{
              backgroundColor: 'transparent',
              color: '#6b7280',
              border: '1px solid #d1d5db',
              padding: '12px 24px',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: '500',
              cursor: 'pointer',
              transition: 'all 0.2s ease'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#f9fafb'
              e.currentTarget.style.borderColor = '#9ca3af'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent'
              e.currentTarget.style.borderColor = '#d1d5db'
            }}
          >
            Choose different method
          </button>
        </div>
      </div>
    </div>
  )
}

export default SocialMediaIntegration