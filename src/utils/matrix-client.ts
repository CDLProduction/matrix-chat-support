import { createClient, MatrixClient, Room, MatrixEvent, RoomEvent, ClientEvent } from 'matrix-js-sdk'
import { MatrixConfig, ChatMessage, UserDetails } from '@/types'

export class MatrixChatClient {
  private client: MatrixClient | null = null
  private config: MatrixConfig
  private currentRoomId: string | null = null
  private messageCallbacks: Array<(message: ChatMessage) => void> = []
  private connectionCallbacks: Array<(connected: boolean) => void> = []
  private errorCallbacks: Array<(error: Error) => void> = []

  constructor(config: MatrixConfig) {
    this.config = config
  }

  async connect(): Promise<void> {
    try {
      this.client = createClient({
        baseUrl: this.config.homeserver,
        accessToken: this.config.accessToken,
        userId: await this.getUserId()
      })

      this.client.on(RoomEvent.Timeline, this.handleTimelineEvent.bind(this))
      this.client.on(ClientEvent.Sync, this.handleSync.bind(this))

      await this.client.startClient()
      
      this.notifyConnection(true)
    } catch (error) {
      this.notifyError(error as Error)
      throw error
    }
  }

  async disconnect(): Promise<void> {
    if (this.client) {
      this.client.stopClient()
      this.client = null
    }
    this.currentRoomId = null
    this.notifyConnection(false)
  }

  async createOrJoinSupportRoom(userDetails: UserDetails): Promise<string> {
    if (!this.client) {
      throw new Error('Matrix client not connected')
    }

    try {
      if (this.config.supportRoomId) {
        const room = this.client.getRoom(this.config.supportRoomId)
        if (room) {
          this.currentRoomId = this.config.supportRoomId
          return this.config.supportRoomId
        }
      }

      const roomOptions = {
        name: `Support Chat - ${userDetails.name}`,
        topic: `Support conversation with ${userDetails.name} (${userDetails.email})`,
        initial_state: [
          {
            type: 'm.room.guest_access',
            content: { guest_access: 'can_join' }
          }
        ]
      }

      const response = await this.client.createRoom(roomOptions)
      this.currentRoomId = response.room_id

      if (this.config.botUserId) {
        await this.client.invite(this.currentRoomId, this.config.botUserId)
      }

      await this.sendMessage(`New support request from ${userDetails.name}\n\nEmail: ${userDetails.email}${userDetails.phone ? `\nPhone: ${userDetails.phone}` : ''}${userDetails.message ? `\n\nInitial message: ${userDetails.message}` : ''}`)

      return this.currentRoomId
    } catch (error) {
      this.notifyError(error as Error)
      throw error
    }
  }

  async sendMessage(text: string): Promise<void> {
    if (!this.client || !this.currentRoomId) {
      throw new Error('No active room to send message to')
    }

    try {
      await this.client.sendTextMessage(this.currentRoomId, text)
    } catch (error) {
      this.notifyError(error as Error)
      throw error
    }
  }

  onMessage(callback: (message: ChatMessage) => void): void {
    this.messageCallbacks.push(callback)
  }

  onConnection(callback: (connected: boolean) => void): void {
    this.connectionCallbacks.push(callback)
  }

  onError(callback: (error: Error) => void): void {
    this.errorCallbacks.push(callback)
  }

  private async getUserId(): Promise<string> {
    if (!this.config.accessToken) {
      throw new Error('Access token required')
    }

    const response = await fetch(`${this.config.homeserver}/_matrix/client/r0/account/whoami`, {
      headers: {
        'Authorization': `Bearer ${this.config.accessToken}`
      }
    })

    if (!response.ok) {
      throw new Error('Failed to get user ID from access token')
    }

    const data = await response.json()
    return data.user_id
  }

  private handleTimelineEvent(event: MatrixEvent, room: Room | undefined): void {
    if (!room || !this.currentRoomId || room.roomId !== this.currentRoomId) {
      return
    }

    if (event.getType() !== 'm.room.message') {
      return
    }

    const content = event.getContent()
    if (content.msgtype !== 'm.text') {
      return
    }

    const message: ChatMessage = {
      id: event.getId() || `${Date.now()}-${Math.random()}`,
      text: content.body,
      sender: event.getSender() === this.client?.getUserId() ? 'user' : 'support',
      timestamp: event.getTs(),
      status: 'sent'
    }

    this.notifyMessage(message)
  }

  private handleSync(state: string): void {
    if (state === 'SYNCING') {
      this.notifyConnection(true)
    }
  }

  private notifyMessage(message: ChatMessage): void {
    this.messageCallbacks.forEach(callback => callback(message))
  }

  private notifyConnection(connected: boolean): void {
    this.connectionCallbacks.forEach(callback => callback(connected))
  }

  private notifyError(error: Error): void {
    this.errorCallbacks.forEach(callback => callback(error))
  }
}