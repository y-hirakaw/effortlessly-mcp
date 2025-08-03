# Security Guidelines - effortlessly-mcp

Comprehensive security guidelines for deploying and operating effortlessly-mcp in enterprise environments.

## Security Architecture

### Security-by-Default Design

effortlessly-mcp implements a **security-first architecture** with the following core principles:

1. **🔒 Default Deny**: All operations are restricted by default
2. **🎯 Explicit Allow**: Only explicitly permitted operations are allowed
3. **📝 Complete Audit**: Every operation is logged with full context
4. **🚫 Offline Only**: No external network communication
5. **🛡️ Defense in Depth**: Multiple layers of security controls

### Trust Model

```
┌─────────────────────────────────────┐
│          Claude Code Client         │  ← Trusted User Interface
└─────────────────┬───────────────────┘
                  │ MCP Protocol (stdio)
┌─────────────────▼───────────────────┐
│        effortlessly-mcp Server      │  ← Security Enforcement Point
├─────────────────────────────────────┤
│         Security Middleware         │  ← Access Control & Validation
├─────────────────────────────────────┤
│        LSP Proxy Integration        │  ← Isolated Process Communication
└─────────────────┬───────────────────┘
                  │ HTTP REST API
┌─────────────────▼───────────────────┐
│         LSP Servers (Isolated)      │  ← Language-specific Analysis
└─────────────────────────────────────┘
```

## Access Control

### Workspace-Based Security

#### Workspace Isolation
Each project operates in an isolated workspace:
```
.claude/workspace/effortlessly/
├── config/
│   ├── workspace.yaml       # Project configuration
│   ├── security.yaml        # Security policies
│   └── whitelist.yaml       # Allowed paths
├── logs/
│   ├── audit/              # Security audit logs
│   ├── error/              # Error logs
│   └── debug/              # Debug information
└── index/                  # Cached data (encrypted)
```

#### Path Whitelist Configuration

**Strict Path Control** - Only explicitly allowed paths are accessible:

```yaml
# .claude/workspace/effortlessly/config/security.yaml
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
```

### Permission Model

#### Operation Categories

1. **READ_ONLY** (Default)
   - `read_file`
   - `list_directory`
   - `get_file_metadata`
   - `search_files`
   - `code_find_symbol`
   - `code_find_references`

2. **WORKSPACE_MANAGEMENT** (Controlled)
   - `workspace_activate`
   - `workspace_get_info`
   - `workspace_list_all`

3. **WRITE_OPERATIONS** (Explicitly Disabled)
   - File creation/modification
   - Directory manipulation
   - System configuration changes

#### Permission Escalation Prevention

```typescript
// Security validation pipeline
class SecurityManager {
  validateOperation(operation: string, params: any): SecurityResult {
    // 1. Check operation permissions
    if (!this.isOperationAllowed(operation)) {
      throw new SecurityError('Operation not permitted');
    }
    
    // 2. Validate parameters
    if (!this.validateParameters(params)) {
      throw new ValidationError('Invalid parameters');
    }
    
    // 3. Check path whitelist
    if (!this.isPathAllowed(params.file_path)) {
      throw new SecurityError('Path access denied');
    }
    
    // 4. Audit logging
    this.auditLogger.log(operation, params);
    
    return { allowed: true };
  }
}
```

## Data Protection

### Sensitive Information Detection

**Automatic Pattern Detection** for common sensitive data:

```typescript
const SENSITIVE_PATTERNS = {
  // API Keys and Tokens
  api_key: /(?:api[_-]?key|apikey)[\s]*[:=][\s]*['"]*([a-zA-Z0-9]{20,})['"]*$/i,
  github_token: /ghp_[a-zA-Z0-9]{36}/,
  slack_token: /xox[baprs]-[0-9a-zA-Z-]{10,}/,
  jwt_token: /eyJ[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+/,
  
  // Credentials
  password: /(?:password|pwd|pass)[\s]*[:=][\s]*['"]*([^'"\s]+)['"]*$/i,
  database_url: /(mongodb|postgres|mysql):\/\/[^\s'"]+/,
  connection_string: /(?:server|host)=[^;]+;.*(?:password|pwd)=[^;]+/i,
  
  // Cloud Provider Keys
  aws_access_key: /AKIA[0-9A-Z]{16}/,
  aws_secret_key: /[0-9a-zA-Z/+]{40}/,
  gcp_key: /"private_key":\s*"-----BEGIN PRIVATE KEY-----/,
  azure_key: /DefaultEndpointsProtocol=https;AccountName=[^;]+;AccountKey=[^;]+/,
  
  // Private Keys and Certificates
  private_key: /-----BEGIN (?:RSA |EC |DSA )?PRIVATE KEY-----/,
  certificate: /-----BEGIN CERTIFICATE-----/,
  ssh_key: /ssh-(?:rsa|dss|ed25519) [A-Za-z0-9+/]+/,
  
  // Personal Information
  credit_card: /\b(?:4[0-9]{12}(?:[0-9]{3})?|5[1-5][0-9]{14}|3[47][0-9]{13}|3[0-9]{13}|6(?:011|5[0-9]{2})[0-9]{12})\b/,
  ssn: /\b\d{3}-\d{2}-\d{4}\b/,
  email: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/
};
```

### Data Masking Strategy

When sensitive data is detected:

1. **LOG MASKING**: Sensitive values are replaced with `[REDACTED]` in logs
2. **RESPONSE FILTERING**: API responses exclude or mask sensitive content
3. **AUDIT NOTIFICATION**: Security team is notified of sensitive data access
4. **QUARANTINE**: Files containing secrets can be quarantined

```typescript
function maskSensitiveData(content: string): string {
  let masked = content;
  
  for (const [type, pattern] of Object.entries(SENSITIVE_PATTERNS)) {
    masked = masked.replace(pattern, (match) => {
      const maskedLength = Math.min(match.length, 8);
      return `[${type.toUpperCase()}_REDACTED_${maskedLength}]`;
    });
  }
  
  return masked;
}
```

## Network Security

### Offline-First Architecture

effortlessly-mcp operates in **complete network isolation**:

- ❌ **No Outbound Connections**: Zero external HTTP/HTTPS requests
- ❌ **No Remote Dependencies**: All functionality is self-contained
- ❌ **No Telemetry**: No usage analytics or crash reporting
- ✅ **Local LSP Communication**: Only localhost HTTP for LSP proxy
- ✅ **File System Only**: All data storage is local

### LSP Proxy Security

The LSP Proxy Server (`localhost:3001`) implements additional security:

```typescript
// LSP Proxy Security Configuration
const SECURITY_CONFIG = {
  // Network binding
  interface: '127.0.0.1',           // Localhost only
  port: 3001,                       // Configurable port
  
  // Request validation
  max_request_size: '10MB',         // Prevent DoS
  rate_limit: '100/minute',         # Rate limiting
  timeout: '30s',                   // Request timeout
  
  // Process isolation
  lsp_process_jail: true,           // Isolate LSP processes
  memory_limit: '500MB',            // Per-process memory limit
  cpu_limit: '50%',                 // CPU usage limit
};
```

## Audit and Compliance

### Comprehensive Audit Logging

**All operations are logged** with complete context:

```json
{
  "timestamp": "2025-01-01T12:00:00.000Z",
  "session_id": "sess_abc123",
  "operation": "read_file",
  "user": "system",
  "tool": "read_file",
  "parameters": {
    "file_path": "/project/src/config.ts",
    "encoding": "utf-8"
  },
  "result": {
    "status": "success",
    "size_bytes": 2048,
    "duration_ms": 45
  },
  "security_context": {
    "path_authorized": true,
    "whitelist_rule": "allowed_paths[0]",
    "sensitive_data_detected": false,
    "operation_permitted": true
  },
  "client_info": {
    "source": "claude-code",
    "version": "1.0.0"
  }
}
```

### Audit Log Protection

Audit logs are protected against tampering:

- **Immutable Storage**: Append-only log files
- **Integrity Verification**: Cryptographic checksums
- **Rotation Policy**: Configurable retention periods
- **Access Control**: Root-only access to audit directories

```yaml
# Audit Configuration
audit:
  enabled: true
  retention_days: 90              # Configurable retention
  log_level: 'info'               # error | warn | info | debug
  include_parameters: true        # Log operation parameters
  include_results: false          # Exclude result content for privacy
  integrity_check: true           # Enable checksum verification
  
  # Log rotation
  max_file_size: '100MB'
  max_files: 10
  compress_old: true
```

### Compliance Features

#### SOX Compliance
- Complete audit trail of all code access
- Immutable log storage with integrity verification
- Access control and user accountability

#### GDPR Compliance
- No personal data collection by default
- Data subject deletion capabilities
- Audit log anonymization options

#### SOC 2 Type II
- Security control documentation
- Monitoring and alerting capabilities
- Incident response procedures

## Threat Model and Mitigations

### Identified Threats

#### 1. **Path Traversal Attacks**
**Threat**: Malicious path manipulation to access unauthorized files

**Mitigations**:
- Strict path validation and normalization
- Whitelist-based path authorization
- Symlink detection and prevention
- Chroot-like workspace isolation

```typescript
function validatePath(inputPath: string, workspaceRoot: string): string {
  // 1. Normalize path
  const normalized = path.resolve(path.normalize(inputPath));
  
  // 2. Ensure within workspace
  if (!normalized.startsWith(workspaceRoot)) {
    throw new SecurityError('Path outside workspace');
  }
  
  // 3. Check whitelist
  if (!isPathWhitelisted(normalized)) {
    throw new SecurityError('Path not in whitelist');
  }
  
  // 4. Detect symlinks
  if (isSymbolicLink(normalized)) {
    throw new SecurityError('Symlink access denied');
  }
  
  return normalized;
}
```

#### 2. **Code Injection via LSP**
**Threat**: Malicious code execution through LSP communication

**Mitigations**:
- Process isolation for LSP servers
- Input validation for all LSP requests
- Sandboxed LSP execution environment
- Memory and CPU limits

#### 3. **Sensitive Data Exposure**
**Threat**: Accidental exposure of secrets in logs or responses

**Mitigations**:
- Automatic sensitive pattern detection
- Response filtering and masking
- Audit log sanitization
- File quarantine for detected secrets

#### 4. **Resource Exhaustion (DoS)**
**Threat**: Resource consumption attacks

**Mitigations**:
- File size limits (100MB default)
- Request rate limiting
- Memory usage monitoring
- CPU time limits for operations

### Security Incident Response

#### Detection
1. **Automated Monitoring**: Anomaly detection in audit logs
2. **Alert Triggers**: Failed security validations
3. **Performance Monitoring**: Resource usage spikes

#### Response Procedure
1. **Immediate**: Block suspicious operations
2. **Investigation**: Review audit logs and context
3. **Containment**: Isolate affected workspace
4. **Recovery**: Restore from known-good state
5. **Post-Incident**: Update security policies

## Deployment Security

### Production Deployment

#### Environment Hardening
```bash
# 1. Create dedicated user
sudo useradd -r -s /bin/false effortlessly-mcp

# 2. Set up workspace directory
sudo mkdir -p /var/lib/effortlessly-mcp
sudo chown effortlessly-mcp:effortlessly-mcp /var/lib/effortlessly-mcp
sudo chmod 750 /var/lib/effortlessly-mcp

# 3. Configure file permissions
sudo chmod 600 /etc/effortlessly-mcp/config/*
sudo chown root:effortlessly-mcp /etc/effortlessly-mcp/config/*

# 4. Set up log directory
sudo mkdir -p /var/log/effortlessly-mcp
sudo chown effortlessly-mcp:adm /var/log/effortlessly-mcp
sudo chmod 750 /var/log/effortlessly-mcp
```

#### Systemd Service Configuration
```ini
[Unit]
Description=effortlessly-mcp Server
After=network.target

[Service]
Type=simple
User=effortlessly-mcp
Group=effortlessly-mcp
WorkingDirectory=/var/lib/effortlessly-mcp
ExecStart=/usr/local/bin/effortlessly-mcp
Restart=always
RestartSec=5

# Security hardening
NoNewPrivileges=yes
PrivateTmp=yes
ProtectSystem=strict
ProtectHome=yes
ReadWritePaths=/var/lib/effortlessly-mcp /var/log/effortlessly-mcp

# Resource limits
LimitNOFILE=65536
LimitNPROC=4096
MemoryMax=1G

[Install]
WantedBy=multi-user.target
```

### Container Security

#### Docker Security Configuration
```dockerfile
FROM node:20-alpine AS base

# Create non-root user
RUN addgroup -g 1001 -S effortlessly && \
    adduser -S effortlessly -u 1001

# Security: no package manager cache
RUN apk --no-cache add dumb-init

# Switch to non-root user
USER effortlessly
WORKDIR /app

# Copy application
COPY --chown=effortlessly:effortlessly . .

# Install dependencies
RUN npm ci --only=production && npm cache clean --force

# Security: use dumb-init to handle signals
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "build/index.js"]

# Security labels
LABEL security.scan="required"
LABEL security.level="high"
```

#### Kubernetes Security Context
```yaml
apiVersion: v1
kind: Pod
spec:
  securityContext:
    runAsNonRoot: true
    runAsUser: 1001
    runAsGroup: 1001
    fsGroup: 1001
    
  containers:
  - name: effortlessly-mcp
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
```

## Security Monitoring

### Metrics and Alerting

#### Key Security Metrics
- Authentication failure rate
- Path traversal attempts
- Sensitive data access events
- Resource usage anomalies
- LSP process crashes

#### Alert Configuration
```yaml
alerts:
  - name: "Security Violation"
    condition: "security_error_rate > 10/hour"
    severity: "critical"
    action: "block_operations"
    
  - name: "Sensitive Data Access"
    condition: "sensitive_data_detected == true"
    severity: "warning"
    action: "notify_security_team"
    
  - name: "Resource Exhaustion"
    condition: "memory_usage > 90% OR cpu_usage > 90%"
    severity: "warning"
    action: "throttle_operations"
```

### Security Health Checks

Regular security validation:

```bash
#!/bin/bash
# Security health check script

# 1. Verify file permissions
find /var/lib/effortlessly-mcp -type f -perm /o+w | wc -l

# 2. Check audit log integrity
sha256sum -c /var/log/effortlessly-mcp/audit/checksums.txt

# 3. Validate configuration
effortlessly-mcp --config-check

# 4. Test security controls
effortlessly-mcp --security-test

# 5. Monitor for sensitive data
grep -r "password\|key\|secret" /var/log/effortlessly-mcp/
```

## Security Best Practices

### For Administrators

1. **Least Privilege**: Grant minimal necessary permissions
2. **Regular Updates**: Keep effortlessly-mcp and dependencies updated
3. **Monitor Logs**: Review audit logs regularly
4. **Backup Security**: Secure backup of configurations and logs
5. **Incident Planning**: Develop incident response procedures

### For Developers

1. **Secure Configuration**: Use security.yaml templates
2. **Path Restrictions**: Limit workspace paths to project directories
3. **Secret Management**: Never commit secrets to repositories
4. **Code Review**: Review MCP tool usage in applications
5. **Testing**: Include security tests in CI/CD pipelines

### For Security Teams

1. **Continuous Monitoring**: Implement automated security monitoring
2. **Threat Modeling**: Regular security assessment updates
3. **Penetration Testing**: Periodic security testing
4. **Compliance**: Ensure regulatory compliance requirements
5. **Training**: Security awareness for development teams

## Security Contact

For security issues and vulnerabilities:

- **Security Email**: security@effortlessly-mcp.dev
- **PGP Key**: Available at https://keybase.io/effortlessly-mcp
- **Disclosure Policy**: Coordinated disclosure with 90-day timeline
- **Bug Bounty**: Contact for responsible disclosure rewards

---

**effortlessly-mcp Security Guidelines** - Version 1.0.0

Maintaining enterprise-grade security for code analysis and semantic search operations.