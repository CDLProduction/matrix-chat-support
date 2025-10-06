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

function validateDepartmentConfig(departments) {
  const errors = []
  
  if (!departments || !Array.isArray(departments) || departments.length === 0) {
    errors.push('At least one department must be configured when using departments mode')
    return errors
  }
  
  const departmentIds = new Set()
  
  departments.forEach((dept, index) => {
    if (!dept.id || typeof dept.id !== 'string') {
      errors.push(`Department ${index}: id is required and must be a string`)
    } else {
      if (departmentIds.has(dept.id)) {
        errors.push(`Department ${dept.id}: duplicate department id found`)
      }
      departmentIds.add(dept.id)
    }
    
    if (!dept.name || typeof dept.name !== 'string') {
      errors.push(`Department ${dept.id || index}: name is required`)
    }
    
    if (!dept.matrix) {
      errors.push(`Department ${dept.id || index}: matrix configuration is required`)
    } else {
      // Validate Matrix configuration for each department
      const homeserver = dept.matrix.homeserver || config.matrix?.homeserver
      if (!homeserver) {
        errors.push(`Department ${dept.id}: homeserver URL is required (either in department config or global matrix config)`)
      } else {
        try {
          new URL(homeserver)
        } catch {
          errors.push(`Department ${dept.id}: invalid homeserver URL`)
        }
      }
      
      if (!dept.matrix.access_token || dept.matrix.access_token === 'YOUR_ACCESS_TOKEN_HERE') {
        errors.push(`Department ${dept.id}: Matrix access token is required`)
      }
    }
  })
  
  return errors
}

function validateLegacyConfig() {
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
  
  return errors
}

function validateConfig() {
  let errors = []
  
  // Check if using departments mode or legacy mode
  if (config.departments && Array.isArray(config.departments) && config.departments.length > 0) {
    console.log('🏢 Multi-department mode detected')
    errors = validateDepartmentConfig(config.departments)
  } else {
    console.log('🔧 Legacy single-department mode detected')
    errors = validateLegacyConfig()
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

// Request logging middleware
app.use((req, res, next) => {
  const timestamp = new Date().toISOString()
  console.log(`📥 ${timestamp} ${req.method} ${req.url} - ${req.ip || 'unknown'}`)
  next()
})

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (mobile apps, curl, file://, etc.)
    if (!origin || origin === 'null') return callback(null, true);

    // Allow any localhost port during development
    if (origin.match(/^https?:\/\/localhost(:\d+)?$/)) {
      return callback(null, true);
    }

    // Allow configured origins
    const allowedOrigins = config.server?.cors_origins || [];
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    // Reject other origins
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true
}))

// Set CSP headers to allow widget loading and debugging
app.use((req, res, next) => {
  res.setHeader('Content-Security-Policy', 
    "default-src 'self'; " +
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'; " +
    "style-src 'self' 'unsafe-inline'; " +
    "img-src 'self' data: blob:; " +
    "connect-src 'self' ws: wss: http: https:; " +
    "font-src 'self' data:; " +
    "frame-src 'none'; " +
    "object-src 'none';"
  )
  next()
})

// Basic index route
app.get('/', (req, res) => {
  res.json({
    name: 'Matrix Chat Support Widget Server',
    version: '1.0.0',
    status: 'running',
    endpoints: {
      config: '/api/config',
      health: '/health',
      embed: '/embed.js',
      widget: '/widget/'
    }
  })
})

function buildLegacyClientConfig() {
  return {
    matrix: {
      homeserver: config.matrix.homeserver,
      accessToken: config.matrix.access_token,
      adminAccessToken: config.matrix.admin_access_token,
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
}

function buildDepartmentClientConfig() {
  const baseConfig = {
    departments: config.departments.map(dept => ({
      id: dept.id,
      name: dept.name,
      description: dept.description,
      icon: dept.icon,
      color: dept.color,
      matrix: {
        homeserver: dept.matrix.homeserver || config.matrix?.homeserver,
        accessToken: dept.matrix.access_token,
        adminAccessToken: dept.matrix.admin_access_token,
        supportRoomId: dept.matrix.support_room_id,
        botUserId: dept.matrix.bot_user_id,
        departmentUsers: dept.matrix.department_users
      },
      widget: {
        greeting: dept.widget?.greeting,
        placeholderText: dept.widget?.placeholder_text,
        additionalFields: dept.widget?.additional_fields
      },
      spaceConfig: dept.matrix?.spaceConfig
    })),
    widget: {
      title: config.widget.title,
      subtitle: config.widget.subtitle,
      brandColor: config.widget.brand_color,
      position: config.widget.position,
      departmentSelection: config.widget.department_selection
    }
  }

  // Add social media configuration if available
  if (config.social_media && Array.isArray(config.social_media) && config.social_media.length > 0) {
    baseConfig.socialMedia = config.social_media.map(social => ({
      id: social.id,
      name: social.name,
      platform: social.platform,
      icon: social.icon,
      color: social.color,
      enabled: social.enabled,
      config: {
        botUsername: social.config?.bot_username,
        welcomeMessage: social.config?.welcome_message,
        autoReply: social.config?.auto_reply,
        departments: social.config?.departments,
        workingHours: social.config?.working_hours
      }
    }))
  }

  // Add communication channels configuration if available
  if (config.communication_channels && Array.isArray(config.communication_channels) && config.communication_channels.length > 0) {
    baseConfig.communicationChannels = config.communication_channels.map(channel => {
      const baseChannel = {
        type: channel.type,
        id: channel.id,
        name: channel.name,
        description: channel.description,
        icon: channel.icon,
        color: channel.color,
        available: channel.available
      }

      // If it's a social media channel, add the social media details
      if (channel.type === 'social' && channel.social_media_id && baseConfig.socialMedia) {
        const socialMedia = baseConfig.socialMedia.find(s => s.id === channel.social_media_id)
        if (socialMedia) {
          baseChannel.socialMedia = socialMedia
        }
      }

      return baseChannel
    })
  }

  return baseConfig
}

app.get('/api/config', (req, res) => {
  console.log('🔧 [/api/config] Configuration requested by client')

  if (!validateConfig()) {
    return res.status(500).json({
      error: 'Server configuration is invalid. Check server logs for details.'
    })
  }
  
  let clientConfig
  
  // Check if using departments mode or legacy mode
  if (config.departments && Array.isArray(config.departments) && config.departments.length > 0) {
    clientConfig = buildDepartmentClientConfig()
    console.log('📤 Serving multi-department configuration')
  } else {
    clientConfig = buildLegacyClientConfig()
    console.log('📤 Serving legacy single-department configuration')
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

// Serve public files (debug pages, etc.)
const publicPath = path.resolve(__dirname, '../public')
if (fs.existsSync(publicPath)) {
  app.use(express.static(publicPath))
  console.log(`Serving public files from ${publicPath}`)
}

app.get('/embed.js', (req, res) => {
  console.log('📄 [/embed.js] Widget embed script requested')

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
      // Load widget CSS
      const cssLink = document.createElement('link');
      cssLink.rel = 'stylesheet';
      cssLink.href = '${req.protocol}://${req.get('host')}/widget/style.css';
      document.head.appendChild(cssLink);
      
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