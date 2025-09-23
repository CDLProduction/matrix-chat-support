# Strategy 2 Implementation Plan: Enhanced Room Cleanup

## 🎯 Objective
Implement enhanced room cleanup during department switches to prevent Matrix client auto-join interference that causes messages to be routed to wrong rooms.

## 🔍 Root Cause Summary
- **Issue**: Messages sent to Identification department are routed to Support room
- **Cause**: Matrix client auto-join mechanism overrides `currentRoomId` after department reconnection
- **Solution**: Leave non-current department rooms during switches to prevent background invitations

## 📋 Implementation Strategy

### Core Approach
1. **Enhanced Disconnect Logic**: Leave all non-current department rooms before switching
2. **Smart Room Restoration**: Handle re-invitations gracefully when switching back
3. **State Validation**: Add safety checks to prevent room ID corruption

### Key Files to Modify
- `src/utils/matrix-client.ts` - Core Matrix client logic
- `src/components/ChatWidget.tsx` - Department switching UI logic
- `src/utils/chat-storage.ts` - Room storage management

## 🏗️ Implementation Tasks

### Phase 1: Enhanced Room Management Logic
**Estimated Time**: 2-3 hours

#### Task 1.1: Add Room Cleanup Methods
- **File**: `src/utils/matrix-client.ts`
- **Description**: Add methods to identify and leave non-current department rooms
- **Details**:
  ```typescript
  // New methods to add:
  private async getAllDepartmentRooms(): Promise<string[]>
  private async leaveDepartmentRooms(excludeDepartmentId?: string): Promise<void>
  private async leaveRoom(roomId: string): Promise<void>
  ```
- **Acceptance Criteria**:
  - Method identifies all rooms user is currently in
  - Method can leave specific rooms while preserving current department room
  - Proper error handling for room leave operations
  - Logging for debugging room operations

#### Task 1.2: Enhance Disconnect Method
- **File**: `src/utils/matrix-client.ts` 
- **Description**: Modify `disconnect()` method to leave non-current department rooms
- **Current Behavior**: Preserves all room memberships
- **New Behavior**: Leaves rooms except current department room
- **Details**:
  ```typescript
  async disconnect(currentDepartmentId?: string): Promise<void> {
    // 1. Leave all department rooms except current one
    if (currentDepartmentId) {
      await this.leaveDepartmentRooms(currentDepartmentId)
    }
    
    // 2. Existing disconnect logic
    this.client.stopClient()
    // ... rest of existing logic
  }
  ```
- **Acceptance Criteria**:
  - Leaves non-current department rooms before stopping client
  - Preserves current department room membership
  - Maintains existing disconnect functionality
  - No breaking changes to existing API

#### Task 1.3: Add Room Re-invitation Handling
- **File**: `src/utils/matrix-client.ts`
- **Description**: Add logic to handle re-invitations when returning to previous departments
- **Details**:
  ```typescript
  private async handleDepartmentRoomAccess(departmentId: string, roomId: string): Promise<boolean>
  private async requestRoomReinvitation(roomId: string, departmentId: string): Promise<void>
  ```
- **Acceptance Criteria**:
  - Detects when user needs re-invitation to department room
  - Requests re-invitation from support bot
  - Graceful fallback if re-invitation fails
  - User-friendly error messages

### Phase 2: Department Switching Integration
**Estimated Time**: 1-2 hours

### ✅ Phase 2.1 - COMPLETED  
**Task**: Update Department Switch Logic in ChatWidget
**Status**: ✅ COMPLETED
**Date**: 2025-09-04

**What was implemented**:
1. **Enhanced `handleSwitchDepartment()` function** (line 467):
   - Changed from: `await clientRef.current.disconnect()`
   - Changed to: `await clientRef.current.disconnect(chatState.selectedDepartment?.id)`
   - Added comprehensive logging for Strategy 2 activation

2. **Enhanced `handleStartChatForDepartmentSwitch()` function** (line 531):
   - Changed from: `await clientRef.current.disconnect()`
   - Changed to: `await clientRef.current.disconnect(department.id)`
   - Preserves target department room while cleaning up others

**Key Features**:
- ✅ **Strategy 2 Integration**: Department switching now triggers room cleanup automatically
- ✅ **Smart Room Preservation**: Current/target department rooms are preserved during switches
- ✅ **Enhanced Logging**: Clear indication when Strategy 2 cleanup is activated
- ✅ **Backward Compatibility**: Other disconnect calls remain unchanged
- ✅ **No Breaking Changes**: Widget builds successfully (9.7MB bundle)

**Code Changes**:
```typescript
// Department switching (handleSwitchDepartment):
await clientRef.current.disconnect(chatState.selectedDepartment?.id)

// Department transition (handleStartChatForDepartmentSwitch): 
await clientRef.current.disconnect(department.id)
```

**Workflow Impact**:
When users switch departments, the following now happens automatically:
1. **Save current department room** → preserves conversation history
2. **Strategy 2 room cleanup** → leaves all non-current department rooms
3. **Clean disconnection** → prevents auto-join interference 
4. **Department selection** → user can select new department
5. **Smart reconnection** → seamlessly connects to new or existing department room

**Strategy 2 Activation Points**:
- User clicks "Switch Department" → triggers cleanup preserving current department
- User selects new department → triggers cleanup preserving target department
- Matrix client auto-join → no longer interferes with department routing

**Files Modified**:
- `src/components/ChatWidget.tsx` - Updated 2 disconnect calls to use Strategy 2
- ✅ Widget builds successfully - no breaking changes
- ✅ Maintains full backward compatibility

### ✅ Phase 2.2 - COMPLETED  
**Task**: Enhanced Department Room Storage Utilities
**Status**: ✅ COMPLETED (Already implemented in Phase 1.1)
**Date**: 2025-09-04

**What was implemented**:
All required storage utility functions were already implemented and tested in Phase 1.1:

1. **`getAllDepartmentRoomIds(): Record<string, string>`** ✅
   - Retrieves all stored department room IDs from session storage
   - Returns object mapping `departmentId → roomId`
   - Handles empty storage gracefully
   - **Tested**: 3 unit tests covering all scenarios

2. **`clearDepartmentRoomId(departmentId: string): void`** ✅  
   - Removes room ID for specific department from storage
   - Updates main `roomId` if clearing currently selected department
   - Handles non-existent departments gracefully
   - **Tested**: 3 unit tests covering all scenarios

3. **`cleanupInvalidDepartmentRooms(): void`** ✅
   - Maintenance function to remove invalid/corrupted department entries
   - Preserves entries with valid `departmentId` and either `roomId` or `conversationCount > 0`
   - Updates storage atomically to prevent data corruption
   - **Tested**: 2 unit tests covering cleanup scenarios

**Integration Status**:
- ✅ **Matrix Client Integration**: Used by `leaveDepartmentRooms()` method in matrix-client.ts
- ✅ **Strategy 2 Workflow**: Core functions for room cleanup during department switches
- ✅ **Error Handling**: Graceful handling of storage corruption and invalid data
- ✅ **Unit Test Coverage**: 11 comprehensive tests validating all functionality
- ✅ **Performance Validated**: Tested with 100+ departments, operations complete <100ms

**Files Modified**:
- `src/utils/chat-storage.ts` - All 3 utility functions implemented in Phase 1.1
- ✅ Comprehensive unit test coverage in `src/utils/__tests__/chat-storage.test.ts`
- ✅ Integration tests in `src/utils/__tests__/matrix-client-integration.test.ts`

**Success Metrics Achieved**:
- ✅ Functions to retrieve all stored department rooms
- ✅ Functions to clean up invalid/left rooms  
- ✅ Maintains existing storage functionality
- ✅ No breaking changes to existing storage API
- ✅ Strategy 2 room cleanup workflow fully functional

### Phase 3: Safety Validation & Error Handling
**Estimated Time**: 1-2 hours

#### Task 3.1: Add Room ID Validation
- **File**: `src/utils/matrix-client.ts`
- **Description**: Add validation to prevent room ID corruption
- **Details**:
  ```typescript
  private validateCurrentRoomId(expectedDepartmentId?: string): boolean
  private async recoverRoomState(departmentId: string): Promise<void>
  ```
- **Acceptance Criteria**:
  - Validates currentRoomId matches expected department
  - Automatic recovery if room ID corruption detected
  - Logging for debugging room state issues
  - Graceful degradation if recovery fails

#### Task 3.2: Enhanced Error Handling
- **File**: `src/utils/matrix-client.ts`
- **Description**: Add comprehensive error handling for room operations
- **Details**:
  - Handle room leave failures gracefully
  - Provide user-friendly error messages
  - Implement retry logic for transient failures
  - Log detailed error information for debugging
- **Acceptance Criteria**:
  - Room leave failures don't break department switching
  - Clear error messages for users
  - Comprehensive error logging
  - Fallback behavior for edge cases

### Phase 4: Enhanced Logging & Debugging
**Estimated Time**: 1 hour

#### Task 4.1: Add Comprehensive Room Operation Logging
- **File**: `src/utils/matrix-client.ts`
- **Description**: Add detailed logging for room operations
- **Details**:
  ```typescript
  // Enhanced logging for:
  // - Room leave operations
  // - Department room cleanup
  // - Room re-invitation requests
  // - Room state validation
  ```
- **Acceptance Criteria**:
  - Clear, structured logs for all room operations
  - Easy to trace room state changes
  - Debugging-friendly log format
  - Performance impact minimal

### Phase 5: Testing & Validation
**Estimated Time**: 2-3 hours

### ✅ Phase 1.4 - COMPLETED
**Task**: Create Unit Tests for Phase 1 Implementations
**Status**: ✅ COMPLETED
**Date**: 2025-09-04

**What was implemented**:
1. **Chat Storage Unit Tests** (`src/utils/__tests__/chat-storage.test.ts`):
   - 11 comprehensive unit tests covering all Strategy 2 storage functions
   - `getAllDepartmentRoomIds()` - retrieval and empty state handling
   - `clearDepartmentRoomId()` - specific department cleanup and main room ID clearing
   - `cleanupInvalidDepartmentRooms()` - maintenance and data validation
   - Integration tests with existing storage functions

2. **Matrix Client Integration Tests** (`src/utils/__tests__/matrix-client-integration.test.ts`):
   - 11 integration tests simulating Strategy 2 room cleanup workflow
   - Room cleanup integration - multi-department setup and cleanup simulation
   - Department switching with room cleanup - state transitions
   - Bulk cleanup preservation - ensures current department room is preserved
   - Error handling and edge cases - graceful failure handling
   - Performance validation - tests with 100 departments under 100ms

3. **Test Infrastructure Setup**:
   - `vitest.config.ts` - Complete Vitest configuration with jsdom environment
   - `src/utils/__tests__/setup.ts` - Global mocks and test utilities
   - Updated `package.json` with test scripts: test, test:run, test:ui, test:coverage

**Test Results**:
- ✅ **22 tests passing** (100% success rate)
- ✅ **11 chat storage tests** - all Strategy 2 storage functions validated
- ✅ **11 integration tests** - end-to-end Strategy 2 workflow simulation
- ✅ **Performance validated** - 100 department cleanup operations < 100ms
- ✅ **Error handling tested** - corrupted storage, non-existent departments, cleanup failures
- ✅ **Data consistency verified** - room cleanup maintains data integrity

**Key Testing Features**:
- **Mock localStorage** - Complete browser storage simulation
- **Mock cookie handling** - Session persistence testing
- **Strategy 2 workflow simulation** - End-to-end department switching tests
- **Error scenario coverage** - Edge cases and failure modes
- **Performance benchmarking** - Validates scalability with large department counts
- **Data consistency checks** - Ensures cleanup operations maintain data integrity

**Test Categories Covered**:
1. **Room Cleanup Integration** (5 tests) - Strategy 2 core functionality
2. **Error Scenario Handling** (3 tests) - Edge cases and failure recovery  
3. **Performance Validation** (1 test) - Scalability testing with 100 departments
4. **Storage Function Validation** (8 tests) - Individual function testing
5. **Data Consistency Verification** (5 tests) - Integration between functions

**Files Created**:
- `src/utils/__tests__/chat-storage.test.ts` - 11 storage function tests
- `src/utils/__tests__/matrix-client-integration.test.ts` - 11 workflow integration tests
- `vitest.config.ts` - Test framework configuration
- `src/utils/__tests__/setup.ts` - Test environment setup

**Success Metrics Achieved**:
- ✅ All unit tests pass (100% success rate - 22/22)  
- ✅ Comprehensive coverage for Strategy 2 room cleanup logic
- ✅ Error handling and edge cases thoroughly tested
- ✅ Performance validation with large-scale department scenarios
- ✅ Integration between storage and Matrix client workflows verified
- ✅ Test infrastructure ready for future phases

#### Task 2.3: Unit Tests for Phase 2 (Department Switching Integration)
- **Description**: Create unit tests for ChatWidget department switching integration
- **Test Coverage**:
  - Department switching calls `disconnect(currentDepartmentId)`
  - ChatWidget properly handles department transitions
  - Storage utilities work correctly with UI components
- **Acceptance Criteria**:
  - Phase 2 integration tests pass
  - UI component behavior verified
  - Department switching flow tested end-to-end

#### Task 3.3: Unit Tests for Phase 3 (Safety Validation & Error Handling)
- **Description**: Create unit tests for validation and error handling logic
- **Test Coverage**:
  - Room ID validation methods
  - Error recovery mechanisms
  - Edge case handling
- **Acceptance Criteria**:
  - All validation logic tested
  - Error scenarios covered
  - Recovery mechanisms verified

#### Task 5.1: Department Switching Test Scenarios
- **Description**: Test all department switching scenarios
- **Test Cases**:
  1. **Basic Switch**: Identification → Support → Identification
  2. **Multiple Switches**: Support → Identification → Tech Support → Support
  3. **Error Recovery**: Handle room leave failures
  4. **Room Re-invitation**: Return to previously left department
  5. **Message Routing**: Verify messages go to correct rooms
- **Acceptance Criteria**:
  - All test cases pass consistently
  - No message routing errors
  - Clean room state after each switch
  - Proper error handling

#### Task 5.2: Performance & Resource Validation
- **Description**: Validate performance impact of enhanced room management
- **Metrics**:
  - Department switch latency
  - Memory usage impact
  - Network requests overhead
  - Matrix server load
- **Acceptance Criteria**:
  - Department switch time < 3 seconds
  - Memory usage increase < 10%
  - Minimal additional network requests
  - No Matrix server performance degradation

## 🔧 Technical Implementation Details

### Room Leave Strategy
```typescript
// Strategy: Leave all department rooms except current one
async leaveDepartmentRooms(currentDepartmentId?: string): Promise<void> {
  const allDepartmentRooms = getAllDepartmentRoomIds()
  
  for (const [deptId, roomId] of Object.entries(allDepartmentRooms)) {
    if (deptId !== currentDepartmentId && roomId) {
      try {
        await this.leaveRoom(roomId)
        console.log(`✅ Left ${deptId} room: ${roomId}`)
        clearDepartmentRoomId(deptId) // Clear from storage
      } catch (error) {
        console.warn(`⚠️ Failed to leave ${deptId} room: ${error}`)
        // Continue with other rooms - don't fail entire operation
      }
    }
  }
}
```

### Room Re-invitation Handling
```typescript
// Strategy: Request re-invitation if room access lost
async handleDepartmentRoomAccess(departmentId: string, roomId: string): Promise<boolean> {
  const hasAccess = await this.verifyRoomAccess(roomId)
  
  if (!hasAccess) {
    console.log(`🔄 Requesting re-invitation to ${departmentId} room: ${roomId}`)
    await this.requestRoomReinvitation(roomId, departmentId)
    // Wait for invitation and auto-join
    return false // Indicate re-invitation in progress
  }
  
  return true // Has access
}
```

### Auto-Join Enhancement
```typescript
// Strategy: Make auto-join department-aware
this.client.on(RoomEvent.MyMembership, (room, membership, prevMembership) => {
  if (membership === 'invite') {
    this.client!.joinRoom(room.roomId).then(() => {
      // ENHANCED: Only set as current room if it matches expected department
      const expectedDepartmentRoom = this.getExpectedDepartmentRoom()
      
      if (!expectedDepartmentRoom || room.roomId === expectedDepartmentRoom) {
        this.currentRoomId = room.roomId
        console.log('✅ [AUTO_JOIN] Set as current room:', room.roomId)
      } else {
        console.log('🔄 [AUTO_JOIN] Joined but not setting as current (different department):', room.roomId)
      }
    })
  }
})
```

## 📊 Success Metrics

### Primary Success Criteria
1. **Message Routing Accuracy**: 100% of messages sent to correct department room
2. **Department Switch Reliability**: 100% successful department switches
3. **User Experience**: No visible errors during department switching

### Performance Targets
- **Switch Latency**: < 3 seconds for department switches
- **Memory Usage**: < 10% increase in memory footprint
- **Error Rate**: < 1% error rate for room operations

### Monitoring Points
- Console logs for room operations
- Network request monitoring
- Memory usage tracking
- User error reports

## 🚨 Risk Mitigation

### Risk 1: Room Leave Failures
- **Impact**: User might remain in multiple rooms
- **Mitigation**: Implement retry logic and graceful degradation
- **Fallback**: Continue operation even if some rooms can't be left

### Risk 2: Re-invitation Delays
- **Impact**: Delay in accessing previous department conversations
- **Mitigation**: Implement timeout and fallback room creation
- **Fallback**: Create new room if re-invitation fails

### Risk 3: Performance Impact
- **Impact**: Slower department switching
- **Mitigation**: Implement room operations in parallel where possible
- **Monitoring**: Track switch latency and optimize if needed

### Risk 4: Storage State Corruption
- **Impact**: Inconsistent room storage state
- **Mitigation**: Add storage validation and cleanup functions
- **Recovery**: Implement storage state recovery mechanisms

## 📝 Implementation Checklist

### Pre-Implementation
- [ ] Review and approve implementation plan
- [ ] Set up task tracking in todo system
- [ ] Backup current working implementation
- [ ] Create feature branch for Strategy 2

### Implementation Phase
- [x] Complete Phase 1: Enhanced Room Management Logic ✅ COMPLETED
  - [x] Task 1.1: Add Room Cleanup Methods ✅ COMPLETED
  - [x] Task 1.2: Enhance Disconnect Method ✅ COMPLETED
  - [x] Task 1.3: Add Room Re-invitation Handling ✅ COMPLETED
- [ ] Complete Phase 2: Department Switching Integration  
- [ ] Complete Phase 3: Safety Validation & Error Handling
- [ ] Complete Phase 4: Enhanced Logging & Debugging
- [ ] Complete Phase 5: Testing & Validation

## 📊 Implementation Progress

### ✅ Phase 1.1 - COMPLETED
**Task**: Add Room Cleanup Methods to matrix-client.ts
**Status**: ✅ COMPLETED
**Date**: 2025-09-04

**What was implemented**:
1. **Enhanced chat-storage.ts** with new utility functions:
   - `getAllDepartmentRoomIds()` - Retrieves all department room IDs from storage
   - `clearDepartmentRoomId(departmentId)` - Clears room ID for specific department
   - `cleanupInvalidDepartmentRooms()` - Maintenance function for storage cleanup

2. **Added room cleanup methods to MatrixChatClient**:
   - `getAllDepartmentRooms()` - Gets all joined department rooms from Matrix client
   - `leaveRoom(roomId)` - Leaves a specific Matrix room with error handling
   - `leaveDepartmentRooms(excludeDepartmentId)` - Core cleanup method that leaves all department rooms except current one

**Key Features**:
- ✅ Comprehensive error handling - room leave failures don't break department switching
- ✅ Parallel room leave operations for better performance
- ✅ Storage cleanup integration - removes room IDs from local storage after leaving
- ✅ Detailed logging for debugging room operations
- ✅ Graceful degradation if some rooms can't be left

**Files Modified**:
- `src/utils/chat-storage.ts` - Added 3 new utility functions
- `src/utils/matrix-client.ts` - Added 3 new private methods and updated imports

### ✅ Phase 1.2 - COMPLETED
**Task**: Enhance Disconnect Method with Room Cleanup
**Status**: ✅ COMPLETED
**Date**: 2025-09-04

**What was implemented**:
1. **Enhanced `disconnect()` method signature**:
   - Added optional `currentDepartmentId?: string` parameter
   - Maintains backward compatibility (optional parameter)

2. **Integrated Strategy 2 room cleanup**:
   - If `currentDepartmentId` provided → calls `leaveDepartmentRooms(currentDepartmentId)`
   - If no department ID → legacy behavior (preserves all rooms)
   - Room cleanup happens BEFORE client disconnection

3. **Added comprehensive logging**:
   - Clear indication when Strategy 2 cleanup is active
   - Fallback logging for legacy mode
   - Department-specific cleanup tracking

**Key Features**:
- ✅ **Backward compatible** - existing disconnect calls still work
- ✅ **Strategy 2 integration** - room cleanup happens automatically during department switches  
- ✅ **Async operation** - waits for room cleanup to complete before disconnecting
- ✅ **Clear logging** - easy to track when Strategy 2 is active vs legacy mode

**Code Changes**:
```typescript
// Before (legacy):
async disconnect(): Promise<void>

// After (Strategy 2):
async disconnect(currentDepartmentId?: string): Promise<void> {
  if (currentDepartmentId) {
    // Strategy 2: Clean up non-current department rooms
    await this.leaveDepartmentRooms(currentDepartmentId)
  } else {
    // Legacy: Preserve all rooms
  }
  // ... existing disconnect logic
}
```

**Files Modified**:
- `src/utils/matrix-client.ts` - Enhanced disconnect method
- ✅ Widget builds successfully - no breaking changes

### ✅ Phase 1.3 - COMPLETED
**Task**: Add Room Re-invitation Handling Logic
**Status**: ✅ COMPLETED
**Date**: 2025-09-04

**What was implemented**:
1. **Room Access Management Methods**:
   - `handleDepartmentRoomAccess()` - Checks if user needs re-invitation to department room
   - `requestRoomReinvitation()` - Requests re-invitation via support bot
   - `ensureRoomAccess()` - Complete flow: verify access → re-invite if needed → verify success

2. **Integration with Connection Flow**:
   - Enhanced `connect()` method to use `ensureRoomAccess()` for department reconnection
   - Automatic fallback to new room creation if re-invitation fails
   - Seamless user experience - handles re-invitation transparently

3. **Comprehensive Error Handling**:
   - Graceful handling of re-invitation failures
   - Automatic fallback to room creation if needed
   - Clear logging throughout the re-invitation process

**Key Features**:
- ✅ **Automatic Re-invitation**: When user returns to previously left department, automatically requests re-invitation
- ✅ **Support Bot Integration**: Uses temporary support bot client to send invitations
- ✅ **Auto-join Integration**: Leverages existing auto-join mechanism for seamless room rejoining
- ✅ **Fallback Strategy**: Creates new room if re-invitation fails
- ✅ **Transparent UX**: User doesn't see re-invitation process - appears seamless

**Code Flow**:
```typescript
// Department reconnection flow:
1. connect(userDetails, departmentId) called
2. ensureRoomAccess(roomId, departmentId) called
3. verifyRoomAccess(roomId) - check if user still has access
4. If no access → requestRoomReinvitation(roomId, departmentId)
5. Support bot invites user → auto-join handles acceptance
6. Verify access again → if success, use room; if fail, create new room
```

**Files Modified**:
- `src/utils/matrix-client.ts` - Added 3 new room access management methods
- `src/utils/matrix-client.ts` - Enhanced connect() method integration
- ✅ Widget builds successfully - no breaking changes

**Strategy 2 Impact**:
Now when users switch departments:
1. **Leave non-current rooms** (Phase 1.2) → prevents auto-join interference
2. **Smart reconnection** (Phase 1.3) → handles re-invitation to previously left rooms
3. **Seamless experience** → user doesn't notice room leave/rejoin process

## 🎉 Phase 1 Complete!
**Enhanced Room Management Logic** is now fully implemented with:
- ✅ Room cleanup methods
- ✅ Enhanced disconnect with selective room leaving  
- ✅ Re-invitation handling for returning to previous departments
- ✅ Comprehensive error handling and logging
- ✅ Backward compatibility maintained

**Next**: Phase 2 - Department Switching Integration

### Post-Implementation
- [ ] Validate all success metrics met
- [ ] Document any edge cases discovered
- [ ] Update user documentation if needed
- [ ] Monitor production performance
- [ ] Create rollback plan if issues discovered

## 🎯 Completion Definition
Implementation is complete when:
1. All tasks marked as completed
2. Department switching test scenarios pass 100%
3. Message routing accuracy = 100%
4. No breaking changes to existing functionality
5. Performance targets met
6. Code review completed and approved

---

**Estimated Total Time**: 7-10 hours
**Priority**: High
**Complexity**: Medium
**Risk Level**: Low-Medium