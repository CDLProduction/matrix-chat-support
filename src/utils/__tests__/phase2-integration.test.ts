import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as chatStorage from '../chat-storage';
import { MatrixChatClient } from '../matrix-client';

// Mock the Matrix SDK
const mockCreateClient = vi.fn();
vi.mock('matrix-js-sdk', () => ({
  MatrixClient: vi.fn(),
  createClient: mockCreateClient
}));

// Mock global fetch for API calls
global.fetch = vi.fn();

describe('Phase 2 Integration Tests - ChatWidget + Strategy 2', () => {
  let mockMatrixClient: any;

  beforeEach(() => {
    // Clear localStorage
    localStorage.clear();
    vi.clearAllMocks();

    // Mock Matrix client methods
    mockMatrixClient = {
      stopClient: vi.fn(),
      leave: vi.fn().mockResolvedValue({}),
      joinRoom: vi.fn().mockResolvedValue({ roomId: '!test-room:localhost' }),
      sendEvent: vi.fn().mockResolvedValue({ event_id: '$test-event' }),
      getRooms: vi.fn().mockReturnValue([]),
      getRoom: vi.fn(),
      on: vi.fn(),
      off: vi.fn(),
      login: vi.fn().mockResolvedValue({ 
        user_id: '@test:localhost',
        access_token: 'test-token'
      }),
      startClient: vi.fn().mockResolvedValue(undefined)
    };

    // Mock createClient to return our mock
    mockCreateClient.mockReturnValue(mockMatrixClient);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Phase 2.1: Department Switch Integration', () => {
    it('should simulate ChatWidget calling disconnect with department ID', async () => {
      // Set up multi-department scenario
      chatStorage.setDepartmentRoomId('support', '!support-room:localhost');
      chatStorage.setDepartmentRoomId('tech_support', '!tech-room:localhost');
      chatStorage.setDepartmentRoomId('identification', '!id-room:localhost');

      // Create Matrix client instance
      const client = new MatrixChatClient();
      await client.initialize({
        homeserver: 'http://localhost:8008',
        userId: '@test:localhost',
        accessToken: 'test-token'
      });

      // Simulate ChatWidget calling disconnect during department switch
      // This is what happens in handleSwitchDepartment()
      const currentDepartmentId = 'support';
      
      console.log('🧪 TEST: Simulating ChatWidget department switch...');
      console.log('📋 Rooms before disconnect:', chatStorage.getAllDepartmentRoomIds());

      // Call disconnect with Strategy 2 (current department ID)
      await client.disconnect(currentDepartmentId);

      // Verify Strategy 2 behavior: other rooms should be cleaned up
      const remainingRooms = chatStorage.getAllDepartmentRoomIds();
      console.log('📋 Rooms after disconnect:', remainingRooms);

      // Should only have the current department room remaining
      expect(remainingRooms).toHaveProperty('support');
      expect(remainingRooms).not.toHaveProperty('tech_support');
      expect(remainingRooms).not.toHaveProperty('identification');

      // Verify Matrix client leave was called for other departments
      expect(mockMatrixClient.leave).toHaveBeenCalledWith('!tech-room:localhost');
      expect(mockMatrixClient.leave).toHaveBeenCalledWith('!id-room:localhost');
      expect(mockMatrixClient.leave).not.toHaveBeenCalledWith('!support-room:localhost');
    });

    it('should simulate ChatWidget department transition workflow', async () => {
      // Simulate complete department transition from ChatWidget perspective
      
      // 1. User starts in 'support' department
      chatStorage.setSelectedDepartment({
        id: 'support',
        name: 'Support',
        matrix: { homeserver: 'http://localhost:8008' },
        widget: {}
      });
      chatStorage.setDepartmentRoomId('support', '!support-room:localhost');
      chatStorage.setDepartmentRoomId('tech_support', '!tech-room:localhost');

      const client = new MatrixChatClient();
      await client.initialize({
        homeserver: 'http://localhost:8008',
        userId: '@test:localhost',
        accessToken: 'test-token'
      });

      // 2. ChatWidget calls disconnect with current department (support) when switching
      console.log('🧪 TEST: User switching from support to tech_support...');
      await client.disconnect('support');

      // 3. Storage should show only support room remaining
      let remainingRooms = chatStorage.getAllDepartmentRoomIds();
      expect(remainingRooms).toEqual({ 'support': '!support-room:localhost' });

      // 4. User selects new department (tech_support)
      chatStorage.setSelectedDepartment({
        id: 'tech_support',
        name: 'Tech Support',
        matrix: { homeserver: 'http://localhost:8008' },
        widget: {}
      });

      // 5. If reconnecting to tech_support, it would need re-invitation
      // (This is handled by the re-invitation logic from Phase 1.3)
      const techRoomId = chatStorage.getDepartmentRoomId('tech_support');
      expect(techRoomId).toBeNull(); // Room was cleaned up

      console.log('✅ TEST: Department switch simulation completed successfully');
    });

    it('should handle ChatWidget error scenarios during department switching', async () => {
      // Set up scenario where room leave fails
      mockMatrixClient.leave.mockRejectedValueOnce(new Error('Network error'));

      chatStorage.setDepartmentRoomId('support', '!support-room:localhost');
      chatStorage.setDepartmentRoomId('failing-dept', '!failing-room:localhost');

      const client = new MatrixChatClient();
      await client.initialize({
        homeserver: 'http://localhost:8008',
        userId: '@test:localhost',
        accessToken: 'test-token'
      });

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      // Disconnect should continue despite individual room leave failures
      await client.disconnect('support');

      // Should log error but continue operation
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to leave room'),
        expect.any(Error)
      );

      // Storage should still be cleaned up even if Matrix leave failed
      const remainingRooms = chatStorage.getAllDepartmentRoomIds();
      expect(remainingRooms).toEqual({ 'support': '!support-room:localhost' });

      consoleSpy.mockRestore();
    });

    it('should validate ChatWidget backward compatibility', async () => {
      // Test that non-department disconnect calls still work (legacy mode)
      chatStorage.setDepartmentRoomId('support', '!support-room:localhost');
      chatStorage.setDepartmentRoomId('tech_support', '!tech-room:localhost');

      const client = new MatrixChatClient();
      await client.initialize({
        homeserver: 'http://localhost:8008',
        userId: '@test:localhost',
        accessToken: 'test-token'
      });

      // Legacy disconnect call (no department ID)
      await client.disconnect();

      // Should NOT trigger Strategy 2 cleanup
      const remainingRooms = chatStorage.getAllDepartmentRoomIds();
      expect(remainingRooms).toHaveProperty('support');
      expect(remainingRooms).toHaveProperty('tech_support');

      // Should not call leave on any rooms
      expect(mockMatrixClient.leave).not.toHaveBeenCalled();
    });
  });

  describe('Phase 2.2: Storage Utilities Integration Validation', () => {
    it('should validate storage utilities work with ChatWidget workflows', () => {
      // Test the storage functions that ChatWidget relies on
      
      // 1. SetDepartmentRoomId - used when saving room info
      chatStorage.setDepartmentRoomId('support', '!room1:localhost');
      chatStorage.setDepartmentRoomId('tech_support', '!room2:localhost');

      // 2. GetAllDepartmentRoomIds - used by Strategy 2 cleanup
      const allRooms = chatStorage.getAllDepartmentRoomIds();
      expect(allRooms).toEqual({
        'support': '!room1:localhost',
        'tech_support': '!room2:localhost'
      });

      // 3. ClearDepartmentRoomId - used after leaving rooms
      chatStorage.clearDepartmentRoomId('tech_support');

      const remainingRooms = chatStorage.getAllDepartmentRoomIds();
      expect(remainingRooms).toEqual({
        'support': '!room1:localhost'
      });

      // 4. CleanupInvalidDepartmentRooms - used for maintenance
      const session = chatStorage.loadChatSession();
      
      // Add invalid entry
      session.departmentHistory?.push({
        departmentId: '',
        lastActivity: new Date().toISOString(),
        conversationCount: 0
      } as any);
      
      chatStorage.updateChatSession({ departmentHistory: session.departmentHistory });
      
      // Cleanup should remove invalid entries
      chatStorage.cleanupInvalidDepartmentRooms();
      
      const cleanedRooms = chatStorage.getAllDepartmentRoomIds();
      expect(cleanedRooms).toEqual({
        'support': '!room1:localhost'
      });
    });

    it('should handle storage edge cases that ChatWidget might encounter', () => {
      // Test edge cases that could occur during ChatWidget operations

      // 1. Empty storage state
      expect(chatStorage.getAllDepartmentRoomIds()).toEqual({});

      // 2. Clearing non-existent department
      expect(() => chatStorage.clearDepartmentRoomId('non-existent')).not.toThrow();

      // 3. Corrupted storage recovery
      localStorage.setItem('matrix-chat-session', 'invalid-json');
      expect(() => chatStorage.getAllDepartmentRoomIds()).not.toThrow();
      expect(chatStorage.getAllDepartmentRoomIds()).toEqual({});

      // 4. Storage cleanup with mixed valid/invalid data
      const validSession = chatStorage.loadChatSession();
      validSession.departmentHistory = [
        {
          departmentId: 'valid-dept',
          roomId: '!valid-room:localhost',
          lastActivity: new Date().toISOString(),
          conversationCount: 1
        },
        {
          departmentId: '',
          lastActivity: new Date().toISOString(),
          conversationCount: 0
        } as any,
        {
          departmentId: 'dept-with-conversations',
          lastActivity: new Date().toISOString(),
          conversationCount: 5
        }
      ];
      
      chatStorage.updateChatSession({ departmentHistory: validSession.departmentHistory });
      chatStorage.cleanupInvalidDepartmentRooms();

      const cleanedRooms = chatStorage.getAllDepartmentRoomIds();
      expect(cleanedRooms).toEqual({
        'valid-dept': '!valid-room:localhost'
      });

      const session = chatStorage.loadChatSession();
      expect(session.departmentHistory).toHaveLength(2);
      expect(session.departmentHistory?.map(h => h.departmentId)).toEqual([
        'valid-dept', 'dept-with-conversations'
      ]);
    });

    it('should validate storage performance under ChatWidget load', () => {
      // Test performance with many departments (simulating heavy usage)
      const startTime = performance.now();

      // Create many departments
      for (let i = 0; i < 50; i++) {
        chatStorage.setDepartmentRoomId(`dept${i}`, `!room${i}:localhost`);
      }

      // Retrieve all rooms (Strategy 2 operation)
      const allRooms = chatStorage.getAllDepartmentRoomIds();
      expect(Object.keys(allRooms)).toHaveLength(50);

      // Cleanup half the departments (simulating department switching)
      for (let i = 25; i < 50; i++) {
        chatStorage.clearDepartmentRoomId(`dept${i}`);
      }

      const remainingRooms = chatStorage.getAllDepartmentRoomIds();
      expect(Object.keys(remainingRooms)).toHaveLength(25);

      // Cleanup invalid entries
      chatStorage.cleanupInvalidDepartmentRooms();

      const finalRooms = chatStorage.getAllDepartmentRoomIds();
      expect(Object.keys(finalRooms)).toHaveLength(25);

      const endTime = performance.now();
      const totalTime = endTime - startTime;

      // Should complete within reasonable time (< 50ms for 50 departments)
      expect(totalTime).toBeLessThan(50);

      console.log(`📊 Storage performance test: ${totalTime}ms for 50 departments`);
    });
  });

  describe('End-to-End Phase 2 Integration', () => {
    it('should simulate complete user journey with Strategy 2', async () => {
      console.log('🧪 TEST: Complete user journey with Strategy 2...');

      // 1. User starts fresh
      const initialSession = chatStorage.loadChatSession();
      expect(initialSession.departmentHistory).toBeUndefined();

      // 2. User selects first department (Support)
      chatStorage.setSelectedDepartment({
        id: 'support',
        name: 'Support',
        matrix: { homeserver: 'http://localhost:8008' },
        widget: {}
      });

      // 3. User creates room in Support
      chatStorage.setDepartmentRoomId('support', '!support-room:localhost');

      // 4. User later selects Tech Support department
      chatStorage.setSelectedDepartment({
        id: 'tech_support',
        name: 'Tech Support',
        matrix: { homeserver: 'http://localhost:8008' },
        widget: {}
      });

      // 5. User creates room in Tech Support
      chatStorage.setDepartmentRoomId('tech_support', '!tech-room:localhost');

      // 6. User switches back to Support - ChatWidget calls Strategy 2 disconnect
      const client = new MatrixChatClient();
      await client.initialize({
        homeserver: 'http://localhost:8008',
        userId: '@test:localhost',
        accessToken: 'test-token'
      });

      // Simulate ChatWidget department switch (preserve support, clean tech_support)
      await client.disconnect('support');

      // 7. Verify final state
      const finalRooms = chatStorage.getAllDepartmentRoomIds();
      expect(finalRooms).toEqual({
        'support': '!support-room:localhost'
      });

      // 8. User can still return to Tech Support (would trigger re-invitation)
      const techRoomId = chatStorage.getDepartmentRoomId('tech_support');
      expect(techRoomId).toBeNull(); // Cleaned up, would need re-invitation

      console.log('✅ Complete user journey simulation passed');
    });

    it('should handle complex department switching scenarios', async () => {
      // Simulate user switching between 3 departments multiple times
      
      const departments = ['support', 'tech_support', 'identification'];
      const client = new MatrixChatClient();
      await client.initialize({
        homeserver: 'http://localhost:8008',
        userId: '@test:localhost',
        accessToken: 'test-token'
      });

      // Set up initial rooms for all departments
      departments.forEach(dept => {
        chatStorage.setDepartmentRoomId(dept, `!${dept}-room:localhost`);
      });

      let initialRooms = chatStorage.getAllDepartmentRoomIds();
      expect(Object.keys(initialRooms)).toHaveLength(3);

      // Switch to support (clean others)
      await client.disconnect('support');
      let rooms = chatStorage.getAllDepartmentRoomIds();
      expect(rooms).toEqual({ 'support': '!support-room:localhost' });

      // Add tech_support room back
      chatStorage.setDepartmentRoomId('tech_support', '!tech-new-room:localhost');

      // Switch to tech_support (clean support)
      await client.disconnect('tech_support');
      rooms = chatStorage.getAllDepartmentRoomIds();
      expect(rooms).toEqual({ 'tech_support': '!tech-new-room:localhost' });

      // Verify Matrix client leave was called appropriately
      expect(mockMatrixClient.leave).toHaveBeenCalledTimes(4); // 2 switches × 2 cleanups each
      
      console.log('✅ Complex department switching scenario completed');
    });

    it('should validate Phase 2 resolves original message routing issue', async () => {
      // This test validates that Strategy 2 prevents the original issue:
      // "Messages sent to Identification department were routed to Support room"

      console.log('🧪 TEST: Validating message routing fix...');

      // 1. Set up the problematic scenario - user has rooms in multiple departments
      chatStorage.setDepartmentRoomId('support', '!support-room:localhost');
      chatStorage.setDepartmentRoomId('identification', '!id-room:localhost');

      const client = new MatrixChatClient();
      await client.initialize({
        homeserver: 'http://localhost:8008',
        userId: '@test:localhost',
        accessToken: 'test-token'
      });

      // 2. User switches to Identification - Strategy 2 should clean up Support room
      await client.disconnect('identification');

      // 3. Verify: Only Identification room remains, Support room is cleaned up
      const rooms = chatStorage.getAllDepartmentRoomIds();
      expect(rooms).toEqual({
        'identification': '!id-room:localhost'
      });

      // 4. Support room should have been left
      expect(mockMatrixClient.leave).toHaveBeenCalledWith('!support-room:localhost');
      expect(mockMatrixClient.leave).not.toHaveBeenCalledWith('!id-room:localhost');

      // 5. This prevents Matrix client auto-join from setting wrong currentRoomId
      // because there's only one room (Identification) that the user is in
      console.log('✅ Message routing fix validated - no room interference possible');
    });
  });
});