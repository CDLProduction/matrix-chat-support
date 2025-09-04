/**
 * Room Operation Logger
 * Provides structured logging for all room operations, especially Strategy 2 related activities
 * Designed for debugging department switching and room state issues
 */

export interface RoomOperationContext {
  operation: 'connect' | 'disconnect' | 'room_create' | 'room_leave' | 'message_send' | 'validation' | 'recovery' | 'department_switch'
  departmentId?: string
  roomId?: string
  userId?: string
  metadata?: Record<string, any>
}

export interface RoomStateSnapshot {
  currentRoomId: string | null
  departmentRooms: Record<string, string>
  totalRooms: number
  selectedDepartment?: string
  isReconnecting: boolean
  clientConnected: boolean
}

/**
 * Structured logger for room operations with search capabilities
 */
export class RoomOperationLogger {
  private static instance: RoomOperationLogger | null = null
  private logs: Array<{
    timestamp: string
    level: 'info' | 'warn' | 'error' | 'debug'
    operation: string
    context: RoomOperationContext
    message: string
    snapshot?: RoomStateSnapshot
  }> = []

  private constructor() {}

  static getInstance(): RoomOperationLogger {
    if (!RoomOperationLogger.instance) {
      RoomOperationLogger.instance = new RoomOperationLogger()
    }
    return RoomOperationLogger.instance
  }

  /**
   * Log a room operation with full context
   */
  log(
    level: 'info' | 'warn' | 'error' | 'debug',
    message: string,
    context: RoomOperationContext,
    snapshot?: RoomStateSnapshot
  ): void {
    const logEntry = {
      timestamp: new Date().toISOString(),
      level,
      operation: context.operation,
      context,
      message,
      snapshot
    }

    this.logs.push(logEntry)

    // Console output with structured format
    const contextStr = this.formatContext(context)
    const snapshotStr = snapshot ? ` | State: ${this.formatSnapshot(snapshot)}` : ''
    
    const logMessage = `🏠 [${context.operation.toUpperCase()}] ${message}${contextStr}${snapshotStr}`

    switch (level) {
      case 'error':
        console.error(logMessage)
        break
      case 'warn':
        console.warn(logMessage)
        break
      case 'debug':
        console.debug(logMessage)
        break
      default:
        console.log(logMessage)
    }

    // Keep only last 100 logs in memory
    if (this.logs.length > 100) {
      this.logs = this.logs.slice(-100)
    }
  }

  /**
   * Log Strategy 2 department switching operations
   */
  logDepartmentSwitch(
    action: 'start' | 'room_cleanup' | 'preserve' | 'complete' | 'error',
    fromDepartment: string | null,
    toDepartment: string,
    snapshot: RoomStateSnapshot,
    details?: any
  ): void {
    const message = this.getDepartmentSwitchMessage(action, fromDepartment, toDepartment, details)
    
    this.log('info', message, {
      operation: 'department_switch',
      departmentId: toDepartment,
      metadata: {
        action,
        fromDepartment,
        toDepartment,
        ...details
      }
    }, snapshot)
  }

  /**
   * Log room validation and recovery operations
   */
  logValidationOperation(
    action: 'validate' | 'recover' | 'cleanup' | 'success' | 'failure',
    departmentId: string,
    roomId: string | null,
    result: boolean | string,
    details?: any
  ): void {
    const level = action === 'failure' ? 'error' : action === 'recover' ? 'warn' : 'info'
    const message = `Room ${action}: ${departmentId} -> ${roomId || 'none'} | Result: ${result}`
    
    this.log(level, message, {
      operation: 'validation',
      departmentId,
      roomId: roomId || undefined,
      metadata: {
        action,
        result,
        ...details
      }
    })
  }

  /**
   * Log connection operations with room context
   */
  logConnection(
    action: 'start' | 'success' | 'failure' | 'reconnect',
    userId: string,
    departmentId?: string,
    roomId?: string,
    error?: Error
  ): void {
    const level = action === 'failure' ? 'error' : 'info'
    const message = `Connection ${action} for ${userId}${departmentId ? ` in ${departmentId}` : ''}`
    
    this.log(level, message, {
      operation: 'connect',
      departmentId,
      roomId,
      userId,
      metadata: {
        action,
        error: error?.message
      }
    })
  }

  /**
   * Search logs by criteria
   */
  searchLogs(criteria: {
    operation?: string
    departmentId?: string
    roomId?: string
    level?: string
    messageContains?: string
    since?: string
  }): Array<any> {
    return this.logs.filter(log => {
      if (criteria.operation && log.operation !== criteria.operation) return false
      if (criteria.departmentId && log.context.departmentId !== criteria.departmentId) return false
      if (criteria.roomId && log.context.roomId !== criteria.roomId) return false
      if (criteria.level && log.level !== criteria.level) return false
      if (criteria.messageContains && !log.message.toLowerCase().includes(criteria.messageContains.toLowerCase())) return false
      if (criteria.since && log.timestamp < criteria.since) return false
      
      return true
    })
  }

  /**
   * Get logs summary for debugging
   */
  getOperationSummary(): Record<string, number> {
    const summary: Record<string, number> = {}
    
    this.logs.forEach(log => {
      const key = `${log.operation}_${log.level}`
      summary[key] = (summary[key] || 0) + 1
    })
    
    return summary
  }

  /**
   * Export logs for debugging (last N entries)
   */
  exportLogs(count = 50): string {
    const recentLogs = this.logs.slice(-count)
    return JSON.stringify(recentLogs, null, 2)
  }

  /**
   * Clear logs (for testing)
   */
  clearLogs(): void {
    this.logs = []
  }

  private formatContext(context: RoomOperationContext): string {
    const parts: string[] = []
    
    if (context.departmentId) parts.push(`dept:${context.departmentId}`)
    if (context.roomId) parts.push(`room:${context.roomId.substring(0, 10)}...`)
    if (context.userId) parts.push(`user:${context.userId.substring(0, 15)}...`)
    
    return parts.length > 0 ? ` [${parts.join(', ')}]` : ''
  }

  private formatSnapshot(snapshot: RoomStateSnapshot): string {
    return `rooms:${snapshot.totalRooms}, current:${snapshot.currentRoomId?.substring(0, 10) || 'none'}, connected:${snapshot.clientConnected}`
  }

  private getDepartmentSwitchMessage(
    action: string,
    from: string | null,
    to: string,
    details?: any
  ): string {
    switch (action) {
      case 'start':
        return `Department switch initiated: ${from || 'none'} → ${to}`
      case 'room_cleanup':
        return `Strategy 2 cleanup: preserving ${to}, removing others`
      case 'preserve':
        return `Preserving room for ${to}: ${details?.roomId || 'unknown'}`
      case 'complete':
        return `Department switch completed: now in ${to}`
      case 'error':
        return `Department switch failed: ${from || 'none'} → ${to} | Error: ${details?.error}`
      default:
        return `Department switch ${action}: ${from || 'none'} → ${to}`
    }
  }
}

/**
 * Convenience functions for common logging operations
 */
export const roomLogger = RoomOperationLogger.getInstance()

export function logRoomOperation(
  level: 'info' | 'warn' | 'error' | 'debug',
  message: string,
  context: RoomOperationContext,
  snapshot?: RoomStateSnapshot
): void {
  roomLogger.log(level, message, context, snapshot)
}

export function logDepartmentSwitch(
  action: 'start' | 'room_cleanup' | 'preserve' | 'complete' | 'error',
  fromDepartment: string | null,
  toDepartment: string,
  snapshot: RoomStateSnapshot,
  details?: any
): void {
  roomLogger.logDepartmentSwitch(action, fromDepartment, toDepartment, snapshot, details)
}

export function logValidation(
  action: 'validate' | 'recover' | 'cleanup' | 'success' | 'failure',
  departmentId: string,
  roomId: string | null,
  result: boolean | string,
  details?: any
): void {
  roomLogger.logValidationOperation(action, departmentId, roomId, result, details)
}

export function createRoomSnapshot(
  currentRoomId: string | null,
  departmentRooms: Record<string, string>,
  selectedDepartment?: string,
  isReconnecting?: boolean,
  clientConnected?: boolean
): RoomStateSnapshot {
  return {
    currentRoomId,
    departmentRooms,
    totalRooms: Object.keys(departmentRooms).length,
    selectedDepartment,
    isReconnecting: isReconnecting || false,
    clientConnected: clientConnected || false
  }
}