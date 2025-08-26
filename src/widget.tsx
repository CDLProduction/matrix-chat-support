import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import ChatWidget from '@/components/ChatWidget'
import { MatrixChatWidgetProps } from '@/types'

declare global {
  interface Window {
    MatrixChatWidget: {
      init: (config: MatrixChatWidgetProps['config'], containerId?: string) => void
    }
  }
}

function initWidget(config: MatrixChatWidgetProps['config'], containerId?: string) {
  const container = containerId 
    ? document.getElementById(containerId)
    : (() => {
        const div = document.createElement('div')
        div.id = 'matrix-chat-widget-container'
        document.body.appendChild(div)
        return div
      })()

  if (!container) {
    console.error('Matrix Chat Widget: Container element not found')
    return
  }

  const root = createRoot(container)
  
  root.render(
    <StrictMode>
      <ChatWidget
        config={config}
        onError={(error) => {
          console.error('Matrix Chat Widget Error:', error)
        }}
        onConnect={(roomId) => {
          console.log('Matrix Chat Widget: Connected to room', roomId)
        }}
        onMessage={(message) => {
          console.log('Matrix Chat Widget: New message', message)
        }}
      />
    </StrictMode>
  )
}

if (typeof window !== 'undefined') {
  window.MatrixChatWidget = {
    init: initWidget
  }
}

export { initWidget as init }
export default ChatWidget