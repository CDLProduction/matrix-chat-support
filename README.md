# Matrix Chat Support Widget

A modern, embeddable chat support widget that integrates with Matrix/Synapse servers. Similar to Chatterbox functionality, this widget provides seamless customer support chat that can be embedded into any website.

## 🚀 Quick Start

```bash
# Install dependencies and setup project
npm install
./scripts/setup.sh

# Configure your Matrix server in config/config.yaml
# Edit the homeserver and access_token fields

# Start development
npm run dev      # Demo at http://localhost:3000
npm run serve    # API at http://localhost:3001
```

## 📖 Documentation

See [CLAUDE.md](./CLAUDE.md) for complete documentation including:

- Installation and setup instructions
- Matrix server configuration
- Deployment guides for Apache2/Nginx
- API reference and customization options
- Troubleshooting guide

## 🌐 Embedding

Add this single line to any webpage:

```html
<script src="https://your-domain.com/embed.js"></script>
```

## ✨ Features

- ✅ Easy single-script embedding
- ✅ Matrix/Synapse server integration
- ✅ Modern responsive UI
- ✅ Customer details collection
- ✅ Real-time messaging
- ✅ Room management (create new or join existing)
- ✅ Production-ready deployment configs
- ✅ TypeScript + React architecture

## 🛠️ Tech Stack

- **Frontend**: React 18 + TypeScript + Vite
- **Matrix**: matrix-js-sdk for protocol communication
- **Backend**: Node.js/Express for configuration
- **Styling**: CSS Modules (scoped, no conflicts)
- **Build**: Optimized single-file widget bundle

## 📄 License

MIT License - see LICENSE file for details.