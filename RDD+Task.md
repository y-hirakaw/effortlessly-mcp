# Effortlessly MCP - Requirements Definition Document & TODO

## 1. プロジェクト概要

### 1.1 プロジェクト情報
- **リポジトリ名**: effortlessly-mcp
- **ワークスペースディレクトリ**: `.claude/workspace/effortlessly/`
- **ライセンス**: MIT License

### 1.2 目的
エンタープライズ環境で安全に利用できるMCP Serverを開発する。高度なコード解析機能とセマンティック検索を提供しながら、セキュリティを最優先事項とし、機密情報の漏洩リスクを最小化する。

### 1.2 技術スタック
- **言語**: TypeScript
- **ランタイム**: Node.js 20+
- **MCP SDK**: @modelcontextprotocol/sdk
- **ビルドツール**: esbuild / tsx
- **テストフレームワーク**: Vitest
- **型バリデーション**: Zod

### 1.3 設計原則
- セキュリティ・バイ・デフォルト
- 最小権限の原則
- 完全なオフライン動作
- 監査可能性の確保

## 2. 機能要件

### 2.1 コア機能（最重要）

#### 高速検索・編集
- セマンティックコード検索（LSP活用）
- シンボル定義・参照の即座検索
- 効率的なコード編集操作
- インクリメンタルインデックス更新

#### プロジェクト管理
- プロジェクトの登録・活性化
- プロジェクト設定の管理
- ホワイトリスト方式でのアクセス制御

#### ファイル操作（読み取り専用デフォルト）
- ファイル読み取り（制限付き）
- ディレクトリ一覧（制限付き）
- シンボリックリンク追跡の禁止

#### セキュリティ機能
- 機密情報の自動検出・マスキング
- 操作ログの完全記録
- 読み取り専用モードの強制
- ホワイトリスト外アクセスの遮断

### 2.2 オプション機能（明示的有効化が必要）
- ファイル編集操作
- シェルコマンド実行（極めて制限的）
- 外部ツール連携

## 3. 非機能要件

### 3.1 セキュリティ要件
- すべての操作に対する監査ログ
- 機密情報パターンの自動検出
- 外部通信の完全禁止
- 暗号化されたローカルストレージ

### 3.2 パフォーマンス要件
- 大規模コードベース（100万行以上）対応
- インクリメンタルインデックス更新
- メモリ効率的な実装

### 3.3 可用性要件
- オフライン環境での完全動作
- 設定ファイルのバックアップ・リストア
- グレースフルなエラーハンドリング

## 4. アーキテクチャ設計

### 4.1 レイヤー構成
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

### 4.2 主要コンポーネント

#### SecurityManager
- アクセス制御
- 機密情報フィルタリング
- 監査ログ管理

#### ProjectManager
- プロジェクト設定管理
- ホワイトリスト管理
- 設定の永続化

#### FileSystemService
- セキュアなファイルアクセス
- パス検証
- シンボリックリンク検出

#### LSPService
- Language Server Protocol統合
- シンボル解析
- コード理解

#### AuditLogger
- 全操作の記録
- ログローテーション
- 改ざん防止

### 4.3 ワークスペース構造

すべてのMCPサーバー生成ファイルは、プロジェクトごとに以下の構造で管理：

```
.claude/
└── workspace/
    └── effortlessly/
        ├── config/
        │   ├── workspace.yaml      # ワークスペース設定
        │   ├── security.yaml       # セキュリティ設定
        │   └── whitelist.yaml      # ホワイトリスト設定
        ├── index/
        │   ├── symbols.db          # シンボルインデックス（SQLite）
        │   ├── files.db            # ファイルインデックス（SQLite）
        │   └── cache/              # LSPキャッシュ
        ├── logs/
        │   ├── audit/              # 監査ログ
        │   │   └── 2024-01-01.log
        │   ├── error/              # エラーログ
        │   └── debug/              # デバッグログ
        ├── temp/                   # 一時ファイル
        └── backups/                # 設定バックアップ
```

この構造により：
- プロジェクトごとの独立性を保証
- .gitignoreに`.claude/workspace/`を追加するだけで管理可能
- 複数プロジェクトの並行作業が可能

### 4.4 データベース設計

インデックスには軽量で高速なSQLiteを採用：

#### symbols.db スキーマ
```sql
CREATE TABLE symbols (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  kind TEXT NOT NULL,  -- function, class, variable, etc.
  file_path TEXT NOT NULL,
  line INTEGER NOT NULL,
  column INTEGER NOT NULL,
  parent_id INTEGER,
  signature TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (parent_id) REFERENCES symbols(id)
);

-- 高速検索のためのインデックス
CREATE INDEX idx_symbols_name ON symbols(name);
CREATE INDEX idx_symbols_file ON symbols(file_path);
CREATE INDEX idx_symbols_name_kind ON symbols(name, kind);
CREATE INDEX idx_symbols_file_line ON symbols(file_path, line);
```

#### files.db スキーマ
```sql
CREATE TABLE files (
  id INTEGER PRIMARY KEY,
  path TEXT UNIQUE NOT NULL,
  size INTEGER NOT NULL,
  modified_at TIMESTAMP NOT NULL,
  indexed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  content_hash TEXT
);

CREATE INDEX idx_files_path ON files(path);
CREATE INDEX idx_files_modified ON files(modified_at);
```

## 5. セキュリティ設計

### 5.1 機密情報検出パターン
```typescript
const SENSITIVE_PATTERNS = {
  apiKey: /[A-Za-z0-9]{32,}/,
  password: /password\s*[:=]\s*["'].*?["']/i,
  connectionString: /(mongodb|postgres|mysql):\/\/.*/,
  privateKey: /-----BEGIN (RSA |EC )?PRIVATE KEY-----/,
  awsCredentials: /aws_access_key_id|aws_secret_access_key/i,
  jwt: /eyJ[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+/,
  creditCard: /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/,
  ssn: /\b\d{3}-\d{2}-\d{4}\b/,
  email: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/
};
```

### 5.2 ホワイトリスト設定例
```yaml
# .claude/workspace/effortlessly/config/security.yaml
security:
  mode: strict
  default_read_only: true
  allowed_paths:
    - /home/user/projects/myproject/src
    - /home/user/projects/myproject/tests
  excluded_patterns:
    - "*.env"
    - "*.key"
    - "*.pem"
    - "config/secrets/*"
  max_file_size: 1048576  # 1MB
  follow_symlinks: false
```

### 5.3 ワークスペース設定例
```yaml
# .claude/workspace/effortlessly/config/workspace.yaml
workspace:
  name: "my-project"
  root_path: "/home/user/projects/myproject"
  created_at: "2024-01-01T00:00:00Z"
  last_accessed: "2024-01-01T00:00:00Z"
  settings:
    index_enabled: true
    lsp_servers:
      - typescript
      - python
    auto_save_logs: true
    log_retention_days: 30
```

## 6. TODO リスト

### Phase 1: 基盤構築（1-2週間）

#### セットアップ
- [ ] プロジェクト初期化（TypeScript, ESLint, Prettier）
- [ ] パッケージ名を`effortlessly-mcp`に設定
- [ ] MCP SDK セットアップ
- [ ] ビルド環境構築（esbuild）
- [ ] テスト環境構築（Vitest）
- [ ] CI/CD パイプライン設定

#### コアアーキテクチャ
- [ ] 基本的なMCP Server実装
- [ ] Tool抽象クラスの実装
- [ ] エラーハンドリング基盤
- [ ] ロギング基盤実装

### Phase 2: 基本ツール実装（2-3週間）

#### ファイル操作ツール
- [ ] **secure_read_file**: 安全なファイル読み取り
  - パラメータ: `file_path` (string), `encoding?` (string), `max_size?` (number)
  - 機能: ホワイトリスト検証、機密情報マスキング、サイズ制限
  - 返り値: ファイル内容（フィルタリング済み）
  - ログ: `.claude/workspace/effortlessly/logs/audit/`に記録

- [ ] **secure_list_directory**: 制限付きディレクトリ一覧
  - パラメータ: `directory_path` (string), `recursive?` (boolean), `pattern?` (string)
  - 機能: ホワイトリスト検証、シンボリックリンク除外、隠しファイル制御
  - 返り値: ファイル/ディレクトリ情報の配列
  - キャッシュ: `.claude/workspace/effortlessly/index/files.db`

- [ ] **secure_get_file_metadata**: ファイルメタデータ取得
  - パラメータ: `file_path` (string)
  - 機能: サイズ、更新日時、パーミッション情報の取得
  - 返り値: メタデータオブジェクト
  - ログ: `.claude/workspace/effortlessly/logs/audit/`に記録

- [ ] **secure_search_files**: パターンベースファイル検索
  - パラメータ: `pattern` (string), `directory?` (string), `file_pattern?` (string)
  - 機能: 正規表現検索、ファイル名フィルタ、結果の機密情報マスキング
  - 返り値: マッチ結果の配列（ファイルパス、行番号、マッチ内容）
  - インデックス: `.claude/workspace/effortlessly/index/files.db`使用

#### プロジェクト管理ツール
- [ ] **workspace_activate**: ワークスペースの活性化
  - パラメータ: `workspace_name` (string) | `workspace_path` (string)
  - 機能: 指定ワークスペースを現在のコンテキストに設定
  - 返り値: 活性化されたワークスペース情報

- [ ] **workspace_get_info**: 現在のワークスペース情報取得
  - パラメータ: なし
  - 機能: アクティブなワークスペースの詳細情報を返す
  - 返り値: ワークスペース設定、統計情報

- [ ] **workspace_list_all**: 登録済みワークスペース一覧
  - パラメータ: なし
  - 機能: すべての登録ワークスペースをリスト表示
  - 返り値: ワークスペース情報の配列

- [ ] **workspace_configure**: ワークスペース設定の更新
  - パラメータ: `workspace_name` (string), `config` (object)
  - 機能: セキュリティ設定、ホワイトリスト、除外パターンの更新
  - 返り値: 更新後の設定

#### 設定管理ツール
- [ ] **config_get_security**: セキュリティ設定の取得
  - パラメータ: なし
  - 機能: 現在のセキュリティ設定を返す
  - 返り値: セキュリティ設定オブジェクト

- [ ] **config_update_whitelist**: ホワイトリストの更新
  - パラメータ: `action` ("add" | "remove"), `paths` (string[])
  - 機能: アクセス許可パスの追加/削除
  - 返り値: 更新後のホワイトリスト

- [ ] **audit_view_logs**: 監査ログの表示
  - パラメータ: `filter?` (object), `limit?` (number)
  - 機能: 操作履歴の検索・表示
  - 返り値: ログエントリの配列

- [ ] **config_export_settings**: 設定のエクスポート
  - パラメータ: `format?` ("yaml" | "json")
  - 機能: 現在の設定を指定形式でエクスポート
  - 返り値: 設定データ（文字列）

### Phase 3: LSP統合（3-4週間）

#### LSPサービス実装
- [ ] LSPクライアント基盤
- [ ] TypeScript LSP統合（typescript-language-server）
- [ ] Java LSP統合（Eclipse JDT LS）
- [ ] Kotlin LSP統合（kotlin-language-server）
- [ ] Swift LSP統合（SourceKit-LSP）
- [ ] Go LSP統合（gopls）
- [ ] Python LSP統合（Pylsp）
- [ ] シンボルキャッシュ実装

#### セマンティック検索ツール
- [ ] **code_find_symbol**: シンボル検索
  - パラメータ: `symbol_name` (string), `search_type?` ("exact" | "fuzzy"), `file_pattern?` (string)
  - 機能: 関数、クラス、変数などのシンボル定義を検索
  - 返り値: シンボル情報の配列（位置、型、シグネチャ）
  - インデックス: `.claude/workspace/effortlessly/index/symbols.db`

- [ ] **code_find_references**: 参照検索
  - パラメータ: `symbol_path` (string), `include_declarations?` (boolean)
  - 機能: 指定シンボルへのすべての参照を検索
  - 返り値: 参照位置の配列（ファイル、行、列、コンテキスト）
  - キャッシュ: `.claude/workspace/effortlessly/index/cache/`

- [ ] **code_get_symbol_hierarchy**: シンボル階層取得
  - パラメータ: `file_path?` (string), `directory_path?` (string)
  - 機能: ファイルまたはディレクトリのシンボル階層を取得
  - 返り値: 階層構造のツリーオブジェクト
  - インデックス: `.claude/workspace/effortlessly/index/symbols.db`

- [ ] **code_analyze_dependencies**: 依存関係分析
  - パラメータ: `file_path` (string), `depth?` (number)
  - 機能: インポート/エクスポートの依存関係を分析
  - 返り値: 依存関係グラフ
  - キャッシュ: `.claude/workspace/effortlessly/index/cache/dependencies.json`

### Phase 4: テストと文書化（2週間）

#### テスト実装
- [ ] ユニットテスト（各コンポーネント）
- [ ] 統合テスト（ツール連携）
- [ ] セキュリティテスト
- [ ] パフォーマンステスト

#### ドキュメント
- [ ] APIドキュメント
- [ ] セキュリティガイドライン
- [ ] 設定ガイド
- [ ] トラブルシューティング


## 7. 実装上の注意事項

### 7.1 セキュリティベストプラクティス
1. すべての入力を検証する
2. 最小権限の原則を徹底する
3. デフォルトで拒否、明示的に許可
4. すべての操作をログに記録
5. 定期的なセキュリティ監査

### 7.2 パフォーマンス考慮事項
1. 大きなファイルの部分読み込み
2. 非同期処理の活用
3. キャッシュの適切な利用
4. メモリリークの防止

### 7.3 保守性向上策
1. 明確なインターフェース定義
2. 依存性注入の活用
3. 包括的なテストカバレッジ
4. 詳細なログ出力

### 7.4 ワークスペース管理のベストプラクティス
1. リポジトリ名は`.git/config`から自動取得
2. ワークスペースディレクトリは初回アクセス時に自動作成
3. 設定ファイルはYAML形式で人間が読み書き可能
4. ログファイルは日付ベースでローテーション
5. インデックスは定期的に最適化
6. 一時ファイルは終了時に自動クリーンアップ

## 8. 成功指標

### 8.1 セキュリティ指標
- ゼロ機密情報漏洩
- 全操作の監査可能性100%
- セキュリティテスト合格率100%

### 8.2 パフォーマンス指標
- **シンボル検索: 50ms以内**
- **ファイル読み取り: 100ms以内**
- **参照検索: 200ms以内**
- 100万行のコードベースで5秒以内のインデックス
- メモリ使用量500MB以下

### 8.3 品質指標
- テストカバレッジ90%以上
- TypeScript strictモード準拠
- ゼロ既知脆弱性

## 9. リスクと対策

### 9.1 技術的リスク
- **LSP統合の複雑性**: 段階的な実装とフォールバック機能
- **パフォーマンス問題**: プロファイリングと最適化
- **互換性問題**: 複数バージョンのサポート

### 9.2 セキュリティリスク
- **ゼロデイ脆弱性**: 定期的なセキュリティ監査
- **設定ミス**: デフォルトセキュア設定
- **内部脅威**: 最小権限とログ監視

## 10. 次のステップ

1. このRDDのレビューと承認
2. 開発環境のセットアップ
3. Phase 1の実装開始
4. 週次進捗レビューの設定
5. セキュリティレビュープロセスの確立

## 11. ライセンスと公開

本プロジェクトはオープンソースとして公開予定。ライセンスはMIT Licenseを採用し、エンタープライズ環境での利用を促進する。