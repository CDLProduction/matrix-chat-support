import React from 'react'
import ReactDOM from 'react-dom/client'
import ChatWidget from '@/components/ChatWidget'

const demoConfig = {
  matrix: {
    homeserver: 'https://matrix.org',
    accessToken: 'DEMO_MODE_NO_CONNECTION',
    supportRoomId: undefined,
    botUserId: undefined
  },
  widget: {
    title: 'Support Chat (Demo)',
    subtitle: 'Testing UI - No Matrix Connection',
    brandColor: '#667eea',
    position: 'bottom-right' as const,
    greeting: 'Hi! This is a demo of the chat widget. You can test the form, but it won\'t actually connect to Matrix.',
    placeholderText: 'Try typing your message here...'
  }
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <div style={{ 
      padding: '20px', 
      minHeight: '100vh',
      backgroundColor: '#f8f9fa',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
    }}>
      <div style={{ maxWidth: '800px', margin: '0 auto' }}>
        <h1 style={{ color: '#333', marginBottom: '10px' }}>Matrix Chat Support Widget - Demo</h1>
        <p style={{ color: '#666', fontSize: '18px', marginBottom: '30px' }}>
          This is a demo page showing the chat widget in action.
        </p>
        
        <div style={{ 
          background: 'white', 
          padding: '30px', 
          borderRadius: '12px',
          marginBottom: '30px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
        }}>
          <h2 style={{ color: '#333', marginTop: '0' }}>🎯 Testing Instructions</h2>
          <div style={{ 
            background: '#e3f2fd', 
            padding: '15px', 
            borderRadius: '8px', 
            marginBottom: '20px',
            border: '1px solid #bbdefb'
          }}>
            <strong>👀 Look for the chat button in the bottom-right corner!</strong>
            <br />Click it to open the chat widget and test the interface.
          </div>
          
          <h3>What you can test:</h3>
          <ul>
            <li>✅ Chat button visibility and positioning</li>
            <li>✅ Modal opening/closing animation</li>
            <li>✅ Contact form validation</li>
            <li>✅ Responsive design (resize your browser)</li>
            <li>⚠️ Matrix connection (will fail without proper config)</li>
          </ul>
        </div>

        <div style={{ 
          background: 'white', 
          padding: '30px', 
          borderRadius: '12px',
          marginBottom: '30px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
        }}>
          <h2 style={{ color: '#333', marginTop: '0' }}>⚙️ Configuration</h2>
          <p>To make this widget work with a real Matrix server:</p>
          <ol>
            <li>Set up a Matrix homeserver (like matrix.org or your own Synapse instance)</li>
            <li>Create a bot/support user account</li>
            <li>Get an access token for that user</li>
            <li>Update <code>config/config.yaml</code> with your server details</li>
            <li>Restart the server with <code>npm run serve</code></li>
          </ol>
          
          <div style={{ 
            background: '#fff3cd', 
            padding: '15px', 
            borderRadius: '8px', 
            marginTop: '20px',
            border: '1px solid #ffeaa7'
          }}>
            <strong>⚠️ Note:</strong> This demo uses placeholder configuration, so the Matrix 
            connection will fail, but you can still test the UI and user experience.
          </div>
        </div>

        <div style={{ 
          background: 'white', 
          padding: '30px', 
          borderRadius: '12px',
          marginBottom: '100px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
        }}>
          <h2 style={{ color: '#333', marginTop: '0' }}>🚀 Production Usage</h2>
          <p>To embed this widget on your website, add this single line:</p>
          <pre style={{ 
            background: '#f8f9fa', 
            padding: '15px', 
            borderRadius: '6px', 
            overflow: 'auto',
            border: '1px solid #e9ecef'
          }}>
            <code>&lt;script src="https://your-domain.com/embed.js"&gt;&lt;/script&gt;</code>
          </pre>
          <p style={{ fontSize: '14px', color: '#666' }}>
            Replace "your-domain.com" with your actual domain where you deploy this server.
          </p>
        </div>
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