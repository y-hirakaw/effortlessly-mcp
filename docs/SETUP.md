# Setup Guide - effortlessly-mcp

Complete setup and configuration guide for effortlessly-mcp MCP Server.

## Prerequisites

### System Requirements

- **Node.js**: 20.0.0 or higher
- **TypeScript**: 5.0 or higher (for development)
- **Operating System**: macOS, Linux, or Windows
- **Memory**: Minimum 512MB RAM, Recommended 1GB+
- **Storage**: 100MB+ free space for workspace and logs

### Language Server Protocol Dependencies

Install LSP servers for the languages you plan to analyze:

```bash
# TypeScript/JavaScript
npm install -g typescript-language-server typescript

# Go
go install golang.org/x/tools/gopls@latest

# Java (requires Java 11+)
# Download from https://download.eclipse.org/jdtls/snapshots/

# C/C++
# Install clangd (varies by platform)
# macOS: brew install llvm
# Ubuntu: apt install clangd
# Windows: Download from LLVM releases
```

## Installation

### Option 1: From npm (Recommended)

```bash
npm install -g effortlessly-mcp
```

### Option 2: From Source

```bash
git clone https://github.com/y-hirakaw/effortlessly-mcp.git
cd effortlessly-mcp
npm install
npm run build
npm link  # For global access
```

### Option 3: Development Installation

```bash
git clone https://github.com/y-hirakaw/effortlessly-mcp.git
cd effortlessly-mcp
npm install
npm run build:dev  # Development build with source maps
```

## Configuration

### Claude Code Integration

Add effortlessly-mcp to your Claude Code configuration:

#### Claude Code Configuration File

Create or update your Claude Code configuration:

```json
{
  "mcpServers": {
    "effortlessly-mcp": {
      "command": "effortlessly-mcp",
      "args": [],
      "env": {
        "NODE_ENV": "production"
      }
    }
  }
}
```

#### macOS Configuration Location
- Global: `~/Library/Application Support/Claude/config.json`
- Project: `.claude/config.json`

#### Linux Configuration Location
- Global: `~/.config/claude/config.json`
- Project: `.claude/config.json`

#### Windows Configuration Location
- Global: `%APPDATA%\\Claude\\config.json`
- Project: `.claude\\config.json`

### LSP Proxy Server Setup

The LSP Proxy Server runs separately to avoid stdio conflicts with MCP:

#### Automatic Startup (Recommended)

```bash
# Start LSP Proxy Server (runs on port 3001 by default)
effortlessly-lsp-proxy
```

#### Manual Configuration

```bash
# Custom port configuration
LSP_PORT=3002 effortlessly-lsp-proxy

# Debug mode
DEBUG=effortlessly-mcp:* effortlessly-lsp-proxy
```

#### Systemd Service (Linux)

Create `/etc/systemd/system/effortlessly-lsp-proxy.service`:

```ini
[Unit]
Description=effortlessly-mcp LSP Proxy Server
After=network.target

[Service]
Type=simple
User=your-username
WorkingDirectory=/home/your-username
ExecStart=/usr/local/bin/effortlessly-lsp-proxy
Restart=always
RestartSec=5
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

Enable and start:
```bash
sudo systemctl enable effortlessly-lsp-proxy
sudo systemctl start effortlessly-lsp-proxy
```

#### launchd Service (macOS)

Create `~/Library/LaunchAgents/com.effortlessly-mcp.lsp-proxy.plist`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.effortlessly-mcp.lsp-proxy</string>
    <key>ProgramArguments</key>
    <array>
        <string>/usr/local/bin/effortlessly-lsp-proxy</string>
    </array>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
    <key>StandardOutPath</key>
    <string>/tmp/effortlessly-lsp-proxy.log</string>
    <key>StandardErrorPath</key>
    <string>/tmp/effortlessly-lsp-proxy.error.log</string>
</dict>
</plist>
```

Load and start:
```bash
launchctl load ~/Library/LaunchAgents/com.effortlessly-mcp.lsp-proxy.plist
launchctl start com.effortlessly-mcp.lsp-proxy
```

## Workspace Configuration

### Creating a Workspace

Workspaces are automatically created when you activate them:

```javascript
// Using MCP client
await mcp.callTool('workspace_activate', {
  workspace_path: '/path/to/your/project',
  name: 'my-project', // Optional
  lsp_servers: ['typescript', 'go'], // Optional
  index_enabled: true // Optional
});
```

### Workspace Structure

effortlessly-mcp creates this structure in your Claude workspace:

```
.claude/workspace/effortlessly/
├── config/
│   ├── workspace.yaml      # Active workspace configuration
│   ├── security.yaml       # Security policies
│   └── whitelist.yaml      # Path whitelist
├── logs/
│   ├── audit/             # Security audit logs
│   ├── error/             # Error logs
│   └── debug/             # Debug information
├── index/
│   ├── symbols.db         # Symbol index (SQLite)
│   └── files.db           # File index (SQLite)
└── temp/                  # Temporary files
```

### Security Configuration

Create `.claude/workspace/effortlessly/config/security.yaml`:

```yaml
security:
  mode: strict                    # strict | permissive
  default_read_only: true         # Default to read-only operations
  
  allowed_paths:
    - "/home/user/projects/myproject/src"
    - "/home/user/projects/myproject/docs"
    - "/home/user/projects/myproject/tests"
  
  excluded_patterns:
    - "*.env"                     # Environment files
    - "*.key"                     # Key files
    - "*.pem"                     # Certificate files
    - "*.p12"                     # Certificate bundles
    - "config/secrets/*"          # Secret directories
    - ".git/**"                   # Git internals
    - "node_modules/**"           # Dependencies
    - ".vscode/settings.json"     # IDE secrets
    
  max_file_size: 104857600        # 100MB limit
  follow_symlinks: false          # Prevent symlink traversal
  enable_write_operations: false  # Disable write operations

  # Sensitive data patterns (automatically detected)
  sensitive_patterns:
    api_key: "[A-Za-z0-9]{32,}"
    password: "password\\s*[:=]\\s*[\"'].*?[\"']"
    jwt: "eyJ[A-Za-z0-9-_]+\\.[A-Za-z0-9-_]+\\.[A-Za-z0-9-_]+"
    aws_key: "AKIA[0-9A-Z]{16}"
    github_token: "ghp_[a-zA-Z0-9]{36}"
```

### Workspace Configuration

Edit `.claude/workspace/effortlessly/config/workspace.yaml`:

```yaml
workspace:
  name: "my-project"
  root_path: "/path/to/project"
  settings:
    index_enabled: true
    lsp_servers:
      - typescript
      - go
      - java
    auto_save_logs: true
    log_retention_days: 30
    max_file_size: 104857600     # 100MB
    excluded_patterns:
      - "*.env"
      - "*.key" 
      - "*.pem"
      - "node_modules/**"
      - ".git/**"
    follow_symlinks: false
```

## Testing Your Setup

### Health Check

```bash
# Test MCP server directly
echo '{"jsonrpc": "2.0", "id": 1, "method": "tools/list"}' | effortlessly-mcp

# Test LSP Proxy Server
curl http://localhost:3001/health
```

### Basic Usage Test

```javascript
// Test workspace activation
const workspaceResult = await mcp.callTool('workspace_activate', {
  workspace_path: '/path/to/test/project'
});

// Test file reading
const fileResult = await mcp.callTool('read_file', {
  file_path: '/path/to/test/file.ts'
});

// Test symbol search (requires LSP Proxy)
const symbolResult = await mcp.callTool('code_find_symbol', {
  symbol_name: 'function',
  search_type: 'fuzzy'
});
```

### Running Test Suite

```bash
# Run all tests
npm test

# Run specific test categories
npm test src/tests/performance/
npm test src/tests/security/
npm test src/tests/integration/
```

## Performance Tuning

### LSP Server Optimization

```yaml
# In workspace.yaml
lsp_optimization:
  typescript:
    memory_limit: "2GB"
    exclude_patterns:
      - "node_modules/**"
      - "dist/**"
      - "build/**"
  
  go:
    build_flags: ["-tags", "dev"]
    
  java:
    vm_args: ["-Xmx1G", "-XX:+UseG1GC"]
```

### Indexing Configuration

```yaml
# In workspace.yaml
indexing:
  enabled: true
  batch_size: 1000              # Files processed per batch
  parallel_workers: 4           # Number of parallel indexing workers
  incremental_updates: true     # Only re-index changed files
  
  file_types:
    - ".ts"
    - ".js"
    - ".go"
    - ".java"
    - ".py"
    - ".cpp"
    - ".hpp"
```

### Memory Management

```yaml
# In workspace.yaml
performance:
  max_memory_usage: "500MB"      # Maximum memory per process
  gc_interval: 300000            # Garbage collection interval (ms)
  cache_size: 1000               # Symbol cache size
  max_concurrent_operations: 10  # Limit concurrent operations
```

## Backup and Recovery

### Configuration Backup

```bash
# Backup workspace configuration
cp -r .claude/workspace/effortlessly/config/ ~/backups/effortlessly-config-$(date +%Y%m%d)/

# Automated backup script
#!/bin/bash
BACKUP_DIR="$HOME/backups/effortlessly-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$BACKUP_DIR"
cp -r .claude/workspace/effortlessly/config/ "$BACKUP_DIR/"
echo "Backup created: $BACKUP_DIR"
```

### Index Recovery

```bash
# Rebuild indexes if corrupted
rm .claude/workspace/effortlessly/index/*.db

# Restart with forced re-indexing
effortlessly-mcp --rebuild-index
```

### Log Rotation

```yaml
# In workspace.yaml
logging:
  rotation:
    max_file_size: "100MB"
    max_files: 10
    compress_old: true
  
  retention:
    audit_logs: 90              # Days to keep audit logs
    error_logs: 30              # Days to keep error logs
    debug_logs: 7               # Days to keep debug logs
```

## Production Deployment

### Docker Deployment

```dockerfile
FROM node:20-alpine

# Create non-root user
RUN addgroup -g 1001 -S effortlessly && \
    adduser -S effortlessly -u 1001

# Install dependencies
RUN apk --no-cache add dumb-init

# Set working directory
WORKDIR /app

# Copy and install application
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

COPY . .

# Switch to non-root user
USER effortlessly

# Security labels
LABEL security.scan="required"
LABEL security.level="high"

# Use dumb-init for signal handling
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "build/index.js"]
```

### Kubernetes Deployment

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: effortlessly-mcp
spec:
  replicas: 1
  selector:
    matchLabels:
      app: effortlessly-mcp
  template:
    metadata:
      labels:
        app: effortlessly-mcp
    spec:
      securityContext:
        runAsNonRoot: true
        runAsUser: 1001
        runAsGroup: 1001
        fsGroup: 1001
        
      containers:
      - name: effortlessly-mcp
        image: effortlessly-mcp:latest
        securityContext:
          allowPrivilegeEscalation: false
          capabilities:
            drop:
            - ALL
          readOnlyRootFilesystem: true
          
        resources:
          limits:
            memory: "1Gi"
            cpu: "500m"
          requests:
            memory: "256Mi"
            cpu: "100m"
            
        volumeMounts:
        - name: workspace
          mountPath: /app/workspace
          
      volumes:
      - name: workspace
        persistentVolumeClaim:
          claimName: effortlessly-workspace
```

### Security Hardening

```bash
# File permissions
chmod 600 .claude/workspace/effortlessly/config/*
chmod 700 .claude/workspace/effortlessly/logs/audit/

# SELinux (if enabled)
setsebool -P httpd_execmem off
setsebool -P httpd_enable_homedirs off

# AppArmor profile (Ubuntu)
sudo cp /etc/apparmor.d/usr.local.bin.effortlessly-mcp /etc/apparmor.d/
sudo apparmor_parser -r /etc/apparmor.d/usr.local.bin.effortlessly-mcp
```

## Environment Variables

```bash
# Core configuration
export NODE_ENV=production
export LOG_LEVEL=info
export WORKSPACE_ROOT=/path/to/workspace

# LSP Proxy configuration
export LSP_PORT=3001
export LSP_HOST=127.0.0.1
export LSP_TIMEOUT=30000

# Security configuration
export SECURITY_MODE=strict
export MAX_FILE_SIZE=104857600
export ENABLE_AUDIT_LOGGING=true

# Performance tuning
export MAX_MEMORY=500MB
export GC_INTERVAL=300000
export MAX_CONCURRENT_OPS=10

# Debug settings
export DEBUG=effortlessly-mcp:*
export VERBOSE_LOGGING=false
```

## Migration and Upgrades

### Version Compatibility

effortlessly-mcp follows semantic versioning:
- **Major version** (X.0.0): Breaking changes
- **Minor version** (0.X.0): New features, backward compatible
- **Patch version** (0.0.X): Bug fixes, backward compatible

### Upgrade Process

```bash
# 1. Backup current configuration
cp -r .claude/workspace/effortlessly/ ~/backup-effortlessly-$(date +%Y%m%d)/

# 2. Update effortlessly-mcp
npm update -g effortlessly-mcp

# 3. Verify installation
effortlessly-mcp --version

# 4. Test with existing workspace
effortlessly-mcp --config-check

# 5. Migrate configuration if needed
effortlessly-mcp --migrate-config
```

### Breaking Changes

#### v1.0.0 → v2.0.0 (Future)
- Configuration format changes
- New security requirements
- LSP protocol updates

## Next Steps

1. **Activate your first workspace** using `workspace_activate`
2. **Configure security policies** based on your requirements
3. **Test symbol search** with your codebase
4. **Set up monitoring** using the audit logs
5. **Integrate with CI/CD** for automated code analysis

For troubleshooting and advanced configuration, see [TROUBLESHOOTING.md](./TROUBLESHOOTING.md).

---

**effortlessly-mcp Setup Guide** - Version 1.0.0

Complete setup documentation for enterprise-grade code analysis with MCP integration.