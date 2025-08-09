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
# Setup and Development
npm install              # Install dependencies
npm run build           # Build with TypeScript
npm run build:fast      # Fast build with esbuild
npm run dev             # Development mode with tsx
npm test               # Run tests with Vitest
npm run test:coverage  # Run tests with coverage
npm run lint           # Run ESLint
npm run typecheck      # TypeScript type checking
npm run format         # Format code with Prettier
```

## Security Design Principles

1. **Security by Default**: All operations are read-only unless explicitly enabled
2. **Whitelist Access Control**: Only explicitly allowed paths can be accessed
3. **Sensitive Data Protection**: Automatic detection and masking of credentials, keys, etc.
4. **Complete Audit Trail**: Every operation is logged to `.claude/workspace/effortlessly/logs/audit/`
5. **No External Communication**: Fully offline operation

## Implementation Status

The project is in active development with substantial implementation completed. Major components are functional:

**✅ Completed Features:**
- Core MCP server architecture (`src/index.ts`)
- Basic file operations (read, list, search, metadata)
- Smart editing tools (smart-edit-file, smart-insert-text)
- Project memory management system
- Code analysis tools (symbol search, references, dependencies)
- Code editing tools (symbol replacement, regex replacement)
- LSP integration (TypeScript, Swift support)
- Project workspace management
- Testing framework with good coverage

**🔄 In Progress:**
- Additional LSP language support
- Performance optimizations
- Documentation completion

**📋 Planned:**
- Security hardening
- Enterprise features
- Release preparation

## Key Features

### Core Tools (✅ Implemented)
- `read_file`: File reading with encoding support
- `list_directory`: Directory listing with recursive and pattern support
- `get_file_metadata`: File metadata retrieval (size, permissions, dates)
- `search_files`: File search with content and name patterns
- `smart_edit_file`: Safe file editing with backup and preview
- `smart_insert_text`: Flexible text insertion with position control

### Workspace Management (✅ Implemented)
- `workspace_activate`: Activate a project workspace
- `workspace_get_info`: Get current workspace information
- `workspace_list_all`: List all registered workspaces

### Code Analysis Tools (✅ Implemented)
- `code_find_symbol`: Semantic symbol search using LSP
- `code_find_references`: Find all references to a symbol
- `code_find_referencing_symbols`: Find symbols that reference target
- `code_get_symbol_hierarchy`: Get hierarchical symbol structure
- `code_get_symbols_overview`: Overview of symbols in files/directories
- `code_search_pattern`: Advanced pattern search with regex
- `code_analyze_dependencies`: Dependency analysis and graph generation

### Code Editing Tools (✅ Implemented)
- `code_replace_symbol_body`: Replace entire symbol implementation
- `code_insert_at_symbol`: Insert code before/after symbols
- `code_replace_with_regex`: Flexible regex-based replacements

### Project Memory (✅ Implemented)
- `project_memory_write`: Store project-specific knowledge
- `project_memory_read`: Retrieve stored knowledge
- `project_memory_list`: List available memory entries
- `project_update_workflow`: Generate update workflows

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

The project has a solid foundation with most core features implemented. Current development priorities:

1. **Performance Optimization**: LSP response times, symbol indexing, large file handling
2. **Language Support**: Expanding LSP integration beyond TypeScript and Swift
3. **Security Enhancement**: Implementing planned security features and audit logging
4. **Documentation**: Comprehensive API documentation and usage examples
5. **Testing**: Expanding test coverage and integration tests
6. **Enterprise Features**: Advanced configuration and monitoring capabilities

# ファイル操作について

## MCP Server effortlessly-mcpの使用

**重要**: このプロジェクトでは、ファイル操作に effortlessly-mcp の基本ツール群を優先的に使用してください。

### 利用可能なツール

1. **`mcp__effortlessly-mcp__read_file`**
   - ファイル内容の読み取り
   - UTF-8エンコーディング対応
   - パラメータ: `file_path`, `encoding`(optional)

2. **`mcp__effortlessly-mcp__list_directory`**
   - ディレクトリ一覧の取得
   - 再帰検索対応
   - パラメータ: `directory_path`, `recursive`(optional), `pattern`(optional)

3. **`mcp__effortlessly-mcp__get_file_metadata`**
   - ファイル/ディレクトリのメタデータ取得
   - 権限、サイズ、更新日時等の詳細情報
   - パラメータ: `file_path`

4. **`mcp__effortlessly-mcp__search_files`**
   - ファイル検索とパターンマッチング
   - ファイル名/内容での検索対応
   - パラメータ: `directory`, `file_pattern`(optional), `content_pattern`(optional), `recursive`(optional), `case_sensitive`(optional), `max_depth`(optional), `max_results`(optional), `include_content`(optional)

5. **`mcp__effortlessly-mcp__echo`**
   - 接続テスト用エコー機能
   - パラメータ: `message`, `prefix`(optional)

### パフォーマンス比較と推奨事項

**effortlessly-mcp vs serena パフォーマンス**:
- ✅ **effortlessly-mcp**: 基本操作（検索、読み取り、簡単な編集）で高速・安定
- ⚠️ **serena**: 複雑な正規表現検索・置換で処理時間が長い場合あり（5分以上）

**推奨使い分け**:
1. **基本ファイル操作**: effortlessly-mcp を優先使用
2. **複雑なコード解析**: 必要に応じてserenaを併用（時間がかかる場合は中断を検討）
3. **大きなファイル編集**: 標準Editツールが最も確実で高速

### 使用方針

- **第一選択**: effortlessly-mcp のツール群を使用
- **フォールバック**: 必要に応じて serena や標準ツールを併用
- **テスト目的**: これらのツールを使用することで、開発中のMCPサーバーの動作確認も兼ねる

### 今回の実装例（RDD更新作業）

**成功パターン**:
1. `mcp__effortlessly-mcp__search_files`: 特定のテキストパターンを高速検索
2. `mcp__effortlessly-mcp__read_file`: 該当箇所の確認
3. 標準`Edit`ツール: 確実で高速な文書更新

**避けるべきパターン**:
- `mcp__serena__search_for_pattern`: 複雑な正規表現で長時間処理
- `mcp__serena__replace_regex`: 大きなファイルの置換で処理時間過大

## 🚨 重要：編集ツール使用ルール

### effortlessly-mcp編集ツールの優先使用

**必須**: Claude Codeの標準ツール（Edit, MultiEdit, Write）の代わりに、effortlessly-mcpの編集ツールを優先的に使用してください。

#### 利用可能な編集ツール

1. **`mcp__effortlessly-mcp__smart_edit_file`** ✅ **優先使用**
   - 標準Editツールの代替
   - 安全な置換操作（プレビュー、バックアップ、エラーハンドリング付き）
   - パラメータ: `file_path`, `old_text`, `new_text`, `case_sensitive?`, `replace_all?`, `preview_mode?`

2. **`mcp__effortlessly-mcp__smart_insert_text`** ✅ **優先使用**  
   - 柔軟な位置指定テキスト挿入
   - 行番号・相対位置・ファイル開始/終了での精密挿入
   - パラメータ: `file_path`, `text`, `position_type`, `line_number?`, `reference_text?`, `auto_indent?`, `preview_mode?`

#### 使用優先順位

1. **第一選択**: `mcp__effortlessly-mcp__smart_edit_file` （置換操作）
2. **第一選択**: `mcp__effortlessly-mcp__smart_insert_text` （挿入操作）
3. **フォールバック**: 標準 `Edit`, `MultiEdit`, `Write` ツール（MCPツールでエラーの場合のみ）

#### 必須の使用パターン

- ✅ **正しい使用例**: 
  ```
  mcp__effortlessly-mcp__smart_edit_file を使用してファイルを編集
  → 自動バックアップ作成、安全な置換処理
  ```

- ❌ **避けるべきパターン**:
  ```  
  標準 Edit ツールを直接使用
  → バックアップなし、テスト機会の損失
  ```

#### テスト・開発の観点

- **重要**: effortlessly-mcpツールの使用により、開発中のMCPサーバーの動作確認を同時に実施
- **品質向上**: 実際の使用状況でのフィードバック収集
- **機能改善**: 使用中に発見された問題の早期修正

# タスクを実施する上での重要事項

* 課題に対処する際に、課題に対処しきれていない状態で完了を宣言しないこと
  * 課題が残っているなら正直にその内容を伝えること

# プロジェクトインデックス活用ガイド

## 🔍 新機能実装・リファクタリング時の推奨フロー

**重要**: 新機能実装や大規模なリファクタリングを行う前に、まずプロジェクトインデックスを活用した調査を実施すること。

### 必須確認事項

#### 1. **最新プロジェクト構造の確認**
```bash
# プロジェクトメモリの最新インデックスを参照（常に最新情報）
mcp__effortlessly-mcp__project_memory_read memory_name="project_structure_index"

# 或いは直接ファイル参照
.claude/workspace/effortlessly/memory/project_structure_index.md
```

利用可能な構造化インデックス：
- **メインインデックス**: `project_structure_index.md` - 全体概要と目次
- **アーキテクチャ**: `architecture_overview.md` - 層状構造詳細  
- **Manager クラス**: `manager_classes_index.md` - 設計パターン一覧
- **セキュリティマップ**: `security_implementation_map.md` - セキュリティ実装箇所
- **LSP統合状況**: `lsp_integration_status.md` - 言語サポート詳細

#### 2. **LSP統合状態の確認**
```bash
# LSPサーバーの動作状況確認
mcp__effortlessly-mcp__workspace_get_info

# TypeScript/Swift シンボル検索の動作確認  
mcp__effortlessly-mcp__code_get_symbols_overview relative_path="src"
```

#### 3. **既存パターンの調査**
```bash
# 類似機能の既存実装を検索
mcp__effortlessly-mcp__search_files directory="src" content_pattern="class.*Manager"

# 既存のセキュリティ実装箇所を特定
mcp__effortlessly-mcp__code_find_symbol symbol_name="security"

# ファイル操作の全箇所を洗い出し
mcp__effortlessly-mcp__search_files directory="src" content_pattern="fs\.(readFile|writeFile)" recursive=true
```

### 実装前の必須ステップ

1. **影響範囲分析**: `code_find_references` で変更予定箇所の全参照を特定
2. **設計一貫性確認**: 既存Managerパターンとの整合性検証
3. **セキュリティ考慮**: 既存のセキュリティ実装との競合回避
4. **テスト戦略**: 既存テスト構造に従った追加テスト計画

### 活用例

#### セキュリティ強化（Phase 2）実装時
1. **既存Manager調査** → 4つのManagerクラスパターン確認
2. **セキュリティ箇所特定** → 6箇所の既存実装発見  
3. **ファイル操作洗い出し** → 45箇所のfs操作を特定
4. **設計決定** → 既存パターンに従ったSecurityManager設計

#### FileSystemService実装時  
1. **影響範囲特定** → 45箇所のファイル操作を一元管理に移行
2. **段階的移行** → fs.readFile/writeFileの段階的置換計画
3. **安全性確保** → 各箇所の参照関係を事前に完全把握

## 🎯 プロジェクトメモリの定期更新

プロジェクト構造が大きく変わった場合は、以下のコマンドで固定ファイル名のメモリを更新：

```bash
# メインインデックスの更新
mcp__effortlessly-mcp__project_memory_write \
  memory_name="project_structure_index" \
  content="最新のプロジェクト全体構造"

# 特化インデックスの更新例
mcp__effortlessly-mcp__project_memory_write \
  memory_name="manager_classes_index" \
  content="Managerクラスの最新一覧と設計パターン"

# アーキテクチャ変更時の更新  
mcp__effortlessly-mcp__project_memory_write \
  memory_name="architecture_overview" \
  content="システムアーキテクチャの最新構成"
```

**重要**: 固定ファイル名を使用することで、常に最新情報への参照が保証されます。古い情報は自動的に `.claude/workspace/effortlessly/memory/backups/` に保存されます。

## ⚠️ 重要な注意事項

- **必ずプロジェクトインデックス確認を最初に実行**すること
- **既存パターンとの一貫性を最優先**に設計すること  
- **影響範囲を事前に完全把握**してから変更を実施すること
- **セキュリティ実装は既存の枠組みとの整合性**を確保すること

# README更新について

* READMEの更新を指示されたらCHANGELOG.mdも必要に応じて更新すること