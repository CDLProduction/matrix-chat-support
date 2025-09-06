import { MatrixClient } from 'matrix-js-sdk'
import { 
  SpacesConfiguration, 
  SpaceHierarchy, 
  Department,
  SpaceSessionContext 
} from '@/types'
import { transformUserFriendlyError } from './error-handler'

/**
 * SpaceManager - Handles Matrix Spaces operations for room organization
 * 
 * This class manages the hierarchical organization of Matrix rooms using Spaces:
 * - Creates and manages space hierarchy (Root -> Channel -> Department -> Rooms)
 * - Handles space-aware room creation
 * - Maintains parent-child relationships
 * - Provides space discovery and validation
 */
export class SpaceManager {
  private client: MatrixClient
  private config: SpacesConfiguration
  private spaceCache: Map<string, string> = new Map()

  constructor(client: MatrixClient, config: SpacesConfiguration) {
    this.client = client
    this.config = config
  }

  // ============================================================================
  // Space Creation Methods
  // ============================================================================

  /**
   * Creates the root space for customer support
   */
  async createRootSpace(): Promise<string> {
    const spaceConfig = this.config.spaces.rootSpace
    
    if (spaceConfig.spaceId && await this.validateSpaceExists(spaceConfig.spaceId)) {
      this.log('info', 'Root space already exists', { spaceId: spaceConfig.spaceId })
      return spaceConfig.spaceId
    }

    try {
      this.log('info', 'Creating root space', { name: spaceConfig.name })
      
      const roomOptions: any = {
        name: spaceConfig.name,
        topic: spaceConfig.topic || spaceConfig.description,
        preset: this.getPresetFromVisibility(spaceConfig.visibility || 'private'),
        creation_content: {
          type: 'm.space'
        },
        power_level_content_override: spaceConfig.powerLevels || {},
        initial_state: []
      }

      // Add avatar if provided
      if (spaceConfig.avatar) {
        roomOptions.initial_state.push({
          type: 'm.room.avatar',
          content: {
            url: spaceConfig.avatar // Should be mxc:// URL or we need to upload first
          }
        })
      }

      const { room_id } = await this.client.createRoom(roomOptions)
      
      // Update configuration with created space ID
      this.config.spaces.rootSpace.spaceId = room_id
      this.spaceCache.set('root', room_id)
      
      this.log('info', 'Root space created successfully', { spaceId: room_id })
      return room_id
    } catch (error: any) {
      this.log('error', 'Failed to create root space', { error: error?.message || String(error) })
      throw transformUserFriendlyError(error, 'Failed to create customer support space')
    }
  }

  /**
   * Creates a communication channel space (Web-Chat, Telegram, etc.)
   */
  async createCommunicationChannelSpace(channelId: string): Promise<string> {
    const channel = this.config.spaces.communicationChannels.find(c => c.id === channelId)
    if (!channel) {
      throw new Error(`Communication channel '${channelId}' not found in configuration`)
    }

    if (!channel.enabled) {
      throw new Error(`Communication channel '${channelId}' is disabled`)
    }

    if (channel.spaceId && await this.validateSpaceExists(channel.spaceId)) {
      this.log('info', 'Communication channel space already exists', { 
        channelId, 
        spaceId: channel.spaceId 
      })
      return channel.spaceId
    }

    try {
      // Ensure root space exists
      const rootSpaceId = await this.ensureRootSpaceExists()

      this.log('info', 'Creating communication channel space', { 
        channelId, 
        name: channel.name 
      })
      
      const roomOptions: any = {
        name: channel.name,
        topic: channel.topic || channel.description,
        preset: this.getPresetFromVisibility(channel.visibility || 'private'),
        creation_content: {
          type: 'm.space'
        },
        power_level_content_override: channel.powerLevels || {},
        initial_state: []
      }

      // Add avatar if provided
      if (channel.avatar) {
        roomOptions.initial_state.push({
          type: 'm.room.avatar',
          content: {
            url: channel.avatar
          }
        })
      }

      const { room_id } = await this.client.createRoom(roomOptions)

      // Update configuration with created space ID
      channel.spaceId = room_id
      this.spaceCache.set(`channel-${channelId}`, room_id)

      // Set parent relationship to root space
      await this.setSpaceParent(room_id, rootSpaceId)
      await this.addChildToParentSpace(room_id, rootSpaceId)

      this.log('info', 'Communication channel space created successfully', { 
        channelId, 
        spaceId: room_id 
      })
      return room_id
    } catch (error: any) {
      this.log('error', 'Failed to create communication channel space', { 
        channelId, 
        error: error?.message || String(error) 
      })
      throw transformUserFriendlyError(
        error, 
        `Failed to create ${channel.name} space`
      )
    }
  }

  /**
   * Creates a department space within a communication channel
   */
  async createDepartmentSpace(
    departmentId: string, 
    channelId: string, 
    department: Department
  ): Promise<string> {
    const departmentConfig = this.config.departmentSpaces[channelId]
    if (!departmentConfig) {
      throw new Error(`Department space configuration not found for channel '${channelId}'`)
    }

    if (!departmentConfig.autoCreateDepartmentSpaces) {
      throw new Error(`Department space auto-creation is disabled for channel '${channelId}'`)
    }

    // Generate department space name
    const departmentSpaceName = this.config.settings.spaceNamingPattern
      .replace('{channelName}', this.getChannelName(channelId))
      .replace('{departmentName}', department.name)

    const departmentSpaceDescription = `${department.description || department.name} conversations from ${this.getChannelName(channelId)}`

    // Check if already exists
    const cacheKey = `dept-${channelId}-${departmentId}`
    const cachedSpaceId = this.spaceCache.get(cacheKey)
    if (cachedSpaceId && await this.validateSpaceExists(cachedSpaceId)) {
      this.log('info', 'Department space already exists', {
        departmentId,
        channelId,
        spaceId: cachedSpaceId
      })
      return cachedSpaceId
    }

    try {
      // Ensure communication channel space exists
      const channelSpaceId = await this.ensureChannelSpaceExists(channelId)

      this.log('info', 'Creating department space', {
        departmentId,
        channelId,
        name: departmentSpaceName
      })

      const roomOptions: any = {
        name: departmentSpaceName,
        topic: departmentSpaceDescription,
        preset: this.getPresetFromVisibility(departmentConfig.visibility),
        creation_content: {
          type: 'm.space'
        },
        initial_state: []
      }

      const { room_id } = await this.client.createRoom(roomOptions)

      // Cache the department space ID
      this.spaceCache.set(cacheKey, room_id)

      // Set parent relationship to channel space
      await this.setSpaceParent(room_id, channelSpaceId)
      await this.addChildToParentSpace(room_id, channelSpaceId)

      this.log('info', 'Department space created successfully', {
        departmentId,
        channelId,
        spaceId: room_id
      })
      return room_id
    } catch (error: any) {
      this.log('error', 'Failed to create department space', {
        departmentId,
        channelId,
        error: error?.message || String(error)
      })
      throw transformUserFriendlyError(error, `Failed to create department space for ${department.name}`)
    }
  }

  // ============================================================================
  // Space Relationship Management
  // ============================================================================

  /**
   * Adds a room to a space
   */
  async addRoomToSpace(roomId: string, spaceId: string): Promise<void> {
    try {
      this.log('debug', 'Adding room to space', { roomId, spaceId })

      await (this.client as any).sendStateEvent(
        spaceId,
        'm.space.child',
        {
          via: [this.client.getDomain() || 'localhost'],
          order: String(Date.now())
        },
        roomId
      )

      this.log('info', 'Room successfully added to space', { roomId, spaceId })
    } catch (error: any) {
      this.log('error', 'Failed to add room to space', { roomId, spaceId, error: error?.message || String(error) })
      throw transformUserFriendlyError(error, 'Failed to organize room in space')
    }
  }

  /**
   * Sets a parent space for a child space
   */
  async setSpaceParent(childSpaceId: string, parentSpaceId: string): Promise<void> {
    try {
      this.log('debug', 'Setting space parent relationship', { childSpaceId, parentSpaceId })

      await (this.client as any).sendStateEvent(
        childSpaceId,
        'm.space.parent',
        {
          via: [this.client.getDomain() || 'localhost'],
          canonical: true
        },
        parentSpaceId
      )

      this.log('info', 'Space parent relationship set', { childSpaceId, parentSpaceId })
    } catch (error: any) {
      this.log('error', 'Failed to set space parent relationship', {
        childSpaceId,
        parentSpaceId,
        error: error?.message || String(error)
      })
      throw transformUserFriendlyError(error, 'Failed to organize space hierarchy')
    }
  }

  /**
   * Adds a child space to a parent space
   */
  async addChildToParentSpace(childSpaceId: string, parentSpaceId: string): Promise<void> {
    try {
      this.log('debug', 'Adding child to parent space', { childSpaceId, parentSpaceId })

      await (this.client as any).sendStateEvent(
        parentSpaceId,
        'm.space.child',
        {
          via: [this.client.getDomain() || 'localhost'],
          order: String(Date.now())
        },
        childSpaceId
      )

      this.log('info', 'Child successfully added to parent space', { childSpaceId, parentSpaceId })
    } catch (error: any) {
      this.log('error', 'Failed to add child to parent space', {
        childSpaceId,
        parentSpaceId,
        error: error?.message || String(error)
      })
      throw transformUserFriendlyError(error, 'Failed to add space to hierarchy')
    }
  }

  // ============================================================================
  // Space Discovery and Validation
  // ============================================================================

  /**
   * Gets the hierarchy of a space
   */
  async getSpaceHierarchy(spaceId: string): Promise<SpaceHierarchy> {
    try {
      this.log('debug', 'Fetching space hierarchy', { spaceId })

      const response = await (this.client as any).http.authedRequest(
        undefined,
        'GET',
        `/_matrix/client/v1/rooms/${spaceId}/hierarchy`,
        {
          suggested_only: false,
          max_depth: 3
        }
      )

      return response as SpaceHierarchy
    } catch (error: any) {
      this.log('error', 'Failed to get space hierarchy', { spaceId, error: error?.message || String(error) })
      throw transformUserFriendlyError(error, 'Failed to fetch space organization')
    }
  }

  /**
   * Validates that a space exists and is accessible
   */
  async validateSpaceExists(spaceId: string): Promise<boolean> {
    try {
      this.log('debug', 'Validating space exists', { spaceId })
      
      // Try to get room state to verify the space exists and is accessible
      try {
        const response = await (this.client as any).http.authedRequest(
          undefined,
          'GET',
          `/_matrix/client/v3/rooms/${spaceId}/state/m.room.create`
        )
        
        // If we get here, the space exists and we have access
        const isSpace = response?.type === 'm.space'
        this.log('debug', 'Space validation result', { spaceId, exists: true, isSpace })
        return isSpace
      } catch (error: any) {
        this.log('debug', 'Space does not exist or not accessible', { spaceId, error: error?.message || String(error) })
        return false
      }
    } catch (error: any) {
      this.log('error', 'Failed to validate space exists', { spaceId, error: error?.message || String(error) })
      return false
    }
  }

  // ============================================================================
  // Space Resolution for Rooms
  // ============================================================================

  /**
   * Resolves the appropriate space context for a room based on department and channel
   */
  async resolveSpaceForRoom(department: Department, channelId: string = 'web-chat'): Promise<SpaceSessionContext> {
    try {
      this.log('debug', 'Resolving space for room', {
        departmentId: department.id,
        channelId
      })

      // Ensure base spaces exist
      const rootSpaceId = await this.ensureRootSpaceExists()
      const channelSpaceId = await this.ensureChannelSpaceExists(channelId)

      // Resolve department space if configured
      let departmentSpaceId: string | undefined
      const departmentConfig = this.config.departmentSpaces[channelId]
      if (departmentConfig?.autoCreateDepartmentSpaces) {
        departmentSpaceId = await this.createDepartmentSpace(department.id, channelId, department)
      }

      const context: SpaceSessionContext = {
        communicationChannelId: channelId,
        channelSpaceId,
        departmentSpaceId,
        rootSpaceId,
        spaceHierarchy: [rootSpaceId, channelSpaceId]
      }

      if (departmentSpaceId) {
        context.spaceHierarchy?.push(departmentSpaceId)
      }

      this.log('info', 'Space context resolved for room', context)
      return context
    } catch (error: any) {
      this.log('error', 'Failed to resolve space for room', {
        departmentId: department.id,
        channelId,
        error: error?.message || String(error)
      })
      throw transformUserFriendlyError(error, 'Failed to determine room organization')
    }
  }

  // ============================================================================
  // Helper Methods
  // ============================================================================

  /**
   * Ensures the root space exists
   */
  private async ensureRootSpaceExists(): Promise<string> {
    try {
      if (this.config.spaces.rootSpace.spaceId && await this.validateSpaceExists(this.config.spaces.rootSpace.spaceId)) {
        return this.config.spaces.rootSpace.spaceId
      }
      return await this.createRootSpace()
    } catch (error: any) {
      this.log('error', 'Failed to ensure root space exists', { error: error?.message || String(error) })
      throw transformUserFriendlyError(error, 'Failed to setup customer support space')
    }
  }

  /**
   * Ensures a communication channel space exists
   */
  private async ensureChannelSpaceExists(channelId: string): Promise<string> {
    const channel = this.config.spaces.communicationChannels.find(c => c.id === channelId)
    if (!channel) {
      throw new Error(`Communication channel '${channelId}' not found`)
    }

    if (channel.spaceId && await this.validateSpaceExists(channel.spaceId)) {
      return channel.spaceId
    }

    return await this.createCommunicationChannelSpace(channelId)
  }

  /**
   * Gets a human-readable channel name
   */
  private getChannelName(channelId: string): string {
    const channel = this.config.spaces.communicationChannels.find(c => c.id === channelId)
    return channel?.name || channelId
  }

  /**
   * Converts visibility setting to Matrix preset
   */
  private getPresetFromVisibility(visibility: string): string {
    switch (visibility) {
      case 'public': return 'public_chat'
      case 'private': return 'private_chat'
      case 'invite_only': return 'private_chat'
      default: return 'private_chat'
    }
  }

  /**
   * Logging utility with context
   */
  private log(level: 'debug' | 'info' | 'warn' | 'error', message: string, data?: any): void {
    const logData = {
      component: 'SpaceManager',
      timestamp: new Date().toISOString(),
      ...data
    }

    switch (level) {
      case 'debug':
        console.debug(`[SpaceManager] ${message}`, logData)
        break
      case 'info':
        console.info(`[SpaceManager] ${message}`, logData)
        break
      case 'warn':
        console.warn(`[SpaceManager] ${message}`, logData)
        break
      case 'error':
        console.error(`[SpaceManager] ${message}`, logData)
        break
    }
  }
}