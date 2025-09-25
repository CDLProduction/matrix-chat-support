import React from 'react'
import { CommunicationChannelOption, Department } from '@/types'
import styles from '@/styles/widget.module.css'

interface CommunicationChannelSelectorProps {
  channels: CommunicationChannelOption[]
  selectedDepartment: Department
  onChannelSelect: (channel: CommunicationChannelOption) => void
  onBack: () => void
}

const CommunicationChannelSelector: React.FC<CommunicationChannelSelectorProps> = ({
  channels,
  selectedDepartment,
  onChannelSelect,
  onBack
}) => {
  const availableChannels = channels.filter(channel => channel.available)

  return (
    <div className={styles.channelSelection}>
      <div className={styles.selectorHeader}>
        <button
          className={styles.backButton}
          onClick={onBack}
          aria-label="Go back to department selection"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M19 12H5M12 19l-7-7 7-7"/>
          </svg>
        </button>
        <div>
          <h3 className={styles.selectorTitle}>
            Choose how to contact {selectedDepartment.name}
          </h3>
          <p className={styles.selectorSubtitle}>
            Select your preferred communication method
          </p>
          <div className={styles.departmentContext}>
            <span className={styles.departmentIcon}>{selectedDepartment.icon}</span>
            <span>{selectedDepartment.name}</span>
          </div>
        </div>
      </div>

      <div className={styles.channelGrid}>
        {availableChannels.map(channel => (
          <button
            key={channel.id}
            type="button"
            className={`${styles.channelCard} ${styles[channel.type + 'Channel']}`}
            onClick={() => onChannelSelect(channel)}
            style={{
              '--channel-color': channel.color,
              borderColor: channel.color + '40'
            } as React.CSSProperties}
            aria-label={`Contact via ${channel.name}`}
          >
            <div className={styles.channelIcon}>
              {channel.icon}
            </div>
            <h4 className={styles.channelName}>
              {channel.name}
            </h4>
            <p className={styles.channelDescription}>
              {channel.description}
            </p>

            {channel.type === 'social' && channel.socialMedia && (
              <div className={styles.socialMediaInfo}>
                <div className={styles.platformBadge}>
                  <span className={styles.platformIcon}>
                    {getPlatformIcon(channel.socialMedia.platform)}
                  </span>
                  <span className={styles.platformName}>
                    {channel.socialMedia.platform}
                  </span>
                </div>
                {channel.socialMedia.config.botUsername && (
                  <div className={styles.botUsername}>
                    @{channel.socialMedia.config.botUsername}
                  </div>
                )}
              </div>
            )}

            {channel.type === 'web' && (
              <div className={styles.webChannelInfo}>
                <div className={styles.featureBadge}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                  </svg>
                  <span>Instant messaging</span>
                </div>
              </div>
            )}
          </button>
        ))}
      </div>

      {availableChannels.length === 0 && (
        <div className={styles.noChannelsAvailable}>
          <p>No communication channels are currently available for this department.</p>
          <p>Please try again later or contact us through our main website.</p>
        </div>
      )}
    </div>
  )
}

const getPlatformIcon = (platform: string) => {
  switch (platform) {
    case 'telegram':
      return '✈️'
    case 'whatsapp':
      return '💬'
    case 'facebook':
      return '📘'
    case 'twitter':
      return '🐦'
    case 'instagram':
      return '📷'
    default:
      return '💬'
  }
}

export default CommunicationChannelSelector