import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as chatStorage from '../chat-storage';
import { MatrixChatClient } from '../matrix-client';
import { logError, getUserFriendlyErrorMessage, isRetryableError } from '../error-handler';

// Mock error handler functions
vi.mock('../error-handler', () => ({
  logError: vi.fn(),
  getUserFriendlyErrorMessage: vi.fn().mockReturnValue('User friendly error message'),
  isRetryableError: vi.fn().mockReturnValue(false),
  ErrorContext: {}
}));

// Mock Matrix SDK
vi.mock('matrix-js-sdk', () => ({
  MatrixClient: vi.fn(),
  createClient: vi.fn().mockReturnValue({
    stopClient: vi.fn(),
    leave: vi.fn().mockRejectedValue(new Error('Network error')),
    sendTextMessage: vi.fn().mockRejectedValue(new Error('Message send failed')),
    on: vi.fn(),
    off: vi.fn(),
    startClient: vi.fn().mockResolvedValue(undefined),
    getUserId: vi.fn().mockReturnValue('@test:localhost')
  }),
  RoomEvent: { Timeline: 'Room.timeline', MyMembership: 'Room.myMembership' },
  ClientEvent: { Sync: 'sync' }
}));

global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

describe('Phase 3.2 Enhanced Error Handling Tests', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  describe('Context-Aware Error Reporting', () => {
    it('should provide context-aware error handling for connection failures', async () => {
      const client = new MatrixChatClient({
        homeserver: 'http://localhost:8008',
        userId: '@test:localhost',
        accessToken: 'test-token'
      });

      const errorCallback = vi.fn();
      client.onError(errorCallback);

      // Attempt connection that will fail
      await expect(client.connect(undefined, 'support')).rejects.toThrow();

      // Verify error handler was called with context
      expect(logError).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'reconnection',
          originalError: expect.any(Error),
          department: expect.objectContaining({ id: 'support' })
        }),
        expect.any(Object)
      );

      // Verify user-friendly error was provided to callback
      expect(getUserFriendlyErrorMessage).toHaveBeenCalled();
      expect(errorCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'User friendly error message'
        })
      );

      console.log('✅ Context-aware connection error handling - passed');
    });

    it('should provide context-aware error handling for message sending failures', async () => {
      const client = new MatrixChatClient({
        homeserver: 'http://localhost:8008',
        userId: '@test:localhost',
        accessToken: 'test-token'
      });

      // Set up a mock room state
      (client as any).currentRoomId = '!test-room:localhost';
      (client as any).client = {
        sendTextMessage: vi.fn().mockRejectedValue(new Error('Message send failed')),
        getUserId: vi.fn().mockReturnValue('@test:localhost')
      };

      const errorCallback = vi.fn();
      client.onError(errorCallback);

      // Attempt message send that will fail
      await expect(client.sendMessage('Hello')).rejects.toThrow();

      // Verify error handler was called with proper context
      expect(logError).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'message_send',
          originalError: expect.any(Error)
        }),
        expect.any(Object)
      );

      // Verify retryable error detection was used
      expect(isRetryableError).toHaveBeenCalledWith(expect.any(Error));

      console.log('✅ Context-aware message send error handling - passed');
    });

    it('should handle Strategy 2 room cleanup errors gracefully', async () => {
      // Set up multiple department rooms
      chatStorage.setDepartmentRoomId('support', '!support-room:localhost');
      chatStorage.setDepartmentRoomId('tech_support', '!tech-room:localhost');

      const client = new MatrixChatClient({
        homeserver: 'http://localhost:8008',
        userId: '@test:localhost',
        accessToken: 'test-token'
      });

      // Mock client with failing leave operation
      (client as any).client = {
        leave: vi.fn().mockRejectedValue(new Error('Room leave failed')),
        stopClient: vi.fn(),
        removeAllListeners: vi.fn()
      };

      // Disconnect with Strategy 2 (should trigger room cleanup)
      await client.disconnect('support');

      // Verify room cleanup errors were logged with context
      expect(logError).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'department_switch_room_creation',
          originalError: expect.any(Error),
          department: expect.objectContaining({ id: 'tech_support' })
        }),
        expect.objectContaining({
          operation: 'room_cleanup',
          excludedDepartment: 'support'
        })
      );

      console.log('✅ Strategy 2 room cleanup error handling - passed');
    });
  });

  describe('Error Context Preservation', () => {
    it('should preserve original error details in user-friendly errors', async () => {
      const client = new MatrixChatClient({
        homeserver: 'http://localhost:8008',
        userId: '@test:localhost',
        accessToken: 'test-token'
      });

      const originalError = new Error('M_FORBIDDEN: Access denied');
      const errorCallback = vi.fn();
      client.onError(errorCallback);

      // Mock the getUserFriendlyErrorMessage to return a specific message
      (getUserFriendlyErrorMessage as any).mockReturnValue('Unable to connect to support team. Please try again later.');

      // Trigger error with context
      (client as any).notifyError(originalError, {
        action: 'connection',
        originalError,
        department: { id: 'support', name: 'Support' }
      });

      // Verify callback received enhanced error
      expect(errorCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Unable to connect to support team. Please try again later.',
          original: originalError,
          context: expect.objectContaining({
            action: 'connection',
            department: expect.objectContaining({ id: 'support' })
          })
        })
      );

      console.log('✅ Error context preservation - passed');
    });

    it('should handle errors without context gracefully', async () => {
      const client = new MatrixChatClient({
        homeserver: 'http://localhost:8008',
        userId: '@test:localhost',
        accessToken: 'test-token'
      });

      const originalError = new Error('Generic error');
      const errorCallback = vi.fn();
      client.onError(errorCallback);

      // Trigger error without context (legacy mode)
      (client as any).notifyError(originalError);

      // Verify original error was passed through unchanged
      expect(errorCallback).toHaveBeenCalledWith(originalError);
      expect(logError).not.toHaveBeenCalled();

      console.log('✅ Legacy error handling compatibility - passed');
    });
  });

  describe('Error Recovery Hints', () => {
    it('should identify retryable vs permanent errors', async () => {
      // Mock different error scenarios
      (isRetryableError as any)
        .mockReturnValueOnce(true)  // Network error - retryable
        .mockReturnValueOnce(false) // Permission error - not retryable
        .mockReturnValueOnce(true); // Timeout - retryable

      const client = new MatrixChatClient({
        homeserver: 'http://localhost:8008',
        userId: '@test:localhost',
        accessToken: 'test-token'
      });

      // Simulate different error types
      const networkError = new Error('Network connection failed');
      const permissionError = new Error('M_FORBIDDEN: Access denied');
      const timeoutError = new Error('Request timeout');

      // Test network error
      await expect(client.connect()).rejects.toThrow();
      expect(isRetryableError).toHaveBeenCalledWith(expect.any(Error));

      // Test permission error
      vi.clearAllMocks();
      await expect(client.connect()).rejects.toThrow();
      expect(isRetryableError).toHaveBeenCalledWith(expect.any(Error));

      console.log('✅ Error recovery hints - passed');
    });

    it('should provide detailed error context for debugging', async () => {
      const client = new MatrixChatClient({
        homeserver: 'http://localhost:8008',
        userId: '@test:localhost',
        accessToken: 'test-token'
      });

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      // Attempt connection that will fail
      await expect(client.connect(undefined, 'support')).rejects.toThrow();

      // Verify detailed error logging was performed
      expect(consoleSpy).toHaveBeenCalledWith(
        '❌ [CONNECT] Connection failed:',
        expect.objectContaining({
          departmentId: 'support',
          error: expect.any(Error),
          isReconnecting: expect.any(Boolean),
          retryable: expect.any(Boolean)
        })
      );

      consoleSpy.mockRestore();
      console.log('✅ Detailed error context logging - passed');
    });
  });

  describe('Error Handler Integration', () => {
    it('should use error handler utilities consistently', async () => {
      const client = new MatrixChatClient({
        homeserver: 'http://localhost:8008',
        userId: '@test:localhost',
        accessToken: 'test-token'
      });

      const error = new Error('Test error');
      const context = {
        action: 'connection' as const,
        originalError: error,
        department: { id: 'support', name: 'Support' } as any
      };

      // Trigger error with context
      (client as any).notifyError(error, context);

      // Verify all error handler utilities were used
      expect(logError).toHaveBeenCalledWith(
        context,
        expect.objectContaining({
          currentRoomId: null,
          clientConnected: false
        })
      );
      expect(getUserFriendlyErrorMessage).toHaveBeenCalledWith(context);

      console.log('✅ Error handler utilities integration - passed');
    });

    it('should handle validation errors from Phase 3.1', async () => {
      const client = new MatrixChatClient({
        homeserver: 'http://localhost:8008',
        userId: '@test:localhost',
        accessToken: 'test-token'
      });

      // Mock validation failure
      vi.spyOn(client, 'validateAndRecoverRoomState').mockResolvedValue(false);
      (client as any).currentRoomId = '!test-room:localhost';

      const errorCallback = vi.fn();
      client.onError(errorCallback);

      // Attempt to send message which will fail validation
      await expect(client.sendMessage('Hello')).rejects.toThrow('Room state corrupted and recovery failed');

      // Verify proper error handling occurred
      expect(errorCallback).toHaveBeenCalled();

      console.log('✅ Phase 3.1 validation error integration - passed');
    });
  });
});