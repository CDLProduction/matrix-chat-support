import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  getAllDepartmentRoomIds,
  clearDepartmentRoomId,
  cleanupInvalidDepartmentRooms,
  loadChatSession,
  updateChatSession,
  setDepartmentRoomId,
  type ChatSession,
  type DepartmentHistory
} from '../chat-storage';

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => { store[key] = value; }),
    removeItem: vi.fn((key: string) => { delete store[key]; }),
    clear: vi.fn(() => { store = {}; })
  };
})();

Object.defineProperty(window, 'localStorage', { value: localStorageMock });

// Mock document.cookie
Object.defineProperty(document, 'cookie', {
  writable: true,
  value: ''
});

describe('Chat Storage - Strategy 2 Room Cleanup Functions', () => {
  beforeEach(() => {
    localStorageMock.clear();
    document.cookie = '';
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('getAllDepartmentRoomIds', () => {
    it('should return empty object when no department history exists', () => {
      const roomIds = getAllDepartmentRoomIds();
      expect(roomIds).toEqual({});
    });

    it('should return all department room IDs from storage', () => {
      const mockSession: ChatSession = {
        userId: 'test-user',
        lastActivity: new Date().toISOString(),
        conversationCount: 0,
        isReturningUser: false,
        departmentHistory: [
          {
            departmentId: 'support',
            roomId: '!room1:localhost',
            lastActivity: new Date().toISOString(),
            conversationCount: 1
          },
          {
            departmentId: 'tech_support',
            roomId: '!room2:localhost',
            lastActivity: new Date().toISOString(),
            conversationCount: 2
          },
          {
            departmentId: 'identification',
            lastActivity: new Date().toISOString(),
            conversationCount: 0
          }
        ]
      };

      localStorageMock.setItem('matrix-chat-session', JSON.stringify(mockSession));

      const roomIds = getAllDepartmentRoomIds();
      
      expect(roomIds).toEqual({
        'support': '!room1:localhost',
        'tech_support': '!room2:localhost'
      });
      expect(roomIds).not.toHaveProperty('identification');
    });

    it('should handle session without departmentHistory gracefully', () => {
      const mockSession: ChatSession = {
        userId: 'test-user',
        lastActivity: new Date().toISOString(),
        conversationCount: 0,
        isReturningUser: false
      };

      localStorageMock.setItem('matrix-chat-session', JSON.stringify(mockSession));

      const roomIds = getAllDepartmentRoomIds();
      expect(roomIds).toEqual({});
    });
  });

  describe('clearDepartmentRoomId', () => {
    it('should clear room ID for specific department', () => {
      const mockSession: ChatSession = {
        userId: 'test-user',
        lastActivity: new Date().toISOString(),
        conversationCount: 0,
        isReturningUser: false,
        departmentHistory: [
          {
            departmentId: 'support',
            roomId: '!room1:localhost',
            lastActivity: new Date().toISOString(),
            conversationCount: 1
          },
          {
            departmentId: 'tech_support',
            roomId: '!room2:localhost',
            lastActivity: new Date().toISOString(),
            conversationCount: 2
          }
        ]
      };

      localStorageMock.setItem('matrix-chat-session', JSON.stringify(mockSession));

      clearDepartmentRoomId('support');

      const updatedSession = loadChatSession();
      const supportDept = updatedSession.departmentHistory?.find(d => d.departmentId === 'support');
      const techDept = updatedSession.departmentHistory?.find(d => d.departmentId === 'tech_support');

      expect(supportDept?.roomId).toBeUndefined();
      expect(techDept?.roomId).toBe('!room2:localhost');
    });

    it('should clear main roomId when clearing currently selected department', () => {
      const mockSession: ChatSession = {
        userId: 'test-user',
        lastActivity: new Date().toISOString(),
        conversationCount: 0,
        isReturningUser: false,
        roomId: '!room1:localhost',
        selectedDepartment: {
          id: 'support',
          name: 'Support',
          matrix: {},
          widget: {}
        },
        departmentHistory: [
          {
            departmentId: 'support',
            roomId: '!room1:localhost',
            lastActivity: new Date().toISOString(),
            conversationCount: 1
          }
        ]
      };

      localStorageMock.setItem('matrix-chat-session', JSON.stringify(mockSession));

      clearDepartmentRoomId('support');

      const updatedSession = loadChatSession();
      expect(updatedSession.roomId).toBeUndefined();
    });

    it('should handle non-existent department gracefully', () => {
      const mockSession: ChatSession = {
        userId: 'test-user',
        lastActivity: new Date().toISOString(),
        conversationCount: 0,
        isReturningUser: false,
        departmentHistory: [
          {
            departmentId: 'support',
            roomId: '!room1:localhost',
            lastActivity: new Date().toISOString(),
            conversationCount: 1
          }
        ]
      };

      localStorageMock.setItem('matrix-chat-session', JSON.stringify(mockSession));

      expect(() => clearDepartmentRoomId('non-existent')).not.toThrow();
      
      const session = loadChatSession();
      expect(session.departmentHistory?.[0].roomId).toBe('!room1:localhost');
    });
  });

  describe('cleanupInvalidDepartmentRooms', () => {
    it('should remove entries with no departmentId', () => {
      const mockSession: ChatSession = {
        userId: 'test-user',
        lastActivity: new Date().toISOString(),
        conversationCount: 0,
        isReturningUser: false,
        departmentHistory: [
          {
            departmentId: 'support',
            roomId: '!room1:localhost',
            lastActivity: new Date().toISOString(),
            conversationCount: 1
          },
          {
            departmentId: '',
            roomId: '!invalid:localhost',
            lastActivity: new Date().toISOString(),
            conversationCount: 0
          } as any,
          {
            departmentId: 'tech_support',
            lastActivity: new Date().toISOString(),
            conversationCount: 1
          }
        ]
      };

      localStorageMock.setItem('matrix-chat-session', JSON.stringify(mockSession));

      cleanupInvalidDepartmentRooms();

      const updatedSession = loadChatSession();
      expect(updatedSession.departmentHistory).toHaveLength(2);
      expect(updatedSession.departmentHistory?.map(d => d.departmentId)).toEqual(['support', 'tech_support']);
    });

    it('should preserve entries with valid departmentId and either roomId or conversationCount > 0', () => {
      const mockSession: ChatSession = {
        userId: 'test-user',
        lastActivity: new Date().toISOString(),
        conversationCount: 0,
        isReturningUser: false,
        departmentHistory: [
          {
            departmentId: 'support',
            roomId: '!room1:localhost',
            lastActivity: new Date().toISOString(),
            conversationCount: 0
          },
          {
            departmentId: 'tech_support',
            lastActivity: new Date().toISOString(),
            conversationCount: 2
          },
          {
            departmentId: 'invalid',
            lastActivity: new Date().toISOString(),
            conversationCount: 0
          }
        ]
      };

      localStorageMock.setItem('matrix-chat-session', JSON.stringify(mockSession));

      cleanupInvalidDepartmentRooms();

      const updatedSession = loadChatSession();
      expect(updatedSession.departmentHistory).toHaveLength(2);
      expect(updatedSession.departmentHistory?.map(d => d.departmentId)).toEqual(['support', 'tech_support']);
    });

    it('should handle empty departmentHistory gracefully', () => {
      const mockSession: ChatSession = {
        userId: 'test-user',
        lastActivity: new Date().toISOString(),
        conversationCount: 0,
        isReturningUser: false
      };

      localStorageMock.setItem('matrix-chat-session', JSON.stringify(mockSession));

      expect(() => cleanupInvalidDepartmentRooms()).not.toThrow();
    });
  });

  describe('Integration with existing storage functions', () => {
    it('should work correctly with setDepartmentRoomId', () => {
      setDepartmentRoomId('support', '!new-room:localhost');
      
      const roomIds = getAllDepartmentRoomIds();
      expect(roomIds.support).toBe('!new-room:localhost');
      
      clearDepartmentRoomId('support');
      
      const clearedRoomIds = getAllDepartmentRoomIds();
      expect(clearedRoomIds).not.toHaveProperty('support');
    });

    it('should maintain data consistency during cleanup operations', () => {
      // Set up complex department history
      setDepartmentRoomId('support', '!room1:localhost');
      setDepartmentRoomId('tech_support', '!room2:localhost');
      setDepartmentRoomId('identification', '!room3:localhost');
      
      // Verify initial state
      let roomIds = getAllDepartmentRoomIds();
      expect(Object.keys(roomIds)).toHaveLength(3);
      
      // Clear one department
      clearDepartmentRoomId('tech_support');
      
      roomIds = getAllDepartmentRoomIds();
      expect(Object.keys(roomIds)).toHaveLength(2);
      expect(roomIds).toHaveProperty('support');
      expect(roomIds).toHaveProperty('identification');
      expect(roomIds).not.toHaveProperty('tech_support');
      
      // Cleanup should not affect valid entries
      cleanupInvalidDepartmentRooms();
      
      roomIds = getAllDepartmentRoomIds();
      expect(Object.keys(roomIds)).toHaveLength(2);
    });
  });
});