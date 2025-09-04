/**
 * Error Handler Utilities
 * Provides department-specific error messages and graceful fallbacks
 */

import { Department } from '@/types'

export interface ErrorContext {
  department?: Department
  action: 'connection' | 'room_creation' | 'message_send' | 'history_load' | 'configuration' | 'department_switch_room_creation' | 'reconnection'
  originalError: Error | string
}

/**
 * Converts technical errors into user-friendly messages with department context
 */
export function getUserFriendlyErrorMessage(context: ErrorContext): string {
  const { department, action, originalError } = context
  const errorMessage = typeof originalError === 'string' ? originalError : originalError.message
  const departmentName = department?.name || 'support'

  // Department-specific error messages
  const departmentContext = department ? `${departmentName} team` : 'support team'

  // Handle specific error types
  if (errorMessage.includes('M_FORBIDDEN') || errorMessage.includes('Forbidden')) {
    return `Unable to connect to ${departmentContext}. Please try again later or contact support directly.`
  }

  if (errorMessage.includes('M_NOT_FOUND') || errorMessage.includes('not found')) {
    switch (action) {
      case 'room_creation':
        return `Could not create ${departmentName} chat room. Please refresh the page and try again.`
      case 'connection':
        return `${departmentName} service is currently unavailable. Please try again later.`
      default:
        return `${departmentName} service temporarily unavailable. Please try again.`
    }
  }

  if (errorMessage.includes('Network') || errorMessage.includes('fetch')) {
    return `Network connection problem. Please check your internet connection and try again.`
  }

  if (errorMessage.includes('timeout') || errorMessage.includes('Timeout')) {
    return `Connection to ${departmentContext} timed out. Please try again.`
  }

  if (errorMessage.includes('already in the room')) {
    // This isn't actually an error - it means successful connection
    return '' // Empty string means no error to display
  }

  if (errorMessage.includes('Failed to get user ID') || errorMessage.includes('Invalid token')) {
    return `Connection issue with ${departmentContext}. Please refresh the page and try again.`
  }

  if (errorMessage.includes('Rate limit') || errorMessage.includes('M_LIMIT_EXCEEDED')) {
    return `Too many requests to ${departmentContext}. Please wait a moment and try again.`
  }

  // Action-specific fallbacks
  switch (action) {
    case 'connection':
      return `Unable to connect to ${departmentContext}. Please try again later.`
    case 'room_creation':
      return `Could not start ${departmentName} chat. Please refresh and try again.`
    case 'department_switch_room_creation':
      return `Could not switch to ${departmentName} department. Please try again.`
    case 'message_send':
      return `Message could not be sent to ${departmentContext}. Please try again.`
    case 'history_load':
      return `Could not load previous ${departmentName} conversation history.`
    case 'configuration':
      return `${departmentName} service configuration error. Please contact support.`
    case 'reconnection':
      return `Could not reconnect to ${departmentContext}. Please try again.`
    default:
      return `Connection to ${departmentContext} failed. Please try again later.`
  }
}

/**
 * Validates department configuration for common issues
 */
export function validateDepartmentConfig(department: Department): string[] {
  const errors: string[] = []

  if (!department.id || department.id.trim() === '') {
    errors.push('Department ID is required')
  }

  if (!department.name || department.name.trim() === '') {
    errors.push('Department name is required')
  }

  if (!department.matrix) {
    errors.push('Matrix configuration is required for department')
  } else {
    if (!department.matrix.homeserver) {
      errors.push(`${department.name}: Matrix homeserver URL is required`)
    }

    if (!department.matrix.accessToken && !department.matrix.access_token) {
      errors.push(`${department.name}: Matrix access token is required`)
    }

    // Validate homeserver URL format
    try {
      if (department.matrix.homeserver) {
        new URL(department.matrix.homeserver)
      }
    } catch (e) {
      errors.push(`${department.name}: Invalid homeserver URL format`)
    }
  }

  return errors
}

/**
 * Validates widget configuration for common issues
 */
export function validateWidgetConfig(config: any): string[] {
  const errors: string[] = []

  // Check if config exists
  if (!config) {
    errors.push('Configuration is missing')
    return errors
  }

  // Validate departments if they exist
  if (config.departments && Array.isArray(config.departments)) {
    if (config.departments.length === 0) {
      errors.push('At least one department must be configured when using multi-department mode')
    }

    config.departments.forEach((dept: Department, index: number) => {
      const deptErrors = validateDepartmentConfig(dept)
      errors.push(...deptErrors.map(err => `Department ${index + 1}: ${err}`))
    })

    // Check for duplicate department IDs
    const departmentIds = config.departments.map((d: Department) => d.id)
    const duplicates = departmentIds.filter((id: string, index: number) => departmentIds.indexOf(id) !== index)
    if (duplicates.length > 0) {
      errors.push(`Duplicate department IDs found: ${duplicates.join(', ')}`)
    }
  } else if (!config.matrix) {
    // If no departments, must have legacy matrix config
    errors.push('Either departments or legacy matrix configuration is required')
  }

  // Validate legacy matrix config if no departments
  if (!config.departments && config.matrix) {
    if (!config.matrix.homeserver) {
      errors.push('Matrix homeserver URL is required')
    }
    if (!config.matrix.accessToken && !config.matrix.access_token) {
      errors.push('Matrix access token is required')
    }
  }

  return errors
}

/**
 * Determines if an error should trigger a retry or if it's permanent
 */
export function isRetryableError(error: Error | string): boolean {
  const errorMessage = typeof error === 'string' ? error : error.message

  // Network and timeout errors are retryable
  if (errorMessage.includes('Network') || 
      errorMessage.includes('timeout') || 
      errorMessage.includes('fetch') ||
      errorMessage.includes('ECONNREFUSED')) {
    return true
  }

  // Rate limiting is retryable after a delay
  if (errorMessage.includes('Rate limit') || errorMessage.includes('M_LIMIT_EXCEEDED')) {
    return true
  }

  // Temporary server errors are retryable
  if (errorMessage.includes('500') || errorMessage.includes('502') || errorMessage.includes('503')) {
    return true
  }

  // Authentication and permission errors are not retryable
  if (errorMessage.includes('M_FORBIDDEN') || 
      errorMessage.includes('M_UNAUTHORIZED') ||
      errorMessage.includes('Invalid token')) {
    return false
  }

  // Configuration errors are not retryable
  if (errorMessage.includes('M_NOT_FOUND') || errorMessage.includes('Invalid config')) {
    return false
  }

  // Default to non-retryable for safety
  return false
}

/**
 * Logs errors with proper context for debugging
 */
export function logError(context: ErrorContext, additionalInfo?: any): void {
  const { department, action, originalError } = context
  
  // Better error logging with actual error details
  const errorDetails = originalError instanceof Error ? originalError.message : String(originalError)
  
  console.error(`🚨 [${action.toUpperCase()}] Error in ${department?.name || 'legacy'} department:`, errorDetails, {
    error: originalError,
    department: department?.id,
    action,
    timestamp: new Date().toISOString(),
    additionalInfo
  })
}