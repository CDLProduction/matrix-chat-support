# Integration Test Scenarios - Multi-Department Chat Widget

## 🧪 Phase 5: Testing & Validation

### Test Environment Setup
- **Multi-Department Server**: http://localhost:3001 (3 departments)
- **Legacy Server**: http://localhost:3003 (single department)
- **Development Server**: http://localhost:3002 (demo/dev mode)

---

## 📋 Test Scenarios

### 1. Configuration Validation Tests ✅

#### 1.1 Valid Multi-Department Config
**Test**: Load widget with departments configuration
**Expected**: 
- Widget shows department selection screen
- All 3 departments displayed (Support, Sales, Identification)
- Each department has correct icon, color, and description
- No configuration errors in console

#### 1.2 Valid Legacy Config  
**Test**: Load widget with legacy matrix configuration
**Expected**:
- Widget shows user details form directly (no department selection)
- Form has legacy greeting message
- No configuration errors in console

#### 1.3 Invalid Config - Missing Required Fields
**Test**: Load widget with incomplete department configuration
**Expected**:
- Configuration error message displayed
- Widget gracefully shows error state
- Console shows detailed validation errors

#### 1.4 Invalid Config - Malformed URLs
**Test**: Load widget with invalid homeserver URL
**Expected**:
- Configuration validation catches malformed URL
- User-friendly error message shown
- Widget doesn't attempt to connect

### 2. Department Selection & Persistence Tests ✅

#### 2.1 Department Selection - First Time User
**Test**: New user selects "General Support" department
**Expected**:
- Department selection stored in localStorage
- User proceeds to user details form
- Form shows department-specific greeting
- Department context preserved throughout session

#### 2.2 Department Selection - Returning User
**Test**: Returning user with stored department selection
**Expected**:
- Widget automatically restores "General Support" selection
- User sees user details form with pre-filled information
- Department-specific greeting displayed
- Previous department context maintained

#### 2.3 Department History Tracking
**Test**: User chats with multiple departments over time
**Expected**:
- Each department maintains separate conversation history
- Room IDs stored per department
- Conversation counts tracked individually
- No cross-department history contamination

#### 2.4 Department Config Changes
**Test**: Department removed from config after user selection
**Expected**:
- Widget detects invalid stored department
- Gracefully resets to department selection screen
- Warning logged to console
- No crash or error state

### 3. Matrix Integration Tests ✅

#### 3.1 Department-Specific Room Creation
**Test**: Create chat rooms for different departments
**Expected**:
- Support room: "General Support: John Doe"
- Sales room: "Sales & Inquiries: Jane Smith"
- Room topics include department context
- Matrix bot receives department-specific context messages

#### 3.2 Room History Restoration
**Test**: Returning user to department with existing room
**Expected**:
- Widget finds correct department-specific room ID
- Previous conversation history loaded
- "I'm back to continue our conversation" message sent
- Message timeline preserved

#### 3.3 Cross-Department Room Isolation
**Test**: User switches between departments
**Expected**:
- Support chat history separate from Sales chat history
- Each department has distinct room ID
- No message leakage between departments
- Independent conversation contexts

### 4. Error Handling & Recovery Tests ✅

#### 4.1 Network Connectivity Issues
**Test**: Simulate network disconnection during chat
**Expected**:
- User-friendly "Network connection problem" message
- Message sending shows "error" status
- Retry mechanisms for temporary failures
- No technical error messages exposed

#### 4.2 Matrix Server Unavailable
**Test**: Invalid homeserver URL or server down
**Expected**:
- Department-specific error message: "Unable to connect to [Department] team"
- Graceful fallback to demo mode if configured
- Clear actionable error guidance for users

#### 4.3 Authentication Failures
**Test**: Invalid or expired access tokens
**Expected**:
- "Connection issue with [Department] team. Please refresh and try again."
- No sensitive token information exposed
- Proper error logging for debugging

#### 4.4 Rate Limiting
**Test**: Exceed Matrix server rate limits
**Expected**:
- "Too many requests to [Department] team. Please wait a moment."
- Automatic retry after appropriate delay
- Temporary error message with countdown

### 5. User Experience Flow Tests ✅

#### 5.1 Complete Multi-Department Flow
**Test**: Full user journey from department selection to chat
**Steps**:
1. Open widget → Department selection screen
2. Select "Sales & Inquiries" → User details form (Sales greeting)
3. Fill form and submit → Chat interface opens
4. Send message → Message appears with "sent" status
5. Receive response → Support response in chat

#### 5.2 Returning User Experience
**Test**: User returns after previous department chat
**Expected**:
- Department selection auto-restored
- User details pre-filled
- Option to "start fresh conversation" vs continue
- Previous chat history accessible

#### 5.3 Form Validation & User Feedback
**Test**: Invalid form submissions and edge cases
**Expected**:
- Empty fields show validation errors
- Invalid email format rejected
- Clear error messages for all validation failures
- No form submission until all fields valid

### 6. Cross-Browser Compatibility Tests

#### 6.1 Modern Browsers
**Browsers to Test**:
- Chrome 120+ ✅
- Firefox 120+ ✅
- Safari 17+ ⚠️
- Edge 120+ ✅

**Test Cases**:
- Widget loads and renders correctly
- Department selection works
- Form submission and validation
- Chat interface responsive design
- localStorage persistence

#### 6.2 Mobile Browsers  
**Browsers to Test**:
- Chrome Mobile ⚠️
- Safari Mobile ⚠️
- Samsung Internet ⚠️

**Test Cases**:
- Widget responsive on mobile screens
- Touch interactions work properly
- Virtual keyboard doesn't break layout
- Department cards tap correctly

#### 6.3 Legacy Browser Support
**Browsers to Test**:
- Chrome 90-100 ⚠️
- Firefox 90-100 ⚠️

**Expected**:
- Graceful degradation for unsupported features
- Core functionality still works
- No JavaScript errors

### 7. Performance & Load Tests

#### 7.1 Widget Bundle Size
**Current**: 9.771 MB (3.52 MB gzipped)
**Target**: < 10 MB total
**Test**: Bundle analysis and optimization opportunities

#### 7.2 Initial Load Time
**Target**: Widget visible within 2 seconds
**Test**: Measure time to interactive for both config modes

#### 7.3 Memory Usage
**Test**: Monitor memory consumption during long chat sessions
**Expected**: No memory leaks, stable usage over time

### 8. Security & Privacy Tests

#### 8.1 Token Security
**Test**: Verify no access tokens exposed in client-side code
**Expected**: Tokens only used in server-to-server communication

#### 8.2 Data Persistence Privacy
**Test**: localStorage contains no sensitive information
**Expected**: Only non-sensitive user preferences stored

#### 8.3 CORS Configuration
**Test**: Widget works from allowed origins only
**Expected**: Proper CORS headers prevent unauthorized embedding

---

## 🔧 Test Execution Commands

### Development Testing
```bash
# Multi-department mode
npm run serve  # localhost:3001

# Legacy mode  
CONFIG_FILE=config/config-legacy-test.yaml npm run serve  # localhost:3003

# Demo/Dev mode
npm run dev  # localhost:3002
```

### Production Testing
```bash
npm run build:widget
npm run serve

# Test embed script
curl http://localhost:3001/embed.js
curl http://localhost:3001/api/config
curl http://localhost:3001/health
```

### Configuration Testing
```bash
# Test config validation
node -e "
import('./src/utils/error-handler.js').then(m => {
  const errors = m.validateWidgetConfig(config)
  console.log('Config errors:', errors)
})
"
```

---

## ✅ Test Results Summary

### Completed ✅
- Configuration validation and error handling
- Department-specific error messages
- Multi-department persistence and room isolation
- Enhanced user experience with graceful fallbacks
- Build system and bundle optimization

### In Progress ⚠️
- Cross-browser compatibility testing
- Mobile responsiveness validation
- Performance optimization

### Pending 📋
- Automated test suite implementation
- End-to-end testing with real Matrix servers
- Load testing with multiple concurrent users

---

## 📊 Test Coverage

| Component | Unit Tests | Integration Tests | Manual Tests |
|-----------|------------|------------------|--------------|
| Department Selection | ❌ | ✅ | ✅ |
| Error Handling | ❌ | ✅ | ✅ |
| Configuration | ❌ | ✅ | ✅ |
| Matrix Integration | ❌ | ✅ | ✅ |
| Persistence | ❌ | ✅ | ✅ |
| UI Components | ❌ | ✅ | ✅ |

**Overall Coverage**: Manual/Integration Testing ✅ | Unit Testing 📋 Future Phase