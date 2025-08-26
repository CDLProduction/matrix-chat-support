import express from 'express'
import cors from 'cors'
import path from 'path'
import fs from 'fs'
import yaml from 'js-yaml'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const app = express()

let config = {}

function loadConfig() {
  try {
    const configPath = path.join(__dirname, '../config/config.yaml')
    const configFile = fs.readFileSync(configPath, 'utf8')
    config = yaml.load(configFile)
    console.log('Configuration loaded successfully')
  } catch (error) {
    console.error('Error loading configuration:', error.message)
    console.log('Using default configuration...')
    
    config = {
      matrix: {
        homeserver: 'https://matrix.org',
        access_token: process.env.MATRIX_ACCESS_TOKEN || 'YOUR_ACCESS_TOKEN_HERE',
        support_room_id: process.env.MATRIX_SUPPORT_ROOM_ID || null,
        bot_user_id: process.env.MATRIX_BOT_USER_ID || null
      },
      widget: {
        title: 'Support Chat',
        subtitle: "We're here to help!",
        brand_color: '#667eea',
        position: 'bottom-right',
        greeting: 'Hi! How can we help you today?',
        placeholder_text: 'Describe your issue...'
      },
      server: {
        port: process.env.PORT || 3001,
        cors_origins: ['http://localhost:3000', 'http://localhost:5173'],
        static_path: './dist/widget'
      },
      logging: {
        level: 'info'
      }
    }
  }
}

function validateConfig() {
  const errors = []
  
  if (!config.matrix?.homeserver) {
    errors.push('Matrix homeserver URL is required')
  }
  
  if (!config.matrix?.access_token || config.matrix.access_token === 'YOUR_ACCESS_TOKEN_HERE') {
    errors.push('Matrix access token is required')
  }
  
  try {
    new URL(config.matrix.homeserver)
  } catch {
    errors.push('Matrix homeserver URL is invalid')
  }
  
  if (errors.length > 0) {
    console.error('Configuration validation errors:')
    errors.forEach(error => console.error(`  - ${error}`))
    console.error('\nPlease check your config.yaml file or environment variables.')
    return false
  }
  
  return true
}

loadConfig()

app.use(express.json())

app.use(cors({
  origin: config.server?.cors_origins || ['http://localhost:3000'],
  credentials: true
}))

app.get('/api/config', (req, res) => {
  if (!validateConfig()) {
    return res.status(500).json({
      error: 'Server configuration is invalid. Check server logs for details.'
    })
  }
  
  const clientConfig = {
    matrix: {
      homeserver: config.matrix.homeserver,
      accessToken: config.matrix.access_token,
      supportRoomId: config.matrix.support_room_id,
      botUserId: config.matrix.bot_user_id
    },
    widget: {
      title: config.widget.title,
      subtitle: config.widget.subtitle,
      brandColor: config.widget.brand_color,
      position: config.widget.position,
      greeting: config.widget.greeting,
      placeholderText: config.widget.placeholder_text
    }
  }
  
  res.json(clientConfig)
})

app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  })
})

const staticPath = path.resolve(__dirname, '../dist/widget')
if (fs.existsSync(staticPath)) {
  app.use('/widget', express.static(staticPath))
  console.log(`Serving widget assets from ${staticPath}`)
} else {
  console.warn(`Widget assets directory not found: ${staticPath}`)
  console.warn('Run "npm run build:widget" to build the widget assets')
}

app.get('/embed.js', (req, res) => {
  const widgetPath = path.join(staticPath, 'matrix-chat-widget.iife.js')
  
  if (!fs.existsSync(widgetPath)) {
    return res.status(404).json({
      error: 'Widget not built. Run "npm run build:widget" first.'
    })
  }
  
  res.setHeader('Content-Type', 'application/javascript')
  res.setHeader('Cache-Control', 'public, max-age=3600')
  
  const script = `
// Matrix Chat Support Widget Embedder
(function() {
  // Load widget configuration
  fetch('${req.protocol}://${req.get('host')}/api/config')
    .then(response => response.json())
    .then(config => {
      // Load widget script
      const script = document.createElement('script');
      script.src = '${req.protocol}://${req.get('host')}/widget/matrix-chat-widget.iife.js';
      script.onload = function() {
        if (window.MatrixChatWidget) {
          window.MatrixChatWidget.init(config);
        }
      };
      document.head.appendChild(script);
    })
    .catch(error => {
      console.error('Failed to load Matrix chat widget:', error);
    });
})();
`
  
  res.send(script)
})

const PORT = config.server?.port || 3001

app.listen(PORT, () => {
  console.log(`Matrix Chat Support server running on port ${PORT}`)
  console.log(`Widget embed URL: http://localhost:${PORT}/embed.js`)
  console.log(`Health check: http://localhost:${PORT}/health`)
  
  if (!validateConfig()) {
    console.error('\n⚠️  Configuration validation failed!')
    console.error('Please fix the configuration before using the widget.\n')
  } else {
    console.log('\n✅ Configuration is valid')
    console.log('Widget is ready to use!\n')
  }
})

export default app