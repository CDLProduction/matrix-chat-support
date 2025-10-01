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
            You'll be redirected to {channel.platform} to start your conversation
          </p>
        </div>
      </div>

      <div className={styles.socialMediaCard}>
        <div
          className={styles.socialMediaHeader}
          style={{ '--platform-color': channel.color } as React.CSSProperties}
        >
          <div className={styles.platformInfo}>
            <div className={styles.platformIcon}>
              {channel.icon}
            </div>
            <div className={styles.platformDetails}>
              <h4 className={styles.platformName}>
                {channel.name}
              </h4>
              <p className={styles.platformType}>
                {channel.platform} • {department.name}
              </p>
            </div>
          </div>
        </div>

        <div className={styles.socialMediaBody}>
          <div className={styles.departmentInfo}>
            <div className={styles.departmentIcon}>
              {department.icon}
            </div>
            <div>
              <h5 className={styles.departmentName}>
                {department.name}
              </h5>
              <p className={styles.departmentDescription}>
                {department.description}
              </p>
            </div>
          </div>

          {channel.config.botUsername && (
            <div className={styles.botInfo}>
              <h6 className={styles.botTitle}>
                {channel.platform === 'telegram' ? 'Telegram Bot' : 'Bot Information'}
              </h6>
              <div className={styles.botDetails}>
                <span className={styles.botUsername}>
                  @{channel.config.botUsername}
                </span>
                {channel.platform === 'telegram' && (
                  <div className={styles.directLink}>
                    <span className={styles.linkLabel}>Direct link:</span>
                    <a
                      href={getTelegramBotUrl()}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={styles.botLink}
                      onClick={() => setTimeout(() => onClose(), 500)}
                    >
                      t.me/{channel.config.botUsername}
                    </a>
                  </div>
                )}
              </div>
            </div>
          )}

          <div className={styles.instructionsList}>
            <h6 className={styles.instructionsTitle}>
              How to start chatting:
            </h6>
            <ol className={styles.instructions}>
              <li>Click "Open {channel.name}" below to launch {channel.platform}</li>
              {channel.platform === 'telegram' && (
                <>
                  <li>The bot will automatically detect your department ({department.name})</li>
                  <li>Start typing your message - our team will respond shortly</li>
                  <li>Continue the full conversation in Telegram</li>
                  {channel.config.botUsername && (
                    <li className={styles.alternativeInstruction}>
                      <strong>Alternative:</strong> Search for "@{channel.config.botUsername}" in Telegram and send: {getDepartmentCommand()}
                    </li>
                  )}
                </>
              )}
              {!['telegram'].includes(channel.platform) && (
                <>
                  <li>The bot will automatically detect your department ({department.name})</li>
                  <li>Start typing your message - our team will respond shortly</li>
                  <li>Continue the full conversation in {channel.platform}</li>
                </>
              )}
            </ol>
          </div>

          {channel.config.workingHours?.enabled && (
            <div className={styles.workingHours}>
              <h6 className={styles.workingHoursTitle}>
                ⏰ Support Hours
              </h6>
              <p className={styles.workingHoursInfo}>
                Our team is available during business hours.
                Outside of these hours, we'll respond as soon as possible.
              </p>
            </div>
          )}
        </div>

        <div className={styles.socialMediaActions}>
          <button
            className={styles.continueButton}
            onClick={handlePlatformRedirect}
            style={{ '--platform-color': channel.color } as React.CSSProperties}
          >
            <span className={styles.buttonIcon}>
              {channel.icon}
            </span>
            Open {channel.name}
          </button>

          <button
            className={styles.cancelButton}
            onClick={onBack}
          >
            Choose different method
          </button>
        </div>
      </div>
    </div>
  )
}

export default SocialMediaIntegration