export interface MatrixConfig {
  homeserver: string
  accessToken: string
  supportRoomId?: string
  botUserId?: string
}

export interface WidgetConfig {
  title?: string
  subtitle?: string
  brandColor?: string
  position?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left'
  greeting?: string
  placeholderText?: string
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

export interface ChatState {
  isOpen: boolean
  isConnected: boolean
  isLoading: boolean
  messages: ChatMessage[]
  roomId?: string
  error?: string
  userDetails?: UserDetails
}

export interface MatrixChatWidgetProps {
  config: {
    matrix: MatrixConfig
    widget: WidgetConfig
  }
  onError?: (error: Error) => void
  onConnect?: (roomId: string) => void
  onMessage?: (message: ChatMessage) => void
}