# Widget UI Changes for Social Media Integration
## Planning Document for Telegram and Facebook Support

This document outlines the UI/UX changes needed in the Matrix Chat Support Widget to support social media integration (Telegram and Facebook) alongside the existing web-chat functionality.

## Current Widget Architecture

### Existing Components
- `ChatWidget.tsx` - Main widget container and state management
- `DepartmentSelector.tsx` - Department selection interface
- `UserDetailsForm.tsx` - Contact form for user details
- `ChatInterface.tsx` - Chat conversation interface
- `LongMessage.tsx` - Message display component

### Current Flow
1. User clicks chat button → Department Selection
2. Department Selection → User Details Form  
3. User Details Form → Chat Interface (Matrix room creation)
4. Chat Interface → Real-time messaging

## Required UI Changes Overview

### 1. Communication Channel Selection (New)
**Purpose**: Allow users to choose between Web Chat, Telegram, and Facebook
**Location**: Before or alongside Department Selection
**Component**: `CommunicationChannelSelector.tsx` (new)

### 2. Enhanced Department Selector
**Purpose**: Show department availability per communication channel
**Modifications**: Update `DepartmentSelector.tsx`
**Changes**: Channel-aware department filtering

### 3. Social Media Connect Forms (New)
**Purpose**: Handle Telegram/Facebook connection instead of traditional contact form
**Components**: 
- `TelegramConnectForm.tsx` (new)
- `FacebookConnectForm.tsx` (new)

### 4. Enhanced Chat Interface  
**Purpose**: Display communication channel context and bridge status
**Modifications**: Update `ChatInterface.tsx`
**Changes**: Channel indicators, bridge status, social media context

### 5. Updated Type Definitions
**Purpose**: Support social media channel types and states
**Modifications**: Update `types/index.ts`
**Changes**: New interfaces for social media integration

## Detailed Implementation Plan

### Phase 1: Type System Updates

#### New Types Needed
```typescript
// Communication channel types
export type CommunicationChannel = 'web-chat' | 'telegram' | 'facebook'

export interface SocialMediaConfig {
  telegram?: TelegramConfig
  facebook?: FacebookConfig
}

export interface TelegramConfig {
  enabled: boolean
  botUsername: string
  botUrl: string
  instructions: string
  departments: string[]
}

export interface FacebookConfig {
  enabled: boolean
  pageId: string
  pageUrl: string
  instructions: string
  departments: string[]
}

// Enhanced ChatSession with channel info
export interface ChatSession {
  // ... existing fields
  communicationChannel: CommunicationChannel
  socialMediaContext?: SocialMediaContext
}

export interface SocialMediaContext {
  channel: CommunicationChannel
  platform?: 'telegram' | 'facebook'
  externalUserId?: string
  externalUsername?: string
  bridgeStatus?: 'connecting' | 'connected' | 'disconnected' | 'error'
  instructions?: string
}

// Enhanced ChatState
export interface ChatState {
  // ... existing fields
  currentChannel?: CommunicationChannel
  availableChannels?: CommunicationChannel[]
  socialMediaStatus?: SocialMediaStatus
}

export interface SocialMediaStatus {
  telegram?: ChannelStatus
  facebook?: ChannelStatus
}

export interface ChannelStatus {
  enabled: boolean
  available: boolean
  error?: string
  departments: string[]
}
```

### Phase 2: Communication Channel Selector Component

#### New Component: `CommunicationChannelSelector.tsx`
```typescript
interface CommunicationChannelSelectorProps {
  availableChannels: CommunicationChannel[]
  selectedChannel?: CommunicationChannel
  socialMediaConfig?: SocialMediaConfig
  onChannelSelect: (channel: CommunicationChannel) => void
  onBack?: () => void
}
```

**Features**:
- Channel cards with icons (💻 Web Chat, ✈️ Telegram, 📘 Facebook)
- Availability status per channel
- Department count per channel
- Responsive grid/list layout
- Channel-specific descriptions and instructions

**UI Design**:
```
┌─────────────────────────────────────┐
│ How would you like to get support?  │
├─────────────────────────────────────┤
│ ┌───────┐ ┌───────┐ ┌───────┐      │
│ │ 💻    │ │ ✈️    │ │ 📘    │      │
│ │Web    │ │Telegram│ │Facebook│     │
│ │Chat   │ │       │ │       │      │
│ │4 depts│ │3 depts│ │2 depts│      │
│ └───────┘ └───────┘ └───────┘      │
│ Start    Connect   Connect        │
│ Chat     Bot       Messenger      │
└─────────────────────────────────────┘
```

### Phase 3: Enhanced Department Selector

#### Modifications to `DepartmentSelector.tsx`
**Changes**:
- Filter departments by selected communication channel
- Show channel-specific availability  
- Display different messaging for social media channels
- Update department descriptions for channel context

```typescript
interface DepartmentSelectorProps {
  // ... existing props
  communicationChannel?: CommunicationChannel
  channelConfig?: SocialMediaConfig
  availableDepartments?: Department[]
}
```

**Channel-Aware Features**:
- Department availability per channel (some departments may not support all channels)
- Channel-specific descriptions ("Chat with us on Telegram" vs "Start web chat")
- Different icons/styling per channel
- Channel context in department cards

### Phase 4: Social Media Connection Components

#### Component: `TelegramConnectForm.tsx`
```typescript
interface TelegramConnectFormProps {
  telegramConfig: TelegramConfig
  selectedDepartment: Department
  onConnect: (instructions: string) => void
  onBack: () => void
}
```

**Features**:
- Instructions to message the Telegram bot
- Bot username and deep link
- Department-specific bot commands
- QR code for mobile users (optional)
- Status checking for bot connection

**UI Flow**:
```
┌─────────────────────────────────────┐
│ Connect via Telegram               │
├─────────────────────────────────────┤
│ 1. Open Telegram                   │
│ 2. Message: @SupportBot            │
│ 3. Send: /start [department]       │
│                                    │
│ ┌─────────────────────────────────┐ │
│ │ 📱 Open in Telegram            │ │
│ │ t.me/SupportBot?start=tech     │ │
│ └─────────────────────────────────┘ │
│                                    │
│ ⚠️  Keep this window open          │
│    We'll show your conversation    │
│    here once connected.           │
└─────────────────────────────────────┘
```

#### Component: `FacebookConnectForm.tsx`
```typescript
interface FacebookConnectFormProps {
  facebookConfig: FacebookConfig
  selectedDepartment: Department
  onConnect: (instructions: string) => void
  onBack: () => void
}
```

**Features**:
- Instructions to message the Facebook page
- Page link and messaging button
- Department selection via Facebook messages
- Connection status indicators

### Phase 5: Enhanced Chat Interface

#### Modifications to `ChatInterface.tsx`
**Changes**:
- Channel indicator in header
- Bridge status indicator for social media
- Channel-specific message formatting
- Social media platform context

```typescript
interface ChatInterfaceProps {
  // ... existing props
  communicationChannel?: CommunicationChannel
  socialMediaContext?: SocialMediaContext
  bridgeStatus?: 'connected' | 'connecting' | 'error'
}
```

**New Features**:
- **Channel Header**: Shows current communication channel with icon
- **Bridge Status**: Live status of Telegram/Facebook bridge connection
- **Platform Context**: Shows external username/handle when applicable
- **Channel Instructions**: Help text specific to each platform
- **Error Handling**: Channel-specific error messages and recovery

**Header Design**:
```
┌─────────────────────────────────────┐
│ ✈️ Telegram • Tech Support • 🟢    │
│ Connected as @username              │
└─────────────────────────────────────┘
```

### Phase 6: Widget Configuration Updates

#### Enhanced `WidgetConfig` Interface
```typescript
export interface WidgetConfig {
  // ... existing fields
  socialMedia?: SocialMediaConfig
  channelSelection?: ChannelSelectionConfig
  defaultChannel?: CommunicationChannel
  showChannelSelector?: boolean
}

export interface ChannelSelectionConfig {
  title?: string
  subtitle?: string
  showAvailability?: boolean
  layout?: 'grid' | 'list'
  allowChannelSwitching?: boolean
}
```

### Phase 7: State Management Updates

#### Enhanced `ChatWidget.tsx` State Management
**Changes**:
- Add channel selection step to widget flow
- Manage social media connection states
- Handle channel-specific error states
- Store bridge status and social media context

```typescript
interface WidgetState extends ChatState {
  // New channel-related state
  currentChannel?: CommunicationChannel
  availableChannels: CommunicationChannel[]
  socialMediaStatus?: SocialMediaStatus
  bridgeConnections?: Record<CommunicationChannel, BridgeConnection>
}

interface BridgeConnection {
  status: 'idle' | 'connecting' | 'connected' | 'error'
  error?: string
  lastConnected?: string
  externalId?: string
}
```

**New State Flow**:
1. `initial` → Channel Selection (if multiple channels enabled)
2. `channel-selected` → Department Selection (filtered by channel)
3. `department-selected` → Connection Form (web form OR social media connect)
4. `connecting` → Bridge connection for social media OR room creation for web
5. `connected` → Chat Interface with channel context

### Phase 8: Responsive Design Considerations

#### Mobile Optimization
- **Channel Selector**: Full-screen overlay on mobile
- **Social Media Connect**: Optimize for mobile app switching
- **Chat Interface**: Channel indicator remains visible in mobile layout
- **Deep Links**: Proper handling of app switching (Telegram/Facebook apps)

#### Desktop Enhancements
- **Multi-Panel View**: Option to show multiple channels simultaneously (future)
- **Channel Switching**: Quick switcher between active conversations
- **Status Indicators**: Persistent bridge status in widget footer

### Phase 9: Accessibility & UX

#### Accessibility Features
- **Screen Reader Support**: Channel names and status announced
- **Keyboard Navigation**: Full keyboard support for channel selection
- **Color Blind Support**: Icons and text labels, not just colors for status
- **High Contrast**: Channel indicators visible in high contrast mode

#### User Experience Improvements
- **Progressive Enhancement**: Graceful degradation if social media unavailable
- **Clear Instructions**: Step-by-step guidance for social media setup
- **Error Recovery**: Clear paths to retry failed connections
- **Loading States**: Smooth transitions between connection states

## Implementation Timeline

### Week 1: Foundation
- [ ] Update type definitions for social media support
- [ ] Create base `CommunicationChannelSelector` component
- [ ] Update widget configuration parsing

### Week 2: Core Components
- [ ] Implement `TelegramConnectForm` component
- [ ] Implement `FacebookConnectForm` component  
- [ ] Update `DepartmentSelector` for channel awareness

### Week 3: Integration
- [ ] Enhance `ChatInterface` with channel context
- [ ] Update `ChatWidget` state management
- [ ] Implement bridge status monitoring

### Week 4: Polish & Testing
- [ ] Mobile responsive design
- [ ] Accessibility testing and improvements
- [ ] Cross-browser testing
- [ ] Integration testing with bridges

## Configuration Example

### Updated `config.yaml` Structure
```yaml
widget:
  title: "Customer Support"
  socialMedia:
    telegram:
      enabled: true
      botUsername: "YourSupportBot"
      botUrl: "https://t.me/YourSupportBot"
      instructions: "Message our bot for instant support"
      departments: ["general", "tech", "verification"]
    facebook:
      enabled: false  # Future implementation
      pageId: "your-page-id"
      pageUrl: "https://m.me/yourpage"
      departments: ["general", "sales"]
  
  channelSelection:
    title: "How would you like to get support?"
    subtitle: "Choose your preferred communication method"
    showAvailability: true
    layout: "grid"
    allowChannelSwitching: false
  
  defaultChannel: "web-chat"  # Fallback if only one channel
  showChannelSelector: true   # Show selector if multiple channels
```

### Department Configuration Updates
```yaml
departments:
  - id: general
    name: "General Support"
    channels: ["web-chat", "telegram"]  # Channel availability
    telegram:
      command: "/support"
      greeting: "Hi! How can we help you today?"
    facebook:
      enabled: false
      
  - id: tech  
    name: "Technical Support"
    channels: ["web-chat", "telegram"]
    telegram:
      command: "/tech"
      greeting: "Technical support here. What's the issue?"
```

## Success Criteria

### Functional Requirements
- [x] Users can choose between Web Chat, Telegram, and Facebook
- [x] Department selection filters by available channels
- [x] Social media connections work seamlessly
- [x] Chat interface shows channel context
- [x] Bridge status monitoring and error handling
- [x] Mobile-responsive social media connection flow

### Technical Requirements  
- [x] Type-safe social media integration
- [x] Proper state management for multi-channel support
- [x] Error boundaries for social media failures
- [x] Graceful degradation if bridges unavailable
- [x] Performance impact < 10% additional bundle size

### User Experience Requirements
- [x] Intuitive channel selection interface
- [x] Clear social media connection instructions
- [x] Seamless transition between channels
- [x] Consistent chat experience across channels
- [x] Accessible for screen readers and keyboard users

## Testing Strategy

### Unit Testing
- Component rendering with different channel configurations
- State management for channel selection and social media connections
- Type safety for social media interfaces
- Error handling for bridge failures

### Integration Testing  
- End-to-end flows for each communication channel
- Channel switching and state persistence
- Bridge connection monitoring and reconnection
- Social media app integration (deep links)

### User Acceptance Testing
- Channel selection usability
- Social media connection success rates
- Cross-platform compatibility (iOS/Android/Desktop)
- Accessibility compliance (WCAG 2.1)

## Future Enhancements

### Phase 10: Advanced Features (Future Roadmap)
- **Multi-Channel Conversations**: Switch between channels mid-conversation
- **Channel Analytics**: Track usage and performance per channel
- **Custom Social Platforms**: Plugin system for additional platforms
- **Advanced Bridge Features**: File sharing, voice messages, reactions
- **Admin Dashboard**: Channel management and monitoring interface

This comprehensive plan provides a roadmap for implementing social media integration in the Matrix Chat Support Widget while maintaining the existing web-chat functionality and ensuring a seamless user experience across all communication channels.