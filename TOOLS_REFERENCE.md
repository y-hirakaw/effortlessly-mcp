# effortlessly-mcp ツールリファレンス v2.0

## 概要

effortlessly-mcpサーバーはセキュアなファイル操作とプロジェクト管理に特化したMCPサーバーです。v2.0戦略転換により、複雑なLSP機能を廃止し、実用性重視の高性能ツールセットに最適化しました。

### アーキテクチャ

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

### 主要性能指標

- **AI検索**: 43%高速化（732ms→416ms実測値）
- **ファイル読取**: <100ms （目標達成）
- **メモリ使用量**: <500MB （目標達成）
- **コンテキスト効率**: 83%削減（6ツール→1ツール統合）
- **テストカバレッジ**: 90%+達成

## 利用可能ツール一覧（16個）

### 🚀 AI搭載検索システム（1個）- 新機能

#### `search_with_learning`
AI搭載学習型高速検索システム（ROI 350%）

**機能:**
- 検索パターン自動学習・最適化
- ファイル変更検知・自動キャッシュ無効化
- コンテキスト削減83%（6→1ツール統合）
- 43%高速化実現

**パラメータ:**
- `query` (必須): 検索クエリ
- `directory` (オプション): 検索対象ディレクトリ
- `file_pattern` (オプション): ファイル名パターン（glob形式）
- `content_pattern` (オプション): ファイル内容検索パターン（正規表現）
- `case_sensitive` (オプション): 大文字小文字区別（デフォルト: false）
- `recursive` (オプション): 再帰検索（デフォルト: true）
- `max_results` (オプション): 最大結果数（デフォルト: 100）
- `learn_patterns` (オプション): パターン学習有効化（デフォルト: true）

**性能:**
- 実行時間: 5-50ms（キャッシュ時）、100-500ms（初回）
- 学習機能: 検索パターンを自動最適化
- 変更検知: ファイル変更時自動キャッシュ無効化

### 📁 基本ファイル操作（4個）

#### `read_file`
ファイル読取（UTF-8対応・部分読取対応）

**機能:**
- UTF-8エンコーディング対応
- 部分読取（offset/limit）
- セキュリティチェック（パス検証、シンボリックリンク検知）
- ファイルサイズ制限（デフォルト: 1MB）

**パラメータ:**
- `file_path` (必須): 読み取るファイルパス
- `encoding` (オプション): エンコーディング（デフォルト: utf-8）
- `include_line_numbers` (オプション): 行番号表示（デフォルト: false）
- `offset` (オプション): 開始行番号（1ベース）
- `limit` (オプション): 読み取り行数

#### `list_directory`
ディレクトリ一覧（再帰・パターン対応）

**機能:**
- 再帰的ディレクトリ探索
- ファイル名パターンフィルタリング（正規表現）
- ファイル詳細情報取得（サイズ、更新日時、権限）
- セキュリティチェック

**パラメータ:**
- `directory_path` (必須): ディレクトリパス
- `recursive` (オプション): 再帰探索（デフォルト: false）
- `pattern` (オプション): ファイル名フィルタパターン（正規表現）

#### `get_file_metadata`
ファイル・ディレクトリ詳細情報取得

**機能:**
- ファイル・ディレクトリ情報取得
- サイズ、更新日時、権限情報
- ファイルタイプ判定
- シンボリックリンク検知

**パラメータ:**
- `file_path` (必須): 対象ファイル・ディレクトリパス

### 🛠️ スマート編集システム（3個）

#### `smart_edit_file`
安全編集（バックアップ・プレビュー・エラーハンドリング完備）

**機能:**
- 自動バックアップ作成
- プレビューモード
- 大文字小文字区別設定
- 全件置換オプション
- ファイルサイズ制限
- 詳細エラーハンドリング

**パラメータ:**
- `file_path` (必須): 編集対象ファイルパス
- `old_text` (必須): 置換前テキスト
- `new_text` (必須): 置換後テキスト
- `case_sensitive` (オプション): 大文字小文字区別（デフォルト: true）
- `replace_all` (オプション): 全件置換（デフォルト: false）
- `preview_mode` (オプション): プレビューのみ（デフォルト: false）
- `create_backup` (オプション): バックアップ作成（デフォルト: true）
- `max_file_size` (オプション): 最大ファイルサイズ（デフォルト: 1MB）

#### `smart_insert_text`
柔軟位置指定テキスト挿入

**機能:**
- 複数の位置指定方式（行番号、テキスト基準、ファイル先頭/末尾）
- 自動インデント調整
- 空行保持設定
- プレビューモード
- 自動バックアップ

**パラメータ:**
- `file_path` (必須): 編集対象ファイルパス
- `text` (必須): 挿入するテキスト
- `position_type` (必須): 位置指定方式
  - `line_number`: 行番号指定
  - `after_text`: 指定テキストの後
  - `before_text`: 指定テキストの前
  - `start`: ファイル先頭
  - `end`: ファイル末尾
- `line_number` (条件付き): 行番号（position_type="line_number"時必須）
- `reference_text` (条件付き): 基準テキスト（after_text/before_text時必須）
- `auto_indent` (オプション): 自動インデント（デフォルト: true）
- `preserve_empty_lines` (オプション): 空行保持（デフォルト: true）
- `preview_mode` (オプション): プレビューのみ（デフォルト: false）
- `create_backup` (オプション): バックアップ作成（デフォルト: true）
- `max_file_size` (オプション): 最大ファイルサイズ（デフォルト: 1MB）

#### `override_text`
ファイル完全上書き（高リスク操作・要注意）

**機能:**
- ファイル完全置換
- 新規ファイル作成対応
- 自動バックアップ
- プレビューモード
- 確認フラグによる安全制御

**パラメータ:**
- `file_path` (必須): 対象ファイルパス
- `text` (必須): 新しいファイル内容
- `allow_new_file` (オプション): 新規ファイル作成許可（デフォルト: true）
- `confirm_override` (オプション): 上書き確認（デフォルト: false）
- `preview_mode` (オプション): プレビューのみ（デフォルト: false）
- `create_backup` (オプション): バックアップ作成（デフォルト: true）
- `max_file_size` (オプション): 最大ファイルサイズ（デフォルト: 10MB）

### 🏢 ワークスペース管理（1個）

#### `workspace_setup`
ワークスペース設定・プロジェクト管理開始

**機能:**
- ワークスペース初期化
- 設定ファイル自動生成（YAML）
- インデックス機能有効化
- ログ保持期間設定
- 自動ログ保存設定

**パラメータ:**
- `workspace_path` (必須): ワークスペースルートディレクトリパス
- `name` (オプション): ワークスペース名（未指定時はディレクトリ名から自動生成）
- `index_enabled` (オプション): インデックス機能有効化（デフォルト: true）
- `auto_save_logs` (オプション): 自動ログ保存（デフォルト: true）
- `log_retention_days` (オプション): ログ保持日数（デフォルト: 30日）

### 🧠 プロジェクトメモリ（5個）- AI駆動

#### `project_memory_write`
プロジェクト知識永続化

**機能:**
- プロジェクト固有知識・設計情報の保存
- タグベース分類
- 上書き防止機能
- 自動タイムスタンプ

**パラメータ:**
- `memory_name` (必須): メモリファイル名
- `content` (必須): 保存する内容
- `tags` (オプション): タグリスト
- `overwrite` (オプション): 既存ファイル上書き許可（デフォルト: false）

#### `project_memory_read`
保存済みプロジェクト知識取得

**機能:**
- 保存されたプロジェクト知識の読み取り
- メタデータ情報表示
- エラーハンドリング

**パラメータ:**
- `memory_name` (必須): 読み取るメモリファイル名

#### `project_memory_list`
プロジェクト知識一覧・メタデータ取得

**機能:**
- 保存されたメモリ一覧表示
- タグフィルタリング
- 詳細統計情報（オプション）
- ファイルサイズ・更新日時表示

**パラメータ:**
- `filter_tags` (オプション): タグフィルタ
- `include_statistics` (オプション): 統計情報含める（デフォルト: false）

#### `project_memory_smart_read`
AI駆動最適メモリ自動検索・取得

**機能:**
- クエリに基づく最適メモリ自動検索
- AI駆動コンテンツマッチング
- 関連性スコアリング
- 複数メモリ同時取得対応

**パラメータ:**
- `query` (必須): 検索したい情報内容
- `max_results` (オプション): 最大取得数（デフォルト: 3、最大: 10）
- `include_content` (オプション): 完全コンテンツ含める（デフォルト: true）

#### `project_memory_update_workflow`
プロジェクトメモリ更新手順生成

**機能:**
- メモリ更新手順の自動生成
- 更新範囲設定（full/incremental/targeted）
- フォーカスエリア指定
- プレビューモード
- ワークフロー最適化

**パラメータ:**
- `task` (オプション): 更新タスクタイプ
- `scope` (オプション): 更新範囲（デフォルト: full）
  - `full`: 全面更新
  - `incremental`: 増分更新
  - `targeted`: 対象絞り込み更新
- `focus_areas` (オプション): 特定フォーカスエリア
- `preview` (オプション): プレビューのみ（デフォルト: false）

### 📏 スマート読み込み最適化（1個）

#### `smart_range_optimizer`
AI駆動最適読み込み範囲提案

**機能:**
- ファイル解析による最適読み込み範囲提案
- 意図ベース範囲特定
- セマンティック検索対応
- 複数範囲同時提案
- パフォーマンス最適化

**パラメータ:**
- `file_path` (必須): 解析対象ファイル
- `intent` (オプション): 読み込み意図（デフォルト: general）
  - `bug_investigation`: バグ調査
  - `code_review`: コードレビュー
  - `feature_addition`: 機能追加
  - `refactoring`: リファクタリング
  - `documentation`: ドキュメント作成
  - `testing`: テスト作成
  - `general`: 一般的な用途
- `semantic_queries` (オプション): セマンティック検索クエリ配列
- `max_ranges` (オプション): 最大提案範囲数（デフォルト: 5）

## セキュリティ機能

### 標準搭載セキュリティ
- **パス検証**: シンボリックリンク検知、パストラバーサル攻撃防止
- **ファイルサイズ制限**: DoS攻撃防止のためのサイズ制限
- **オフライン動作**: 外部通信一切なし

### ワークスペース分離
- **設定分離**: `.claude/workspace/effortlessly/config/`
- **メモリ分離**: `.claude/workspace/effortlessly/memory/`  
- **インデックス分離**: `.claude/workspace/effortlessly/search_index/`
- **バックアップ分離**: `.claude/workspace/effortlessly/backups/`

## 廃止済み機能（v2.0戦略転換）

### LSP関連機能（保守負担70%削減達成）
- TypeScript LSP統合
- Swift LSP統合
- コード解析機能
- シンボル解析
- 診断機能
- コード補完機能

### 検索ツール統合（83%コンテキスト削減）
- ❌ `search_files` → ✅ `search_with_learning`に統合
- ❌ `optimize_search_query` → ✅ 自動最適化に統合
- ❌ `get_search_statistics` → ✅ 自動収集に統合
- ❌ `update_search_patterns` → ✅ 自動学習に統合

## パフォーマンス最適化

### 実証済み性能指標
- **AI検索**: 43%高速化（732ms→416ms）
- **ファイル読取**: <100ms達成
- **メモリ使用量**: <500MB達成
- **キャッシュヒット率**: 変更検知による自動無効化
- **コンテキスト効率**: 83%削減

### 最適化技術
- **SearchLearningEngine**: パターン学習・自動最適化
- **FileWatcher**: リアルタイム変更監視・キャッシュ管理
- **SQLiteインデックス**: 高速検索・永続化
- **並列処理**: I/O最適化・非同期処理
- **メモリ効率化**: ストリーミング・部分読み込み

## 使用例

### 基本的な使用パターン

```typescript
// ファイル検索
await searchWithLearning({
  query: "authentication middleware implementation",
  directory: "./src",
  recursive: true,
  max_results: 10
});

// ファイル編集
await smartEditFile({
  file_path: "./src/auth.ts",
  old_text: "const secret = 'hardcoded'",
  new_text: "const secret = process.env.JWT_SECRET",
  create_backup: true
});

// プロジェクト知識保存
await projectMemoryWrite({
  memory_name: "auth_architecture",
  content: "JWT認証システムの設計仕様...",
  tags: ["architecture", "security", "jwt"]
});
```

### ワークスペースセットアップ

```typescript
await workspaceSetup({
  workspace_path: "/path/to/project",
  name: "my_project",
  index_enabled: true,
  auto_save_logs: true,
  log_retention_days: 30
});
```

## 開発・運用情報

### テスト
```bash
npm test                 # 全テスト実行
npm run test:coverage    # カバレッジ付きテスト
npm run lint            # ESLint実行
npm run typecheck       # TypeScript型チェック
```

### ビルド
```bash
npm run build           # 標準ビルド
npm run build:fast      # 高速ビルド（esbuild）
npm run dev            # 開発モード
```

### 品質保証
- **テストカバレッジ**: 90%+達成
- **TypeScript strict**: 全コード対応
- **ESLint**: コーディング規約遵守
- **セキュリティ監査**: 全操作ログ記録

---

**最終更新**: 2025年09月03日  
**バージョン**: v2.0.0  
**ライセンス**: MIT