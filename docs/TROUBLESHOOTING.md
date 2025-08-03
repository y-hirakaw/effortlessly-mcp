# Troubleshooting Guide - effortlessly-mcp

Comprehensive troubleshooting guide for common issues and advanced debugging.

## Common Issues

### 1. MCP Server Not Starting

#### Symptoms
- Claude Code shows "Server failed to start" error
- MCP connection timeout
- Process exits immediately

#### Diagnosis
```bash
# Test MCP server directly
echo '{"jsonrpc": "2.0", "id": 1, "method": "initialize", "params": {"protocolVersion": "2024-11-05", "capabilities": {}}}' | effortlessly-mcp

# Check Node.js version
node --version  # Should be 20.0.0+

# Verify installation
which effortlessly-mcp
effortlessly-mcp --version
```

#### Solutions

**Solution 1: Reinstall effortlessly-mcp**
```bash
npm uninstall -g effortlessly-mcp
npm cache clean --force
npm install -g effortlessly-mcp
```

**Solution 2: Check permissions**
```bash
# macOS/Linux
ls -la $(which effortlessly-mcp)
chmod +x $(which effortlessly-mcp)

# Windows (PowerShell)
Get-Acl (Get-Command effortlessly-mcp).Source
```

**Solution 3: Environment conflicts**
```bash
# Clear Node.js cache
npm cache clean --force
rm -rf node_modules package-lock.json  # If in project directory

# Check for conflicting packages
npm list -g --depth=0 | grep mcp
```

### 2. LSP Proxy Server Issues

#### Symptoms
- Symbol search returns empty results
- LSP health check fails
- Port 3001 connection refused

#### Diagnosis
```bash
# Check if LSP Proxy is running
curl http://localhost:3001/health
lsof -i :3001

# Check for port conflicts
netstat -tulpn | grep :3001  # Linux
lsof -i :3001                # macOS

# Test LSP dependencies
typescript-language-server --version
gopls version
clangd --version
```

#### Solutions

**Solution 1: Start LSP Proxy Server**
```bash
# Kill existing processes
lsof -ti :3001 | xargs kill -9

# Start fresh
effortlessly-lsp-proxy
```

**Solution 2: Change port**
```bash
# Use different port
LSP_PORT=3002 effortlessly-lsp-proxy

# Update MCP server configuration
export LSP_PORT=3002
```

**Solution 3: Install missing LSP servers**
```bash
# TypeScript
npm install -g typescript-language-server typescript

# Go
go install golang.org/x/tools/gopls@latest

# Verify PATH
echo $PATH
which typescript-language-server
which gopls
```

### 3. Symbol Search Not Working

#### Symptoms
- `code_find_symbol` returns no results
- TypeScript symbols not found
- "No Project" error in logs

#### Diagnosis
```bash
# Check LSP Proxy status
curl http://localhost:3001/lsps/status

# Test symbol search directly
curl -X POST http://localhost:3001/symbols/search \
  -H "Content-Type: application/json" \
  -d '{"query": "function", "languages": ["typescript"]}'

# Check workspace structure
ls -la tsconfig.json package.json  # For TypeScript projects
ls -la go.mod go.sum               # For Go projects
```

#### Solutions

**Solution 1: Configure TypeScript project**
```bash
# Create tsconfig.json if missing
cat > tsconfig.json << EOF
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "node",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "build", "dist"]
}
EOF
```

**Solution 2: Restart LSP services**
```bash
# Kill and restart LSP Proxy
pkill -f "effortlessly-lsp-proxy"
effortlessly-lsp-proxy

# Wait for initialization
sleep 5
curl http://localhost:3001/health
```

**Solution 3: Check workspace activation**
```javascript
// Re-activate workspace
await mcp.callTool('workspace_activate', {
  workspace_path: '/absolute/path/to/project',
  lsp_servers: ['typescript', 'go']
});
```

### 4. File Access Denied

#### Symptoms
- "Path access denied" errors
- Security validation failures
- Whitelist violations

#### Diagnosis
```bash
# Check workspace configuration
cat .claude/workspace/effortlessly/config/security.yaml

# Verify file permissions
ls -la /path/to/blocked/file

# Check current workspace
cat .claude/workspace/effortlessly/config/workspace.yaml
```

#### Solutions

**Solution 1: Update security configuration**
```yaml
# Edit .claude/workspace/effortlessly/config/security.yaml
security:
  mode: permissive  # Temporary for testing
  allowed_paths:
    - "/your/project/path"
    - "/additional/allowed/path"
```

**Solution 2: Use absolute paths**
```javascript
// Convert relative to absolute paths
const path = require('path');
const absolutePath = path.resolve('./relative/path');

await mcp.callTool('read_file', {
  file_path: absolutePath  // Use absolute path
});
```

**Solution 3: Check symlinks**
```bash
# Find and resolve symlinks
ls -la | grep "^l"
realpath /path/with/symlinks
```

### 5. Performance Issues

#### Symptoms
- Slow symbol search (>5 seconds)
- High memory usage
- Timeout errors

#### Diagnosis
```bash
# Monitor resource usage
top -p $(pgrep effortlessly)
ps aux | grep effortlessly

# Check index status
ls -la .claude/workspace/effortlessly/index/
sqlite3 .claude/workspace/effortlessly/index/symbols.db ".tables"

# Monitor LSP Proxy
curl http://localhost:3001/lsps/status
```

#### Solutions

**Solution 1: Rebuild indexes**
```bash
# Clear old indexes
rm .claude/workspace/effortlessly/index/*.db

# Force re-indexing
effortlessly-mcp --rebuild-index
```

**Solution 2: Optimize workspace**
```yaml
# In workspace.yaml
performance:
  max_memory_usage: "1GB"
  cache_size: 2000
  excluded_patterns:
    - "node_modules/**"
    - "dist/**"
    - "build/**"
    - ".git/**"
```

**Solution 3: Limit concurrent operations**
```yaml
# In workspace.yaml
performance:
  max_concurrent_operations: 5
  indexing:
    batch_size: 500
    parallel_workers: 2
```

### 6. Memory Leaks

#### Symptoms
- Steadily increasing memory usage
- Process killed by OS
- Out of memory errors

#### Diagnosis
```bash
# Monitor memory over time
while true; do
  ps -o pid,vsz,rss,comm -p $(pgrep effortlessly)
  sleep 10
done

# Check for memory leaks in Node.js
node --inspect effortlessly-mcp
# Open chrome://inspect in browser
```

#### Solutions

**Solution 1: Enable garbage collection**
```bash
# Run with GC optimization
node --max-old-space-size=1024 --expose-gc effortlessly-mcp
```

**Solution 2: Restart services periodically**
```bash
# Systemd service with restart
[Service]
Restart=always
RestartSec=3600  # Restart every hour
```

**Solution 3: Memory limits**
```yaml
# In workspace.yaml
performance:
  max_memory_usage: "500MB"
  gc_interval: 300000  # 5 minutes
```

## Advanced Debugging

### 1. Enable Debug Logging

```bash
# Full debug output
DEBUG=effortlessly-mcp:* effortlessly-mcp

# Specific subsystems
DEBUG=effortlessly-mcp:lsp,effortlessly-mcp:security effortlessly-mcp

# Log to file
DEBUG=effortlessly-mcp:* effortlessly-mcp 2>&1 | tee debug.log
```

### 2. MCP Protocol Debugging

```bash
# Test MCP messages directly
echo '{"jsonrpc": "2.0", "id": 1, "method": "tools/list"}' | effortlessly-mcp | jq

# Validate MCP responses
echo '{"jsonrpc": "2.0", "id": 1, "method": "tools/call", "params": {"name": "echo", "arguments": {"message": "test"}}}' | effortlessly-mcp | jq
```

### 3. LSP Protocol Debugging

```bash
# Debug LSP communication
curl -X POST http://localhost:3001/symbols/search \
  -H "Content-Type: application/json" \
  -d '{"query": "test", "languages": ["typescript"]}' | jq

# Check LSP server logs
tail -f .claude/workspace/effortlessly/logs/debug/lsp-*.log
```

### 4. Security Audit Debugging

```bash
# Check audit logs
tail -f .claude/workspace/effortlessly/logs/audit/$(date +%Y-%m-%d).log

# Validate security patterns
cat .claude/workspace/effortlessly/logs/audit/*.log | jq '.security_context'
```

### 5. Performance Profiling

```bash
# Profile with Node.js
node --prof effortlessly-mcp
node --prof-process isolate-*.log > profile.txt

# Memory profiling
node --inspect --max-old-space-size=1024 effortlessly-mcp
# Use Chrome DevTools for memory analysis
```

## Error Reference

### Error Codes and Solutions

#### ECONNREFUSED (LSP_PROXY_UNAVAILABLE)
```
Error: connect ECONNREFUSED 127.0.0.1:3001
```
**Solution**: Start LSP Proxy Server
```bash
effortlessly-lsp-proxy
```

#### EACCES (PERMISSION_DENIED)
```
Error: EACCES: permission denied, open '/restricted/file'
```
**Solution**: Update security configuration or check file permissions

#### EMFILE (TOO_MANY_FILES)
```
Error: EMFILE: too many open files
```
**Solution**: Increase file descriptor limit
```bash
ulimit -n 4096
```

#### ENOMEM (OUT_OF_MEMORY)
```
Error: Cannot allocate memory
```
**Solution**: Increase memory limits or optimize workspace

#### MCP_INVALID_REQUEST
```
Error: Invalid MCP request format
```
**Solution**: Validate JSON-RPC 2.0 format
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "tool_name",
    "arguments": {}
  }
}
```

#### LSP_SERVER_NOT_FOUND
```
Error: TypeScript language server not found
```
**Solution**: Install required LSP server
```bash
npm install -g typescript-language-server typescript
```

#### WORKSPACE_NOT_ACTIVATED
```
Error: No active workspace
```
**Solution**: Activate workspace first
```javascript
await mcp.callTool('workspace_activate', {
  workspace_path: '/path/to/project'
});
```

#### SECURITY_VIOLATION
```
Error: Path traversal attempt detected
```
**Solution**: Use absolute paths within allowed directories

## Recovery Procedures

### 1. Complete Reset

```bash
# Stop all services
pkill -f "effortlessly"

# Backup current state
cp -r .claude/workspace/effortlessly/ ~/backup-$(date +%Y%m%d)/

# Clean installation
rm -rf .claude/workspace/effortlessly/
npm uninstall -g effortlessly-mcp
npm install -g effortlessly-mcp

# Restart services
effortlessly-lsp-proxy &
```

### 2. Index Corruption Recovery

```bash
# Detect corruption
sqlite3 .claude/workspace/effortlessly/index/symbols.db "PRAGMA integrity_check;"

# Rebuild if corrupted
rm .claude/workspace/effortlessly/index/*.db
effortlessly-mcp --rebuild-index
```

### 3. Configuration Recovery

```bash
# Restore from backup
cp -r ~/backup-effortlessly-*/config/ .claude/workspace/effortlessly/

# Or create minimal configuration
mkdir -p .claude/workspace/effortlessly/config/
cat > .claude/workspace/effortlessly/config/workspace.yaml << EOF
workspace:
  name: "default"
  settings:
    index_enabled: true
    lsp_servers: ["typescript"]
EOF
```

## Monitoring and Maintenance

### 1. Health Monitoring

Create monitoring script:
```bash
#!/bin/bash
# health-check.sh

MCP_STATUS=$(echo '{"jsonrpc": "2.0", "id": 1, "method": "tools/list"}' | effortlessly-mcp | jq -r '.result' 2>/dev/null)
LSP_STATUS=$(curl -s http://localhost:3001/health | jq -r '.status' 2>/dev/null)

if [ "$MCP_STATUS" = "null" ] || [ "$LSP_STATUS" != "healthy" ]; then
  echo "ALERT: effortlessly-mcp unhealthy"
  # Send notification or restart services
fi
```

### 2. Log Rotation

```bash
# Automatic log cleanup
find .claude/workspace/effortlessly/logs/ -name "*.log" -mtime +30 -delete

# Compress old logs
find .claude/workspace/effortlessly/logs/ -name "*.log" -mtime +7 -exec gzip {} \;
```

### 3. Performance Monitoring

```bash
# Resource usage alerts
#!/bin/bash
MEMORY_USAGE=$(ps -o %mem -p $(pgrep effortlessly) | tail -n 1)
if (( $(echo "$MEMORY_USAGE > 80" | bc -l) )); then
  echo "WARNING: High memory usage: $MEMORY_USAGE%"
fi
```

## Getting Help

### 1. Diagnostic Information

When reporting issues, include:

```bash
# System information
uname -a
node --version
npm --version

# effortlessly-mcp version
effortlessly-mcp --version

# LSP server versions
typescript-language-server --version
gopls version

# Configuration
cat .claude/workspace/effortlessly/config/workspace.yaml
cat .claude/workspace/effortlessly/config/security.yaml

# Recent logs
tail -n 50 .claude/workspace/effortlessly/logs/error/$(date +%Y-%m-%d).log
```

### 2. Creating Minimal Reproduction

```bash
# Create test workspace
mkdir test-effortlessly
cd test-effortlessly

# Minimal TypeScript project
echo '{"name": "test", "dependencies": {}}' > package.json
echo '{"compilerOptions": {"target": "ES2020"}}' > tsconfig.json
echo 'function test() { return "hello"; }' > test.ts

# Test with effortlessly-mcp
effortlessly-lsp-proxy &
sleep 5

# Test MCP calls
echo '{"jsonrpc": "2.0", "id": 1, "method": "tools/call", "params": {"name": "workspace_activate", "arguments": {"workspace_path": "'$(pwd)'"}}}' | effortlessly-mcp

echo '{"jsonrpc": "2.0", "id": 2, "method": "tools/call", "params": {"name": "code_find_symbol", "arguments": {"symbol_name": "test"}}}' | effortlessly-mcp
```

### 3. Community Resources

- **GitHub Issues**: https://github.com/y-hirakaw/effortlessly-mcp/issues
- **Documentation**: https://github.com/y-hirakaw/effortlessly-mcp/docs
- **Security Issues**: security@effortlessly-mcp.dev

### 4. Professional Support

For enterprise users:
- **Priority Support**: Available for enterprise licenses
- **Custom Integration**: Professional services available
- **Training**: On-site training for development teams

---

**effortlessly-mcp Troubleshooting Guide** - Version 1.0.0

Comprehensive troubleshooting for enterprise-grade code analysis and MCP integration.