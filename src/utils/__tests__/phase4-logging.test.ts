import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RoomOperationLogger, roomLogger, logRoomOperation, logDepartmentSwitch, logValidation, createRoomSnapshot } from '../room-operation-logger';

describe('Phase 4.1 Room Operation Logging Tests', () => {
  beforeEach(() => {
    // Clear logs before each test
    roomLogger.clearLogs();
    vi.clearAllMocks();
  });

  describe('Structured Logging Core Functionality', () => {
    it('should log room operations with full context', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      
      const context = {
        operation: 'connect' as const,
        departmentId: 'support',
        roomId: '!test-room:localhost',
        userId: '@test:localhost',
        metadata: { isReconnection: true }
      };

      const snapshot = createRoomSnapshot(
        '!test-room:localhost',
        { support: '!test-room:localhost' },
        'support',
        false,
        true
      );

      logRoomOperation('info', 'Connection test', context, snapshot);

      // Verify structured logging
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('🏠 [CONNECT] Connection test')
      );

      // Verify log was stored
      const logs = roomLogger.searchLogs({ operation: 'connect' });
      expect(logs).toHaveLength(1);
      expect(logs[0]).toMatchObject({
        level: 'info',
        operation: 'connect',
        context: context,
        message: 'Connection test',
        snapshot: snapshot
      });

      consoleSpy.mockRestore();
      console.log('✅ Structured room operation logging - passed');
    });

    it('should log department switching operations', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      
      const snapshot = createRoomSnapshot(
        '!old-room:localhost',
        { 
          support: '!support-room:localhost',
          tech_support: '!tech-room:localhost'
        },
        'tech_support',
        false,
        true
      );

      logDepartmentSwitch('start', 'support', 'tech_support', snapshot, {
        userInitiated: true
      });

      // Verify department switch logging
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('🏠 [DEPARTMENT_SWITCH] Department switch initiated: support → tech_support')
      );

      const logs = roomLogger.searchLogs({ operation: 'department_switch' });
      expect(logs).toHaveLength(1);
      expect(logs[0].context.departmentId).toBe('tech_support');
      expect(logs[0].context.metadata).toMatchObject({
        action: 'start',
        fromDepartment: 'support',
        toDepartment: 'tech_support',
        userInitiated: true
      });

      consoleSpy.mockRestore();
      console.log('✅ Department switch logging - passed');
    });

    it('should log validation operations with results', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      
      // Test successful validation
      logValidation('validate', 'support', '!support-room:localhost', true, {
        validationReason: 'room_matches_department'
      });

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('🏠 [VALIDATION] Room validate: support → !support-room:localhost | Result: true')
      );

      // Test failed validation
      logValidation('failure', 'support', '!wrong-room:localhost', false, {
        issue: 'room_department_mismatch'
      });

      const logs = roomLogger.searchLogs({ operation: 'validation' });
      expect(logs).toHaveLength(2);
      
      expect(logs[0].level).toBe('info');
      expect(logs[1].level).toBe('error');

      consoleSpy.mockRestore();
      console.log('✅ Validation operation logging - passed');
    });
  });

  describe('Log Search and Analysis', () => {
    it('should support searching logs by multiple criteria', () => {
      // Add various logs
      logRoomOperation('info', 'Test 1', { operation: 'connect', departmentId: 'support' });
      logRoomOperation('error', 'Test 2', { operation: 'connect', departmentId: 'tech_support' });
      logRoomOperation('info', 'Test 3', { operation: 'disconnect', departmentId: 'support' });

      // Search by operation
      const connectLogs = roomLogger.searchLogs({ operation: 'connect' });
      expect(connectLogs).toHaveLength(2);

      // Search by department
      const supportLogs = roomLogger.searchLogs({ departmentId: 'support' });
      expect(supportLogs).toHaveLength(2);

      // Search by level
      const errorLogs = roomLogger.searchLogs({ level: 'error' });
      expect(errorLogs).toHaveLength(1);

      // Search by message content
      const test2Logs = roomLogger.searchLogs({ messageContains: 'Test 2' });
      expect(test2Logs).toHaveLength(1);

      console.log('✅ Log search functionality - passed');
    });

    it('should provide operation summary statistics', () => {
      // Add various operations
      logRoomOperation('info', 'Connect 1', { operation: 'connect' });
      logRoomOperation('info', 'Connect 2', { operation: 'connect' });
      logRoomOperation('error', 'Connect fail', { operation: 'connect' });
      logRoomOperation('info', 'Disconnect', { operation: 'disconnect' });

      const summary = roomLogger.getOperationSummary();
      
      expect(summary['connect_info']).toBe(2);
      expect(summary['connect_error']).toBe(1);
      expect(summary['disconnect_info']).toBe(1);

      console.log('✅ Operation summary statistics - passed');
    });

    it('should export logs for debugging', () => {
      logRoomOperation('info', 'Test log', { operation: 'connect', departmentId: 'support' });
      
      const exported = roomLogger.exportLogs(1);
      const parsedLogs = JSON.parse(exported);
      
      expect(parsedLogs).toHaveLength(1);
      expect(parsedLogs[0]).toMatchObject({
        level: 'info',
        message: 'Test log',
        operation: 'connect'
      });

      console.log('✅ Log export functionality - passed');
    });
  });

  describe('Room State Snapshot Functionality', () => {
    it('should create comprehensive room state snapshots', () => {
      const snapshot = createRoomSnapshot(
        '!current-room:localhost',
        {
          support: '!support-room:localhost',
          tech_support: '!tech-room:localhost',
          identification: '!id-room:localhost'
        },
        'support',
        true,
        true
      );

      expect(snapshot).toEqual({
        currentRoomId: '!current-room:localhost',
        departmentRooms: {
          support: '!support-room:localhost',
          tech_support: '!tech-room:localhost',
          identification: '!id-room:localhost'
        },
        totalRooms: 3,
        selectedDepartment: 'support',
        isReconnecting: true,
        clientConnected: true
      });

      console.log('✅ Room state snapshot creation - passed');
    });

    it('should handle empty room state gracefully', () => {
      const snapshot = createRoomSnapshot(null, {}, undefined, false, false);

      expect(snapshot).toEqual({
        currentRoomId: null,
        departmentRooms: {},
        totalRooms: 0,
        selectedDepartment: undefined,
        isReconnecting: false,
        clientConnected: false
      });

      console.log('✅ Empty room state handling - passed');
    });
  });

  describe('Strategy 2 Operation Logging', () => {
    it('should log complete Strategy 2 workflow', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      
      const initialSnapshot = createRoomSnapshot(
        '!support-room:localhost',
        {
          support: '!support-room:localhost',
          tech_support: '!tech-room:localhost'
        },
        'support',
        false,
        true
      );

      // Log department switch start
      logDepartmentSwitch('start', 'support', 'tech_support', initialSnapshot);
      
      // Log room cleanup
      logDepartmentSwitch('room_cleanup', 'support', 'tech_support', initialSnapshot, {
        roomsToCleanup: ['!support-room:localhost']
      });
      
      // Log completion
      const finalSnapshot = createRoomSnapshot(
        '!tech-room:localhost',
        { tech_support: '!tech-room:localhost' },
        'tech_support',
        false,
        true
      );
      logDepartmentSwitch('complete', 'support', 'tech_support', finalSnapshot);

      // Verify complete workflow logging
      const logs = roomLogger.searchLogs({ operation: 'department_switch' });
      expect(logs).toHaveLength(3);
      
      expect(logs[0].context.metadata.action).toBe('start');
      expect(logs[1].context.metadata.action).toBe('room_cleanup');
      expect(logs[2].context.metadata.action).toBe('complete');

      consoleSpy.mockRestore();
      console.log('✅ Strategy 2 workflow logging - passed');
    });

    it('should log Strategy 2 error scenarios', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      const snapshot = createRoomSnapshot(
        '!support-room:localhost',
        { support: '!support-room:localhost' },
        'support',
        false,
        true
      );

      logDepartmentSwitch('error', 'support', 'tech_support', snapshot, {
        error: 'Room leave failed',
        failedRoomId: '!support-room:localhost'
      });

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('🏠 [DEPARTMENT_SWITCH] Department switch failed')
      );

      const errorLogs = roomLogger.searchLogs({ level: 'info', operation: 'department_switch' });
      expect(errorLogs).toHaveLength(1);
      expect(errorLogs[0].context.metadata.error).toBe('Room leave failed');

      consoleSpy.mockRestore();
      console.log('✅ Strategy 2 error logging - passed');
    });
  });

  describe('Integration with Matrix Operations', () => {
    it('should log room validation within department context', () => {
      // Simulate validation during department switching
      logValidation('validate', 'support', '!support-room:localhost', true, {
        context: 'department_switch',
        expectedRoomId: '!support-room:localhost',
        actualRoomId: '!support-room:localhost'
      });

      logValidation('failure', 'tech_support', null, false, {
        context: 'department_switch',
        issue: 'no_room_for_department',
        requiresReinvitation: true
      });

      const validationLogs = roomLogger.searchLogs({ operation: 'validation' });
      expect(validationLogs).toHaveLength(2);
      
      expect(validationLogs[0].level).toBe('info');
      expect(validationLogs[1].level).toBe('error');
      expect(validationLogs[1].context.metadata.requiresReinvitation).toBe(true);

      console.log('✅ Validation logging within department context - passed');
    });

    it('should maintain log history across multiple operations', () => {
      // Simulate a complete user session with multiple operations
      
      // 1. Initial connection
      logRoomOperation('info', 'Initial connection', {
        operation: 'connect',
        departmentId: 'support',
        userId: '@user:localhost'
      });

      // 2. Department switch
      logDepartmentSwitch('start', 'support', 'tech_support', createRoomSnapshot(null, {}, 'tech_support'));
      
      // 3. Validation failure
      logValidation('failure', 'tech_support', null, false, { issue: 'no_room' });
      
      // 4. Recovery attempt
      logValidation('recover', 'tech_support', '!new-room:localhost', true, { recovered: true });
      
      // 5. Final connection
      logRoomOperation('info', 'Connection recovered', {
        operation: 'connect',
        departmentId: 'tech_support',
        roomId: '!new-room:localhost'
      });

      const allLogs = roomLogger.searchLogs({});
      expect(allLogs).toHaveLength(5);
      
      // Verify chronological order
      expect(allLogs[0].context.operation).toBe('connect');
      expect(allLogs[1].context.operation).toBe('department_switch');
      expect(allLogs[2].context.operation).toBe('validation');
      expect(allLogs[3].context.operation).toBe('validation');
      expect(allLogs[4].context.operation).toBe('connect');

      console.log('✅ Multi-operation session logging - passed');
    });
  });
});