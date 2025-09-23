// Future: Use yaml for file-based configuration loading
// import * as yaml from 'js-yaml'
import { SpacesConfiguration, SpaceConfig, CommunicationChannel } from '@/types'
import { transformUserFriendlyError } from './error-handler'

/**
 * ConfigManager - Handles Matrix Spaces configuration loading and validation
 * 
 * This class manages:
 * - Loading spaces.yaml configuration
 * - Validating space configuration structure
 * - Providing department space mappings
 * - Dynamic space configuration updates
 */
export class ConfigManager {
  private spacesConfig: SpacesConfiguration | null = null
  private configPath: string
  private lastLoaded: number = 0
  private readonly CACHE_DURATION = 5 * 60 * 1000 // 5 minutes

  constructor(configPath = '/config/spaces.yaml') {
    this.configPath = configPath
  }

  // ============================================================================
  // Configuration Loading
  // ============================================================================

  /**
   * Loads and parses the spaces configuration from YAML
   */
  async loadSpaceConfiguration(): Promise<SpacesConfiguration> {
    try {
      // Return cached configuration if still valid
      if (this.spacesConfig && this.isCacheValid()) {
        return this.spacesConfig
      }

      console.log('[ConfigManager] Loading spaces configuration from', this.configPath)
      
      // For now, we'll use a default configuration since we can't read files directly
      // In a real implementation, this would read from the file system
      this.spacesConfig = this.getDefaultSpacesConfiguration()
      this.lastLoaded = Date.now()

      // Validate the loaded configuration
      if (!this.validateSpaceConfiguration(this.spacesConfig)) {
        throw new Error('Invalid spaces configuration structure')
      }

      console.log('[ConfigManager] Spaces configuration loaded successfully')
      return this.spacesConfig
    } catch (error: any) {
      console.error('[ConfigManager] Failed to load spaces configuration:', error?.message || String(error))
      throw transformUserFriendlyError(error, 'Failed to load space organization settings')
    }
  }

  /**
   * Validates the structure and content of spaces configuration
   */
  validateSpaceConfiguration(config: SpacesConfiguration): boolean {
    try {
      // Validate root space
      if (!config.spaces?.rootSpace) {
        console.error('[ConfigManager] Missing root space configuration')
        return false
      }

      if (!this.validateSpaceConfig(config.spaces.rootSpace, 'rootSpace')) {
        return false
      }

      // Validate communication channels
      if (!config.spaces?.communicationChannels || !Array.isArray(config.spaces.communicationChannels)) {
        console.error('[ConfigManager] Missing or invalid communication channels')
        return false
      }

      for (const channel of config.spaces.communicationChannels) {
        if (!this.validateCommunicationChannel(channel)) {
          return false
        }
      }

      // Validate settings
      if (!config.settings) {
        console.error('[ConfigManager] Missing settings configuration')
        return false
      }

      if (!this.validateSettings(config.settings)) {
        return false
      }

      // Validate department spaces configuration
      if (!config.departmentSpaces || typeof config.departmentSpaces !== 'object') {
        console.error('[ConfigManager] Missing or invalid department spaces configuration')
        return false
      }

      console.log('[ConfigManager] Configuration validation passed')
      return true
    } catch (error: any) {
      console.error('[ConfigManager] Configuration validation error:', error?.message || String(error))
      return false
    }
  }

  /**
   * Updates space mapping with resolved space IDs
   */
  async updateSpaceMapping(spaceId: string, config: Partial<SpaceConfig>): Promise<void> {
    try {
      if (!this.spacesConfig) {
        throw new Error('No spaces configuration loaded')
      }

      // Update root space if applicable
      if (config.name === this.spacesConfig.spaces.rootSpace.name) {
        this.spacesConfig.spaces.rootSpace = {
          ...this.spacesConfig.spaces.rootSpace,
          ...config,
          spaceId
        }
        console.log('[ConfigManager] Updated root space mapping', { spaceId })
        return
      }

      // Update communication channel space
      const channel = this.spacesConfig.spaces.communicationChannels.find(
        c => c.name === config.name
      )
      if (channel) {
        Object.assign(channel, config, { spaceId })
        console.log('[ConfigManager] Updated channel space mapping', { 
          channelId: channel.id, 
          spaceId 
        })
        return
      }

      console.warn('[ConfigManager] Space not found for mapping update', { spaceId, config })
    } catch (error: any) {
      console.error('[ConfigManager] Failed to update space mapping:', error?.message || String(error))
      throw transformUserFriendlyError(error, 'Failed to update space configuration')
    }
  }

  // ============================================================================
  // Configuration Getters
  // ============================================================================

  /**
   * Gets the space ID for a specific department and communication channel
   */
  getDepartmentSpaceId(_departmentId: string, channelId: string): string | null {
    if (!this.spacesConfig) {
      return null
    }

    const channel = this.spacesConfig.spaces.communicationChannels.find(c => c.id === channelId)
    if (!channel?.enabled) {
      return null
    }

    // For now, return the channel space ID
    // In future, this could return department-specific space IDs
    return channel.spaceId || null
  }

  /**
   * Gets the configuration for a specific communication channel
   */
  getChannelConfiguration(channelId: string): CommunicationChannel | null {
    if (!this.spacesConfig) {
      return null
    }

    return this.spacesConfig.spaces.communicationChannels.find(c => c.id === channelId) || null
  }

  /**
   * Gets all enabled communication channels
   */
  getEnabledChannels(): CommunicationChannel[] {
    if (!this.spacesConfig) {
      return []
    }

    return this.spacesConfig.spaces.communicationChannels.filter(c => c.enabled)
  }

  /**
   * Gets the current spaces configuration
   */
  getCurrentConfiguration(): SpacesConfiguration | null {
    return this.spacesConfig
  }

  /**
   * Checks if spaces are enabled in the configuration
   */
  areSpacesEnabled(): boolean {
    if (!this.spacesConfig) {
      return false
    }

    return this.spacesConfig.settings.autoSetupSpaces && 
           this.spacesConfig.settings.spaceCreationMode !== 'disabled'
  }

  /**
   * Gets space creation mode
   */
  getSpaceCreationMode(): 'auto' | 'manual' | 'disabled' {
    return this.spacesConfig?.settings.spaceCreationMode || 'disabled'
  }

  // ============================================================================
  // Private Validation Methods
  // ============================================================================

  /**
   * Validates individual space configuration
   */
  private validateSpaceConfig(space: SpaceConfig, spaceName: string): boolean {
    if (!space.name || typeof space.name !== 'string') {
      console.error(`[ConfigManager] Invalid name for ${spaceName}`)
      return false
    }

    if (!space.description || typeof space.description !== 'string') {
      console.error(`[ConfigManager] Invalid description for ${spaceName}`)
      return false
    }

    if (space.visibility && !['public', 'private', 'invite_only'].includes(space.visibility)) {
      console.error(`[ConfigManager] Invalid visibility for ${spaceName}`)
      return false
    }

    return true
  }

  /**
   * Validates communication channel configuration
   */
  private validateCommunicationChannel(channel: CommunicationChannel): boolean {
    if (!channel.id || typeof channel.id !== 'string') {
      console.error('[ConfigManager] Communication channel missing or invalid ID')
      return false
    }

    if (!this.validateSpaceConfig(channel, `channel:${channel.id}`)) {
      return false
    }

    if (typeof channel.enabled !== 'boolean') {
      console.error(`[ConfigManager] Invalid enabled flag for channel ${channel.id}`)
      return false
    }

    return true
  }

  /**
   * Validates settings configuration
   */
  private validateSettings(settings: any): boolean {
    if (typeof settings.autoSetupSpaces !== 'boolean') {
      console.error('[ConfigManager] Invalid autoSetupSpaces setting')
      return false
    }

    if (!['auto', 'manual', 'disabled'].includes(settings.spaceCreationMode)) {
      console.error('[ConfigManager] Invalid spaceCreationMode setting')
      return false
    }

    if (typeof settings.repairHierarchyOnStart !== 'boolean') {
      console.error('[ConfigManager] Invalid repairHierarchyOnStart setting')
      return false
    }

    return true
  }

  /**
   * Checks if the configuration cache is still valid
   */
  private isCacheValid(): boolean {
    return Date.now() - this.lastLoaded < this.CACHE_DURATION
  }

  /**
   * Returns default spaces configuration
   * In a real implementation, this would be loaded from the YAML file
   */
  private getDefaultSpacesConfiguration(): SpacesConfiguration {
    return {
      spaces: {
        rootSpace: {
          name: "Customer Support",
          description: "Central hub for all customer support communications",
          avatar: "🏢",
          topic: "Organized customer support across all communication channels",
          visibility: "private"
        },
        communicationChannels: [
          {
            id: "web-chat",
            name: "Web-Chat",
            description: "All conversations from the website chat widget",
            avatar: "💻",
            topic: "Customer conversations from web widget",
            visibility: "private",
            enabled: true
          },
          {
            id: "telegram",
            name: "Telegram",
            description: "All conversations from Telegram bot",
            avatar: "✈️",
            topic: "Customer conversations from Telegram integration",
            visibility: "private",
            enabled: false
          },
          {
            id: "facebook",
            name: "Facebook",
            description: "All conversations from Facebook Messenger",
            avatar: "📘",
            topic: "Customer conversations from Facebook Messenger bridge",
            visibility: "private",
            enabled: false
          }
        ]
      },
      settings: {
        autoSetupSpaces: true,
        spaceCreationMode: "auto",
        repairHierarchyOnStart: true,
        spaceNamingPattern: "{channelName} - {departmentName}",
        maxRoomsPerSpace: 1000,
        maxHierarchyDepth: 5,
        autoCleanup: {
          enabled: false,
          emptySpaceRetentionDays: 30
        }
      },
      departmentSpaces: {
        "web-chat": {
          autoCreateDepartmentSpaces: true,
          visibility: "private",
          roomNamingPattern: "{userName} - {departmentName} #{conversationId}",
          organization: {
            groupBy: "department",
            maxRoomsPerDepartment: 500,
            autoArchiveAfterDays: 90
          }
        },
        "telegram": {
          autoCreateDepartmentSpaces: false,
          visibility: "private",
          roomNamingPattern: "{userName} (Telegram) - {departmentName} #{conversationId}",
          organization: {
            groupBy: "department",
            maxRoomsPerDepartment: 500,
            autoArchiveAfterDays: 90
          }
        },
        "facebook": {
          autoCreateDepartmentSpaces: false,
          visibility: "private",
          roomNamingPattern: "{userName} (Facebook) - {departmentName} #{conversationId}",
          organization: {
            groupBy: "department",
            maxRoomsPerDepartment: 500,
            autoArchiveAfterDays: 90
          }
        }
      },
      appearance: {
        showSpaceInHeader: true,
        displayChannelOrigin: true,
        allowSpaceSwitching: false,
        spaceIcons: {
          rootSpace: "🏢",
          webChat: "💻",
          telegram: "✈️",
          facebook: "📘"
        },
        spaceColors: {
          rootSpace: "#4F46E5",
          webChat: "#667eea",
          telegram: "#0088cc",
          facebook: "#1877f2"
        }
      },
      logging: {
        logSpaceOperations: true,
        logHierarchyChanges: true,
        logRoomSpaceChanges: true,
        spaceLogLevel: "info"
      },
      matrix: {
        rateLimiting: {
          spaceCreation: 5,
          roomToSpace: 30,
          hierarchyQuery: 60
        },
        retryPolicy: {
          maxRetries: 3,
          retryDelayMs: 1000,
          exponentialBackoff: true
        },
        sync: {
          syncIntervalMinutes: 60,
          validateIntegrity: true,
          autoRepair: true
        }
      },
      features: {
        debugMode: false,
        analytics: false,
        experimentalFeatures: false,
        performanceMonitoring: true
      }
    }
  }
}