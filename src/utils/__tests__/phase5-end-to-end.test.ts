import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as chatStorage from '../chat-storage';
import { MatrixChatClient } from '../matrix-client';
import { roomLogger } from '../room-operation-logger';

// Mock Matrix SDK with factory function to avoid hoisting issues
vi.mock('matrix-js-sdk', () => {
  const mockMatrixClient = {
    stopClient: vi.fn(),
    leave: vi.fn().mockResolvedValue({}),
    joinRoom: vi.fn().mockResolvedValue({ roomId: '!test-room:localhost' }),
    sendEvent: vi.fn().mockResolvedValue({ event_id: '$test-event' }),
    sendTextMessage: vi.fn().mockResolvedValue({ event_id: '$test-message' }),
    getRooms: vi.fn().mockReturnValue([]),
    getRoom: vi.fn().mockReturnValue({ 
      roomId: '!test-room:localhost',
      getMyMembership: vi.fn().mockReturnValue('join')
    }),
    on: vi.fn(),
    off: vi.fn(),
    removeAllListeners: vi.fn(),
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

// Mock successful API responses
global.fetch = vi.fn().mockImplementation((url: string) => {
  if (url.includes('/_matrix/client/r0/account/whoami')) {
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve({ user_id: '@support:localhost' })
    });
  }
  if (url.includes('/api/guest/register')) {
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve({
        userId: '@guest123:localhost',
        accessToken: 'guest-token-123'
      })
    });
  }
  return Promise.resolve({
    ok: true,
    json: () => Promise.resolve({})
  });
});

describe('Phase 5.1 End-to-End Department Switching Test Scenarios', () => {
  let client: MatrixChatClient;

  beforeEach(() => {
    localStorage.clear();
    roomLogger.clearLogs();
    vi.clearAllMocks();
    
    client = new MatrixChatClient({
      homeserver: 'http://localhost:8008',
      userId: '@support:localhost',
      accessToken: 'support-token'
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Scenario 1: Initial Department Selection', () => {
    it('should handle first-time user selecting a department', async () => {
      console.log('🧪 SCENARIO 1: First-time user department selection');

      // Verify clean initial state
      expect(chatStorage.getAllDepartmentRoomIds()).toEqual({});
      expect(chatStorage.getCurrentRoomId()).toBeNull();

      // User selects Support department for the first time
      const userDetails = {
        name: 'John Doe',
        email: 'john@example.com',
        message: 'I need help with my account'
      };

      // Connect to Support department (should create new room)
      await client.connect(userDetails, 'support');

      // Verify connection state - access mock through the import
      const { createClient } = await import('matrix-js-sdk');
      const mockClient = (createClient as any)();
      expect(mockClient.startClient).toHaveBeenCalled();
      
      // Check logs for proper workflow
      const logs = roomLogger.searchLogs({ operation: 'connect' });
      expect(logs.length).toBeGreaterThan(0);
      expect(logs[0].context.departmentId).toBe('support');

      console.log('✅ SCENARIO 1: First-time department selection completed successfully');
    });
  });

  describe('Scenario 2: Department Switch with Strategy 2', () => {
    it('should handle switching from Support to Tech Support', async () => {
      console.log('🧪 SCENARIO 2: Support → Tech Support department switch');

      // Set up initial state: user is in Support
      chatStorage.setDepartmentRoomId('support', '!support-room:localhost');
      chatStorage.setSelectedDepartment({
        id: 'support',
        name: 'Support',
        matrix: { homeserver: 'http://localhost:8008' },
        widget: {}
      });

      // Simulate current room connection
      (client as any).currentRoomId = '!support-room:localhost';
      (client as any).client = mockMatrixClient;

      // User switches to Tech Support - trigger Strategy 2 disconnect
      console.log('🔄 Executing Strategy 2 disconnect...');
      await client.disconnect('support'); // Strategy 2: preserve support, clean others

      // Verify Strategy 2 behavior
      const remainingRooms = chatStorage.getAllDepartmentRoomIds();
      expect(remainingRooms).toEqual({ 'support': '!support-room:localhost' });

      // User connects to Tech Support
      await client.connect(undefined, 'tech_support');

      // Verify new connection logs
      const connectLogs = roomLogger.searchLogs({ 
        operation: 'connect', 
        departmentId: 'tech_support' 
      });
      expect(connectLogs.length).toBeGreaterThan(0);

      console.log('✅ SCENARIO 2: Department switch completed successfully');
    });

    it('should handle rapid department switching', async () => {
      console.log('🧪 SCENARIO 2b: Rapid department switching (Support → Tech → Identification)');

      // Set up multiple department rooms
      chatStorage.setDepartmentRoomId('support', '!support-room:localhost');
      chatStorage.setDepartmentRoomId('tech_support', '!tech-room:localhost');
      chatStorage.setDepartmentRoomId('identification', '!id-room:localhost');

      (client as any).client = mockMatrixClient;

      const initialRooms = chatStorage.getAllDepartmentRoomIds();
      expect(Object.keys(initialRooms)).toHaveLength(3);

      // Rapid switches
      console.log('🔄 Switch 1: Preserve Support');
      await client.disconnect('support');
      let rooms = chatStorage.getAllDepartmentRoomIds();
      expect(rooms).toEqual({ 'support': '!support-room:localhost' });

      // Add back rooms for next switch
      chatStorage.setDepartmentRoomId('tech_support', '!tech-room-new:localhost');
      chatStorage.setDepartmentRoomId('identification', '!id-room-new:localhost');

      console.log('🔄 Switch 2: Preserve Tech Support');
      await client.disconnect('tech_support');
      rooms = chatStorage.getAllDepartmentRoomIds();
      expect(rooms).toEqual({ 'tech_support': '!tech-room-new:localhost' });

      // Verify Matrix leave operations were called
      expect(mockMatrixClient.leave).toHaveBeenCalledTimes(3); // 2 + 1 from previous switches

      console.log('✅ SCENARIO 2b: Rapid switching handled correctly');
    });
  });

  describe('Scenario 3: Error Recovery During Department Switching', () => {
    it('should recover from room leave failures during department switch', async () => {
      console.log('🧪 SCENARIO 3: Error recovery during department switching');

      // Set up rooms with one that will fail to leave
      chatStorage.setDepartmentRoomId('support', '!support-room:localhost');
      chatStorage.setDepartmentRoomId('tech_support', '!failing-room:localhost');

      (client as any).client = mockMatrixClient;

      // Mock one room leave to fail
      mockMatrixClient.leave.mockImplementation((roomId: string) => {
        if (roomId === '!failing-room:localhost') {
          return Promise.reject(new Error('Network timeout'));
        }
        return Promise.resolve({});
      });

      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      // Execute Strategy 2 disconnect - should continue despite failures
      await client.disconnect('support');

      // Verify error handling
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to clean up department tech_support'),
        expect.any(Error)
      );

      // Verify room cleanup still occurred for successful operations
      const remainingRooms = chatStorage.getAllDepartmentRoomIds();
      expect(remainingRooms).toEqual({ 'support': '!support-room:localhost' });

      consoleSpy.mockRestore();
      console.log('✅ SCENARIO 3: Error recovery handled gracefully');
    });

    it('should handle validation failures and trigger recovery', async () => {
      console.log('🧪 SCENARIO 3b: Room validation failure and recovery');

      // Set up corrupted state
      (client as any).currentRoomId = '!wrong-room:localhost';
      chatStorage.setDepartmentRoomId('support', '!correct-room:localhost');

      // Mock room verification to fail initially
      const verifyRoomAccessSpy = vi.spyOn(client as any, 'verifyRoomAccess')
        .mockResolvedValueOnce(false) // Initial verification fails
        .mockResolvedValueOnce(true); // Recovery succeeds

      // Connect should trigger validation and recovery
      await client.connect(undefined, 'support');

      // Verify validation was called
      expect(verifyRoomAccessSpy).toHaveBeenCalled();

      // Check validation logs
      const validationLogs = roomLogger.searchLogs({ operation: 'validation' });
      expect(validationLogs.length).toBeGreaterThan(0);

      console.log('✅ SCENARIO 3b: Validation failure and recovery completed');
    });
  });

  describe('Scenario 4: Message Routing Integrity', () => {
    it('should prevent cross-department message routing', async () => {
      console.log('🧪 SCENARIO 4: Message routing integrity validation');

      // This scenario validates that Strategy 2 prevents the original issue:
      // "Messages sent to Identification department were routed to Support room"

      // Set up the problematic scenario that Strategy 2 was designed to prevent
      chatStorage.setDepartmentRoomId('support', '!support-room:localhost');
      chatStorage.setDepartmentRoomId('identification', '!id-room:localhost');

      // User is in Identification department
      (client as any).currentRoomId = '!id-room:localhost';
      (client as any).client = mockMatrixClient;

      // Trigger Strategy 2 cleanup for Identification (preserve ID, clean Support)
      await client.disconnect('identification');

      // Verify: Support room is cleaned up, only Identification remains
      const remainingRooms = chatStorage.getAllDepartmentRoomIds();
      expect(remainingRooms).toEqual({
        'identification': '!id-room:localhost'
      });

      // Verify Support room was left
      expect(mockMatrixClient.leave).toHaveBeenCalledWith('!support-room:localhost');

      // Now there's only one room the user can send messages to
      // This prevents Matrix client auto-join from setting wrong currentRoomId
      
      // Test message sending - should go to correct room
      await client.sendMessage('Test message to Identification');
      
      expect(mockMatrixClient.sendTextMessage).toHaveBeenCalledWith(
        '!id-room:localhost',
        'Test message to Identification'
      );

      console.log('✅ SCENARIO 4: Message routing integrity validated - no cross-department bleed possible');
    });
  });

  describe('Scenario 5: Session Persistence and Recovery', () => {
    it('should maintain department state across page refreshes', async () => {
      console.log('🧪 SCENARIO 5: Session persistence across page refresh');

      // Simulate user session with multiple departments
      chatStorage.setDepartmentRoomId('support', '!support-room:localhost');
      chatStorage.setDepartmentRoomId('tech_support', '!tech-room:localhost');
      chatStorage.setSelectedDepartment({
        id: 'tech_support',
        name: 'Tech Support',
        matrix: { homeserver: 'http://localhost:8008' },
        widget: {}
      });

      // Execute Strategy 2 to clean state (preserve tech_support)
      (client as any).client = mockMatrixClient;
      await client.disconnect('tech_support');

      // Verify clean state after Strategy 2
      const cleanedRooms = chatStorage.getAllDepartmentRoomIds();
      expect(cleanedRooms).toEqual({
        'tech_support': '!tech-room:localhost'
      });

      // Simulate page refresh - create new client instance
      const newClient = new MatrixChatClient({
        homeserver: 'http://localhost:8008',
        userId: '@support:localhost',
        accessToken: 'support-token'
      });

      // Reconnect should restore the correct state
      await newClient.connect(undefined, 'tech_support');

      // Verify state consistency
      const restoredRooms = chatStorage.getAllDepartmentRoomIds();
      expect(restoredRooms).toHaveProperty('tech_support');

      console.log('✅ SCENARIO 5: Session persistence validated');
    });
  });

  describe('Scenario 6: Performance Under Load', () => {
    it('should handle multiple rapid department switches efficiently', async () => {
      console.log('🧪 SCENARIO 6: Performance under rapid switching load');

      const startTime = performance.now();

      // Create many departments for stress testing
      const departments = ['support', 'tech_support', 'identification', 'billing', 'sales'];
      
      departments.forEach(dept => {
        chatStorage.setDepartmentRoomId(dept, `!${dept}-room:localhost`);
      });

      (client as any).client = mockMatrixClient;

      // Perform rapid switches
      for (let i = 0; i < departments.length; i++) {
        const currentDept = departments[i];
        console.log(`🔄 Rapid switch ${i + 1}: Preserving ${currentDept}`);
        
        await client.disconnect(currentDept);
        
        // Verify only current department remains
        const rooms = chatStorage.getAllDepartmentRoomIds();
        expect(rooms).toEqual({ [currentDept]: `!${currentDept}-room:localhost` });
        
        // Re-add other rooms for next iteration (simulating new room creation)
        if (i < departments.length - 1) {
          departments.forEach((dept, idx) => {
            if (idx > i) {
              chatStorage.setDepartmentRoomId(dept, `!${dept}-room-${i}:localhost`);
            }
          });
        }
      }

      const endTime = performance.now();
      const totalTime = endTime - startTime;

      // Performance assertions
      expect(totalTime).toBeLessThan(1000); // Should complete within 1 second
      expect(mockMatrixClient.leave).toHaveBeenCalledTimes(10); // 4+3+2+1 = 10 leave operations

      // Check operation logs
      const disconnectLogs = roomLogger.searchLogs({ operation: 'disconnect' });
      expect(disconnectLogs).toHaveLength(departments.length);

      console.log(`📊 SCENARIO 6: Performance test completed in ${totalTime}ms - PASSED`);
    });

    it('should limit log memory usage during extended operation', async () => {
      console.log('🧪 SCENARIO 6b: Log memory management validation');

      // Generate many log entries
      for (let i = 0; i < 150; i++) {
        roomLogger.log('info', `Test log ${i}`, {
          operation: 'connect',
          departmentId: `dept${i % 10}`,
          metadata: { iteration: i }
        });
      }

      // Verify log memory limit (should keep only last 100)
      const allLogs = roomLogger.searchLogs({});
      expect(allLogs.length).toBeLessThanOrEqual(100);
      
      // Verify newest logs are kept
      expect(allLogs[allLogs.length - 1].context.metadata?.iteration).toBe(149);

      console.log('✅ SCENARIO 6b: Log memory management working correctly');
    });
  });

  describe('Scenario 7: Integration with Error Handling', () => {
    it('should provide user-friendly errors during department switching', async () => {
      console.log('🧪 SCENARIO 7: User-friendly error handling integration');

      const errorCallback = vi.fn();
      client.onError(errorCallback);

      // Mock a connection failure
      mockMatrixClient.startClient.mockRejectedValueOnce(new Error('M_FORBIDDEN: Access denied'));

      // Attempt to connect
      await expect(client.connect(undefined, 'support')).rejects.toThrow();

      // Verify user-friendly error was provided
      expect(errorCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('Unable to connect')
        })
      );

      console.log('✅ SCENARIO 7: User-friendly error handling validated');
    });
  });

  describe('Scenario 8: Strategy 2 vs Legacy Mode Comparison', () => {
    it('should demonstrate difference between Strategy 2 and Legacy disconnect', async () => {
      console.log('🧪 SCENARIO 8: Strategy 2 vs Legacy mode comparison');

      // Set up multiple rooms
      chatStorage.setDepartmentRoomId('support', '!support-room:localhost');
      chatStorage.setDepartmentRoomId('tech_support', '!tech-room:localhost');
      chatStorage.setDepartmentRoomId('identification', '!id-room:localhost');

      (client as any).client = mockMatrixClient;

      const initialRooms = chatStorage.getAllDepartmentRoomIds();
      expect(Object.keys(initialRooms)).toHaveLength(3);

      // Test Legacy disconnect (no department ID)
      console.log('🔄 Testing Legacy disconnect...');
      await client.disconnect(); // No department ID = legacy mode

      // Verify: Legacy mode preserves all rooms
      let rooms = chatStorage.getAllDepartmentRoomIds();
      expect(Object.keys(rooms)).toHaveLength(3);
      expect(mockMatrixClient.leave).not.toHaveBeenCalled();

      // Test Strategy 2 disconnect
      console.log('🔄 Testing Strategy 2 disconnect...');
      await client.disconnect('support'); // With department ID = Strategy 2

      // Verify: Strategy 2 cleans up non-current rooms
      rooms = chatStorage.getAllDepartmentRoomIds();
      expect(rooms).toEqual({ 'support': '!support-room:localhost' });
      expect(mockMatrixClient.leave).toHaveBeenCalledTimes(2); // tech_support + identification

      console.log('✅ SCENARIO 8: Strategy 2 vs Legacy behavior validated');
    });
  });
});