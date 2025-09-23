/**
 * Chat Storage Utilities
 * Manages persistent user sessions and chat history in browser storage
 */

export interface UserDetails {
  name: string;
  email: string;
  phone?: string;
}

export interface ChatSession {
  userId: string;
  matrixUserId?: string;
  roomId?: string;
  userDetails?: UserDetails;
  lastActivity: string;
  conversationCount: number;
  isReturningUser: boolean;
  guestUserId?: string;
  guestAccessToken?: string;
  // Department-specific fields (Phase 4)
  selectedDepartment?: Department;
  departmentId?: string;
  departmentHistory?: DepartmentHistory[];
}

export interface Department {
  id: string;
  name: string;
  description?: string;
  icon?: string;
  color?: string;
  matrix: any; // MatrixConfig
  widget: any; // DepartmentWidgetConfig
}

export interface DepartmentHistory {
  departmentId: string;
  roomId?: string;
  lastActivity: string;
  conversationCount: number;
  // Strategy 2.1: Smart Room Preservation - Enhanced room status tracking
  roomStatus?: 'active' | 'left' | 'invalid';
  membershipHistory?: Array<{
    action: 'join' | 'leave' | 'invite';
    timestamp: string;
    reason?: string;
  }>;
}

const STORAGE_KEY = 'matrix-chat-session';
const COOKIE_NAME = 'matrix-chat-user-id';
const SESSION_DURATION_DAYS = 30;

/**
 * Generates a unique user identifier
 */
export function generateUserId(): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  return `matrix-chat-user-${timestamp}-${random}`;
}

/**
 * Sets a cookie with specified name, value, and expiration days
 */
function setCookie(name: string, value: string, days: number): void {
  const expires = new Date();
  expires.setTime(expires.getTime() + (days * 24 * 60 * 60 * 1000));
  document.cookie = `${name}=${value};expires=${expires.toUTCString()};path=/;SameSite=Lax`;
}

/**
 * Gets a cookie value by name
 */
function getCookie(name: string): string | null {
  const nameEQ = name + "=";
  const ca = document.cookie.split(';');
  for (let i = 0; i < ca.length; i++) {
    let c = ca[i];
    while (c.charAt(0) === ' ') c = c.substring(1, c.length);
    if (c.indexOf(nameEQ) === 0) return c.substring(nameEQ.length, c.length);
  }
  return null;
}

/**
 * Saves chat session to localStorage and cookie backup
 */
export function saveChatSession(session: ChatSession): void {
  try {
    // Save to localStorage (primary storage)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    
    // Save user ID to cookie as backup
    setCookie(COOKIE_NAME, session.userId, SESSION_DURATION_DAYS);
    
  } catch (error) {
    console.warn('Failed to save chat session:', error);
  }
}

/**
 * Loads chat session from localStorage or creates new one
 */
export function loadChatSession(): ChatSession {
  try {
    // Try to load from localStorage first
    const storedData = localStorage.getItem(STORAGE_KEY);
    if (storedData) {
      const session: ChatSession = JSON.parse(storedData);
      
      // Validate session data
      if (session.userId && isValidSession(session)) {
        session.isReturningUser = true;
        return session;
      }
    }
    
    // Try fallback to cookie
    const cookieUserId = getCookie(COOKIE_NAME);
    if (cookieUserId) {
      const session: ChatSession = {
        userId: cookieUserId,
        lastActivity: new Date().toISOString(),
        conversationCount: 0,
        isReturningUser: true
      };
      console.log('🍪 Restored session from cookie:', cookieUserId);
      return session;
    }
  } catch (error) {
    console.warn('Failed to load chat session from storage:', error);
  }
  
  // Create new session for first-time user
  const newSession: ChatSession = {
    userId: generateUserId(),
    lastActivity: new Date().toISOString(),
    conversationCount: 0,
    isReturningUser: false
  };
  
  return newSession;
}

/**
 * Updates existing chat session with new data
 */
export function updateChatSession(updates: Partial<ChatSession>): ChatSession {
  const currentSession = loadChatSession();
  const updatedSession: ChatSession = {
    ...currentSession,
    ...updates,
    lastActivity: new Date().toISOString()
  };
  
  saveChatSession(updatedSession);
  return updatedSession;
}

/**
 * Clears chat session (starts fresh conversation)
 */
export function clearChatSession(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
    setCookie(COOKIE_NAME, '', -1); // Delete cookie
  } catch (error) {
    console.warn('Failed to clear chat session:', error);
  }
}

/**
 * Validates if a session is still valid (not too old, has required fields)
 */
function isValidSession(session: ChatSession): boolean {
  try {
    // Check if session has required fields
    if (!session.userId || !session.lastActivity) {
      return false;
    }
    
    // Check if session is not too old (30 days)
    const lastActivity = new Date(session.lastActivity);
    const now = new Date();
    const daysSinceLastActivity = (now.getTime() - lastActivity.getTime()) / (1000 * 3600 * 24);
    
    if (daysSinceLastActivity > SESSION_DURATION_DAYS) {
      console.log('⏰ Session expired (older than 30 days)');
      return false;
    }
    
    return true;
  } catch (error) {
    console.warn('Error validating session:', error);
    return false;
  }
}

/**
 * Increments conversation count for analytics
 */
export function incrementConversationCount(): void {
  const session = loadChatSession();
  updateChatSession({
    conversationCount: session.conversationCount + 1
  });
}

/**
 * Gets user details from current session
 */
export function getUserDetails(): UserDetails | null {
  const session = loadChatSession();
  return session.userDetails || null;
}

/**
 * Updates user details in current session
 */
export function updateUserDetails(userDetails: UserDetails): void {
  updateChatSession({ userDetails });
}

/**
 * Sets the Matrix room ID for current session
 */
export function setRoomId(roomId: string): void {
  updateChatSession({ roomId });
}

/**
 * Gets the current room ID if available
 */
export function getCurrentRoomId(): string | null {
  const session = loadChatSession();
  return session.roomId || null;
}

/**
 * Sets the Matrix user ID for current session
 */
export function setMatrixUserId(matrixUserId: string): void {
  updateChatSession({ matrixUserId });
}

/**
 * Gets current Matrix user ID if available
 */
export function getMatrixUserId(): string | null {
  const session = loadChatSession();
  return session.matrixUserId || null;
}

/**
 * Checks if user is returning (has previous session)
 */
export function isReturningUser(): boolean {
  const session = loadChatSession();
  return session.isReturningUser;
}

/**
 * Sets the selected department for current session
 */
export function setSelectedDepartment(department: Department): void {
  const session = loadChatSession();
  
  // Initialize department history if not exists
  if (!session.departmentHistory) {
    session.departmentHistory = [];
  }
  
  // Update or create department history entry
  const existingHistoryIndex = session.departmentHistory.findIndex(h => h.departmentId === department.id);
  if (existingHistoryIndex >= 0) {
    session.departmentHistory[existingHistoryIndex].lastActivity = new Date().toISOString();
  } else {
    session.departmentHistory.push({
      departmentId: department.id,
      lastActivity: new Date().toISOString(),
      conversationCount: 0
    });
  }
  
  updateChatSession({
    selectedDepartment: department,
    departmentId: department.id,
    departmentHistory: session.departmentHistory
  });
  
}

/**
 * Gets the currently selected department
 */
export function getSelectedDepartment(): Department | null {
  const session = loadChatSession();
  return session.selectedDepartment || null;
}

/**
 * Gets room ID for a specific department (from department history)
 */
export function getDepartmentRoomId(departmentId: string): string | null {
  const session = loadChatSession();
  if (!session.departmentHistory) {
    return null;
  }
  
  const departmentHistory = session.departmentHistory.find(h => h.departmentId === departmentId);
  return departmentHistory?.roomId || null;
}

/**
 * Sets room ID for a specific department
 */
export function setDepartmentRoomId(departmentId: string, roomId: string): void {
  const session = loadChatSession();
  
  if (!session.departmentHistory) {
    session.departmentHistory = [];
  }
  
  const existingHistoryIndex = session.departmentHistory.findIndex(h => h.departmentId === departmentId);
  if (existingHistoryIndex >= 0) {
    session.departmentHistory[existingHistoryIndex].roomId = roomId;
    session.departmentHistory[existingHistoryIndex].lastActivity = new Date().toISOString();
  } else {
    session.departmentHistory.push({
      departmentId: departmentId,
      roomId: roomId,
      lastActivity: new Date().toISOString(),
      conversationCount: 0
    });
  }
  
  // Also update main roomId if this is the currently selected department
  const updates: Partial<ChatSession> = {
    departmentHistory: session.departmentHistory
  };
  
  if (session.selectedDepartment?.id === departmentId) {
    updates.roomId = roomId;
  }
  
  updateChatSession(updates);
  
}

/**
 * Increments conversation count for current department
 */
export function incrementDepartmentConversationCount(departmentId?: string): void {
  const session = loadChatSession();
  const targetDepartmentId = departmentId || session.selectedDepartment?.id;
  
  if (!targetDepartmentId) {
    // Fallback to legacy behavior
    incrementConversationCount();
    return;
  }
  
  if (!session.departmentHistory) {
    session.departmentHistory = [];
  }
  
  const existingHistoryIndex = session.departmentHistory.findIndex(h => h.departmentId === targetDepartmentId);
  if (existingHistoryIndex >= 0) {
    session.departmentHistory[existingHistoryIndex].conversationCount++;
    session.departmentHistory[existingHistoryIndex].lastActivity = new Date().toISOString();
  } else {
    session.departmentHistory.push({
      departmentId: targetDepartmentId,
      lastActivity: new Date().toISOString(),
      conversationCount: 1
    });
  }
  
  // Also update main conversation count
  updateChatSession({
    conversationCount: session.conversationCount + 1,
    departmentHistory: session.departmentHistory
  });
  
}

/**
 * Gets conversation count for a specific department
 */
export function getDepartmentConversationCount(departmentId: string): number {
  const session = loadChatSession();
  if (!session.departmentHistory) {
    return 0;
  }
  
  const departmentHistory = session.departmentHistory.find(h => h.departmentId === departmentId);
  return departmentHistory?.conversationCount || 0;
}

/**
 * Clears department-specific data while preserving user session
 */
export function clearDepartmentData(): void {
  updateChatSession({
    selectedDepartment: undefined,
    departmentId: undefined,
    roomId: undefined
  });
}

/**
 * Gets all department room IDs from storage (for Strategy 2 room cleanup)
 */
export function getAllDepartmentRoomIds(): Record<string, string> {
  const session = loadChatSession();
  const roomIds: Record<string, string> = {};
  
  if (session.departmentHistory) {
    for (const dept of session.departmentHistory) {
      if (dept.roomId) {
        roomIds[dept.departmentId] = dept.roomId;
      }
    }
  }
  
  return roomIds;
}

/**
 * Strategy 2.1: Sets room status for a specific department (replaces clearDepartmentRoomId)
 */
export function setDepartmentRoomStatus(
  departmentId: string, 
  roomId: string, 
  status: 'active' | 'left' | 'invalid',
  reason?: string
): void {
  const session = loadChatSession();
  
  if (!session.departmentHistory) {
    session.departmentHistory = [];
  }
  
  const existingHistoryIndex = session.departmentHistory.findIndex(h => h.departmentId === departmentId);
  const timestamp = new Date().toISOString();
  
  if (existingHistoryIndex >= 0) {
    const dept = session.departmentHistory[existingHistoryIndex];
    dept.roomId = roomId;
    dept.roomStatus = status;
    dept.lastActivity = timestamp;
    
    // Add to membership history
    if (!dept.membershipHistory) {
      dept.membershipHistory = [];
    }
    
    const action = status === 'active' ? 'join' : status === 'left' ? 'leave' : 'leave';
    dept.membershipHistory.push({
      action,
      timestamp,
      reason: reason || `status_change_to_${status}`
    });
    
    // Keep membership history to reasonable size
    if (dept.membershipHistory.length > 10) {
      dept.membershipHistory = dept.membershipHistory.slice(-10);
    }
  } else {
    // Create new department entry
    session.departmentHistory.push({
      departmentId,
      roomId,
      roomStatus: status,
      lastActivity: timestamp,
      conversationCount: 0,
      membershipHistory: [{
        action: status === 'active' ? 'join' : 'leave',
        timestamp,
        reason: reason || `initial_${status}`
      }]
    });
  }
  
  // Update main roomId if this is the currently selected department
  const updates: Partial<ChatSession> = {
    departmentHistory: session.departmentHistory
  };
  
  if (session.selectedDepartment?.id === departmentId && status === 'active') {
    updates.roomId = roomId;
  } else if (session.selectedDepartment?.id === departmentId && status !== 'active') {
    updates.roomId = undefined;
  }
  
  updateChatSession(updates);
  
}

/**
 * Strategy 2.1: Gets room information including status for a specific department
 */
export function getDepartmentRoomInfo(departmentId: string): {
  roomId: string;
  status: 'active' | 'left' | 'invalid';
  lastActivity: string;
  membershipHistory?: Array<{action: string, timestamp: string, reason?: string}>;
} | null {
  const session = loadChatSession();
  if (!session.departmentHistory) {
    return null;
  }
  
  const departmentHistory = session.departmentHistory.find(h => h.departmentId === departmentId);
  if (!departmentHistory?.roomId) {
    return null;
  }
  
  return {
    roomId: departmentHistory.roomId,
    status: departmentHistory.roomStatus || 'active', // Default to active for backwards compatibility
    lastActivity: departmentHistory.lastActivity,
    membershipHistory: departmentHistory.membershipHistory
  };
}

/**
 * Strategy 2.1: Gets all department room information with status (enhanced version)
 */
export function getAllDepartmentRoomInfo(): Record<string, {
  roomId: string;
  status: 'active' | 'left' | 'invalid';
  lastActivity: string;
}> {
  const session = loadChatSession();
  const roomInfo: Record<string, {roomId: string, status: 'active' | 'left' | 'invalid', lastActivity: string}> = {};
  
  if (session.departmentHistory) {
    for (const dept of session.departmentHistory) {
      if (dept.roomId) {
        roomInfo[dept.departmentId] = {
          roomId: dept.roomId,
          status: dept.roomStatus || 'active', // Default to active for backwards compatibility
          lastActivity: dept.lastActivity
        };
      }
    }
  }
  
  return roomInfo;
}

/**
 * Clears room ID for a specific department (for Strategy 2 room cleanup)
 * @deprecated Use setDepartmentRoomStatus instead for Strategy 2.1
 */
export function clearDepartmentRoomId(departmentId: string): void {
  const session = loadChatSession();
  
  if (!session.departmentHistory) {
    return;
  }
  
  const existingHistoryIndex = session.departmentHistory.findIndex(h => h.departmentId === departmentId);
  if (existingHistoryIndex >= 0) {
    session.departmentHistory[existingHistoryIndex].roomId = undefined;
    session.departmentHistory[existingHistoryIndex].lastActivity = new Date().toISOString();
    
    // Also clear main roomId if this is the currently selected department
    const updates: Partial<ChatSession> = {
      departmentHistory: session.departmentHistory
    };
    
    if (session.selectedDepartment?.id === departmentId) {
      updates.roomId = undefined;
    }
    
    updateChatSession(updates);
    
  }
}

/**
 * Strategy 2.1: Cleans up invalid/empty department room entries with enhanced status-aware logic
 */
export function cleanupInvalidDepartmentRooms(maxAgeMs?: number): void {
  const session = loadChatSession();
  
  if (!session.departmentHistory) {
    return;
  }
  
  const initialCount = session.departmentHistory.length;
  const now = Date.now();
  const defaultMaxAge = 7 * 24 * 60 * 60 * 1000; // 7 days
  const maxAge = maxAgeMs ?? defaultMaxAge;
  
  // Enhanced cleanup logic for Strategy 2.1
  session.departmentHistory = session.departmentHistory.filter(dept => {
    // Keep departments with valid IDs
    if (!dept.departmentId) {
      return false;
    }
    
    // Keep departments with conversation history even if no room
    if (dept.conversationCount > 0) {
      return true;
    }
    
    // Remove departments marked as invalid and old enough
    if (dept.roomStatus === 'invalid') {
      const lastActivity = new Date(dept.lastActivity).getTime();
      const age = now - lastActivity;
      if (age > maxAge) {
        return false;
      }
    }
    
    // Keep rooms that are active or left (for potential re-invitation)
    if (dept.roomId && (dept.roomStatus === 'active' || dept.roomStatus === 'left')) {
      return true;
    }
    
    // Remove empty entries with no room ID and no conversation history
    if (!dept.roomId && dept.conversationCount === 0) {
      return false;
    }
    
    return true;
  });
  
  const cleanedCount = initialCount - session.departmentHistory.length;
  
  if (cleanedCount > 0) {
    updateChatSession({
      departmentHistory: session.departmentHistory
    });
    
  }
}

/**
 * Strategy 2.1: Validates and marks rooms that no longer exist on the server
 */
export function markInvalidRooms(invalidRoomIds: string[]): void {
  const session = loadChatSession();
  
  if (!session.departmentHistory || invalidRoomIds.length === 0) {
    return;
  }
  
  let updatedCount = 0;
  const timestamp = new Date().toISOString();
  
  session.departmentHistory.forEach(dept => {
    if (dept.roomId && invalidRoomIds.includes(dept.roomId)) {
      dept.roomStatus = 'invalid';
      dept.lastActivity = timestamp;
      
      // Add to membership history
      if (!dept.membershipHistory) {
        dept.membershipHistory = [];
      }
      
      dept.membershipHistory.push({
        action: 'leave',
        timestamp,
        reason: 'room_invalid_server_verification'
      });
      
      updatedCount++;
    }
  });
  
  if (updatedCount > 0) {
    updateChatSession({
      departmentHistory: session.departmentHistory
    });
    
  }
}

/**
 * Gets session analytics for debugging (enhanced with department info)
 */
export function getSessionInfo() {
  const session = loadChatSession();
  return {
    userId: session.userId,
    hasRoom: !!session.roomId,
    hasUserDetails: !!session.userDetails,
    conversationCount: session.conversationCount,
    lastActivity: session.lastActivity,
    isReturning: session.isReturningUser,
    // Department-specific info
    selectedDepartment: session.selectedDepartment?.name || null,
    departmentId: session.departmentId || null,
    departmentHistoryCount: session.departmentHistory?.length || 0,
    daysSinceLastActivity: Math.floor(
      (Date.now() - new Date(session.lastActivity).getTime()) / (1000 * 3600 * 24)
    )
  };
}