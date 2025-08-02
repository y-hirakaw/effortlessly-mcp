# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.
必ず日本語でチャットを返してください。

## Project Overview

**effortlessly-mcp** - An enterprise-grade MCP (Model Context Protocol) Server focused on secure code analysis and semantic search capabilities.

### Key Information
- **Repository Name**: effortlessly-mcp
- **Workspace Directory**: `.claude/workspace/effortlessly/`
- **License**: MIT
- **Language**: TypeScript
- **Runtime**: Node.js 20+

## Architecture & Structure

This project implements a security-first MCP server with the following layered architecture:

```
┌─────────────────────────────────────┐
│         MCP Protocol Layer          │
├─────────────────────────────────────┤
│        Security Middleware          │
├─────────────────────────────────────┤
│         Tool Handlers               │
├─────────────────────────────────────┤
│    Core Services (LSP, FS, etc)    │
├─────────────────────────────────────┤
│       Storage & Logging             │
└─────────────────────────────────────┘
```

### Core Components
- **SecurityManager**: Access control, sensitive data filtering, audit logging
- **ProjectManager**: Project configuration, whitelist management
- **FileSystemService**: Secure file access with path validation
- **LSPService**: Language Server Protocol integration for code analysis
- **AuditLogger**: Complete operation logging with tamper protection

### Workspace Structure
All MCP server-generated files are organized under `.claude/workspace/effortlessly/`:
- `config/`: YAML configuration files (workspace, security, whitelist)
- `index/`: SQLite databases for symbols and files
- `logs/`: Audit, error, and debug logs
- `temp/`: Temporary files
- `backups/`: Configuration backups

## Development Commands

```bash
# Setup (not yet implemented - placeholder commands)
npm install              # Install dependencies
npm run build           # Build with esbuild
npm test               # Run tests with Vitest
npm run lint           # Run ESLint
npm run typecheck      # TypeScript type checking
```

## Security Design Principles

1. **Security by Default**: All operations are read-only unless explicitly enabled
2. **Whitelist Access Control**: Only explicitly allowed paths can be accessed
3. **Sensitive Data Protection**: Automatic detection and masking of credentials, keys, etc.
4. **Complete Audit Trail**: Every operation is logged to `.claude/workspace/effortlessly/logs/audit/`
5. **No External Communication**: Fully offline operation

## Implementation Status

The project is in the planning phase with a comprehensive Requirements Definition Document (RDD+Task.md). Implementation follows these phases:

1. **Phase 1**: Basic setup and core architecture
2. **Phase 2**: Security implementation (workspace management, access control, audit logging)
3. **Phase 3**: Basic tools (secure file operations, project management)
4. **Phase 4**: LSP integration for semantic code analysis
5. **Phase 5**: Testing and documentation
6. **Phase 6**: Optimization and release preparation

## Key Features (Planned)

### Core Tools
- `secure_read_file`: Safe file reading with filtering
- `secure_list_directory`: Directory listing with restrictions
- `workspace_activate`: Activate a project workspace
- `code_find_symbol`: Semantic symbol search using LSP
- `code_find_references`: Find all references to a symbol

### Security Features
- Automatic sensitive pattern detection (API keys, passwords, credentials)
- Path validation against whitelist
- Symlink detection and prevention
- File size limits
- Complete operation auditing

## Performance Targets
- Symbol search: <50ms
- File read: <100ms
- Reference search: <200ms
- Support for codebases with 1M+ lines
- Memory usage: <500MB

## Development Guidelines

1. **TypeScript Strict Mode**: All code must pass strict type checking
2. **Test Coverage**: Target 90%+ coverage
3. **Security First**: Every feature must consider security implications
4. **Offline Operation**: No external network calls
5. **Audit Everything**: All operations must be logged

## Current Focus

The project is currently in the planning and architecture phase. The next steps are:
1. Initialize the TypeScript project with proper tooling
2. Implement the core MCP server structure
3. Build the security layer with workspace management
4. Add basic file operation tools with security controls

# ファイルの読み書きについて

* MCPサーバー serenaを利用すること