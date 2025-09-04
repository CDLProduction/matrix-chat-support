import { describe, it, expect, beforeEach } from 'vitest';
import * as chatStorage from '../chat-storage';

describe('Strategy 2.1 Phase 1: Smart Room Preservation', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe('Enhanced Room Status Tracking', () => {
    it('should set room status with membership history', () => {
      console.log('🧪 Testing enhanced room status tracking');

      // Set initial active room
      chatStorage.setDepartmentRoomStatus('support', '!support-room:localhost', 'active', 'room_created');
      
      let roomInfo = chatStorage.getDepartmentRoomInfo('support');
      expect(roomInfo?.status).toBe('active');
      expect(roomInfo?.membershipHistory?.[0]?.action).toBe('join');
      expect(roomInfo?.membershipHistory?.[0]?.reason).toBe('room_created');
      
      // Leave room (Strategy 2.1 - preserve in storage)
      chatStorage.setDepartmentRoomStatus('support', '!support-room:localhost', 'left', 'department_switch');
      
      roomInfo = chatStorage.getDepartmentRoomInfo('support');
      expect(roomInfo?.status).toBe('left');
      expect(roomInfo?.membershipHistory).toHaveLength(2);
      expect(roomInfo?.membershipHistory?.[1]?.action).toBe('leave');
      expect(roomInfo?.membershipHistory?.[1]?.reason).toBe('department_switch');

      console.log('✅ Room status tracking with membership history working');
    });

    it('should demonstrate Strategy 2.1 room preservation vs old Strategy 2', () => {
      console.log('🧪 Comparing Strategy 2 vs Strategy 2.1 behavior');

      // Setup: User active in 3 departments
      chatStorage.setDepartmentRoomStatus('support', '!support-room:localhost', 'active');
      chatStorage.setDepartmentRoomStatus('tech_support', '!tech-room:localhost', 'active');
      chatStorage.setDepartmentRoomStatus('identification', '!id-room:localhost', 'active');

      const allRoomsBefore = chatStorage.getAllDepartmentRoomInfo();
      expect(Object.keys(allRoomsBefore)).toHaveLength(3);

      // OLD Strategy 2 behavior (simulated)
      console.log('🔄 OLD Strategy 2: clearDepartmentRoomId removes from storage');
      chatStorage.clearDepartmentRoomId('support'); // ❌ This removes memory!
      chatStorage.clearDepartmentRoomId('tech_support'); // ❌ This removes memory!

      const afterOldStrategy = chatStorage.getAllDepartmentRoomIds();
      expect(Object.keys(afterOldStrategy)).toHaveLength(1); // Only identification remains
      
      // User returns to support - OLD behavior: no memory, creates new room
      expect(chatStorage.getDepartmentRoomInfo('support')).toBeNull(); // ❌ No memory!

      // Reset for NEW Strategy 2.1
      localStorage.clear();
      chatStorage.setDepartmentRoomStatus('support', '!support-room:localhost', 'active');
      chatStorage.setDepartmentRoomStatus('tech_support', '!tech-room:localhost', 'active');
      chatStorage.setDepartmentRoomStatus('identification', '!id-room:localhost', 'active');

      // NEW Strategy 2.1 behavior
      console.log('🔄 NEW Strategy 2.1: preserve room memory with "left" status');
      chatStorage.setDepartmentRoomStatus('support', '!support-room:localhost', 'left', 'department_switch');
      chatStorage.setDepartmentRoomStatus('tech_support', '!tech-room:localhost', 'left', 'department_switch');

      const afterNewStrategy = chatStorage.getAllDepartmentRoomInfo();
      expect(Object.keys(afterNewStrategy)).toHaveLength(3); // ✅ All rooms preserved!

      // User returns to support - NEW behavior: has memory, can re-invite
      const supportInfo = chatStorage.getDepartmentRoomInfo('support');
      expect(supportInfo?.status).toBe('left'); // ✅ Memory preserved!
      expect(supportInfo?.roomId).toBe('!support-room:localhost'); // ✅ Room ID remembered!

      console.log('✅ Strategy 2.1 preserves room memory for re-invitation');
    });

    it('should handle room state transitions correctly', () => {
      console.log('🧪 Testing room state transitions');

      const roomId = '!test-room:localhost';
      const deptId = 'test_dept';

      // Create room (active)
      chatStorage.setDepartmentRoomStatus(deptId, roomId, 'active', 'room_created');
      expect(chatStorage.getDepartmentRoomInfo(deptId)?.status).toBe('active');

      // Leave room (preserve for re-invitation)
      chatStorage.setDepartmentRoomStatus(deptId, roomId, 'left', 'department_switch');
      expect(chatStorage.getDepartmentRoomInfo(deptId)?.status).toBe('left');

      // Re-join room (from left to active)
      chatStorage.setDepartmentRoomStatus(deptId, roomId, 'active', 'department_switch_return');
      expect(chatStorage.getDepartmentRoomInfo(deptId)?.status).toBe('active');

      // Room becomes invalid (server deleted it)
      chatStorage.setDepartmentRoomStatus(deptId, roomId, 'invalid', 'rejoin_failed');
      expect(chatStorage.getDepartmentRoomInfo(deptId)?.status).toBe('invalid');

      const roomInfo = chatStorage.getDepartmentRoomInfo(deptId);
      expect(roomInfo?.membershipHistory).toHaveLength(4);

      console.log('✅ Room state transitions working correctly');
    });

    it('should clean up invalid rooms while preserving left rooms', () => {
      console.log('🧪 Testing enhanced cleanup logic');

      // Setup various room states
      chatStorage.setDepartmentRoomStatus('active_dept', '!active:localhost', 'active', 'room_created');
      chatStorage.setDepartmentRoomStatus('left_dept', '!left:localhost', 'left', 'department_switch');
      chatStorage.setDepartmentRoomStatus('invalid_dept', '!invalid:localhost', 'invalid', 'server_deleted');

      // Set invalid room to be old (simulate 8 days ago)
      const oldTimestamp = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString();
      const session = chatStorage.loadChatSession();
      if (session.departmentHistory) {
        const invalidDept = session.departmentHistory.find(d => d.departmentId === 'invalid_dept');
        if (invalidDept) {
          invalidDept.lastActivity = oldTimestamp;
          chatStorage.updateChatSession({ departmentHistory: session.departmentHistory });
        }
      }

      const beforeCleanup = chatStorage.getAllDepartmentRoomInfo();
      expect(Object.keys(beforeCleanup)).toHaveLength(3);

      // Run cleanup (7 day max age)
      chatStorage.cleanupInvalidDepartmentRooms();

      const afterCleanup = chatStorage.getAllDepartmentRoomInfo();
      expect(Object.keys(afterCleanup)).toHaveLength(2); // Invalid room removed
      expect(afterCleanup).toHaveProperty('active_dept');
      expect(afterCleanup).toHaveProperty('left_dept'); // ✅ Left room preserved!
      expect(afterCleanup).not.toHaveProperty('invalid_dept'); // ✅ Old invalid room cleaned up!

      console.log('✅ Enhanced cleanup preserves left rooms for re-invitation');
    });
  });

  describe('Backwards Compatibility', () => {
    it('should handle legacy rooms without status', () => {
      console.log('🧪 Testing backwards compatibility');

      // Simulate legacy room entry (no roomStatus)
      const session = chatStorage.loadChatSession();
      session.departmentHistory = [{
        departmentId: 'legacy_dept',
        roomId: '!legacy-room:localhost',
        lastActivity: new Date().toISOString(),
        conversationCount: 1
        // No roomStatus field (legacy)
      }];
      chatStorage.updateChatSession({ departmentHistory: session.departmentHistory });

      // Should default to 'active' for backwards compatibility
      const roomInfo = chatStorage.getDepartmentRoomInfo('legacy_dept');
      expect(roomInfo?.status).toBe('active'); // Default fallback
      expect(roomInfo?.roomId).toBe('!legacy-room:localhost');

      console.log('✅ Backwards compatibility maintained');
    });
  });
});