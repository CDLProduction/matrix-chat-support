# Matrix Synapse Docker Setup

This Docker Compose setup provides a complete Matrix Synapse homeserver with admin panel for testing the chat widget.

## 🐳 What's Included

- **Matrix Synapse**: The homeserver (port 8008)
- **PostgreSQL**: Database backend
- **Redis**: Caching and workers
- **Synapse Admin**: Web admin interface (port 8080)
- **Element Web**: Matrix web client (port 8081)

## 🚀 Quick Start

### 1. Start the Stack

```bash
# Start all services
docker compose up -d

# Check logs
docker compose logs -f synapse
```

### 2. Create Admin User

```bash
# Create admin user (run after services are up)
docker exec -it matrix-synapse register_new_matrix_user \
  -c /data/homeserver.yaml \
  -u admin \
  -p admin123 \
  --admin \
  http://localhost:8008
```

### 3. Create Support Bot User

```bash
# Create support bot user
docker exec -it matrix-synapse register_new_matrix_user \
  -c /data/homeserver.yaml \
  -u support \
  -p support123 \
  http://localhost:8008
```

## 🌐 Access Points

- **Synapse Server**: http://localhost:8008
- **Admin Panel**: http://localhost:8080
- **Element Web Client**: http://localhost:8081

## 🔑 Getting Access Tokens

### Method 1: Using curl

```bash
# Get access token for support bot
curl -X POST http://localhost:8008/_matrix/client/r0/login \
  -H 'Content-Type: application/json' \
  -d '{
    "type": "m.login.password",
    "user": "support",
    "password": "support123"
  }' | jq -r '.access_token'
```

### Method 2: Using Element Web

1. Go to http://localhost:8081
2. Login with support/support123
3. Go to Settings → Help & About
4. Scroll down and copy the access token

### Method 3: Using Admin Panel

1. Go to http://localhost:8080
2. Login with admin/admin123
3. Go to Users → support
4. Copy the access token

## ⚙️ Configure Chat Widget

Update your `config/config.yaml`:

```yaml
matrix:
  homeserver: "http://localhost:8008"
  access_token: "YOUR_SUPPORT_BOT_TOKEN_HERE"
  bot_user_id: "@support:localhost"

widget:
  title: "Support Chat"
  subtitle: "We're here to help!"
  brand_color: "#667eea"
  position: "bottom-right"
  greeting: "Hi! How can we help you today?"
```

## 📋 Management Commands

### Service Management
```bash
# Start services
docker compose up -d

# Stop services
docker compose down

# View logs
docker compose logs -f [service_name]

# Restart a service
docker compose restart synapse
```

### User Management
```bash
# Create new user
docker exec -it matrix-synapse register_new_matrix_user \
  -c /data/homeserver.yaml \
  -u username \
  -p password \
  http://localhost:8008

# Create admin user
docker exec -it matrix-synapse register_new_matrix_user \
  -c /data/homeserver.yaml \
  -u username \
  -p password \
  --admin \
  http://localhost:8008

# Reset user password (requires admin)
docker exec -it matrix-synapse synapse_port_db \
  --database-config /data/homeserver.yaml
```

### Database Management
```bash
# Access PostgreSQL
docker exec -it matrix-postgres psql -U synapse -d synapse

# Database backup
docker exec matrix-postgres pg_dump -U synapse synapse > backup.sql

# Database restore
cat backup.sql | docker exec -i matrix-postgres psql -U synapse -d synapse
```

### Room Management
```bash
# List rooms
curl -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  "http://localhost:8008/_synapse/admin/v1/rooms"

# Create room
curl -X POST -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": "Support Room", "topic": "Customer Support"}' \
  "http://localhost:8008/_matrix/client/r0/createRoom"
```

## 🔧 Troubleshooting

### Common Issues

**Services won't start:**
```bash
# Check logs
docker compose logs

# Check if ports are available
netstat -tulpn | grep -E '8008|8080|8081'

# Reset everything
docker compose down -v
docker compose up -d
```

**Can't create users:**
```bash
# Wait for Synapse to fully start
docker compose logs -f synapse

# Ensure database is ready
docker compose logs postgres

# Try again after services are healthy
docker compose ps
```

**Registration not working:**
```bash
# Check if registration is enabled
grep enable_registration docker/synapse/homeserver.yaml

# Enable registration temporarily
docker exec -it matrix-synapse grep -n enable_registration /data/homeserver.yaml
```

**Memory issues:**
```bash
# Check resource usage
docker stats

# Reduce worker processes in homeserver.yaml
# Or allocate more memory to Docker
```

## 🧹 Cleanup

### Complete Cleanup
```bash
# Stop and remove everything
docker compose down -v

# Remove Docker images
docker rmi matrixdotorg/synapse:latest
docker rmi postgres:15-alpine
docker rmi redis:7-alpine
docker rmi awesometechnologies/synapse-admin:latest
docker rmi vectorim/element-web:latest

# Remove Docker networks
docker network prune
```

### Partial Cleanup (Keep Images)
```bash
# Stop services and remove volumes
docker compose down -v

# Keep images for next time
# Just restart with: docker compose up -d
```

## 📊 Monitoring

### Health Checks
```bash
# Check service health
curl http://localhost:8008/health

# Check admin panel
curl http://localhost:8080

# Check Element client
curl http://localhost:8081
```

### Performance Monitoring
```bash
# View resource usage
docker stats

# Check Synapse metrics (if enabled)
curl http://localhost:9000/_synapse/metrics
```

## 🔒 Security Notes

**For Testing Only:**
- This setup is for development/testing only
- Default passwords are weak
- No SSL/TLS encryption
- Registration is open
- No rate limiting configured

**Production Considerations:**
- Use strong passwords and secrets
- Enable SSL/TLS with proper certificates
- Configure proper rate limiting
- Disable open registration
- Use separate database server
- Configure proper backup strategy

## 🎯 Testing the Chat Widget

1. Start the Matrix stack: `docker compose up -d`
2. Create users: `admin` and `support`
3. Get the support bot's access token
4. Update your widget's `config.yaml`
5. Start the widget: `npm run serve`
6. Test on: http://localhost:3001

The widget will create support rooms and the admin can monitor them via:
- Admin panel: http://localhost:8080
- Element client: http://localhost:8081

## 📝 Default Credentials

- **Admin User**: admin / admin123
- **Support Bot**: support / support123
- **Database**: synapse / synapse_password
- **Server Name**: localhost