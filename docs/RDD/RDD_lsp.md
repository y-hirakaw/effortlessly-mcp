# RDD: LSP (Language Server Protocol) 統合システム

**Version**: 1.0.8  
**作成日**: 2025-08-09  
**最終更新**: 2025-08-09 - 設定システム改善実装完了

## 📋 要求定義概要

### 目的
effortlessly-mcpにおいて、複数のプログラミング言語に対するLSP（Language Server Protocol）統合を提供し、コード解析・検索・参照機能を実現する。

### 目標
1. **高性能**: シンボル検索 <50ms、参照検索 <200ms
2. **自動化**: 依存関係の自動検出・インストール・起動
3. **拡張性**: 新言語の容易な追加
4. **堅牢性**: エラーハンドリングと自動復旧

## 🎯 対応言語要求

### Phase 1: 実装完了 ✅
| 言語 | 実装状況 | 言語サーバー | 自動起動 | 備考 |
|------|----------|--------------|----------|------|
| **TypeScript/JavaScript** | ✅ 完了 | typescript-language-server | ✅ | Node.js プロジェクト対応 |
| **Swift** | ✅ 完了 | sourcekit-lsp | ❌ | システム標準LSP使用 |

### Phase 2: 実装予定 🔄
| 言語 | 優先度 | 言語サーバー | 自動起動 | インストール方法 |
|------|--------|--------------|----------|-----------------|
| **Go** | 高 | gopls | 🔄 準備完了 | システムパッケージ |
| **Java** | 高 | eclipse.jdt.ls | 🔄 準備完了 | システムパッケージ |
| **Kotlin** | 中 | kotlin-language-server | 🔄 準備完了 | システムパッケージ |
| **Python** | 中 | python-lsp-server | 🔄 準備完了 | pip経由 |

### 対応予定なし ❌
- **Rust**: プロジェクト要件外
- **C++**: 現時点で要求なし

## 🏗️ システム要求

### 機能要求

#### FR-LSP-001: 基本LSP機能
- **要求**: シンボル検索、参照検索、定義ジャンプ
- **実装**: ✅ 完了（TypeScript, Swift）
- **パフォーマンス**: シンボル検索 <50ms、参照検索 <200ms

#### FR-LSP-002: 自動起動システム
- **要求**: 言語サーバーの自動検出・起動
- **実装**: ✅ 完了（自動起動基盤）
- **対応**: TypeScript（有効）、Go/Java/Kotlin/Python（準備完了）

#### FR-LSP-003: 依存関係管理
- **要求**: LSPサーバー依存関係の自動インストール
- **実装**: ✅ 完了
- **サポート**: npm, pip, cargo, brew, apt

#### FR-LSP-004: プロジェクト統合
- **要求**: ワークスペースとの連携
- **実装**: ✅ 完了（AutoWorkspaceManager統合）
- **機能**: アクティベーション時の自動LSP起動

### 非機能要求

#### NFR-LSP-001: パフォーマンス
- シンボル検索: <50ms
- 参照検索: <200ms  
- プロジェクト解析: 初回 <10秒、キャッシュ後 <1秒
- メモリ使用量: <500MB（大規模プロジェクト）

#### NFR-LSP-002: 可用性
- LSPサーバー起動成功率: >95%
- エラー時の自動復旧: 対応
- グレースフルシャットダウン: 対応

#### NFR-LSP-003: 拡張性
- 新言語追加: 設定ファイルベース
- プラグイン対応: 将来拡張
- カスタムLSPサーバー: 対応

## 📊 現在の実装状況

### 完了コンポーネント

#### 1. コアLSPシステム
```
src/services/lsp/
├── index.ts                     # LSPManager (統合管理)
├── lsp-client.ts                # LSPクライアント基盤
├── lsp-auto-launcher.ts         # 自動起動システム
├── lsp-dependency-manager.ts    # 依存関係管理
├── swift-lsp.ts                 # Swift実装 (42KB)
├── typescript-lsp.ts            # TypeScript実装 (15KB)
├── symbol-indexer.ts            # シンボルインデックス
└── types.ts                     # 型定義
```

#### 2. ツール統合
```
src/tools/code-analysis/
├── code-find-symbol.ts
├── code-find-references.ts
├── code-get-symbol-hierarchy.ts
├── code-get-symbols-overview.ts
├── code-analyze-dependencies.ts
└── code-find-referencing-symbols.ts
```

#### 3. テストスイート
- **Swift LSP**: 包括的統合テスト
- **TypeScript LSP**: 基本機能テスト
- **自動起動システム**: 391行の詳細テスト
- **カバレッジ**: 99.4%+

### 設定要求

#### 改善された設定構造 ✅ **v1.0.8で実装完了**
```yaml
# .claude/workspace/effortlessly/config.yaml
lsp_servers:
  # LSPプロキシサーバー設定
  proxy_server:
    enabled: true
    host: "localhost"
    port: 3001
    auto_start: true  # workspace_activate時の自動起動
    startup_timeout: 10000  # 起動タイムアウト（ms）
  
  # 利用する言語サーバーの選択（コメントアウトで無効化）
  enabled_languages:
    - typescript    # TypeScript/JavaScript 開発
    - swift         # Swift 開発  
    # - python      # Python 開発（無効化例）
    # - go          # Go 開発（準備中）
    # - java        # Java 開発（準備中）
    # - kotlin      # Kotlin 開発（準備中）
  
  # 各言語サーバーの詳細設定
  language_configurations:
    typescript:
      server_command: "typescript-language-server"
      server_args: ["--stdio"]
      auto_install: true
      file_extensions: [".ts", ".js", ".tsx", ".jsx", ".mts", ".cts"]
    python:
      server_command: "pylsp"
      server_args: []
      auto_install: false
      file_extensions: [".py", ".pyi", ".pyw"]
    swift:
      server_command: "sourcekit-lsp"
      server_args: []
      auto_install: false
      file_extensions: [".swift", ".swiftinterface"]
```

#### 従来の設定構造（非推奨）
```yaml
# 旧構造 - 複雑で管理が困難
lsp_servers: 
  supported_languages:
    typescript:
      enabled: true
      server_command: "typescript-language-server"
    # ...
```

#### 設定改善の利点
1. **直感的な操作**
   - コメントアウト（`# - python`）で言語を無効化
   - コメント削除（`- python`）で言語を有効化

2. **設定の可視性**
   - 有効な言語が `enabled_languages` で一目瞭然
   - 利用可能な言語がすべてリスト表示

3. **保守性の向上**
   - 設定構造がシンプル
   - 新しい言語の追加が容易

4. **エラーの削減**
   - YAML構造エラーのリスク最小化
   - タイポによる設定ミスの防止

## 🔧 技術仕様

### 言語サーバー仕様

#### TypeScript/JavaScript
```typescript
{
  name: 'typescript-language-server',
  command: 'typescript-language-server',
  args: ['--stdio'],
  fileExtensions: ['.ts', '.js', '.tsx', '.jsx', '.mts', '.cts'],
  auto_start: {
    enabled: true,
    auto_install: true,
    dependencies: [
      { name: 'typescript', version: '5.5.4', installer: 'npm' },
      { name: 'typescript-language-server', version: '4.3.3', installer: 'npm' }
    ]
  }
}
```

#### Swift
```typescript
{
  name: 'sourcekit-lsp',
  command: 'sourcekit-lsp',
  args: [],
  fileExtensions: ['.swift', '.swiftinterface'],
  auto_start: {
    enabled: true,
    auto_install: false, // システム標準使用
    check_command: ['sourcekit-lsp', '--help']
  }
}
```

#### Go（実装予定）
```typescript
{
  name: 'gopls',
  command: 'gopls',
  args: [],
  fileExtensions: ['.go'],
  auto_start: {
    enabled: false, // 将来有効化
    auto_install: false,
    dependencies: [
      { name: 'gopls', installer: 'system' }
    ]
  }
}
```

#### Java（実装予定）
```typescript
{
  name: 'eclipse-jdtls',
  command: 'jdtls',
  args: [],
  fileExtensions: ['.java'],
  auto_start: {
    enabled: false, // 将来有効化
    auto_install: false,
    dependencies: [
      { name: 'eclipse.jdt.ls', installer: 'system' }
    ]
  }
}
```

#### Kotlin（実装予定）
```typescript
{
  name: 'kotlin-language-server',
  command: 'kotlin-language-server', 
  args: [],
  fileExtensions: ['.kt', '.kts'],
  auto_start: {
    enabled: false, // 将来有効化
    auto_install: false,
    dependencies: [
      { name: 'kotlin-language-server', installer: 'system' }
    ]
  }
}
```

#### Python（実装予定）
```typescript
{
  name: 'pylsp',
  command: 'pylsp',
  args: [],
  fileExtensions: ['.py', '.pyi', '.pyw'],
  auto_start: {
    enabled: false, // 将来有効化
    auto_install: false,
    dependencies: [
      { name: 'python-lsp-server[all]', installer: 'pip' }
    ]
  }
}
```

### API仕様

#### LSPManager
```typescript
class LSPManager {
  // 初期化
  async initialize(workspaceRoot: string): Promise<void>
  
  // 言語サポート有効化
  async enableLanguageSupport(language: string, config?: Partial<ExtendedLSPServerConfig>): Promise<boolean>
  
  // 複数言語一括有効化
  async enableMultipleLanguages(languages: string[]): Promise<Map<string, boolean>>
  
  // 依存関係レポート
  getDependencyReport(): DependencyReport | undefined
  
  // 全クライアント切断
  async disconnectAll(): Promise<void>
}
```

#### LSPAutoLauncher
```typescript
class LSPAutoLauncher {
  // サーバー検出・起動
  async detectAndStartServer(language: string, config?: Partial<ExtendedLSPServerConfig>): Promise<LSPClientBase | null>
  
  // 依存関係確保
  async ensureDependencies(language: string, config: ExtendedLSPServerConfig): Promise<boolean>
  
  // システムシャットダウン
  async shutdown(): Promise<void>
  
  // 設定済み言語取得
  getConfiguredLanguages(): string[]
}
```

#### LSPDependencyManager
```typescript
class LSPDependencyManager {
  // 初期化
  async initialize(): Promise<void>
  
  // 依存関係インストール
  async installDependencies(dependencies: LSPDependency[], config?: LSPAutoStartConfig): Promise<DependencyInstallResult[]>
  
  // 単一依存関係インストール
  async installSingleDependency(dependency: LSPDependency, config?: LSPAutoStartConfig): Promise<DependencyInstallResult>
  
  // 失敗したインストールのクリーンアップ
  async cleanupFailedInstallations(): Promise<void>
  
  // インストールレポート
  getInstallationReport(): InstallationReport
}
```

## 🚀 実装ロードマップ

### Phase 1: 基盤実装 ✅ 完了
- [x] LSP基盤システム
- [x] TypeScript/JavaScript実装
- [x] Swift実装  
- [x] 自動起動システム基盤
- [x] 依存関係管理システム
- [x] テストスイート
- [x] **設定システム改善** (v1.0.8) - 直感的な言語サーバー選択

### Phase 2: 言語拡張 🔄 準備完了
- [ ] Go LSP実装
- [ ] Java LSP実装
- [ ] Kotlin LSP実装
- [ ] Python LSP実装
- [ ] 各言語テストスイート
- [ ] ドキュメント更新

### Phase 3: 高度機能 📋 計画中
- [ ] マルチプロジェクト対応
- [ ] リアルタイム同期
- [ ] パフォーマンス最適化
- [ ] バイナリ自動ダウンロード
- [ ] 監視ダッシュボード

## 🧪 品質保証要求

### テスト要求
- **単体テスト**: 各コンポーネント90%+カバレッジ
- **統合テスト**: 言語サーバー連携テスト
- **パフォーマンステスト**: レスポンス時間検証
- **エラーハンドリングテスト**: 障害シナリオ対応

### 品質メトリクス
- **コードカバレッジ**: >95%
- **パフォーマンス**: 要求仕様内
- **可用性**: >99%
- **MTTR**: <5分（自動復旧）

## 📚 参考資料

### 技術仕様
- [Language Server Protocol Specification](https://microsoft.github.io/language-server-protocol/)
- [TypeScript Language Server](https://github.com/typescript-language-server/typescript-language-server)
- [Swift SourceKit-LSP](https://github.com/apple/sourcekit-lsp)

### 関連ドキュメント
- `docs/ARCHITECTURE.md`: システムアーキテクチャ
- `src/services/lsp/types.ts`: 型定義
- `tests/lsp-auto-launcher.test.ts`: テスト仕様
- `.claude/workspace/effortlessly/memory/lsp_integration_status.md`: 実装状況

---

**最終更新者**: Claude Code SuperClaude  
**承認者**: Project Owner  
**次回レビュー**: Phase 2実装完了時
