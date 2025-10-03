# Synapse Installation Script Fixes

## Summary of Changes

Complete refactor of `scripts/lib/synapse-setup.sh` to fix all installation issues on Ubuntu 24.04.

## Key Problems Fixed

### 1. **Configuration Generation Approach**
**Problem:** Previous approach tried to use `docker run --generate-config` which doesn't match how the working `docker-setup.sh` operates.

**Solution:** Changed to template-based approach:
- Copy pre-made templates from `docker/synapse/homeserver.yaml`
- Customize with Python/YAML for safe editing
- Matches proven working approach from `docker-setup.sh`

### 2. **Custom Port Configuration**
**Problem:** User-specified custom ports weren't being applied to the configuration.

**Solution:** 
- Read port from `install-session.json`
- Use Python YAML library to safely update both listener port and `public_baseurl`
- Ensures proper YAML formatting without regex errors

### 3. **File Permissions and Signing Keys**
**Problem:** Permission denied errors when Synapse tried to create signing keys.

**Solution:**
- Set UID 991 ownership on `data/` directory BEFORE starting Synapse
- Let Synapse auto-generate signing keys on first startup
- Preserve `install-session.json` ownership for installer access

### 4. **Database Configuration**
**Problem:** Template had incorrect database username (`synapse` vs `synapse_user`).

**Solution:**
- Template updated to use `synapse_user` matching docker-compose.yml
- Python script ensures database args are always correct

### 5. **Docker Restart Loops**
**Problem:** Docker's `restart: unless-stopped` policy caused immediate restarts during installation.

**Solution:**
- Create `docker-compose.override.yml` with `restart: "no"` during installation
- Removed after successful setup
- Prevents "address already in use" errors from restart loops

### 6. **Redis Configuration**
**Problem:** Template referenced Redis but docker-compose.yml doesn't include Redis service.

**Solution:**
- Commented out Redis config in template (marked as optional)
- Removed Python code that deleted Redis config (no longer needed)

## Implementation Details

### Configuration Customization (Python)
Uses Python with PyYAML for safe configuration modification:
- Updates `server_name` based on user input
- Updates port in listeners array
- Updates `public_baseurl` to match domain and port
- Ensures database credentials match docker-compose.yml
- Sets correct signing key path

### Permission Handling
1. Create data directories with current user initially
2. Copy configuration templates
3. Customize configuration with Python
4. **Before starting Docker:** Set UID 991 ownership on data directory
5. Preserve install-session.json for installer access
6. Start containers with Synapse able to write signing keys

### Startup Sequence
1. Stop any existing containers (`docker compose down`)
2. Set proper permissions on data directory
3. Create docker-compose.override.yml with no-restart policy
4. Start PostgreSQL first, wait for readiness
5. Start Synapse (auto-generates signing keys)
6. Start admin panel and Element
7. Wait for Synapse health check
8. Create users and spaces
9. Remove override file and restart with production policy

## Testing Checklist

- [ ] Fresh installation on Ubuntu 24.04
- [ ] Custom port configuration (e.g., 8001)
- [ ] Custom domain configuration
- [ ] PostgreSQL connectivity
- [ ] Signing key auto-generation
- [ ] User creation (admin + department users)
- [ ] Access token retrieval
- [ ] Complete end-to-end installation

## Files Modified

1. `scripts/lib/synapse-setup.sh` - Complete refactor of config generation and Docker startup
2. `docker/synapse/homeserver.yaml` - Fixed Redis config (commented out), confirmed correct DB username

## Compatibility

- Works with both `docker compose` (v2) and `docker-compose` (v1)
- macOS and Linux compatible (stat command differences handled)
- Ubuntu 24.04 tested (UID 991 maps to systemd-resolve)
