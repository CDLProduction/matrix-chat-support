import { describe, it, expect, beforeEach } from 'vitest';
import * as chatStorage from '../chat-storage';
import { roomLogger } from '../room-operation-logger';

describe('Phase 5.2 Performance Validation (Lightweight)', () => {
  beforeEach(() => {
    localStorage.clear();
    roomLogger.clearLogs();
  });

  describe('Core Strategy 2 Performance', () => {
    it('should perform department cleanup efficiently at moderate scale', () => {
      console.log('🧪 PERFORMANCE: Strategy 2 cleanup efficiency');

      const departmentCount = 50;
      const testIterations = 20;
      
      // Setup departments
      for (let i = 0; i < departmentCount; i++) {
        chatStorage.setDepartmentRoomId(`dept_${i}`, `!room-${i}:localhost`);
      }
      
      const cleanupTimes: number[] = [];
      
      // Test Strategy 2 cleanup performance
      for (let i = 0; i < testIterations; i++) {
        const targetDept = `dept_${i % departmentCount}`;
        
        const start = performance.now();
        
        // Strategy 2 cleanup
        const allRooms = chatStorage.getAllDepartmentRoomIds();
        Object.entries(allRooms).forEach(([dept, roomId]) => {
          if (dept !== targetDept) {
            chatStorage.clearDepartmentRoomId(dept);
          }
        });
        
        const end = performance.now();
        cleanupTimes.push(end - start);
        
        // Verify cleanup
        const remaining = chatStorage.getAllDepartmentRoomIds();
        expect(Object.keys(remaining)).toHaveLength(1);
        expect(remaining).toHaveProperty(targetDept);
        
        // Restore departments for next iteration
        for (let j = 0; j < departmentCount; j++) {
          if (j !== (i % departmentCount)) {
            chatStorage.setDepartmentRoomId(`dept_${j}`, `!room-${j}-${i}:localhost`);
          }
        }
      }
      
      const avgTime = cleanupTimes.reduce((sum, t) => sum + t, 0) / cleanupTimes.length;
      const maxTime = Math.max(...cleanupTimes);
      
      console.log(`📊 Cleanup Performance: avg=${avgTime.toFixed(2)}ms, max=${maxTime.toFixed(2)}ms`);
      
      // Performance assertions
      expect(avgTime).toBeLessThan(20); // Should average < 20ms
      expect(maxTime).toBeLessThan(100); // Max should be < 100ms
      
      console.log('✅ Strategy 2 cleanup performance validated');
    });

    it('should maintain consistent performance under moderate load', () => {
      console.log('🧪 PERFORMANCE: Consistent performance under load');

      const operationCount = 200;
      const operationTimes: number[] = [];
      
      for (let i = 0; i < operationCount; i++) {
        const start = performance.now();
        
        // Mix of operations
        const opType = i % 4;
        const deptId = `load_dept_${i % 10}`;
        
        switch (opType) {
          case 0:
            chatStorage.setDepartmentRoomId(deptId, `!room-${i}:localhost`);
            break;
          case 1:
            chatStorage.getAllDepartmentRoomIds();
            break;
          case 2:
            chatStorage.getDepartmentRoomId(deptId);
            break;
          case 3:
            chatStorage.clearDepartmentRoomId(deptId);
            break;
        }
        
        const time = performance.now() - start;
        operationTimes.push(time);
      }
      
      const avgTime = operationTimes.reduce((sum, t) => sum + t, 0) / operationTimes.length;
      const maxTime = Math.max(...operationTimes);
      const opsPerSecond = operationCount / (operationTimes.reduce((sum, t) => sum + t, 0) / 1000);
      
      console.log(`📊 Load Performance: ${operationCount} ops, avg=${avgTime.toFixed(3)}ms, ${opsPerSecond.toFixed(0)} ops/sec`);
      
      expect(avgTime).toBeLessThan(5); // Average < 5ms per operation
      expect(opsPerSecond).toBeGreaterThan(100); // > 100 operations per second
      
      console.log('✅ Consistent performance under load validated');
    });
  });

  describe('Memory and Resource Management', () => {
    it('should manage localStorage efficiently', () => {
      console.log('🧪 RESOURCE: localStorage management');

      const initialSize = JSON.stringify(localStorage).length;
      
      // Add many departments
      const deptCount = 100;
      for (let i = 0; i < deptCount; i++) {
        chatStorage.setDepartmentRoomId(`mem_dept_${i}`, `!room-${i}:example.com`);
      }
      
      const maxSize = JSON.stringify(localStorage).length;
      
      // Strategy 2 cleanup
      const preserveDept = 'mem_dept_25';
      const allRooms = chatStorage.getAllDepartmentRoomIds();
      Object.entries(allRooms).forEach(([dept, roomId]) => {
        if (dept !== preserveDept) {
          chatStorage.clearDepartmentRoomId(dept);
        }
      });
      
      const finalSize = JSON.stringify(localStorage).length;
      const reduction = ((maxSize - finalSize) / maxSize) * 100;
      
      console.log(`📊 Storage: initial=${initialSize}, peak=${maxSize}, final=${finalSize} (${reduction.toFixed(1)}% reduction)`);
      
      expect(finalSize).toBeLessThan(maxSize);
      expect(reduction).toBeGreaterThan(80); // Should reduce by >80%
      
      console.log('✅ localStorage management efficient');
    });

    it('should control memory usage with logging', () => {
      console.log('🧪 RESOURCE: Logging memory control');

      // Generate logs beyond the limit
      for (let i = 0; i < 150; i++) {
        roomLogger.log('info', `Test log ${i}`, {
          operation: 'disconnect',
          departmentId: `dept${i % 5}`,
          metadata: { iteration: i }
        });
      }
      
      const logs = roomLogger.searchLogs({});
      const summary = roomLogger.getOperationSummary();
      
      console.log(`📊 Logging: ${logs.length} logs maintained, ${Object.keys(summary).length} operation types`);
      
      expect(logs.length).toBeLessThanOrEqual(100); // Should limit to 100
      expect(logs[logs.length - 1].context.metadata?.iteration).toBe(149); // Latest should be kept
      
      console.log('✅ Logging memory control working');
    });
  });

  describe('Scalability Assessment', () => {
    it('should handle realistic department counts', () => {
      console.log('🧪 SCALABILITY: Realistic department handling');

      // Realistic enterprise scenario: 20 departments, 50 switches
      const departments = 20;
      const switches = 50;
      
      // Setup
      for (let i = 0; i < departments; i++) {
        chatStorage.setDepartmentRoomId(`real_dept_${i}`, `!room-${i}:company.com`);
      }
      
      const switchTimes: number[] = [];
      
      for (let i = 0; i < switches; i++) {
        const start = performance.now();
        
        const targetDept = `real_dept_${i % departments}`;
        const allRooms = chatStorage.getAllDepartmentRoomIds();
        
        // Strategy 2 cleanup
        Object.entries(allRooms).forEach(([dept, roomId]) => {
          if (dept !== targetDept) {
            chatStorage.clearDepartmentRoomId(dept);
          }
        });
        
        const time = performance.now() - start;
        switchTimes.push(time);
        
        // Verify
        const remaining = chatStorage.getAllDepartmentRoomIds();
        expect(Object.keys(remaining)).toHaveLength(1);
        
        // Restore subset for next iteration
        const restoreCount = Math.min(5, departments);
        for (let j = 1; j <= restoreCount; j++) {
          const restoreIndex = (i + j) % departments;
          chatStorage.setDepartmentRoomId(`real_dept_${restoreIndex}`, `!room-${restoreIndex}-${i}:company.com`);
        }
      }
      
      const avgTime = switchTimes.reduce((sum, t) => sum + t, 0) / switchTimes.length;
      const switchesPerSecond = switches / (switchTimes.reduce((sum, t) => sum + t, 0) / 1000);
      
      console.log(`📊 Scalability: ${switches} switches across ${departments} depts, avg=${avgTime.toFixed(2)}ms, ${switchesPerSecond.toFixed(1)} switches/sec`);
      
      expect(avgTime).toBeLessThan(15); // Realistic departments should be fast
      expect(switchesPerSecond).toBeGreaterThan(20); // Should handle reasonable user activity
      
      console.log('✅ Realistic scalability validated');
    });

    it('should simulate real user behavior', () => {
      console.log('🧪 REAL-WORLD: User behavior simulation');

      // Simulate 3 different user patterns
      const patterns = [
        { name: 'frequent', departments: ['support', 'tech_support'], switches: 10 },
        { name: 'moderate', departments: ['identification', 'billing'], switches: 5 },
        { name: 'mixed', departments: ['support', 'tech_support', 'identification'], switches: 8 }
      ];
      
      const results: Array<{pattern: string, avgTime: number, switches: number}> = [];
      
      patterns.forEach(pattern => {
        console.log(`📊 Testing ${pattern.name} pattern...`);
        
        // Setup departments
        pattern.departments.forEach(dept => {
          chatStorage.setDepartmentRoomId(dept, `!${dept}-${pattern.name}:localhost`);
        });
        
        const times: number[] = [];
        
        for (let i = 0; i < pattern.switches; i++) {
          const start = performance.now();
          
          const targetDept = pattern.departments[i % pattern.departments.length];
          const allRooms = chatStorage.getAllDepartmentRoomIds();
          
          Object.entries(allRooms).forEach(([dept, roomId]) => {
            if (dept !== targetDept) {
              chatStorage.clearDepartmentRoomId(dept);
            }
          });
          
          const time = performance.now() - start;
          times.push(time);
          
          // Restore for next switch
          pattern.departments.forEach(dept => {
            if (dept !== targetDept) {
              chatStorage.setDepartmentRoomId(dept, `!${dept}-${pattern.name}-${i}:localhost`);
            }
          });
        }
        
        const avgTime = times.reduce((sum, t) => sum + t, 0) / times.length;
        results.push({ pattern: pattern.name, avgTime, switches: pattern.switches });
        
        console.log(`   ✓ ${pattern.name}: ${avgTime.toFixed(2)}ms average`);
      });
      
      // Verify all patterns perform well
      results.forEach(result => {
        expect(result.avgTime).toBeLessThan(20); // All patterns should be efficient
      });
      
      const overallAvg = results.reduce((sum, r) => sum + r.avgTime, 0) / results.length;
      console.log(`📊 Overall average: ${overallAvg.toFixed(2)}ms`);
      
      console.log('✅ Real user behavior patterns validated');
    });
  });

  describe('Strategy 2 vs Legacy Performance Comparison', () => {
    it('should demonstrate Strategy 2 efficiency benefits', () => {
      console.log('🧪 COMPARISON: Strategy 2 vs Legacy efficiency');

      const departmentCount = 30;
      const testSwitches = 20;
      
      // Setup departments
      for (let i = 0; i < departmentCount; i++) {
        chatStorage.setDepartmentRoomId(`comp_dept_${i}`, `!room-${i}:localhost`);
      }
      
      // Test Strategy 2 approach (with cleanup)
      console.log('📊 Testing Strategy 2 approach...');
      const strategy2Times: number[] = [];
      
      for (let i = 0; i < testSwitches; i++) {
        const start = performance.now();
        
        // Strategy 2: cleanup non-current departments
        const targetDept = `comp_dept_${i % departmentCount}`;
        const allRooms = chatStorage.getAllDepartmentRoomIds();
        
        Object.entries(allRooms).forEach(([dept, roomId]) => {
          if (dept !== targetDept) {
            chatStorage.clearDepartmentRoomId(dept);
          }
        });
        
        const time = performance.now() - start;
        strategy2Times.push(time);
        
        // Measure storage size after cleanup
        const postCleanupSize = JSON.stringify(localStorage).length;
        
        // Restore for next test
        for (let j = 0; j < departmentCount; j++) {
          if (j !== (i % departmentCount)) {
            chatStorage.setDepartmentRoomId(`comp_dept_${j}`, `!room-${j}-s2:localhost`);
          }
        }
      }
      
      // Test Legacy approach (no cleanup)
      console.log('📊 Testing Legacy approach...');
      const legacyTimes: number[] = [];
      
      for (let i = 0; i < testSwitches; i++) {
        const start = performance.now();
        
        // Legacy: just get all departments (no cleanup)
        const allRooms = chatStorage.getAllDepartmentRoomIds();
        // In legacy mode, all departments would remain
        
        const time = performance.now() - start;
        legacyTimes.push(time);
        
        // Add more departments to simulate accumulation
        const newDept = `legacy_accumulate_${i}`;
        chatStorage.setDepartmentRoomId(newDept, `!legacy-room-${i}:localhost`);
      }
      
      const strategy2Avg = strategy2Times.reduce((sum, t) => sum + t, 0) / strategy2Times.length;
      const legacyAvg = legacyTimes.reduce((sum, t) => sum + t, 0) / legacyTimes.length;
      
      const strategy2Storage = JSON.stringify(localStorage).length;
      
      // Reset and measure legacy storage size
      localStorage.clear();
      for (let i = 0; i < departmentCount + testSwitches; i++) {
        chatStorage.setDepartmentRoomId(`legacy_dept_${i}`, `!room-${i}:localhost`);
      }
      const legacyStorage = JSON.stringify(localStorage).length;
      
      console.log(`📊 Performance Comparison:`);
      console.log(`   Strategy 2: ${strategy2Avg.toFixed(3)}ms avg, ${strategy2Storage} storage bytes`);
      console.log(`   Legacy: ${legacyAvg.toFixed(3)}ms avg, ${legacyStorage} storage bytes`);
      console.log(`   Storage savings: ${((legacyStorage - strategy2Storage) / legacyStorage * 100).toFixed(1)}%`);
      
      // Strategy 2 should be more storage efficient
      expect(strategy2Storage).toBeLessThan(legacyStorage);
      
      console.log('✅ Strategy 2 efficiency benefits demonstrated');
    });
  });
});