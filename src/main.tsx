import React from 'react'
import ReactDOM from 'react-dom/client'
import ChatWidget from '@/components/ChatWidget'
import '@/styles/widget.module.css'

const demoConfig = {
  matrix: {
    homeserver: 'https://matrix.org',
    accessToken: 'YOUR_ACCESS_TOKEN',
    supportRoomId: undefined,
    botUserId: undefined
  },
  widget: {
    title: 'Support Chat',
    subtitle: 'We\'re here to help!',
    brandColor: '#667eea',
    position: 'bottom-right' as const,
    greeting: 'Hi! How can we help you today?',
    placeholderText: 'Describe your issue...'
  }
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <div style={{ padding: '20px' }}>
      <h1>Matrix Chat Support Widget - Demo</h1>
      <p>This is a demo page showing the chat widget in action.</p>
      <p>Click the chat button in the bottom-right corner to test it.</p>
      
      <div style={{ 
        background: '#f5f5f5', 
        padding: '20px', 
        borderRadius: '8px',
        marginTop: '20px'
      }}>
        <h2>Configuration</h2>
        <p>To use this widget, you need to:</p>
        <ol>
          <li>Set up a Matrix homeserver (like matrix.org or your own Synapse instance)</li>
          <li>Get an access token for your bot user</li>
          <li>Configure the widget with your Matrix server details</li>
          <li>Embed the widget in your website</li>
        </ol>
        
        <p><strong>Note:</strong> This demo uses placeholder configuration. 
           Check the config.yaml file and server setup for real deployment.</p>
      </div>
    </div>
    
    <ChatWidget 
      config={demoConfig}
      onError={(error) => console.error('Chat Widget Error:', error)}
      onConnect={(roomId) => console.log('Connected to room:', roomId)}
      onMessage={(message) => console.log('New message:', message)}
    />
  </React.StrictMode>,
)