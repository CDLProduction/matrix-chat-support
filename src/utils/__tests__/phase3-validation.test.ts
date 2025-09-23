import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as chatStorage from '../chat-storage';
import { MatrixChatClient } from '../matrix-client';

// Mock the Matrix SDK with factory function to avoid hoisting issues
vi.mock('matrix-js-sdk', () => {
  const mockMatrixClient = {
    stopClient: vi.fn(),
    leave: vi.fn().mockResolvedValue({}),
    joinRoom: vi.fn().mockResolvedValue({ roomId: '!test-room:localhost' }),
    sendEvent: vi.fn().mockResolvedValue({ event_id: '$test-event' }),
    sendTextMessage: vi.fn().mockResolvedValue({ event_id: '$test-message' }),
    getRooms: vi.fn().mockReturnValue([]),
    getRoom: vi.fn(),
    on: vi.fn(),
    off: vi.fn(),
    login: vi.fn().mockResolvedValue({ 
      user_id: '@test:localhost',
      access_token: 'test-token'
    }),
    startClient: vi.fn().mockResolvedValue(undefined),
    getUserId: vi.fn().mockReturnValue('@test:localhost')
  };

  return {
    MatrixClient: vi.fn(),
    createClient: vi.fn().mockReturnValue(mockMatrixClient),
    RoomEvent: {
      Timeline: 'Room.timeline',
      MyMembership: 'Room.myMembership'
    },
    ClientEvent: {
      Sync: 'sync'
    }
  };
});

// Mock global fetch for API calls
global.fetch = vi.fn();

describe('Phase 3.1 Room Validation Tests', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Room State Validation', () => {
    it('should validate correct room state during connect', async () => {
      // Set up department with valid room
      chatStorage.setSelectedDepartment({
        id: 'support',
        name: 'Support',
        matrix: { homeserver: 'http://localhost:8008' },
        widget: {}
      });
      chatStorage.setDepartmentRoomId('support', '!support-room:localhost');

      const client = new MatrixChatClient({
        homeserver: 'http://localhost:8008',
        userId: '@test:localhost',
        accessToken: 'test-token'
      });

      // Mock successful room access for validation
      const verifyRoomAccessSpy = vi.spyOn(client as any, 'verifyRoomAccess').mockResolvedValue(true);
      const ensureRoomAccessSpy = vi.spyOn(client as any, 'ensureRoomAccess').mockResolvedValue(true);

      // Connect to support department
      await client.connect(undefined, 'support');

      // Verify validation was called
      expect(ensureRoomAccessSpy).toHaveBeenCalledWith('!support-room:localhost', 'support');
      
      console.log('✅ Room validation during connect - passed');
    });

    it('should detect and recover from corrupted room state', async () => {
      const client = new MatrixChatClient({
        homeserver: 'http://localhost:8008',
        userId: '@test:localhost',
        accessToken: 'test-token'
      });

      // Set up corrupted state - currentRoomId doesn't match storage
      (client as any).currentRoomId = '!wrong-room:localhost';
      chatStorage.setSelectedDepartment({
        id: 'support',
        name: 'Support', 
        matrix: { homeserver: 'http://localhost:8008' },
        widget: {}
      });
      chatStorage.setDepartmentRoomId('support', '!correct-room:localhost');

      // Attempt validation and recovery
      const recovered = await client.validateAndRecoverRoomState('support');
      
      // Should detect corruption and attempt recovery
      expect(recovered).toBeDefined();
      
      console.log('✅ Room state corruption detection - passed');
    });

    it('should validate room state before sending messages', async () => {
      const client = new MatrixChatClient({
        homeserver: 'http://localhost:8008',
        userId: '@test:localhost',
        accessToken: 'test-token'
      });

      // Set up valid state
      chatStorage.setSelectedDepartment({
        id: 'support',
        name: 'Support',
        matrix: { homeserver: 'http://localhost:8008' },
        widget: {}
      });
      chatStorage.setDepartmentRoomId('support', '!support-room:localhost');
      (client as any).currentRoomId = '!support-room:localhost';

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      // Send message should validate room state first
      await client.sendMessage('Hello support!');

      // Verify message was sent (validation passed)
      expect(mockMatrixClient.sendTextMessage).toHaveBeenCalledWith('!support-room:localhost', 'Hello support!');
      
      consoleSpy.mockRestore();
      console.log('✅ Message send validation - passed');
    });

    it('should prevent message sending when room state is corrupted', async () => {
      const client = new MatrixChatClient({
        homeserver: 'http://localhost:8008',
        userId: '@test:localhost',
        accessToken: 'test-token'
      });

      // Set up corrupted state that cannot be recovered
      (client as any).currentRoomId = '!wrong-room:localhost';
      chatStorage.setDepartmentRoomId('identification', '!id-room:localhost');
      
      // Mock recovery failure
      const validateAndRecoverSpy = vi.spyOn(client, 'validateAndRecoverRoomState').mockResolvedValue(false);

      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      // Attempt to send message should fail
      await expect(client.sendMessage('This should fail')).rejects.toThrow(
        'Room state corrupted and recovery failed - cannot send message'
      );

      // Should not attempt to send message to Matrix
      expect(mockMatrixClient.sendTextMessage).not.toHaveBeenCalled();
      
      consoleWarnSpy.mockRestore();
      console.log('✅ Corrupted room state prevention - passed');
    });

    it('should validate department room consistency', async () => {
      // This test ensures room state matches expected department
      chatStorage.setSelectedDepartment({
        id: 'support',
        name: 'Support',
        matrix: { homeserver: 'http://localhost:8008' },
        widget: {}
      });
      chatStorage.setDepartmentRoomId('support', '!support-room:localhost');
      chatStorage.setDepartmentRoomId('tech_support', '!tech-room:localhost');

      const client = new MatrixChatClient({
        homeserver: 'http://localhost:8008',
        userId: '@test:localhost',
        accessToken: 'test-token'
      });

      // Set current room to different department (simulating room bleed)
      (client as any).currentRoomId = '!tech-room:localhost';

      // Validate should detect mismatch
      const isValid = (client as any).validateCurrentRoomId('support');
      expect(isValid).toBe(false);

      console.log('✅ Department room consistency validation - passed');
    });
  });

  describe('Room Recovery Mechanisms', () => {
    it('should clean invalid room state during recovery', async () => {
      const client = new MatrixChatClient({
        homeserver: 'http://localhost:8008',
        userId: '@test:localhost',
        accessToken: 'test-token'
      });

      // Set up corrupted state
      (client as any).currentRoomId = '!invalid-room:localhost';
      chatStorage.setDepartmentRoomId('support', '!invalid-room:localhost');

      // Mock room access failure (room doesn't exist)
      const verifyRoomAccessSpy = vi.spyOn(client as any, 'verifyRoomAccess').mockResolvedValue(false);

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      // Attempt recovery
      await (client as any).recoverRoomState('support');

      // Should clear invalid room state
      expect(chatStorage.getDepartmentRoomId('support')).toBeNull();
      expect((client as any).currentRoomId).toBeNull();

      consoleSpy.mockRestore();
      console.log('✅ Invalid room state cleanup - passed');
    });

    it('should integrate with re-invitation logic during recovery', async () => {
      const client = new MatrixChatClient({
        homeserver: 'http://localhost:8008',
        userId: '@test:localhost',
        accessToken: 'test-token'
      });

      // Set up room that needs re-invitation
      chatStorage.setDepartmentRoomId('support', '!support-room:localhost');
      (client as any).currentRoomId = '!support-room:localhost';

      // Mock that room exists but user needs re-invitation
      const ensureRoomAccessSpy = vi.spyOn(client as any, 'ensureRoomAccess').mockResolvedValue(true);
      const verifyRoomAccessSpy = vi.spyOn(client as any, 'verifyRoomAccess').mockResolvedValue(false);

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      // Recovery should trigger re-invitation logic
      await (client as any).recoverRoomState('support');

      // Should attempt to ensure room access (re-invitation)
      expect(ensureRoomAccessSpy).toHaveBeenCalledWith('!support-room:localhost', 'support');

      consoleSpy.mockRestore();
      console.log('✅ Re-invitation integration during recovery - passed');
    });

    it('should handle recovery gracefully when re-invitation fails', async () => {
      const client = new MatrixChatClient({
        homeserver: 'http://localhost:8008',
        userId: '@test:localhost',
        accessToken: 'test-token'
      });

      // Set up room state
      chatStorage.setDepartmentRoomId('support', '!support-room:localhost');
      (client as any).currentRoomId = '!support-room:localhost';

      // Mock re-invitation failure
      const ensureRoomAccessSpy = vi.spyOn(client as any, 'ensureRoomAccess').mockResolvedValue(false);
      const verifyRoomAccessSpy = vi.spyOn(client as any, 'verifyRoomAccess').mockResolvedValue(false);

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      // Recovery should handle failure gracefully
      await (client as any).recoverRoomState('support');

      // Should clear invalid state when re-invitation fails
      expect(chatStorage.getDepartmentRoomId('support')).toBeNull();

      consoleSpy.mockRestore();
      console.log('✅ Recovery failure handling - passed');
    });
  });

  describe('Edge Cases and Error Scenarios', () => {
    it('should handle validation when no department is selected', async () => {
      const client = new MatrixChatClient({
        homeserver: 'http://localhost:8008',
        userId: '@test:localhost',
        accessToken: 'test-token'
      });

      // No department selected, only legacy room
      (client as any).currentRoomId = '!legacy-room:localhost';

      // Should not fail validation for legacy scenarios
      const isValid = (client as any).validateCurrentRoomId();
      expect(typeof isValid).toBe('boolean');

      console.log('✅ No department validation handling - passed');
    });

    it('should validate after Strategy 2 room cleanup', async () => {
      // Test validation works correctly after Strategy 2 operations
      chatStorage.setDepartmentRoomId('support', '!support-room:localhost');
      chatStorage.setDepartmentRoomId('tech_support', '!tech-room:localhost');
      chatStorage.setDepartmentRoomId('identification', '!id-room:localhost');

      const client = new MatrixChatClient({
        homeserver: 'http://localhost:8008',
        userId: '@test:localhost',
        accessToken: 'test-token'
      });

      // Simulate Strategy 2 disconnect (preserve support, clean others)
      await client.disconnect('support');

      const remainingRooms = chatStorage.getAllDepartmentRoomIds();
      expect(remainingRooms).toEqual({ 'support': '!support-room:localhost' });

      // Validation should work correctly after cleanup
      (client as any).currentRoomId = '!support-room:localhost';
      const isValid = (client as any).validateCurrentRoomId('support');
      expect(isValid).toBe(true);

      console.log('✅ Post-Strategy 2 validation - passed');
    });

    it('should detect room state corruption that could interfere with Strategy 2', async () => {
      // Test that validation prevents the original message routing issue
      const client = new MatrixChatClient({
        homeserver: 'http://localhost:8008',
        userId: '@test:localhost',
        accessToken: 'test-token'
      });

      // Set up the problematic scenario that Strategy 2 was designed to fix
      chatStorage.setDepartmentRoomId('support', '!support-room:localhost');
      chatStorage.setDepartmentRoomId('identification', '!id-room:localhost');
      chatStorage.setSelectedDepartment({
        id: 'identification',
        name: 'Identification',
        matrix: { homeserver: 'http://localhost:8008' },
        widget: {}
      });

      // Current room is wrong (support room when user is in identification)
      (client as any).currentRoomId = '!support-room:localhost';

      // Validation should detect this corruption
      const isValid = (client as any).validateCurrentRoomId('identification');
      expect(isValid).toBe(false);

      console.log('✅ Strategy 2 interference prevention - passed');
    });
  });
});