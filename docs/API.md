# effortlessly-mcp API Documentation

Comprehensive API documentation for effortlessly-mcp Model Context Protocol Server.

## Overview

effortlessly-mcp provides a secure, enterprise-grade MCP server with advanced code analysis capabilities through LSP integration and comprehensive file management tools.

### Key Features

- **🔒 Security-First Design**: Default read-only operations with explicit permission model
- **🌐 Multi-Language LSP Support**: TypeScript, Go, Java, C++ semantic analysis
- **⚡ High Performance**: Sub-100ms response times for most operations
- **🛡️ Enterprise Security**: Comprehensive audit logging and sensitive data protection
- **📁 Workspace Management**: Isolated project environments with YAML configuration

## Architecture

```
┌─────────────────────────────────────┐
│         MCP Protocol Layer          │  ← Claude Code Interface
├─────────────────────────────────────┤
│        Security Middleware          │  ← Access Control & Audit
├─────────────────────────────────────┤
│         Tool Handlers               │  ← 11 Available Tools
├─────────────────────────────────────┤
│    Core Services (LSP, FS, etc)    │  ← File System & LSP Proxy
├─────────────────────────────────────┤
│       Storage & Logging             │  ← SQLite + Audit Logs
└─────────────────────────────────────┘
```

### LSP Proxy Architecture

**Revolutionary stdio Conflict Resolution**:
```
Claude Code Client
    ↓ (MCP over stdio)
MCP Server (effortlessly-mcp)
    ↓ (HTTP REST API)
LSP Proxy Server (localhost:3001)
    ↓ (LSP over stdio)
TypeScript/Python/Go/etc LSP Servers
```

## Available Tools

### 📁 File Operations

#### `read_file`
Securely read file contents with encoding support.

**Parameters:**
- `file_path` (string, required): Absolute or relative path to file
- `encoding` (string, optional): File encoding (default: 'utf-8')

**Returns:**
```json
{
  "content": "file contents",
  "size": 1234,
  "encoding": "utf-8",
  "file_path": "/absolute/path/to/file.txt"
}
```

**Security Features:**
- Path validation and normalization
- File size limits (configurable, default: 100MB)
- Binary file detection with base64 encoding option
- Symlink protection

**Example:**
```typescript
const result = await mcp.callTool('read_file', {
  file_path: './src/index.ts',
  encoding: 'utf-8'
});
```

#### `list_directory`
List directory contents with filtering and recursion support.

**Parameters:**
- `directory_path` (string, required): Directory to list
- `recursive` (boolean, optional): Recursive traversal (default: false)
- `pattern` (string, optional): Regex pattern for filtering

**Returns:**
```json
{
  "entries": [
    {
      "name": "file.ts",
      "type": "file",
      "size": 1234,
      "modified": "2025-01-01T00:00:00Z",
      "path": "/full/path/to/file.ts"
    }
  ],
  "total_count": 1,
  "directory_path": "/directory/path"
}
```

**Example:**
```typescript
const result = await mcp.callTool('list_directory', {
  directory_path: './src',
  recursive: true,
  pattern: '\\.ts$'
});
```

#### `get_file_metadata`
Retrieve detailed file or directory metadata.

**Parameters:**
- `file_path` (string, required): Path to file or directory

**Returns:**
```json
{
  "type": "file|directory|symlink|socket|fifo|block|character",
  "size": 1234,
  "modified": "2025-01-01T00:00:00Z",
  "created": "2025-01-01T00:00:00Z",
  "accessed": "2025-01-01T00:00:00Z",
  "permissions": {
    "readable": true,
    "writable": false,
    "executable": false
  },
  "absolute_path": "/absolute/path"
}
```

#### `search_files`
Advanced file and content search with pattern matching.

**Parameters:**
- `directory` (string, required): Search directory
- `file_pattern` (string, optional): Glob pattern for filenames
- `content_pattern` (string, optional): Regex for file contents
- `recursive` (boolean, optional): Recursive search (default: false)
- `case_sensitive` (boolean, optional): Case sensitivity (default: false)
- `max_depth` (number, optional): Maximum directory depth
- `max_results` (number, optional): Result limit (default: 100)
- `include_content` (boolean, optional): Include matched content (default: false)

**Returns:**
```json
{
  "matches": [
    {
      "file_path": "/path/to/file.ts",
      "matches": [
        {
          "line_number": 10,
          "content": "matching line content",
          "match_start": 5,
          "match_end": 15
        }
      ]
    }
  ],
  "total_found": 1,
  "search_params": { /* search parameters */ }
}
```

### 🏗️ Project Management

#### `workspace_activate`
Activate a workspace for project management.

**Parameters:**
- `workspace_path` (string, required): Project root directory
- `name` (string, optional): Workspace name (auto-generated if not provided)
- `index_enabled` (boolean, optional): Enable file indexing (default: true)
- `lsp_servers` (string[], optional): LSP servers to enable

**Returns:**
```json
{
  "status": "activated",
  "workspace": {
    "name": "my-project",
    "root_path": "/path/to/project",
    "created_at": "2025-01-01T00:00:00Z",
    "settings": {
      "index_enabled": true,
      "lsp_servers": ["typescript", "python"],
      "auto_save_logs": true,
      "log_retention_days": 30
    }
  },
  "statistics": {
    "total_files": 150,
    "total_directories": 25,
    "indexed_files": 120,
    "supported_languages": ["typescript", "javascript"]
  }
}
```

#### `workspace_get_info`
Get current workspace information.

**Returns:**
```json
{
  "active_workspace": {
    "name": "current-project",
    "root_path": "/path/to/project",
    "last_accessed": "2025-01-01T00:00:00Z",
    "settings": { /* workspace settings */ }
  },
  "statistics": { /* file statistics */ }
}
```

#### `workspace_list_all`
List all registered workspaces.

**Returns:**
```json
{
  "workspaces": [
    {
      "name": "project1",
      "root_path": "/path/to/project1",
      "last_accessed": "2025-01-01T00:00:00Z",
      "status": "active"
    }
  ],
  "total_count": 1
}
```

### 🔍 Code Analysis (LSP Integration)

#### `code_find_symbol`
Semantic symbol search using Language Server Protocol.

**Parameters:**
- `symbol_name` (string, required): Symbol to search for
- `search_type` (string, optional): "exact" or "fuzzy" (default: "fuzzy")
- `file_pattern` (string, optional): File pattern to restrict search
- `symbol_kind` (number, optional): LSP SymbolKind filter
- `max_results` (number, optional): Maximum results (default: 100)

**Returns:**
```json
{
  "query": "Logger",
  "search_type": "fuzzy",
  "total": 5,
  "symbols": [
    {
      "name": "Logger",
      "kind": 5,
      "kind_name": "Class",
      "location": {
        "uri": "file:///path/to/file.ts",
        "range": {
          "start": { "line": 10, "character": 0 },
          "end": { "line": 50, "character": 1 }
        }
      },
      "container_name": "services",
      "signature": "class Logger implements ILogger"
    }
  ]
}
```

**Symbol Kinds:**
- 1: File, 2: Module, 3: Namespace, 4: Package, 5: Class
- 6: Method, 7: Property, 8: Field, 9: Constructor, 10: Enum
- 11: Interface, 12: Function, 13: Variable, 14: Constant
- 15: String, 16: Number, 17: Boolean, 18: Array

#### `code_find_references`
Find all references to a symbol at a specific location.

**Parameters:**
- `file_path` (string, required): File containing the symbol
- `line` (number, required): Line number (0-based)
- `column` (number, required): Column number (0-based)
- `include_declaration` (boolean, optional): Include symbol declaration

**Returns:**
```json
{
  "symbol": {
    "name": "Logger",
    "kind": "Class"
  },
  "references": [
    {
      "uri": "file:///path/to/usage.ts",
      "range": {
        "start": { "line": 5, "character": 10 },
        "end": { "line": 5, "character": 16 }
      },
      "context": "const logger = new Logger();"
    }
  ],
  "total_references": 15
}
```

### 🛠️ Utility

#### `echo`
Simple echo utility for connection testing.

**Parameters:**
- `message` (string, required): Message to echo
- `prefix` (string, optional): Optional prefix

**Returns:**
```json
{
  "message": "prefixed: original message",
  "timestamp": "2025-01-01T00:00:00Z"
}
```

## LSP Proxy Server API

The LSP Proxy Server runs on `http://localhost:3001` and provides HTTP REST API access to Language Server Protocol functionality.

### Health Check

**GET** `/health`

**Response:**
```json
{
  "status": "healthy",
  "workspace": "/current/workspace/path",
  "timestamp": "2025-01-01T00:00:00Z",
  "lsps": {
    "available": ["typescript", "go", "java", "cpp"],
    "running": {
      "typescript": {
        "connected": true,
        "initialized": true,
        "pid": 12345
      }
    },
    "workspaceRoot": "/workspace/path"
  }
}
```

### Symbol Search

**POST** `/symbols/search`

**Request Body:**
```json
{
  "query": "function_name",
  "languages": ["typescript", "go"],
  "maxResults": 50
}
```

**Response:**
```json
{
  "query": "function_name",
  "languages": ["typescript"],
  "total": 3,
  "symbols": [
    {
      "name": "function_name",
      "kind": 12,
      "location": {
        "uri": "file:///path/to/file.ts",
        "range": {
          "start": { "line": 10, "character": 0 },
          "end": { "line": 15, "character": 1 }
        }
      },
      "containerName": "MyClass"
    }
  ]
}
```

### Reference Search

**POST** `/references/find`

**Request Body:**
```json
{
  "filePath": "/absolute/path/to/file.ts",
  "position": { "line": 10, "character": 5 },
  "includeDeclaration": true
}
```

### LSP Status

**GET** `/lsps/status`

**Response:**
```json
{
  "available": ["typescript", "go", "java", "cpp"],
  "running": {
    "typescript": {
      "language": "typescript",
      "connected": true,
      "initialized": true,
      "pid": 12345
    }
  },
  "workspaceRoot": "/workspace/path"
}
```

## Configuration

### Workspace Configuration

Workspace settings are stored in `.claude/workspace/effortlessly/config/workspace.yaml`:

```yaml
workspace:
  name: "my-project"
  root_path: "/path/to/project"
  created_at: "2025-01-01T00:00:00Z"
  last_accessed: "2025-01-01T00:00:00Z"
  settings:
    index_enabled: true
    lsp_servers:
      - typescript
      - python
    auto_save_logs: true
    log_retention_days: 30
    max_file_size: 104857600  # 100MB
    excluded_patterns:
      - "*.env"
      - "*.key" 
      - "*.pem"
      - "node_modules/**"
      - ".git/**"
    follow_symlinks: false
```

### Security Configuration

Security settings in `.claude/workspace/effortlessly/config/security.yaml`:

```yaml
security:
  mode: strict
  default_read_only: true
  allowed_paths:
    - "/home/user/projects/myproject/src"
    - "/home/user/projects/myproject/tests"
  excluded_patterns:
    - "*.env"
    - "*.key"
    - "*.pem"
    - "config/secrets/*"
  max_file_size: 1048576  # 1MB
  follow_symlinks: false
  sensitive_patterns:
    api_key: "[A-Za-z0-9]{32,}"
    password: "password\\s*[:=]\\s*[\"'].*?[\"']"
    jwt: "eyJ[A-Za-z0-9-_]+\\.[A-Za-z0-9-_]+\\.[A-Za-z0-9-_]+"
```

## Error Handling

### Error Response Format

All errors follow a consistent format:

```json
{
  "error": {
    "type": "ValidationError|SecurityError|McpError",
    "message": "Human-readable error message",
    "code": "ERROR_CODE",
    "details": {
      "parameter": "file_path",
      "value": "invalid/path",
      "constraint": "must be absolute path"
    }
  }
}
```

### Common Error Types

#### ValidationError
Input validation failures:
- Invalid file paths
- Missing required parameters
- Type mismatches

#### SecurityError
Security policy violations:
- Unauthorized path access
- Symlink traversal attempts
- File size limit exceeded

#### McpError
General MCP operation failures:
- File not found
- Permission denied
- Internal server errors

## Performance Specifications

### Response Time Targets (from RDD)

- **Symbol Search**: <50ms
- **File Read**: <100ms
- **Reference Search**: <200ms
- **Directory Listing**: <500ms for 1000+ files

### Capacity Limits

- **Supported Codebase Size**: 1M+ lines
- **Memory Usage**: <500MB
- **File Size Limit**: 100MB (configurable)
- **Concurrent Operations**: 100+ simultaneous requests

## Security Model

### Default Security Posture

- **Read-Only by Default**: All operations are read-only unless explicitly enabled
- **Whitelist Access Control**: Only explicitly allowed paths are accessible
- **Sensitive Data Protection**: Automatic detection and masking of credentials
- **Complete Audit Trail**: All operations logged to audit files
- **Offline Operation**: No external network communication

### Audit Logging

All operations are logged to `.claude/workspace/effortlessly/logs/audit/`:

```json
{
  "timestamp": "2025-01-01T00:00:00Z",
  "operation": "read_file",
  "user": "system",
  "parameters": {
    "file_path": "/path/to/file.txt"
  },
  "result": "success",
  "duration_ms": 45,
  "security_context": {
    "authorized": true,
    "whitelist_matched": true
  }
}
```

## Installation and Setup

### Prerequisites

- Node.js 20+
- TypeScript 5.0+
- LSP servers for desired languages:
  - `typescript-language-server` for TypeScript/JavaScript
  - `gopls` for Go
  - `jdtls` for Java
  - `clangd` for C++

### Quick Start

1. **Install effortlessly-mcp:**
```bash
npm install -g effortlessly-mcp
```

2. **Start LSP Proxy Server:**
```bash
effortlessly-lsp-proxy
```

3. **Configure Claude Code:**
```json
{
  "mcpServers": {
    "effortlessly-mcp": {
      "command": "effortlessly-mcp"
    }
  }
}
```

4. **Activate a workspace:**
```typescript
await mcp.callTool('workspace_activate', {
  workspace_path: '/path/to/your/project'
});
```

## Migration and Compatibility

### Upgrading from Earlier Versions

effortlessly-mcp maintains backward compatibility for all tool interfaces. Configuration files are automatically migrated on first startup.

### Supported Environments

- **Operating Systems**: macOS, Linux, Windows
- **Node.js**: 20.0.0+
- **Claude Code**: All current versions
- **VSCode**: Compatible with VSCode LSP extensions

## Troubleshooting

### Common Issues

1. **LSP Server Not Starting**
   - Check LSP dependencies are installed
   - Verify port 3001 is available
   - Review logs in `.claude/workspace/effortlessly/logs/`

2. **Symbol Search Returns Empty**
   - Ensure TypeScript project has valid `tsconfig.json`
   - Check workspace activation was successful
   - Verify LSP server initialization in status endpoint

3. **File Access Denied**
   - Check workspace whitelist configuration
   - Verify path normalization
   - Review security policy settings

### Debug Logging

Enable debug logging by setting environment variable:
```bash
DEBUG=effortlessly-mcp:* effortlessly-mcp
```

## Contributing

effortlessly-mcp is open source (MIT License). Contributions welcome:

1. **Repository**: https://github.com/y-hirakaw/effortlessly-mcp
2. **Issues**: Report bugs and request features
3. **Pull Requests**: Code contributions with tests
4. **Documentation**: Help improve API documentation

### Development Setup

```bash
git clone https://github.com/y-hirakaw/effortlessly-mcp.git
cd effortlessly-mcp
npm install
npm run build
npm test
```

---

**effortlessly-mcp** - Enterprise-grade MCP Server for secure code analysis and semantic search.

Version: 1.0.0 | License: MIT | Documentation: https://github.com/y-hirakaw/effortlessly-mcp