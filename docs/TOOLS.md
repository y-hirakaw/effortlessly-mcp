# Tools Reference - effortlessly-mcp

完全なツールリファレンス - effortlessly-mcp MCP Serverで利用可能な全ツールの詳細仕様

## 概要

effortlessly-mcpは以下のカテゴリに分類される26個のツールを提供します：

## 📋 サポートツール一覧

### ファイル操作ツール
- **echo** - 接続テスト用エコー機能
- **read_file** - ファイル内容の読み取り（部分読み取り・行番号表示対応）
- **list_directory** - ディレクトリ内容の一覧表示（再帰検索・パターンフィルタ対応）
- **get_file_metadata** - ファイル/ディレクトリのメタデータ取得
- **search_files** - ファイル検索とパターンマッチング
- **smart_edit_file** - 安全なファイル編集（プレビュー、バックアップ、エラーハンドリング対応）
- **smart_insert_text** - 柔軟な位置指定によるテキスト挿入
- **override_text** - 既存ファイルの完全上書きまたは新規ファイル作成

### ワークスペース管理ツール
- **workspace_activate** - プロジェクトワークスペースの有効化
- **workspace_get_info** - 現在アクティブなワークスペースの情報取得
- **workspace_list_all** - 登録済みの全ワークスペースを一覧表示

### コード解析ツール（LSP統合）
- **code_find_symbol** - TypeScript/JavaScript/Swiftファイル内のシンボル検索
- **code_find_references** - 指定位置のシンボルの参照（使用箇所）を検索
- **code_find_referencing_symbols** - 指定シンボルを参照しているシンボルを検索
- **code_get_symbol_hierarchy** - ファイル/ディレクトリのシンボル階層を取得
- **code_get_symbols_overview** - 包括的なシンボル構造概要を取得
- **code_search_pattern** - 正規表現パターンによるファイル内容検索
- **code_analyze_dependencies** - ファイルのインポート/エクスポート依存関係を分析

### コード編集ツール
- **code_replace_symbol_body** - コードシンボルの実装部分のみを精密に置換
- **code_insert_at_symbol** - 指定シンボルの前後に精密にコードを挿入
- **code_replace_with_regex** - 正規表現パターンを使用した柔軟なコード置換

### プロジェクト管理ツール
- **project_memory_write** - プロジェクト固有の知識・設計情報を永続化
- **project_memory_read** - 保存されたプロジェクト固有の知識・設計情報を取得
- **project_memory_list** - 保存されたプロジェクト知識の一覧とメタデータを取得
- **project_memory_smart_read** - AI駆動のプロジェクト知識検索（クエリベース）
- **project_memory_update_workflow** - プロジェクトメモリを最新化するための手順を生成

### Java LSP診断ツール
- **java_lsp_basic_diagnostics** - Java LSPサーバーの基本状態確認とエラー統計（Phase 2A）

## 🆕 最新の更新 (v1.0.9)

**Java LSP統合（Phase 2A）**:
- `java_lsp_basic_diagnostics`: Java LSPの基本状態確認・エラー統計ツール
- Eclipse JDT Language Server統合による基本診断機能

**Intent Logging機能追加**:
- `smart_edit_file`, `smart_insert_text`にIntent Logging対応
- 編集操作の目的・理由を記録して開発履歴の追跡性向上

**テスト品質大幅向上**:
- 全テスト数: 282 → 551テスト（196%増加）
- 成功率: 100%維持（失敗0件）

**プロジェクトメモリシステム改善**:
- プロジェクトメモリの3分類システム（generic/project_specific/templates）
- 分類対応プロンプト自動生成機能

## ツールカテゴリ

- **ファイル操作**: 5ツール（読み取り、一覧、検索、メタデータ、エコー）
- **ワークスペース管理**: 3ツール（有効化、情報取得、一覧表示）  
- **スマート編集**: 3ツール（ファイル編集、テキスト挿入、完全上書き）※Intent Logging対応
- **コード解析**: 7ツール（シンボル検索、参照検索、階層取得など）
- **コード編集**: 3ツール（シンボル置換、挿入、正規表現置換）
- **Java LSP**: 1ツール（基本診断）※Phase 2A実装
- **プロジェクト管理**: 4ツール（メモリ読み書き、一覧、ワークフロー生成）※分類システム対応

## ファイル操作ツール

### 1. read_file

ファイル内容の読み取り（部分読み取り・行番号表示対応）

**パラメータ:**
- `file_path` (string, required): 読み取るファイルのパス
- `encoding` (string, optional): ファイルのエンコーディング（デフォルト: utf-8）
- `offset` (number, optional): 読み取り開始行番号（1から始まる）
- `limit` (number, optional): 読み取る行数
- `include_line_numbers` (boolean, optional): 行番号を含めるかどうか（デフォルト: false）

**戻り値:**
```json
{
  "content": "ファイル内容",
  "encoding": "utf-8",
  "size": 1024,
  "total_lines": 50,
  "lines_read": 10,
  "range": {
    "start": 10,
    "end": 20
  }
}
```

**使用例:**
```typescript
// 基本的なファイル読み取り
const result = await mcp.callTool('read_file', {
  file_path: '/path/to/file.ts',
  encoding: 'utf-8'
});

// 部分読み取り（10行目から5行分、行番号付き）
const partialResult = await mcp.callTool('read_file', {
  file_path: '/path/to/large-file.ts',
  offset: 10,
  limit: 5,
  include_line_numbers: true
});
```

### 2. list_directory

ディレクトリ内容の一覧表示

**パラメータ:**
- `directory_path` (string, required): 一覧表示するディレクトリのパス
- `recursive` (boolean, optional): 再帰的に一覧表示するかどうか（デフォルト: false）
- `pattern` (string, optional): ファイル名のフィルタパターン（正規表現）
- `max_results` (number, optional): 最大結果数（デフォルト: 100、最大: 1000）**トークン制限対策**

**戻り値:**
```json
{
  "entries": [
    {
      "name": "file.ts",
      "path": "/full/path/to/file.ts",
      "type": "file",
      "size": 1024,
      "modified": "2023-12-01T10:00:00.000Z",
      "permissions": "644"
    }
  ],
  "total_count": 1,
  "directory": "/path/to/directory"
}
```

**使用例:**
```typescript
const result = await mcp.callTool('list_directory', {
  directory_path: '/path/to/src',
  recursive: true,
  pattern: '*.ts$'
});
```

### 3. get_file_metadata

ファイル/ディレクトリのメタデータ取得

**パラメータ:**
- `file_path` (string, required): メタデータを取得するファイル/ディレクトリのパス

**戻り値:**
```json
{
  "path": "/path/to/file.ts",
  "type": "file",
  "size": 1024,
  "created": "2023-11-01T10:00:00.000Z",
  "modified": "2023-12-01T10:00:00.000Z",
  "accessed": "2023-12-02T10:00:00.000Z",
  "permissions": "644",
  "is_symlink": false,
  "is_readonly": false
}
```

### 4. search_files

ファイル検索とパターンマッチング

**パラメータ:**
- `directory` (string, required): 検索対象のディレクトリパス
- `file_pattern` (string, optional): ファイル名のパターン（glob形式）
- `content_pattern` (string, optional): ファイル内容の検索パターン（正規表現）
- `recursive` (boolean, optional): 再帰的に検索するかどうか（デフォルト: false）
- `case_sensitive` (boolean, optional): 大文字小文字を区別するかどうか（デフォルト: false）
- `max_depth` (number, optional): 最大検索深度
- `max_results` (number, optional): 最大結果数（デフォルト: 100）
- `include_content` (boolean, optional): マッチした内容を含めるかどうか（デフォルト: false）

**戻り値:**
```json
{
  "matches": [
    {
      "file_path": "/path/to/file.ts",
      "matches": [
        {
          "line_number": 15,
          "line_content": "function calculateTotal() {",
          "match_start": 9,
          "match_end": 22
        }
      ]
    }
  ],
  "total_matches": 1,
  "search_params": {
    "directory": "/path/to/src",
    "file_pattern": "*.ts",
    "content_pattern": "function.*calculate"
  }
}
```

### 5. echo

接続テスト用エコー機能

**パラメータ:**
- `message` (string, required): エコーするメッセージ
- `prefix` (string, optional): メッセージのプレフィックス

**戻り値:**
```json
{
  "echoed_message": "Hello World",
  "prefix": "Echo",
  "timestamp": "2023-12-01T10:00:00.000Z"
}
```

## ワークスペース管理ツール

### 1. workspace_activate

プロジェクトワークスペースの有効化

**パラメータ:**
- `workspace_path` (string, required): ワークスペースのルートディレクトリパス
- `name` (string, optional): ワークスペース名（省略時はディレクトリ名から自動生成）
- `lsp_servers` (array, optional): 使用するLSPサーバーのリスト（デフォルト: ["typescript", "python"]）
- `index_enabled` (boolean, optional): インデックス機能を有効にするか（デフォルト: true）
- `auto_save_logs` (boolean, optional): ログの自動保存を有効にするか（デフォルト: true）
- `log_retention_days` (number, optional): ログの保持日数（デフォルト: 30）

**戻り値:**
```json
{
  "success": true,
  "workspace": {
    "name": "my-project",
    "path": "/path/to/project",
    "active": true,
    "lsp_servers": ["typescript", "python"],
    "index_enabled": true
  },
  "config_created": true,
  "index_initialized": true
}
```

### 2. workspace_get_info

現在アクティブなワークスペースの情報取得

**パラメータ:** なし

**戻り値:**
```json
{
  "workspace": {
    "name": "my-project",
    "path": "/path/to/project",
    "active": true,
    "created": "2023-12-01T10:00:00.000Z",
    "last_accessed": "2023-12-02T10:00:00.000Z",
    "lsp_servers": ["typescript", "python"],
    "index_enabled": true,
    "file_count": 1250,
    "symbol_count": 5420
  },
  "config_path": "/path/to/.claude/workspace/effortlessly/config/workspace.yaml",
  "logs_path": "/path/to/.claude/workspace/effortlessly/logs"
}
```

### 3. workspace_list_all

登録済みのすべてのワークスペースを一覧表示

**パラメータ:** なし

**戻り値:**
```json
{
  "workspaces": [
    {
      "name": "project-a",
      "path": "/path/to/project-a",
      "active": true,
      "last_accessed": "2023-12-02T10:00:00.000Z"
    },
    {
      "name": "project-b",
      "path": "/path/to/project-b",
      "active": false,
      "last_accessed": "2023-12-01T10:00:00.000Z"
    }
  ],
  "total_count": 2,
  "active_workspace": "project-a"
}
```

## スマート編集ツール

### 1. smart_edit_file

安全なファイル編集（プレビュー、バックアップ、エラーハンドリング対応）

**パラメータ:**
- `file_path` (string, required): 編集対象ファイルパス
- `old_text` (string, required): 置換対象の文字列（新規ファイル作成時は空文字列可）
- `new_text` (string, required): 置換後の文字列
- `preview_mode` (boolean, optional): プレビューモード（実際の変更は行わない、デフォルト: false）
- `create_backup` (boolean, optional): バックアップファイルを作成（デフォルト: true）
- `case_sensitive` (boolean, optional): 大文字小文字を区別（デフォルト: true）
- `replace_all` (boolean, optional): すべての出現箇所を置換（デフォルト: false）
- `max_file_size` (number, optional): 最大ファイルサイズ（バイト、デフォルト: 1MB）
- `create_new_file` (boolean, optional): 新規ディレクトリも含めて作成を許可（デフォルト: false）
- `intent` (string, optional): 編集の目的・理由（v1.0.9追加、Intent Logging機能）

**戻り値:**
```json
{
  "success": true,
  "file_path": "/path/to/file.ts",
  "preview_mode": false,
  "changes_made": true,
  "replacement_count": 3,
  "backup_path": "/path/to/.claude/workspace/effortlessly/backups/file.ts.2023-12-01T10-00-00-000Z.backup",
  "file_size": 2048,
  "matches_found": [
    {
      "line_number": 15,
      "line_content": "const oldVariable = 'value';",
      "match_start": 6,
      "match_end": 17
    }
  ],
  "is_new_file": false
}
```

### 2. smart_insert_text

柔軟な位置指定によるテキスト挿入

**パラメータ:**
- `file_path` (string, required): 編集対象ファイルパス
- `text` (string, required): 挿入するテキスト
- `position_type` (string, required): 挿入位置の指定方法（line_number, after_text, before_text, start, end）
- `line_number` (number, optional): 行番号（1から開始、position_type="line_number"の場合）
- `reference_text` (string, optional): 参照テキスト（after_text/before_textの場合）
- `auto_indent` (boolean, optional): 自動インデント調整（デフォルト: true）
- `preserve_empty_lines` (boolean, optional): 空行を保持（デフォルト: true）
- `preview_mode` (boolean, optional): プレビューモード（デフォルト: false）
- `create_backup` (boolean, optional): バックアップファイルを作成（デフォルト: true）
- `max_file_size` (number, optional): 最大ファイルサイズ（デフォルト: 1MB）
- `intent` (string, optional): 挿入の目的・理由（v1.0.9追加、Intent Logging機能）
- `create_new_file` (boolean, optional): 新規ディレクトリも含めて作成を許可（デフォルト: false）

**戻り値:**
```json
{
  "success": true,
  "file_path": "/path/to/file.ts",
  "preview_mode": false,
  "text_inserted": true,
  "insert_position": {
    "line_number": 15,
    "column": 0
  },
  "backup_path": "/path/to/.claude/workspace/effortlessly/backups/file.ts.2023-12-01T10-00-00-000Z.backup",
  "original_line_count": 50,
  "new_line_count": 52,
  "is_new_file": false
}
```

### 3. override_text

既存ファイルの完全上書きまたは新規ファイル作成（高リスク操作）

**パラメータ:**
- `file_path` (string, required): 対象ファイルパス
- `text` (string, required): 新しいファイル内容（完全置換）
- `preview_mode` (boolean, optional): プレビューモード（デフォルト: false）
- `create_backup` (boolean, optional): バックアップファイルを作成（デフォルト: true）
- `max_file_size` (number, optional): 最大ファイルサイズ（デフォルト: 10MB）
- `confirm_override` (boolean, optional): 上書き意図の明示的確認（デフォルト: false）
- `allow_new_file` (boolean, optional): 新規ファイル作成を許可（デフォルト: true）

**戻り値:**
```json
{
  "success": true,
  "file_path": "/path/to/config.json",
  "preview_mode": false,
  "operation": "override",
  "backup_path": "/path/to/.claude/workspace/effortlessly/backups/config.json.2023-12-01T10-00-00-000Z.backup",
  "original_size": 1024,
  "new_size": 2048,
  "security_warning": "⚠️ 高リスク操作: 既存ファイル（1024バイト）を完全上書きします。必要に応じてpreview_mode=trueで内容確認を推奨。"
}
```

**使用例:**
```bash
# 設定ファイル完全更新
mcp://override_text({
  "file_path": "config/app.json",
  "text": "{\n  \"version\": \"2.0\",\n  \"features\": [\"auth\", \"api\"]\n}",
  "preview_mode": true
})

# 新規テンプレートファイル作成
mcp://override_text({
  "file_path": "templates/component.tsx",
  "text": "import React from 'react';\n\nexport const Template = () => {\n  return <div>Template</div>;\n};",
  "allow_new_file": true
})
```

**セキュリティ機能:**
- 機密ファイル（.env, config, package.json等）に対する自動保護
- `confirm_override=true` での明示的確認機能
- 自動バックアップ作成（既存ファイルのみ）
- プレビューモードでの事前確認

## コード解析ツール

### 1. code_find_symbol

TypeScript/JavaScript/Swiftファイル内のシンボル（関数、クラス、変数など）を検索

**パラメータ:**
- `symbol_name` (string, required): 検索するシンボル名
- `search_type` (string, optional): 検索タイプ（exact, fuzzy、デフォルト: fuzzy）
- `file_pattern` (string, optional): ファイルパターン（部分マッチ）
- `symbol_kind` (number, optional): シンボルの種類（SymbolKind）
- `max_results` (number, optional): 最大結果数（デフォルト: 100）

**戻り値:**
```json
{
  "symbols": [
    {
      "name": "calculateTotal",
      "kind": 12,
      "kind_name": "Function",
      "file_path": "/path/to/file.ts",
      "range": {
        "start": { "line": 15, "character": 0 },
        "end": { "line": 20, "character": 1 }
      },
      "selection_range": {
        "start": { "line": 15, "character": 9 },
        "end": { "line": 15, "character": 22 }
      },
      "detail": "function calculateTotal(items: Item[]): number"
    }
  ],
  "total_found": 1,
  "search_params": {
    "symbol_name": "calculateTotal",
    "search_type": "fuzzy"
  }
}
```

### 2. code_find_references

指定された位置のシンボルの参照（使用箇所）を検索

**パラメータ:**
- `file_path` (string, required): ファイルパス
- `line` (number, required): 行番号（0から開始）
- `column` (number, required): 列番号（0から開始）
- `include_declaration` (boolean, optional): 宣言も含めるかどうか（デフォルト: true）

**戻り値:**
```json
{
  "references": [
    {
      "file_path": "/path/to/file.ts",
      "range": {
        "start": { "line": 25, "character": 10 },
        "end": { "line": 25, "character": 23 }
      },
      "context": "const result = calculateTotal(items);"
    }
  ],
  "total_found": 1,
  "target_symbol": "calculateTotal"
}
```

### 3. code_find_referencing_symbols

指定したシンボルを参照しているシンボルを検索

**パラメータ:**
- `target_file` (string, required): 対象ファイルパス
- `target_symbol` (string, required): 対象シンボル名
- `search_scope` (string, optional): 検索範囲（workspace, project, directory、デフォルト: workspace）
- `include_context` (boolean, optional): コンテキストを含める（デフォルト: true）
- `max_results` (number, optional): 最大結果数（デフォルト: 100）

**戻り値:**
```json
{
  "referencing_symbols": [
    {
      "symbol_name": "processOrder",
      "symbol_kind": 12,
      "file_path": "/path/to/service.ts",
      "reference_location": {
        "line": 30,
        "character": 15
      },
      "context": "const total = calculateTotal(order.items);",
      "symbol_range": {
        "start": { "line": 28, "character": 0 },
        "end": { "line": 35, "character": 1 }
      }
    }
  ],
  "total_found": 1
}
```

### 4. code_get_symbol_hierarchy

ファイルまたはディレクトリのシンボル階層（クラス、関数、変数など）を階層構造で取得

**パラメータ:**
- `file_path` (string, optional): 特定のファイルのシンボル階層を取得
- `directory_path` (string, optional): 特定のディレクトリのシンボル階層を取得
- `max_depth` (number, optional): 最大階層深度（デフォルト: 3）
- `include_private` (boolean, optional): プライベートシンボルも含めるか（デフォルト: false）
- `symbol_kinds` (array, optional): 含めるシンボル種類の配列（SymbolKind）

**戻り値:**
```json
{
  "hierarchy": [
    {
      "name": "UserService",
      "kind": 5,
      "kind_name": "Class",
      "file_path": "/path/to/service.ts",
      "range": {
        "start": { "line": 10, "character": 0 },
        "end": { "line": 50, "character": 1 }
      },
      "children": [
        {
          "name": "constructor",
          "kind": 9,
          "kind_name": "Constructor",
          "range": {
            "start": { "line": 12, "character": 2 },
            "end": { "line": 15, "character": 3 }
          }
        },
        {
          "name": "getUser",
          "kind": 6,
          "kind_name": "Method",
          "range": {
            "start": { "line": 17, "character": 2 },
            "end": { "line": 25, "character": 3 }
          }
        }
      ]
    }
  ]
}
```

### 5. code_get_symbols_overview

ファイルまたはディレクトリの包括的なシンボル構造概要を取得

**パラメータ:**
- `relative_path` (string, required): 対象パス（ファイルまたはディレクトリ）
- `max_files` (number, optional): 最大処理ファイル数（デフォルト: 50、最大: 500）**トークン制限対策**
- `max_depth` (number, optional): 最大階層深度（デフォルト: 3）
- `include_private` (boolean, optional): プライベートシンボルを含める（デフォルト: false）
- `symbol_kinds` (array, optional): 含めるシンボル種類

**戻り値:**
```json
{
  "overview": [
    {
      "file_path": "/path/to/service.ts",
      "symbols": [
        {
          "name": "UserService",
          "kind": 5,
          "kind_name": "Class",
          "access": "public",
          "children_count": 5,
          "description": "User management service"
        }
      ],
      "symbol_count": 1,
      "file_size": 2048
    }
  ],
  "total_files": 1,
  "total_symbols": 1
}
```

### 6. code_search_pattern

柔軟なパターン検索機能。正規表現パターンによるファイル内容検索

**パラメータ:**
- `pattern` (string, required): 検索パターン（正規表現）
- `directory_path` (string, optional): 検索対象ディレクトリ
- `file_pattern` (string, optional): 対象ファイルのパターン（glob形式）
- `case_sensitive` (boolean, optional): 大文字小文字を区別（デフォルト: false）
- `include_context` (boolean, optional): コンテキストを含める（デフォルト: true）
- `max_results` (number, optional): 最大結果数（デフォルト: 100）

**戻り値:**
```json
{
  "matches": [
    {
      "file_path": "/path/to/file.ts",
      "line_number": 15,
      "line_content": "export class UserService extends BaseService {",
      "match_start": 13,
      "match_end": 24,
      "matched_text": "UserService",
      "context": {
        "before": ["", "import { BaseService } from './base';"],
        "after": ["  constructor() {", "    super();"]
      }
    }
  ],
  "total_matches": 1,
  "pattern": "class\\s+(\\w+)\\s+extends"
}
```

### 7. code_analyze_dependencies

ファイルのインポート/エクスポート依存関係を分析

**パラメータ:**
- `file_path` (string, required): 分析対象のファイルパス
- `depth` (number, optional): 依存関係の追跡深度（デフォルト: 3）
- `include_external` (boolean, optional): 外部ライブラリの依存関係も含めるか（デフォルト: true）
- `include_dev_dependencies` (boolean, optional): 開発依存関係も含めるか（デフォルト: false）
- `resolve_imports` (boolean, optional): インポートパスを解決するか（デフォルト: true）

**戻り値:**
```json
{
  "dependencies": {
    "imports": [
      {
        "source": "./userService",
        "imported": ["UserService", "UserConfig"],
        "import_type": "named",
        "resolved_path": "/path/to/userService.ts",
        "is_external": false
      },
      {
        "source": "lodash",
        "imported": ["_"],
        "import_type": "default",
        "is_external": true,
        "package_version": "4.17.21"
      }
    ],
    "exports": [
      {
        "name": "OrderService",
        "export_type": "named",
        "is_default": false
      }
    ]
  },
  "dependency_graph": {
    "nodes": [
      { "id": "/path/to/orderService.ts", "type": "file" },
      { "id": "/path/to/userService.ts", "type": "file" },
      { "id": "lodash", "type": "external" }
    ],
    "edges": [
      { "from": "/path/to/orderService.ts", "to": "/path/to/userService.ts" },
      { "from": "/path/to/orderService.ts", "to": "lodash" }
    ]
  },
  "circular_dependencies": [],
  "external_dependencies": ["lodash"],
  "analysis_depth": 3
}
```

## コード編集ツール

### 1. code_replace_symbol_body

コードシンボル（関数・クラス・メソッド）の実装部分のみを精密に置換

**パラメータ:**
- `file_path` (string, required): 対象ファイルパス
- `symbol_name` (string, required): 置換対象のシンボル名
- `new_body` (string, required): 新しいシンボル本体
- `backup` (boolean, optional): バックアップを作成（デフォルト: true）

**戻り値:**
```json
{
  "success": true,
  "file_path": "/path/to/service.ts",
  "symbol_name": "calculateTotal",
  "changes_made": true,
  "backup_path": "/path/to/.claude/workspace/effortlessly/backups/service.ts.2023-12-01T10-00-00-000Z.backup",
  "original_range": {
    "start": { "line": 15, "character": 0 },
    "end": { "line": 20, "character": 1 }
  },
  "new_range": {
    "start": { "line": 15, "character": 0 },
    "end": { "line": 22, "character": 1 }
  }
}
```

### 2. code_insert_at_symbol

指定されたシンボルの前後に精密にコードを挿入

**パラメータ:**
- `file_path` (string, required): 対象ファイルパス
- `symbol_name` (string, required): 挿入位置のシンボル名
- `content` (string, required): 挿入するコンテンツ
- `position` (string, required): 挿入位置（before, after, inside）
- `backup` (boolean, optional): バックアップを作成（デフォルト: true）

**戻り値:**
```json
{
  "success": true,
  "file_path": "/path/to/service.ts",
  "symbol_name": "UserService",
  "position": "before",
  "content_inserted": true,
  "backup_path": "/path/to/.claude/workspace/effortlessly/backups/service.ts.2023-12-01T10-00-00-000Z.backup",
  "insert_location": {
    "line": 10,
    "character": 0
  }
}
```

### 3. code_replace_with_regex

正規表現パターンを使用した柔軟なコード置換

**パラメータ:**
- `file_path` (string, required): 対象ファイルパス
- `search_pattern` (string, required): 検索パターン（正規表現）
- `replacement` (string, required): 置換文字列
- `flags` (string, optional): 正規表現フラグ
- `backup` (boolean, optional): バックアップを作成（デフォルト: true）

**戻り値:**
```json
{
  "success": true,
  "file_path": "/path/to/service.ts",
  "pattern": "function\\s+(\\w+)\\s*\\(",
  "replacement": "const $1 = (",
  "matches_replaced": 5,
  "backup_path": "/path/to/.claude/workspace/effortlessly/backups/service.ts.2023-12-01T10-00-00-000Z.backup",
  "replacements": [
    {
      "line": 15,
      "original": "function calculateTotal(",
      "replaced": "const calculateTotal = ("
    }
  ]
}
```

## 🗂️ 特化プロジェクトインデックス（v1.0.2+）

effortlessly-mcpでは、プロジェクト情報を固定ファイル名で管理する特化インデックスシステムを提供しています。

### 利用可能な特化インデックス

| インデックス名 | ファイル名 | 内容 |
|---------------|-----------|------|
| **メインインデックス** | `project_structure_index` | プロジェクト全体の目次とクイックリファレンス |
| **Managerクラス** | `manager_classes_index` | 4つの中核クラス（Workspace/Project/LSP/Security）の詳細 |
| **アーキテクチャ** | `architecture_overview` | 5層システム構造の詳細解説 |
| **セキュリティマップ** | `security_implementation_map` | 実装済み/予定のセキュリティ機能一覧 |
| **LSP統合状況** | `lsp_integration_status` | TypeScript/Swift等の言語サポート詳細 |

### 活用例

```typescript
// プロジェクト概要の取得
const overview = await mcp.callTool('project_memory_read', {
  memory_name: 'project_structure_index'
});

// 特定Manager情報の確認
const managers = await mcp.callTool('project_memory_read', {
  memory_name: 'manager_classes_index'
});

// セキュリティ実装状況の確認
const security = await mcp.callTool('project_memory_read', {
  memory_name: 'security_implementation_map'
});
```

**特徴:**
- **固定ファイル名**: 古い情報参照問題を根本解決
- **自動バックアップ**: 更新時に `.claude/workspace/effortlessly/memory/backups/` に自動保存
- **構造化分離**: 情報種別ごとに専用インデックスで管理効率化

## Java LSP 診断ツール

### java_lsp_basic_diagnostics

Java LSPサーバーの基本状態確認とエラー統計を取得（Phase 2A実装）

**パラメータ:**
- `detailed` (boolean, optional): 詳細情報を含めるか（デフォルト: false）

**戻り値:**
```json
{
  "success": true,
  "lsp_status": {
    "server_running": true,
    "connection_healthy": true,
    "response_time_ms": 156
  },
  "error_statistics": {
    "total_errors": 3,
    "error_types": {
      "compile_errors": 2,
      "syntax_errors": 1
    },
    "recent_errors": [
      {
        "type": "compile_error",
        "message": "Cannot find symbol: variable undefinedVar",
        "file": "src/Main.java",
        "line": 15,
        "timestamp": "2025-08-10T11:00:00Z"
      }
    ]
  },
  "health_check": {
    "status": "healthy",
    "checks": [
      {"name": "server_startup", "status": "✅ OK"},
      {"name": "workspace_initialization", "status": "✅ OK"},
      {"name": "project_classpath", "status": "⚠️ Warning: Some dependencies not found"}
    ]
  },
  "message": "Java LSPサーバーは正常に動作しています。コンパイルエラー2件、構文エラー1件を検出しました。",
  "recommendations": [
    "未定義変数 'undefinedVar' を確認してください（src/Main.java:15）",
    "プロジェクトの依存関係を確認してください"
  ]
}
```

**使用例:**
```typescript
// 基本的な診断実行
const diagnostics = await mcp.callTool('java_lsp_basic_diagnostics', {});

// 詳細情報込みの診断
const detailed = await mcp.callTool('java_lsp_basic_diagnostics', {
  detailed: true
});
```

**実装状況:**
- ✅ **Phase 2A完了**: 基本診断機能・エラー記録・統計収集
- 🔄 **Phase 2B計画中**: 高度診断機能・パフォーマンス解析
- 📋 **Phase 3予定**: 完全統合・自動修正提案

**注意事項:**
- Java プロジェクトでのみ有効
- Eclipse JDT Language Server が必要（自動インストール対応）
- 初回実行時にLSPサーバー起動のため応答時間が長くなる場合があります

## プロジェクト管理ツール

### 1. project_memory_write

プロジェクト固有の知識・設計情報を永続化

**パラメータ:**
- `memory_name` (string, required): メモリファイル名
- `content` (string, required): 保存する内容
- `tags` (array, optional): タグのリスト
- `overwrite` (boolean, optional): 既存ファイルを上書きするか（デフォルト: false）

**戻り値:**
```json
{
  "success": true,
  "memory_name": "architecture-decisions",
  "file_path": "/path/to/.claude/workspace/effortlessly/memories/architecture-decisions.md",
  "content_size": 2048,
  "tags": ["architecture", "database", "auth"],
  "created": "2023-12-01T10:00:00.000Z",
  "overwritten": false
}
```

### 2. project_memory_read

保存されたプロジェクト固有の知識・設計情報を取得

**パラメータ:**
- `memory_name` (string, required): 読み取るメモリファイル名

**戻り値:**
```json
{
  "success": true,
  "memory_name": "architecture-decisions",
  "content": "# アーキテクチャ決定記録\n\n## データベース設計\n...",
  "metadata": {
    "created": "2023-12-01T10:00:00.000Z",
    "modified": "2023-12-01T15:30:00.000Z",
    "size": 2048,
    "tags": ["architecture", "database", "auth"]
  }
}
```

### 3. project_memory_list

保存されたプロジェクト知識の一覧とメタデータを取得

**パラメータ:**
- `tag_filter` (string, optional): タグによるフィルタリング
- `include_statistics` (boolean, optional): 統計情報を含める（デフォルト: false）

**戻り値:**
```json
{
  "memories": [
    {
      "name": "architecture-decisions",
      "tags": ["architecture", "database", "auth"],
      "created": "2023-12-01T10:00:00.000Z",
      "modified": "2023-12-01T15:30:00.000Z",
      "size": 2048,
      "preview": "# アーキテクチャ決定記録\n\n## データベース設計\n..."
    }
  ],
  "total_count": 1,
  "filter_applied": "architecture",
  "statistics": {
    "total_size": 2048,
    "average_size": 2048,
    "most_common_tags": ["architecture", "database"]
  }
}
```

### 4. project_update_workflow

プロジェクト情報を最新化するための手順を生成

**パラメータ:**
- `task` (string, optional): 更新タスクの種類
- `scope` (string, optional): 更新の範囲（full, incremental, targeted、デフォルト: full）
- `focus_areas` (array, optional): 特定のフォーカスエリア
- `preview` (boolean, optional): 手順のプレビューのみ表示（デフォルト: false）

**戻り値:**
```json
{
  "workflow": {
    "task": "security-audit",
    "scope": "full",
    "steps": [
      {
        "step": 1,
        "title": "セキュリティパターンスキャン",
        "description": "潜在的なセキュリティ問題をパターン検索で特定",
        "tools": ["code_search_pattern"],
        "estimated_time": "10 minutes"
      },
      {
        "step": 2,
        "title": "依存関係脆弱性チェック",
        "description": "外部依存関係の既知の脆弱性を確認",
        "tools": ["code_analyze_dependencies"],
        "estimated_time": "5 minutes"
      }
    ],
    "focus_areas": ["authentication", "data-validation", "dependencies"],
    "estimated_total_time": "15 minutes"
  },
  "preview_mode": true
}
```

## LSPシンボル種類一覧

LSPツールで使用されるシンボル種類（SymbolKind）の対応表：

```json
{
  "1": "File",
  "2": "Module", 
  "3": "Namespace",
  "4": "Package",
  "5": "Class",
  "6": "Method",
  "7": "Property",
  "8": "Field",
  "9": "Constructor",
  "10": "Enum",
  "11": "Interface",
  "12": "Function",
  "13": "Variable",
  "14": "Constant",
  "15": "String",
  "16": "Number",
  "17": "Boolean",
  "18": "Array",
  "19": "Object",
  "20": "Key",
  "21": "Null",
  "22": "EnumMember",
  "23": "Struct",
  "24": "Event",
  "25": "Operator",
  "26": "TypeParameter"
}
```

## エラーハンドリング

すべてのツールは以下の共通エラー形式を使用します：

```json
{
  "isError": true,
  "content": [
    {
      "type": "text",
      "text": "エラーメッセージ: 詳細な説明"
    }
  ]
}
```

### 一般的なエラーコード

- **ENOENT**: ファイルまたはディレクトリが見つからない
- **EACCES**: アクセス権限不足
- **EISDIR**: ファイルを期待したがディレクトリを指定
- **ENOTDIR**: ディレクトリを期待したがファイルを指定
- **EMFILE**: ファイル数上限到達
- **ENOSPC**: ディスク容量不足
- **LSP_ERROR**: LSPサーバーエラー
- **PARSE_ERROR**: ファイル解析エラー
- **VALIDATION_ERROR**: パラメータ検証エラー
- **SECURITY_ERROR**: セキュリティポリシー違反

## パフォーマンス考慮事項

### 大規模プロジェクトでの推奨設定

```typescript
// 検索結果を制限
const symbols = await mcp.callTool('code_find_symbol', {
  symbol_name: 'Component',
  max_results: 50  // デフォルト100を制限
});

// ファイルパターンで範囲を限定
const patterns = await mcp.callTool('code_search_pattern', {
  pattern: 'export class',
  file_pattern: 'src/**/*.ts',  // 検索範囲を限定
  max_results: 20
});

// 階層深度を制限
const hierarchy = await mcp.callTool('code_get_symbol_hierarchy', {
  file_path: '/path/to/large-file.ts',
  max_depth: 2  // デフォルト3を制限
});
```

### バッチ処理の推奨パターン

```typescript
// 複数ファイルの並列処理
const files = ['file1.ts', 'file2.ts', 'file3.ts'];
const results = await Promise.all(
  files.map(file => 
    mcp.callTool('code_get_symbols_overview', { relative_path: file })
  )
);

// 大量ファイルの分割処理
const BATCH_SIZE = 10;
for (let i = 0; i < files.length; i += BATCH_SIZE) {
  const batch = files.slice(i, i + BATCH_SIZE);
  const batchResults = await Promise.all(
    batch.map(file => mcp.callTool('read_file', { file_path: file }))
  );
  // バッチ結果を処理
}
```

## セキュリティ制限

### ファイルアクセス制限

- ホワイトリストに登録されたパスのみアクセス可能
- シンボリックリンクの追跡は無効
- 最大ファイルサイズ制限（デフォルト1MB）
- 機密データパターンの自動検出とマスキング

### 機密データパターン

自動検出される機密データパターン：
- APIキー: `[A-Za-z0-9]{32,}`
- パスワード: `password\s*[:=]\s*["'].*?["']`
- JWT: `eyJ[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+`
- AWS キー: `AKIA[0-9A-Z]{16}`
- GitHub トークン: `ghp_[a-zA-Z0-9]{36}`

## 関連ドキュメント

- [セットアップガイド](./SETUP.md) - インストールと初期設定
- [使い方ガイド](./USAGE.md) - 実践的な使用方法
- [セキュリティガイド](./SECURITY.md) - セキュリティ設定と監査
- [トラブルシューティング](./TROUBLESHOOTING.md) - 問題解決ガイド

---

**effortlessly-mcp Tools Reference** - Version 1.0.0

全25ツールの完全リファレンス - 企業級コード解析とセキュアファイル操作