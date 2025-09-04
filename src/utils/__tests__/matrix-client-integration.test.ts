import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as chatStorage from '../chat-storage';

// Test the integration between MatrixChatClient and chat-storage for Strategy 2
describe('Matrix Client - Strategy 2 Integration with Storage', () => {
  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear();
    vi.clearAllMocks();
  });

  describe('Room cleanup integration', () => {
    it('should retrieve all department room IDs correctly for cleanup', () => {
      // Set up multiple departments with room IDs
      chatStorage.setDepartmentRoomId('support', '!room1:localhost');
      chatStorage.setDepartmentRoomId('tech_support', '!room2:localhost');
      chatStorage.setDepartmentRoomId('identification', '!room3:localhost');

      const allRoomIds = chatStorage.getAllDepartmentRoomIds();

      expect(allRoomIds).toEqual({
        'support': '!room1:localhost',
        'tech_support': '!room2:localhost',
        'identification': '!room3:localhost'
      });
    });

    it('should simulate Strategy 2 room cleanup workflow', () => {
      // Set up initial state with multiple departments
      chatStorage.setDepartmentRoomId('support', '!room1:localhost');
      chatStorage.setDepartmentRoomId('tech_support', '!room2:localhost');
      chatStorage.setDepartmentRoomId('identification', '!room3:localhost');

      const currentDepartmentId = 'support';
      
      // Simulate the disconnect process with Strategy 2
      const allRoomIds = chatStorage.getAllDepartmentRoomIds();
      
      // Filter out current department (should not be cleaned up)
      const roomsToCleanup = Object.entries(allRoomIds).filter(
        ([deptId]) => deptId !== currentDepartmentId
      );

      expect(roomsToCleanup).toHaveLength(2);
      expect(roomsToCleanup).toEqual([
        ['tech_support', '!room2:localhost'],
        ['identification', '!room3:localhost']
      ]);

      // Simulate clearing the room IDs after leaving
      roomsToCleanup.forEach(([deptId]) => {
        chatStorage.clearDepartmentRoomId(deptId);
      });

      // Verify cleanup results
      const remainingRoomIds = chatStorage.getAllDepartmentRoomIds();
      expect(remainingRoomIds).toEqual({
        'support': '!room1:localhost'
      });
    });

    it('should handle department switching with room cleanup', () => {
      // Initial state: user in support department
      chatStorage.setSelectedDepartment({
        id: 'support',
        name: 'Support',
        matrix: {},
        widget: {}
      });
      chatStorage.setDepartmentRoomId('support', '!support-room:localhost');

      // Simulate switching to tech_support
      const oldDepartmentId = 'support';
      const newDepartmentId = 'tech_support';

      // In Strategy 2, we would clean up the old department's room
      chatStorage.clearDepartmentRoomId(oldDepartmentId);
      
      // Set new department
      chatStorage.setSelectedDepartment({
        id: newDepartmentId,
        name: 'Tech Support',
        matrix: {},
        widget: {}
      });

      // Verify state after switch
      const roomIds = chatStorage.getAllDepartmentRoomIds();
      expect(roomIds).not.toHaveProperty('support');
      
      const selectedDept = chatStorage.getSelectedDepartment();
      expect(selectedDept?.id).toBe('tech_support');
    });

    it('should preserve current department room during bulk cleanup', () => {
      // Set up scenario with multiple departments
      chatStorage.setDepartmentRoomId('support', '!support:localhost');
      chatStorage.setDepartmentRoomId('tech_support', '!tech:localhost');
      chatStorage.setDepartmentRoomId('identification', '!id:localhost');
      chatStorage.setDepartmentRoomId('billing', '!billing:localhost');

      const preserveDepartmentId = 'tech_support';
      const allRoomIds = chatStorage.getAllDepartmentRoomIds();

      // Simulate Strategy 2 bulk cleanup (preserve current department)
      Object.keys(allRoomIds).forEach(deptId => {
        if (deptId !== preserveDepartmentId) {
          chatStorage.clearDepartmentRoomId(deptId);
        }
      });

      const remainingRooms = chatStorage.getAllDepartmentRoomIds();
      expect(remainingRooms).toEqual({
        'tech_support': '!tech:localhost'
      });
    });

    it('should handle cleanup validation and maintenance', () => {
      // Set up invalid/incomplete department entries
      const session = chatStorage.loadChatSession();
      session.departmentHistory = [
        {
          departmentId: 'support',
          roomId: '!valid-room:localhost',
          lastActivity: new Date().toISOString(),
          conversationCount: 1
        },
        {
          departmentId: '', // Invalid - no department ID
          roomId: '!invalid1:localhost',
          lastActivity: new Date().toISOString(),
          conversationCount: 0
        } as any,
        {
          departmentId: 'tech_support',
          lastActivity: new Date().toISOString(),
          conversationCount: 2 // Valid - has conversation count even without room
        },
        {
          departmentId: 'orphaned',
          lastActivity: new Date().toISOString(),
          conversationCount: 0 // Invalid - no room and no conversations
        }
      ];
      
      chatStorage.updateChatSession({ departmentHistory: session.departmentHistory });

      // Run cleanup
      chatStorage.cleanupInvalidDepartmentRooms();

      // Verify only valid entries remain
      const cleanedRooms = chatStorage.getAllDepartmentRoomIds();
      expect(cleanedRooms).toEqual({
        'support': '!valid-room:localhost'
      });

      const updatedSession = chatStorage.loadChatSession();
      expect(updatedSession.departmentHistory).toHaveLength(2);
      expect(updatedSession.departmentHistory?.map(h => h.departmentId)).toEqual(['support', 'tech_support']);
    });
  });

  describe('Error scenarios', () => {
    it('should handle gracefully when no departments exist', () => {
      const roomIds = chatStorage.getAllDepartmentRoomIds();
      expect(roomIds).toEqual({});

      // Simulate cleanup with no rooms - should not error
      expect(() => chatStorage.cleanupInvalidDepartmentRooms()).not.toThrow();
    });

    it('should handle clearing non-existent department room ID', () => {
      chatStorage.setDepartmentRoomId('support', '!room:localhost');
      
      // Try to clear non-existent department
      expect(() => chatStorage.clearDepartmentRoomId('non-existent')).not.toThrow();
      
      // Original department should remain intact
      const roomIds = chatStorage.getAllDepartmentRoomIds();
      expect(roomIds.support).toBe('!room:localhost');
    });

    it('should handle corrupted storage gracefully', () => {
      // Simulate corrupted localStorage
      localStorage.setItem('matrix-chat-session', 'invalid-json');
      
      // Should create new session instead of crashing
      expect(() => chatStorage.getAllDepartmentRoomIds()).not.toThrow();
      
      const roomIds = chatStorage.getAllDepartmentRoomIds();
      expect(roomIds).toEqual({});
    });
  });

  describe('Performance validation', () => {
    it('should handle large numbers of departments efficiently', () => {
      const startTime = performance.now();
      
      // Set up 100 departments
      for (let i = 0; i < 100; i++) {
        chatStorage.setDepartmentRoomId(`dept${i}`, `!room${i}:localhost`);
      }
      
      // Retrieve all room IDs
      const allRoomIds = chatStorage.getAllDepartmentRoomIds();
      expect(Object.keys(allRoomIds)).toHaveLength(100);
      
      // Clean up all but one department
      Object.keys(allRoomIds).forEach((deptId, index) => {
        if (index > 0) { // Preserve first department
          chatStorage.clearDepartmentRoomId(deptId);
        }
      });
      
      const remainingRooms = chatStorage.getAllDepartmentRoomIds();
      expect(Object.keys(remainingRooms)).toHaveLength(1);
      
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      // Operations should complete within reasonable time (< 100ms)
      expect(duration).toBeLessThan(100);
    });
  });
});