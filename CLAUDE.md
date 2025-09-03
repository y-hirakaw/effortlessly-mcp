# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.
必ず日本語でチャットを返してください。

## Project Overview

**effortlessly-mcp** - セキュアなファイル操作とプロジェクト管理に特化した高性能MCP（Model Context Protocol）サーバー

### Key Information
- **Repository Name**: effortlessly-mcp
- **Workspace Directory**: `.claude/workspace/effortlessly/`
- **License**: MIT
- **Language**: TypeScript
- **Runtime**: Node.js 20+

## Architecture & Structure

実用性重視の軽量アーキテクチャ（v2.0戦略転換後）:

```
┌─────────────────────────────────────┐
│         MCP Protocol Layer          │
├─────────────────────────────────────┤
│        Security Middleware          │
├─────────────────────────────────────┤
│         Tool Handlers (16個)        │
├─────────────────────────────────────┤
│   Core Services (FS, Memory, AI)   │
├─────────────────────────────────────┤
│    SearchLearningEngine + SQLite    │
└─────────────────────────────────────┘
```

### Core Components
- **SecurityManager**: アクセス制御、機密データフィルタリング、監査ログ
- **ProjectManager**: プロジェクト設定、ホワイトリスト管理
- **FileSystemService**: パス検証付きセキュアファイルアクセス
- **SearchLearningEngine**: AI搭載学習型高速検索システム（ROI 350%）
- **ProjectMemoryService**: AI駆動プロジェクト知識管理システム
- **AuditLogger**: 完全操作ログ記録・改ざん防止

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

**✅ v2.0完成済み - 実用性重視の高性能MCPサーバー**

**🎯 主力機能（高品質・本番対応）:**
- ✅ **AI搭載SearchLearningEngine** - 43%高速化、ROI 350%実現
- ✅ **スマート編集システム** - バックアップ・プレビュー・エラーハンドリング完備
- ✅ **プロジェクトメモリ** - AI駆動知識管理・自動検索最適化
- ✅ **セキュリティファースト** - ホワイトリスト・監査ログ・機密データ保護
- ✅ **ワークスペース管理** - 設定自動生成・分離環境・YAML設定

**🔧 ツール統合完了:**
- ✅ **83%コンテキスト削減** - 6個→1個の検索ツール統合
- ✅ **16個の最適化ツール** - 冗長性排除・機能集約完了
- ✅ **テストカバレッジ90%+** - 高品質保証・安定性確保

**🚫 LSP機能廃止完了 (v2.0戦略転換):**
- ❌ 複雑なコード解析機能 → シンプルなファイル操作に集約
- ❌ TypeScript/Swift LSP統合 → 保守負担70%削減達成
- ❌ 重厚な依存関係 → 軽量・高速・確実な動作に最適化

## 利用可能ツール（16個）- 実用性特化・高性能

### 🚀 AI検索システム（1個） - 新機能
- **`search_with_learning`**: AI搭載学習型高速検索
  - 検索パターン自動学習・最適化 
  - ファイル変更検知・自動キャッシュ無効化
  - 43%高速化・ROI 350%の性能向上

### 📁 基本ファイル操作（4個）
- **`read_file`**: ファイル読取（UTF-8対応・部分読取）
- **`list_directory`**: ディレクトリ一覧（再帰・パターン対応）
- **`get_file_metadata`**: ファイル・ディレクトリ詳細情報取得
- **`search_files`**: ファイル検索 *(非推奨 - search_with_learningを推奨)*

### 🛠️ スマート編集（3個）
- **`smart_edit_file`**: 安全編集（バックアップ・プレビュー・エラーハンドリング）
- **`smart_insert_text`**: 柔軟位置指定テキスト挿入
- **`override_text`**: ファイル完全上書き（バックアップ機能付き）

### 🏢 ワークスペース管理（3個）
- **`workspace_activate`**: ワークスペース有効化
- **`workspace_get_info`**: 現在のワークスペース情報取得  
- **`workspace_list_all`**: 全ワークスペース一覧

### 🧠 プロジェクトメモリ（5個） - AI駆動
- **`project_memory_write`**: プロジェクト知識永続化
- **`project_memory_read`**: 保存知識取得
- **`project_memory_list`**: メモリ一覧
- **`project_memory_smart_read`**: AI駆動最適メモリ自動検索・取得
- **`project_memory_update_workflow`**: メモリ更新手順生成

### Security Features
- Automatic sensitive pattern detection (API keys, passwords, credentials)
- Path validation against whitelist
- Symlink detection and prevention
- File size limits
- Complete operation auditing

## 実証済み性能（v2.0達成値）
- **AI検索**: 43%高速化（732ms→416ms実測値）
- **ファイル読取**: <100ms （目標達成）
- **キャッシュヒット**: 変更検知による自動無効化
- **メモリ使用量**: <500MB （目標達成）
- **コンテキスト効率**: 83%削減（6ツール→1ツール統合）

## Development Guidelines

1. **TypeScript Strict Mode**: All code must pass strict type checking
2. **Test Coverage**: Target 90%+ coverage
3. **Security First**: Every feature must consider security implications
4. **Offline Operation**: No external network calls
5. **Audit Everything**: All operations must be logged

## v2.0戦略転換完了 - 実用性重視の成果

**✅ 達成済み成果:**
1. **パフォーマンス最適化**: SearchLearningEngineで43%高速化実現
2. **ツール統合**: 83%のコンテキスト削減（6→1ツール）
3. **セキュリティ強化**: ホワイトリスト・監査ログ・機密データ保護完備
4. **テスト品質**: 90%+カバレッジ達成・安定性確保
5. **エンタープライズ対応**: ワークスペース分離・YAML設定・バックアップ機能

**🎯 v2.0の価値:**
- **開発効率**: 複雑なLSP機能廃止で保守負担70%削減
- **安定性**: シンプルアーキテクチャで確実な動作保証
- **実用性**: ファイル操作・プロジェクト管理に特化した高性能ツール

# ファイル操作について

## effortlessly-mcp ツール必須使用設定

### 🚨 MUST: effortlessly-mcpツール優先使用

利用可能な場合は**必ず優先的に使用**:

**ファイル探索**: `mcp__effortlessly-mcp__search_with_learning`, `mcp__effortlessly-mcp__list_directory`

**ファイル読取**: `mcp__effortlessly-mcp__read_file`, `mcp__effortlessly-mcp__smart_range_optimizer`

**ファイル編集**: `mcp__effortlessly-mcp__smart_edit_file`, `mcp__effortlessly-mcp__smart_insert_text`, `mcp__effortlessly-mcp__override_text`

**エラー時のみ標準ツール使用**: `Read`, `Edit`, `Glob`, `Grep`

### 📏 ファイルサイズ判断基準

**Large (>50KB)**: `smart_range_optimizer` 使用
**Small (<50KB)**: `read_file` 使用

# タスクを実施する上での重要事項

* 課題に対処する際に、課題に対処しきれていない状態で完了を宣言しないこと
  * 課題が残っているなら正直にその内容を伝えること

# チャットでのやり取りについて

* 依頼者に忖度せず率直な意見を述べること

# Web検索について

* Web Searchツールではなく、必ず以下コマンドを使ってcodexに調査を依頼すること。{}をWebで調査させたい内容に置き換えてください。
  * `codex exec --model gpt-5 --sandbox workspace-write --config "sandbox_workspace_write.network_access=true" "{}についてWeb検索した後調査結果を報告してください。Web検索する回数は最大5回までにすること" --skip-git-repo-check`