export interface MatrixConfig {
  homeserver: string
  accessToken: string
  adminAccessToken?: string
  supportRoomId?: string
  botUserId?: string
  departmentUsers?: string[]
  spaceConfig?: DepartmentSpaceConfig
}

// Matrix Spaces Configuration Interfaces
export interface SpaceConfig {
  name: string
  description: string
  spaceId?: string
  parentSpaceId?: string
  avatar?: string
  topic?: string
  visibility?: 'public' | 'private' | 'invite_only'
  enabled?: boolean
  powerLevels?: SpacePowerLevels
}

export interface SpacePowerLevels {
  invite?: number
  kick?: number
  ban?: number
  redact?: number
  events_default?: number
  users_default?: number
  state_default?: number
}

export interface CommunicationChannel extends SpaceConfig {
  id: string
  departments?: string[]
}

export interface DepartmentSpaceConfig {
  channelId: string
  parentSpaceId?: string
  departmentSpaceId?: string
  autoCreateDepartmentSpace?: boolean
  departmentSpaceNaming?: string
}

export interface SpacesConfiguration {
  spaces: {
    rootSpace: SpaceConfig
    communicationChannels: CommunicationChannel[]
  }
  settings: SpaceSettings
  departmentSpaces: Record<string, DepartmentSpaceSettings>
  appearance: SpaceAppearanceConfig
  logging: SpaceLoggingConfig
  matrix: SpaceMatrixConfig
  features: SpaceFeatureFlags
}

export interface SpaceSettings {
  autoSetupSpaces: boolean
  spaceCreationMode: 'auto' | 'manual' | 'disabled'
  repairHierarchyOnStart: boolean
  spaceNamingPattern: string
  maxRoomsPerSpace: number
  maxHierarchyDepth: number
  autoCleanup: {
    enabled: boolean
    emptySpaceRetentionDays: number
  }
}

export interface DepartmentSpaceSettings {
  autoCreateDepartmentSpaces: boolean
  visibility: 'public' | 'private' | 'invite_only'
  roomNamingPattern: string
  organization: {
    groupBy: 'none' | 'date' | 'department' | 'user'
    maxRoomsPerDepartment: number
    autoArchiveAfterDays: number
  }
}

export interface SpaceAppearanceConfig {
  showSpaceInHeader: boolean
  displayChannelOrigin: boolean
  allowSpaceSwitching: boolean
  spaceIcons: Record<string, string>
  spaceColors: Record<string, string>
}

export interface SpaceLoggingConfig {
  logSpaceOperations: boolean
  logHierarchyChanges: boolean
  logRoomSpaceChanges: boolean
  spaceLogLevel: 'debug' | 'info' | 'warn' | 'error'
}

export interface SpaceMatrixConfig {
  rateLimiting: {
    spaceCreation: number
    roomToSpace: number
    hierarchyQuery: number
  }
  retryPolicy: {
    maxRetries: number
    retryDelayMs: number
    exponentialBackoff: boolean
  }
  sync: {
    syncIntervalMinutes: number
    validateIntegrity: boolean
    autoRepair: boolean
  }
}

export interface SpaceFeatureFlags {
  debugMode: boolean
  analytics: boolean
  experimentalFeatures: boolean
  performanceMonitoring: boolean
}

export interface SpaceHierarchy {
  roomId: string
  childrenState: SpaceChild[]
  children?: SpaceHierarchy[]
}

export interface SpaceChild {
  roomId: string
  roomType?: string
  name?: string
  topic?: string
  avatar?: string
  via: string[]
  suggested?: boolean
  order?: string
}

export interface DepartmentWidgetConfig {
  greeting?: string
  placeholderText?: string
  additionalFields?: UserFormField[]
}

export interface UserFormField {
  id: string
  name: string
  type: 'text' | 'email' | 'tel' | 'textarea' | 'select'
  required?: boolean
  placeholder?: string
  options?: string[]
}

export interface Department {
  id: string
  name: string
  description?: string
  icon?: string
  color?: string
  matrix: MatrixConfig
  widget: DepartmentWidgetConfig
}

export interface DepartmentSelectionConfig {
  title?: string
  subtitle?: string
  showDescriptions?: boolean
  layout?: 'grid' | 'list'
}

export interface WidgetConfig {
  title?: string
  subtitle?: string
  brandColor?: string
  position?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left'
  greeting?: string
  placeholderText?: string
  departmentSelection?: DepartmentSelectionConfig
  spaces?: WidgetSpaceConfig
}

export interface WidgetSpaceConfig {
  showSpaceInHeader?: boolean
  displayChannelOrigin?: boolean
  allowSpaceSwitching?: boolean
  spaceIndicatorStyle?: 'minimal' | 'detailed' | 'hidden'
}

export interface UserDetails {
  name: string
  email: string
  phone?: string
  message?: string
}

export interface ChatMessage {
  id: string
  text: string
  sender: 'user' | 'support'
  timestamp: number
  status?: 'sending' | 'sent' | 'error'
}

export interface ChatSession {
  userId: string
  selectedDepartment?: Department
  departmentId?: string
  matrixUserId?: string
  roomId?: string
  userDetails?: UserDetails
  lastActivity: string
  conversationCount: number
  isReturningUser: boolean
  // Space-related session information
  spaceContext?: SpaceSessionContext
}

export interface SpaceSessionContext {
  communicationChannelId: string    // 'web-chat', 'telegram'
  channelSpaceId?: string          // Communication channel space ID
  departmentSpaceId?: string       // Department-specific space ID
  rootSpaceId?: string             // Root space ID
  spaceHierarchy?: string[]        // Array of space IDs from root to room
}

export interface ChatState {
  // Navigation state
  currentStep: 'department-selection' | 'channel-selection' | 'social-media-setup' | 'user-form' | 'chat'
  selectedDepartment?: Department
  selectedChannel?: CommunicationChannelOption
  selectedSocialMedia?: SocialMediaChannel
  
  // Existing state
  isOpen: boolean
  isConnected: boolean
  isLoading: boolean
  messages: ChatMessage[]
  roomId?: string
  error?: string
  userDetails?: UserDetails
  session?: ChatSession
  isLoadingHistory?: boolean
  
  // Department-specific client
  matrixClient?: any
}

// Social Media Integration Types
export interface SocialMediaChannel {
  id: string
  name: string
  platform: 'telegram' | 'whatsapp' | 'twitter' | 'instagram'
  icon: string
  color: string
  enabled: boolean
  config: SocialMediaConfig
}

export interface SocialMediaConfig {
  // Telegram specific
  botUsername?: string
  botToken?: string

  // Department mappings
  departments?: SocialMediaDepartmentMapping[]

  // General config
  welcomeMessage?: string
  autoReply?: boolean
  workingHours?: WorkingHours
}

export interface SocialMediaDepartmentMapping {
  departmentId: string
  command: string
  channelSpecific?: boolean
}

export interface WorkingHours {
  enabled: boolean
  timezone: string
  schedule: DaySchedule[]
  offHoursMessage?: string
}

export interface DaySchedule {
  day: 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday'
  start: string // HH:mm format
  end: string   // HH:mm format
  enabled: boolean
}

export interface CommunicationChannelOption {
  type: 'web' | 'social'
  id: string
  name: string
  description: string
  icon: string
  color: string
  available: boolean
  socialMedia?: SocialMediaChannel
}

export interface MatrixChatWidgetProps {
  config: {
    departments?: Department[]
    matrix?: MatrixConfig  // Fallback for legacy mode
    widget: WidgetConfig
    spaces?: SpacesConfiguration  // Optional spaces configuration
    socialMedia?: SocialMediaChannel[]  // Social media integration
    communicationChannels?: CommunicationChannelOption[]  // Channel selection
  }
  onError?: (error: Error) => void
  onConnect?: (roomId: string, department?: Department) => void
  onMessage?: (message: ChatMessage) => void
  onDepartmentSelect?: (department: Department) => void
  onSpaceContext?: (context: SpaceSessionContext) => void
  onSocialMediaSelect?: (channel: SocialMediaChannel, department: Department) => void
}