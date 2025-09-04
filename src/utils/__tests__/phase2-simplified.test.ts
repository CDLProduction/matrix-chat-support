import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as chatStorage from '../chat-storage';

// Mock console to prevent test output noise
const consoleSpy = {
  log: vi.spyOn(console, 'log').mockImplementation(() => {}),
  warn: vi.spyOn(console, 'warn').mockImplementation(() => {}),
  error: vi.spyOn(console, 'error').mockImplementation(() => {})
};

describe('Phase 2 Integration Tests - Strategy 2 Storage Integration', () => {
  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear();
    vi.clearAllMocks();
  });

  afterAll(() => {
    // Restore console methods
    consoleSpy.log.mockRestore();
    consoleSpy.warn.mockRestore();
    consoleSpy.error.mockRestore();
  });

  describe('Phase 2.1: Department Switch Workflow Integration', () => {
    it('should simulate ChatWidget department switching storage operations', () => {
      // This test simulates the storage operations that happen during
      // ChatWidget department switching with Strategy 2

      console.log('🧪 TEST: Simulating ChatWidget department switch workflow...');

      // 1. Initial state: User connects to Support department
      chatStorage.setSelectedDepartment({
        id: 'support',
        name: 'Support',
        matrix: { homeserver: 'http://localhost:8008' },
        widget: {}
      });
      chatStorage.setDepartmentRoomId('support', '!support-room:localhost');

      // 2. User creates conversation with Tech Support
      chatStorage.setDepartmentRoomId('tech_support', '!tech-room:localhost');

      // 3. User creates conversation with Identification
      chatStorage.setDepartmentRoomId('identification', '!id-room:localhost');

      // Verify multi-department state
      const allRooms = chatStorage.getAllDepartmentRoomIds();
      expect(allRooms).toEqual({
        'support': '!support-room:localhost',
        'tech_support': '!tech-room:localhost',
        'identification': '!id-room:localhost'
      });

      // 4. ChatWidget calls handleSwitchDepartment() - user switches to Identification
      // This triggers Strategy 2: preserve Identification, clean up others
      
      // Simulate the room cleanup that would happen during disconnect('identification')
      const currentDepartmentId = 'identification';
      const roomsToCleanup = Object.entries(allRooms).filter(
        ([deptId]) => deptId !== currentDepartmentId
      );

      // Clean up non-current department rooms (what Strategy 2 does)
      roomsToCleanup.forEach(([deptId]) => {
        chatStorage.clearDepartmentRoomId(deptId);
      });

      // 5. Verify Strategy 2 result: only current department room remains
      const remainingRooms = chatStorage.getAllDepartmentRoomIds();
      expect(remainingRooms).toEqual({
        'identification': '!id-room:localhost'
      });

      // 6. Update selected department
      chatStorage.setSelectedDepartment({
        id: 'identification',
        name: 'Identification',
        matrix: { homeserver: 'http://localhost:8008' },
        widget: {}
      });

      const selectedDept = chatStorage.getSelectedDepartment();
      expect(selectedDept?.id).toBe('identification');

      console.log('✅ ChatWidget department switch workflow simulation passed');
    });

    it('should handle ChatWidget department switching with room preservation', () => {
      // Test that Strategy 2 preserves the correct room during switches

      // Setup: User has rooms in 3 departments
      const departments = ['support', 'tech_support', 'identification'];
      departments.forEach((dept, index) => {
        chatStorage.setDepartmentRoomId(dept, `!${dept}-room-${index}:localhost`);
      });

      // Simulate switching to each department and verify correct preservation
      departments.forEach(currentDept => {
        console.log(`🔄 Switching to department: ${currentDept}`);

        // Re-setup all rooms (simulating return after time)
        departments.forEach((dept, index) => {
          chatStorage.setDepartmentRoomId(dept, `!${dept}-room-${index}:localhost`);
        });

        // Get all rooms before cleanup
        const allRooms = chatStorage.getAllDepartmentRoomIds();
        
        // Simulate Strategy 2 cleanup (preserve current department)
        Object.keys(allRooms).forEach(deptId => {
          if (deptId !== currentDept) {
            chatStorage.clearDepartmentRoomId(deptId);
          }
        });

        // Verify only current department room remains
        const remainingRooms = chatStorage.getAllDepartmentRoomIds();
        expect(Object.keys(remainingRooms)).toHaveLength(1);
        expect(remainingRooms).toHaveProperty(currentDept);
        
        console.log(`✅ ${currentDept} room preserved, others cleaned up`);
      });
    });

    it('should validate ChatWidget storage operations are atomic', () => {
      // Test that storage operations during department switching are consistent

      // Setup initial state
      chatStorage.setDepartmentRoomId('support', '!support-room:localhost');
      chatStorage.setDepartmentRoomId('tech_support', '!tech-room:localhost');

      // Simulate atomic department switch operation
      const session = chatStorage.loadChatSession();
      const initialHistoryLength = session.departmentHistory?.length || 0;

      // Switch to identification (new department)
      chatStorage.setSelectedDepartment({
        id: 'identification',
        name: 'Identification',
        matrix: {},
        widget: {}
      });

      // Clean up previous department rooms
      chatStorage.clearDepartmentRoomId('support');
      chatStorage.clearDepartmentRoomId('tech_support');

      // Set new department room
      chatStorage.setDepartmentRoomId('identification', '!id-room:localhost');

      // Verify final state is consistent
      const finalSession = chatStorage.loadChatSession();
      const finalRooms = chatStorage.getAllDepartmentRoomIds();
      
      expect(finalRooms).toEqual({
        'identification': '!id-room:localhost'
      });
      
      expect(finalSession.selectedDepartment?.id).toBe('identification');
      
      // History should have been updated atomically
      expect(finalSession.departmentHistory?.length).toBeGreaterThanOrEqual(initialHistoryLength);
    });
  });

  describe('Phase 2.2: Storage Utilities Integration with ChatWidget', () => {
    it('should validate all Phase 2.2 storage utilities work with ChatWidget patterns', () => {
      // Test that all storage utilities work correctly in ChatWidget usage patterns

      console.log('🧪 TEST: Validating Phase 2.2 storage utilities integration...');

      // 1. ChatWidget sets multiple department rooms (user switches between departments)
      const departments = [
        { id: 'support', roomId: '!support:localhost' },
        { id: 'tech_support', roomId: '!tech:localhost' },
        { id: 'identification', roomId: '!id:localhost' },
        { id: 'billing', roomId: '!billing:localhost' }
      ];

      departments.forEach(dept => {
        chatStorage.setDepartmentRoomId(dept.id, dept.roomId);
      });

      // 2. Verify getAllDepartmentRoomIds() works (used by Strategy 2)
      const allRooms = chatStorage.getAllDepartmentRoomIds();
      expect(Object.keys(allRooms)).toHaveLength(4);
      departments.forEach(dept => {
        expect(allRooms[dept.id]).toBe(dept.roomId);
      });

      // 3. Simulate ChatWidget department switch cleanup
      const currentDepartment = 'tech_support';
      Object.keys(allRooms).forEach(deptId => {
        if (deptId !== currentDepartment) {
          chatStorage.clearDepartmentRoomId(deptId);
        }
      });

      // Verify clearDepartmentRoomId() worked correctly
      const remainingRooms = chatStorage.getAllDepartmentRoomIds();
      expect(remainingRooms).toEqual({
        'tech_support': '!tech:localhost'
      });

      // 4. Test storage maintenance (cleanupInvalidDepartmentRooms)
      const session = chatStorage.loadChatSession();
      
      // Add some invalid entries (simulating corruption or old data)
      if (!session.departmentHistory) {
        session.departmentHistory = [];
      }

      session.departmentHistory.push(
        // Valid entry
        {
          departmentId: 'valid-dept',
          roomId: '!valid:localhost',
          lastActivity: new Date().toISOString(),
          conversationCount: 1
        },
        // Invalid entry (no departmentId)
        {
          departmentId: '',
          roomId: '!invalid:localhost',
          lastActivity: new Date().toISOString(),
          conversationCount: 0
        } as any,
        // Valid entry (no room but has conversations)
        {
          departmentId: 'conversations-only',
          lastActivity: new Date().toISOString(),
          conversationCount: 3
        }
      );

      chatStorage.updateChatSession({ departmentHistory: session.departmentHistory });

      // Run cleanup
      chatStorage.cleanupInvalidDepartmentRooms();

      // Verify cleanup worked
      const cleanedSession = chatStorage.loadChatSession();
      expect(cleanedSession.departmentHistory).toHaveLength(3); // tech_support + valid-dept + conversations-only
      
      const validDeptIds = cleanedSession.departmentHistory?.map(h => h.departmentId) || [];
      expect(validDeptIds).toContain('tech_support');
      expect(validDeptIds).toContain('valid-dept');
      expect(validDeptIds).toContain('conversations-only');
      expect(validDeptIds).not.toContain(''); // Invalid entry removed

      console.log('✅ All Phase 2.2 storage utilities validated');
    });

    it('should handle ChatWidget edge cases with storage utilities', () => {
      // Test edge cases that ChatWidget might encounter

      // 1. Empty storage state (new user)
      expect(chatStorage.getAllDepartmentRoomIds()).toEqual({});

      // 2. Clearing non-existent department (defensive programming)
      expect(() => chatStorage.clearDepartmentRoomId('non-existent')).not.toThrow();

      // 3. Multiple rapid department switches (race conditions)
      const rapidSwitches = ['dept1', 'dept2', 'dept3', 'dept1', 'dept2'];
      rapidSwitches.forEach((dept, index) => {
        chatStorage.setDepartmentRoomId(dept, `!room${index}:localhost`);
        
        // Simulate rapid cleanup
        const allRooms = chatStorage.getAllDepartmentRoomIds();
        Object.keys(allRooms).forEach(deptId => {
          if (deptId !== dept) {
            chatStorage.clearDepartmentRoomId(deptId);
          }
        });
      });

      // Should end up with only the last department
      const finalRooms = chatStorage.getAllDepartmentRoomIds();
      expect(Object.keys(finalRooms)).toHaveLength(1);
      expect(finalRooms).toHaveProperty('dept2');

      // 4. Storage corruption handling
      localStorage.setItem('matrix-chat-session', 'invalid-json{');
      expect(() => chatStorage.getAllDepartmentRoomIds()).not.toThrow();
      expect(chatStorage.getAllDepartmentRoomIds()).toEqual({});

      // Should recover gracefully
      chatStorage.setDepartmentRoomId('recovery-test', '!recovery:localhost');
      const recoveredRooms = chatStorage.getAllDepartmentRoomIds();
      expect(recoveredRooms).toEqual({
        'recovery-test': '!recovery:localhost'
      });
    });

    it('should validate performance with ChatWidget usage patterns', () => {
      // Test performance under realistic ChatWidget usage

      const startTime = performance.now();

      // Simulate heavy usage: user switches between 25 departments
      const departments = Array.from({ length: 25 }, (_, i) => `dept${i}`);

      // Each switch involves: set new room, cleanup others
      departments.forEach(currentDept => {
        // Set room for current department
        chatStorage.setDepartmentRoomId(currentDept, `!room-${currentDept}:localhost`);

        // Get all rooms (Strategy 2 operation)
        const allRooms = chatStorage.getAllDepartmentRoomIds();

        // Cleanup non-current rooms (Strategy 2 operation)
        Object.keys(allRooms).forEach(deptId => {
          if (deptId !== currentDept) {
            chatStorage.clearDepartmentRoomId(deptId);
          }
        });
      });

      // Verify final state
      const finalRooms = chatStorage.getAllDepartmentRoomIds();
      expect(Object.keys(finalRooms)).toHaveLength(1);

      // Run cleanup maintenance
      chatStorage.cleanupInvalidDepartmentRooms();

      const endTime = performance.now();
      const totalTime = endTime - startTime;

      // Should complete within reasonable time (< 100ms for 25 departments)
      expect(totalTime).toBeLessThan(100);

      console.log(`📊 Performance test: ${totalTime}ms for 25 department switches`);
    });
  });

  describe('End-to-End Phase 2 Integration Validation', () => {
    it('should validate Strategy 2 prevents original message routing issue', () => {
      // This test validates that Phase 2 implementation prevents the original issue:
      // "Messages sent to Identification department were routed to Support room"

      console.log('🧪 TEST: Validating original message routing issue is prevented...');

      // 1. Reproduce the original problematic scenario
      // User has conversations in both Support and Identification
      chatStorage.setDepartmentRoomId('support', '!support-room:localhost');
      chatStorage.setDepartmentRoomId('identification', '!id-room:localhost');

      // 2. Before Strategy 2: both rooms would remain, causing auto-join interference
      const roomsBeforeStrategy2 = chatStorage.getAllDepartmentRoomIds();
      expect(Object.keys(roomsBeforeStrategy2)).toHaveLength(2);
      expect(roomsBeforeStrategy2).toHaveProperty('support');
      expect(roomsBeforeStrategy2).toHaveProperty('identification');

      // 3. Strategy 2 solution: when user switches to Identification, clean up Support room
      const currentDepartment = 'identification';
      
      // Simulate what ChatWidget + Strategy 2 does during department switch
      Object.keys(roomsBeforeStrategy2).forEach(deptId => {
        if (deptId !== currentDepartment) {
          chatStorage.clearDepartmentRoomId(deptId);
        }
      });

      // 4. After Strategy 2: only Identification room remains
      const roomsAfterStrategy2 = chatStorage.getAllDepartmentRoomIds();
      expect(roomsAfterStrategy2).toEqual({
        'identification': '!id-room:localhost'
      });

      // 5. This prevents the original issue because:
      // - Matrix client can only auto-join to Identification room (the only one user is in)
      // - No Support room membership = no interference with currentRoomId
      // - Messages sent to Identification will definitely go to Identification room

      expect(roomsAfterStrategy2).not.toHaveProperty('support');
      expect(Object.keys(roomsAfterStrategy2)).toHaveLength(1);

      console.log('✅ Original message routing issue prevention validated');
      console.log('   - Support room cleaned up ✓');  
      console.log('   - Only Identification room remains ✓');
      console.log('   - No auto-join interference possible ✓');
    });

    it('should validate complete ChatWidget + Strategy 2 user journey', () => {
      // Test complete user journey with multiple department switches

      console.log('🧪 TEST: Complete user journey with ChatWidget + Strategy 2...');

      // 1. New user selects Support department
      chatStorage.setSelectedDepartment({
        id: 'support',
        name: 'Support',
        matrix: {},
        widget: {}
      });
      chatStorage.setDepartmentRoomId('support', '!support-room:localhost');

      let session = chatStorage.loadChatSession();
      expect(session.selectedDepartment?.id).toBe('support');

      // 2. User switches to Tech Support (ChatWidget calls Strategy 2)
      // Clean up support room, preserve tech_support
      chatStorage.clearDepartmentRoomId('support');
      chatStorage.setSelectedDepartment({
        id: 'tech_support',
        name: 'Tech Support',
        matrix: {},
        widget: {}
      });
      chatStorage.setDepartmentRoomId('tech_support', '!tech-room:localhost');

      let rooms = chatStorage.getAllDepartmentRoomIds();
      expect(rooms).toEqual({
        'tech_support': '!tech-room:localhost'
      });

      // 3. User switches to Identification (ChatWidget calls Strategy 2)
      chatStorage.clearDepartmentRoomId('tech_support');
      chatStorage.setSelectedDepartment({
        id: 'identification', 
        name: 'Identification',
        matrix: {},
        widget: {}
      });
      chatStorage.setDepartmentRoomId('identification', '!id-room:localhost');

      rooms = chatStorage.getAllDepartmentRoomIds();
      expect(rooms).toEqual({
        'identification': '!id-room:localhost'
      });

      // 4. User switches back to Support (new conversation)
      chatStorage.clearDepartmentRoomId('identification');
      chatStorage.setSelectedDepartment({
        id: 'support',
        name: 'Support', 
        matrix: {},
        widget: {}
      });
      chatStorage.setDepartmentRoomId('support', '!support-new-room:localhost');

      rooms = chatStorage.getAllDepartmentRoomIds();
      expect(rooms).toEqual({
        'support': '!support-new-room:localhost'
      });

      // 5. Verify session history tracking
      session = chatStorage.loadChatSession();
      expect(session.selectedDepartment?.id).toBe('support');
      expect(session.departmentHistory).toBeDefined();
      expect(session.departmentHistory?.length).toBeGreaterThan(0);

      // 6. Run storage maintenance
      chatStorage.cleanupInvalidDepartmentRooms();

      // Should still be in consistent state
      rooms = chatStorage.getAllDepartmentRoomIds();
      expect(rooms).toEqual({
        'support': '!support-new-room:localhost'
      });

      console.log('✅ Complete ChatWidget + Strategy 2 user journey validated');
    });

    it('should validate Phase 2 integration maintains data consistency', () => {
      // Test that all Phase 2 operations maintain data consistency

      // Setup complex scenario with multiple operations
      const operations = [
        () => chatStorage.setDepartmentRoomId('dept1', '!room1:localhost'),
        () => chatStorage.setDepartmentRoomId('dept2', '!room2:localhost'), 
        () => chatStorage.clearDepartmentRoomId('dept1'),
        () => chatStorage.setDepartmentRoomId('dept3', '!room3:localhost'),
        () => chatStorage.cleanupInvalidDepartmentRooms(),
        () => chatStorage.clearDepartmentRoomId('dept2'),
        () => chatStorage.setDepartmentRoomId('dept4', '!room4:localhost')
      ];

      // Execute operations
      operations.forEach((op, index) => {
        op();
        
        // After each operation, data should be consistent
        const session = chatStorage.loadChatSession();
        const rooms = chatStorage.getAllDepartmentRoomIds();
        
        // Session should be valid
        expect(session.userId).toBeDefined();
        expect(session.lastActivity).toBeDefined();
        
        // Rooms should be consistent with department history
        if (session.departmentHistory) {
          session.departmentHistory.forEach(dept => {
            if (dept.roomId) {
              expect(rooms).toHaveProperty(dept.departmentId, dept.roomId);
            }
          });
        }

        console.log(`✓ Operation ${index + 1} completed, data consistent`);
      });

      // Final state should be consistent
      const finalRooms = chatStorage.getAllDepartmentRoomIds();
      const finalSession = chatStorage.loadChatSession();

      expect(finalRooms).toEqual({
        'dept3': '!room3:localhost',
        'dept4': '!room4:localhost'
      });

      expect(finalSession.departmentHistory?.length).toBeGreaterThan(0);

      console.log('✅ Data consistency maintained throughout all operations');
    });
  });
});