export interface MatrixConfig {
  homeserver: string
  accessToken: string
  adminAccessToken?: string
  supportRoomId?: string
  botUserId?: string
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
}

export interface ChatState {
  // Navigation state
  currentStep: 'department-selection' | 'user-form' | 'chat'
  selectedDepartment?: Department
  
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

export interface MatrixChatWidgetProps {
  config: {
    departments?: Department[]
    matrix?: MatrixConfig  // Fallback for legacy mode
    widget: WidgetConfig
  }
  onError?: (error: Error) => void
  onConnect?: (roomId: string, department?: Department) => void
  onMessage?: (message: ChatMessage) => void
  onDepartmentSelect?: (department: Department) => void
}