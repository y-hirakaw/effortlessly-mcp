# Swift Development Guide - effortlessly-mcp

effortlessly-mcpを使ったSwift開発の完全ガイド - SourceKit-LSP統合による高度なコード解析

## 🚀 概要

effortlessly-mcpは、AppleのSourceKit-LSPと統合することで、Swiftプロジェクトに対して以下の機能を提供します：

- **高精度なシンボル検索**: クラス、関数、プロパティ、プロトコルの検索
- **依存関係分析**: Swift Package Manager、CocoaPods対応
- **参照検索**: シンボルの使用箇所を正確に特定
- **Package.swift自動認識**: SPMプロジェクトの自動設定
- **マルチプラットフォーム対応**: iOS、macOS、watchOS、tvOS

## 📋 前提条件

### 必須要件

1. **Xcode または Swift Toolchain**
   ```bash
   # Xcodeがインストールされている場合
   xcode-select --print-path
   
   # Swift単体がインストールされている場合
   swift --version
   ```

2. **SourceKit-LSP**
   ```bash
   # Xcodeに含まれている場合（推奨）
   xcrun --find sourcekit-lsp
   
   # Homebrewの場合
   brew install swift
   which sourcekit-lsp
   ```

3. **effortlessly-mcp**
   ```bash
   git clone https://github.com/y-hirakaw/effortlessly-mcp.git
   cd effortlessly-mcp
   npm install && npm run build
   ```

### 推奨環境

- **macOS**: 12.0以上（SourceKit-LSPの安定性のため）
- **Xcode**: 14.0以上
- **Swift**: 5.7以上

## ⚙️ セットアップ

### 1. AutoWorkspaceManager機能

effortlessly-mcpには、プロジェクトに応じて自動的にワークスペースを設定する **AutoWorkspaceManager** 機能が搭載されています。

#### 自動設定ファイル

プロジェクトルートに以下の設定ファイルを配置することで、カスタムワークスペース設定が可能です：

**`.claude/workspace/effortlessly/auto-workspace.yaml`**

```yaml
# effortlessly-mcp Auto Workspace Configuration
auto_workspace:
  auto_activate: true
  project:
    type: "swift"  # プロジェクトタイプを手動でSwiftに設定
    lsp_servers: ["swift"]  # LSPサーバーを手動指定
    index_enabled: true
    auto_save_logs: true
  display:
    show_banner: true
    custom_banner: |
      🍎 Swift Development Workspace Ready! 🚀
      Custom configuration loaded successfully!
    verbose_logging: true
    use_emojis: true
  advanced:
    init_timeout: 30000
    detection_depth: 3
    retry_count: 2
```

#### 起動時の動作

**初回起動時**（ワークスペースが存在しない場合）：
```
🎯 Starting auto workspace activation...
📋 Current workspace status: none
🚀 No active workspace found, starting auto-activation...
🚀 Initializing effortlessly-mcp workspace...
📁 Project: effortlessly-mcp
🔍 Project type: swift (configured)  ← カスタム設定
⚙️  LSP servers: swift (configured)   ← カスタム設定

🍎 Swift Development Workspace Ready! 🚀  ← カスタムバナー
Custom configuration loaded successfully!
```

**再起動時**（ワークスペースが既存の場合）：
- 自動初期化メッセージは表示されません（重複初期化防止）
- 設定ファイルからの値は引き続き有効
- `workspace_get_info` で設定内容を確認可能

#### 設定確認方法

```typescript
// ワークスペース状態の確認
const info = await mcp.callTool('workspace_get_info');
// 結果: settings.lsp_servers: ["swift"] (設定ファイルから読み込み)

// 設定ファイルの直接確認
const config = await mcp.callTool('read_file', {
  file_path: '/Users/username/.claude/workspace/effortlessly/auto-workspace.yaml'
});
```

### 2. SourceKit-LSPの確認

```bash
# SourceKit-LSPが利用可能か確認
xcrun --find sourcekit-lsp
# または
which sourcekit-lsp

# Swiftバージョン確認
swift --version
```

### 2. Claude Code設定

Claude Codeの設定ファイルに以下を追加：

**macOS**: `~/Library/Application Support/Claude/config.json`

```json
{
  "mcpServers": {
    "effortlessly-mcp": {
      "type": "stdio",
      "command": "node",
      "args": [
        "/path/to/your/effortlessly-mcp/build/index.js"
      ],
      "env": {
        "NODE_ENV": "production"
      }
    }
  }
}
```

### 3. ワークスペース有効化

Claude Code内で以下を実行してSwiftワークスペースを有効化：

```typescript
// Swiftプロジェクトのワークスペースを有効化
const result = await mcp.callTool('workspace_activate', {
  workspace_path: '/path/to/your/swift/project',
  name: 'my-swift-project',
  lsp_servers: ['swift'],
  index_enabled: true
});
```

## 📁 サポートするプロジェクト構造

### Swift Package Manager (SPM)

```
MySwiftProject/
├── Package.swift                    # ✅ 自動認識
├── Sources/
│   ├── MyLibrary/
│   │   ├── MyClass.swift
│   │   └── Utils.swift
│   └── MyExecutable/
│       └── main.swift
├── Tests/
│   └── MyLibraryTests/
│       └── MyClassTests.swift
└── README.md
```

### iOS/macOSプロジェクト

```
MyApp/
├── MyApp.xcodeproj/                 # ✅ 対応
├── MyApp/
│   ├── AppDelegate.swift
│   ├── ViewController.swift
│   └── Models/
│       └── User.swift
├── MyAppTests/
│   └── UserTests.swift
└── Podfile                          # ✅ CocoaPods対応
```

### Multiplatform Project

```
MultiplatformApp/
├── Package.swift
├── Sources/
│   ├── App/                         # iOS/macOS共通
│   │   ├── ContentView.swift
│   │   └── AppModel.swift
│   ├── Core/                        # ビジネスロジック
│   │   └── DataManager.swift
│   └── Utilities/                   # ユーティリティ
│       └── Extensions.swift
└── Tests/
    └── CoreTests/
        └── DataManagerTests.swift
```

## 💻 基本的な使い方

### 1. Swift固有のシンボル検索

```typescript
// クラス検索
const classes = await mcp.callTool('code_find_symbol', {
  symbol_name: 'ViewController',
  search_type: 'fuzzy',
  max_results: 20
});

// プロトコル検索
const protocols = await mcp.callTool('code_find_symbol', {
  symbol_name: 'Delegate',
  search_type: 'fuzzy',
  max_results: 15
});

// 関数検索（複数パターン）
const functions = await mcp.callTool('code_find_symbol', {
  symbol_name: 'viewDidLoad',
  search_type: 'exact'
});
```

### 2. Swift Package依存関係分析

```typescript
// Package.swiftファイルの依存関係分析
const dependencies = await mcp.callTool('code_analyze_dependencies', {
  file_path: '/path/to/your/project/Package.swift',
  depth: 2,
  include_external: true,
  resolve_imports: true
});

// 結果例:
// {
//   "dependencies": {
//     "imports": [
//       {
//         "source": "Foundation",
//         "is_external": true,
//         "import_type": "framework"
//       },
//       {
//         "source": "SwiftUI", 
//         "is_external": true,
//         "import_type": "framework"
//       }
//     ]
//   }
// }
```

### 3. Swiftファイルの階層構造取得

```typescript
// ViewControllerの構造を詳細取得
const hierarchy = await mcp.callTool('code_get_symbol_hierarchy', {
  file_path: '/path/to/ViewController.swift',
  max_depth: 3,
  include_private: false
});

// プロジェクト全体の概要
const overview = await mcp.callTool('code_get_symbols_overview', {
  relative_path: 'Sources',
  max_depth: 2,
  symbol_kinds: [5, 6, 11, 12]  // Class, Method, Interface, Function
});
```

### 4. 参照検索

```typescript
// 特定のクラスを使用している箇所を検索
const references = await mcp.callTool('code_find_referencing_symbols', {
  target_file: '/path/to/User.swift',
  target_symbol: 'User',
  search_scope: 'workspace',
  include_context: true
});
```

## 🎯 Swift開発での実践例

### 1. SwiftUIコンポーネント分析

```typescript
// SwiftUIビューの構造分析
const swiftUIViews = await mcp.callTool('code_search_pattern', {
  pattern: 'struct\\s+\\w+View\\s*:\\s*View',
  directory_path: 'Sources',
  file_pattern: '*.swift',
  include_context: true
});

// @State、@Bindingプロパティの検索
const stateProperties = await mcp.callTool('code_search_pattern', {
  pattern: '@(State|Binding|ObservedObject)\\s+var\\s+\\w+',
  directory_path: 'Sources',
  file_pattern: '*.swift',
  include_context: true
});
```

### 2. iOS開発パターン分析

```typescript
// ViewControllerライフサイクルメソッドの検索
const lifecycleMethods = await mcp.callTool('code_search_pattern', {
  pattern: 'override\\s+func\\s+(viewDidLoad|viewDidAppear|viewWillAppear)',
  directory_path: 'Sources',
  file_pattern: '*.swift',
  include_context: true
});

// IBOutlet/IBActionの検索
const interfaceBuilder = await mcp.callTool('code_search_pattern', {
  pattern: '@IB(Outlet|Action)\\s+(weak\\s+)?var\\s+\\w+',
  directory_path: 'Sources', 
  file_pattern: '*.swift',
  include_context: true
});
```

### 3. プロトコル実装の分析

```typescript
// プロトコル準拠クラスの検索
const protocolConformance = await mcp.callTool('code_search_pattern', {
  pattern: 'class\\s+\\w+.*:\\s*.*\\w+Protocol',
  directory_path: 'Sources',
  file_pattern: '*.swift',
  include_context: true
});

// Delegateパターンの分析
const delegates = await mcp.callTool('code_search_pattern', {
  pattern: 'protocol\\s+\\w+Delegate',
  directory_path: 'Sources',
  file_pattern: '*.swift',
  include_context: true
});
```

### 4. エラーハンドリングパターン

```typescript
// Result型使用箇所の検索
const resultTypes = await mcp.callTool('code_search_pattern', {
  pattern: 'Result<\\w+,\\s*\\w+>',
  directory_path: 'Sources',
  file_pattern: '*.swift',
  include_context: true
});

// do-catch文の検索
const errorHandling = await mcp.callTool('code_search_pattern', {
  pattern: 'do\\s*\\{[\\s\\S]*?\\}\\s*catch',
  directory_path: 'Sources',
  file_pattern: '*.swift',
  include_context: true
});
```

## 🔧 高度な機能

### 1. Package.swift自動解析

effortlessly-mcpは、Package.swiftファイルを自動認識し、以下を実行します：

- **依存関係の自動検出**
- **プロジェクト構造の把握**
- **SourceKit-LSPの最適設定**

```typescript
// プロジェクト設定の確認
const workspaceInfo = await mcp.callTool('workspace_get_info');

// 出力例:
// {
//   "workspace": {
//     "name": "my-swift-project",
//     "lsp_servers": ["swift"],
//     "file_count": 45,
//     "symbol_count": 234
//   }
// }
```

### 2. マルチターゲット対応

```typescript
// iOS固有のコードパターン検索
const iOSCode = await mcp.callTool('code_search_pattern', {
  pattern: '#if\\s+os\\(iOS\\)',
  directory_path: 'Sources',
  file_pattern: '*.swift',
  include_context: true
});

// macOS固有のコードパターン検索  
const macOSCode = await mcp.callTool('code_search_pattern', {
  pattern: '#if\\s+os\\(macOS\\)',
  directory_path: 'Sources',
  file_pattern: '*.swift',
  include_context: true
});
```

### 3. テストコード分析

```typescript
// XCTestCase継承クラスの検索
const testClasses = await mcp.callTool('code_search_pattern', {
  pattern: 'class\\s+\\w+.*:\\s*XCTestCase',
  directory_path: 'Tests',
  file_pattern: '*.swift',
  include_context: true
});

// テストメソッドの検索
const testMethods = await mcp.callTool('code_search_pattern', {
  pattern: 'func\\s+test\\w+\\(\\)',
  directory_path: 'Tests',
  file_pattern: '*.swift',
  include_context: true
});
```

## 📝 コード編集機能

### 1. Swiftコードの精密編集

```typescript
// ViewControllerの実装を更新
const editResult = await mcp.callTool('smart_edit_file', {
  file_path: '/path/to/ViewController.swift',
  old_text: 'override func viewDidLoad() {\n        super.viewDidLoad()\n    }',
  new_text: `override func viewDidLoad() {
        super.viewDidLoad()
        setupUI()
        configureConstraints()
    }`,
  create_backup: true
});
```

### 2. プロパティの追加

```typescript
// クラスにプロパティを追加
const insertResult = await mcp.callTool('smart_insert_text', {
  file_path: '/path/to/User.swift',
  text: '    @Published var isActive: Bool = true',
  position_type: 'after_text',
  reference_text: 'class User: ObservableObject {',
  auto_indent: true
});
```

### 3. インポート文の管理

```typescript
// 新しいフレームワークのインポートを追加
const importResult = await mcp.callTool('smart_insert_text', {
  file_path: '/path/to/ContentView.swift',
  text: 'import Combine',
  position_type: 'after_text',
  reference_text: 'import SwiftUI',
  create_backup: true
});
```

## 🔧 プロジェクトメモリ活用

### Swift開発知識の保存

```typescript
// アーキテクチャ決定を記録
const architectureNotes = await mcp.callTool('project_memory_write', {
  memory_name: 'swift-architecture-decisions',
  content: `# Swift Architecture Decisions

## MVVM + Combine
- ViewModelはObservableObjectを継承
- @Publishedでデータバインディング
- Combineでリアクティブプログラミング

## 依存関係注入
- プロトコルベースの設計
- 環境変数でDI管理
- テスタビリティを重視

## エラーハンドリング
- Result<T, Error>型を活用
- カスタムErrorプロトコル実装
- ユーザーフレンドリーなエラーメッセージ
`,
  tags: ['architecture', 'swift', 'mvvm', 'combine']
});

// 開発ガイドラインの保存
const guidelines = await mcp.callTool('project_memory_write', {
  memory_name: 'swift-coding-guidelines',
  content: `# Swift Coding Guidelines

## 命名規則
- クラス: PascalCase (UserService)
- 関数・変数: camelCase (getUserData)
- 定数: camelCase (maxRetryCount)
- プロトコル: 〜able, 〜ing (Codable, Networking)

## SwiftUI規則
- View構造体は〜Viewサフィックス
- @State は private
- @Binding は親から子へのデータ渡し

## コード構成
- 1ファイル1クラス原則
- extension で機能分割
- MARK: コメントで区切り
`,
  tags: ['guidelines', 'swift', 'swiftui', 'naming']
});
```

## 🐛 トラブルシューティング

### AutoWorkspaceManager関連

#### 1. カスタム設定が反映されない

**症状**: 設定ファイルを作成したが、デフォルト設定のままになる

**解決方法**:
```bash
# 設定ファイルの存在確認
ls -la ~/.claude/workspace/effortlessly/auto-workspace.yaml

# 設定ファイルの内容確認
cat ~/.claude/workspace/effortlessly/auto-workspace.yaml

# YAML構文チェック（Pythonの場合）
python -c "import yaml; yaml.safe_load(open('~/.claude/workspace/effortlessly/auto-workspace.yaml'))"
```

**チェックポイント**:
- YAMLのインデントが正しいか（スペース2個）
- ファイルのエンコーディングがUTF-8か
- ファイルの読み取り権限があるか

#### 2. 自動初期化バナーが表示されない

**正常な動作**:
- **初回起動時のみ**: カスタムバナーが表示される
- **再起動時**: 既存ワークスペースがある場合は表示されない（仕様）

**確認方法**:
```typescript
// ワークスペース状態確認
const info = await mcp.callTool('workspace_get_info');
console.log('LSP Servers:', info.workspace.settings.lsp_servers);
// 期待値: ["swift"] (設定ファイルから読み込み)
```

#### 3. TypeScriptプロジェクトがSwiftとして認識されない

**設定ファイルで強制指定**:
```yaml
auto_workspace:
  project:
    type: "swift"           # 手動でSwiftに設定
    lsp_servers: ["swift"]  # LSPサーバーを手動指定
```

**確認コマンド**:
```typescript
const info = await mcp.callTool('workspace_get_info');
// project.type が "swift (configured)" と表示されることを確認
```

### よくある問題と解決方法

#### 1. SourceKit-LSPが見つからない

```bash
# Xcodeのパスを確認
xcode-select --print-path

# パスが正しくない場合
sudo xcode-select --switch /Applications/Xcode.app/Contents/Developer

# SourceKit-LSPの場所を確認
xcrun --find sourcekit-lsp
```

#### 2. Swiftファイルが認識されない

```typescript
// ワークスペースの再有効化
const reactivate = await mcp.callTool('workspace_activate', {
  workspace_path: '/path/to/your/swift/project',
  lsp_servers: ['swift'],
  index_enabled: true
});

// Swiftファイル検出の確認
const files = await mcp.callTool('search_files', {
  directory: '/path/to/your/swift/project',
  file_pattern: '*.swift',
  recursive: true
});
```

#### 3. Package.swiftが認識されない

Package.swiftファイルがプロジェクトルートにあることを確認：

```bash
# プロジェクト構造確認
ls -la /path/to/your/swift/project/Package.swift

# Package.swiftの内容確認
cat /path/to/your/swift/project/Package.swift
```

#### 4. シンボル検索が動作しない

```typescript
// LSP接続状況の確認
const workspaceInfo = await mcp.callTool('workspace_get_info');

// 手動でのファイル検索テスト
const manualSearch = await mcp.callTool('search_files', {
  directory: '/path/to/your/swift/project/Sources',
  content_pattern: 'class.*ViewController',
  recursive: true,
  include_content: true
});
```

### デバッグ情報取得

```typescript
// 詳細なワークスペース情報
const debugInfo = await mcp.callTool('workspace_get_info');
console.log('Workspace Info:', JSON.stringify(debugInfo, null, 2));

// Swiftファイル一覧
const swiftFiles = await mcp.callTool('search_files', {
  directory: '/path/to/your/swift/project',
  file_pattern: '*.swift',
  recursive: true
});
console.log('Swift Files:', swiftFiles.length);
```

## 📊 パフォーマンス最適化

### 大規模Swiftプロジェクト向け

```typescript
// 検索結果を制限
const optimizedSearch = await mcp.callTool('code_find_symbol', {
  symbol_name: 'View',
  search_type: 'fuzzy',
  file_pattern: 'Sources',     // 検索範囲を限定
  max_results: 30              // 結果数制限
});

// ディレクトリ単位での分析
const moduleAnalysis = await mcp.callTool('code_get_symbols_overview', {
  relative_path: 'Sources/Core',  // 特定モジュールのみ
  max_depth: 2,                   // 深度制限
  include_private: false          // パブリックAPIのみ
});
```

## 🔗 統合ワークフロー例

### 1. コードレビューワークフロー

```typescript
// 1. TODOコメントの検索
const todos = await mcp.callTool('code_search_pattern', {
  pattern: '//\\s*TODO.*',
  directory_path: 'Sources',
  file_pattern: '*.swift',
  include_context: true
});

// 2. 廃止予定APIの検索
const deprecated = await mcp.callTool('code_search_pattern', {
  pattern: '@available\\(.*,\\s*deprecated',
  directory_path: 'Sources', 
  file_pattern: '*.swift',
  include_context: true
});

// 3. 強制アンラップの検索
const forceUnwraps = await mcp.callTool('code_search_pattern', {
  pattern: '\\w+!(?!\\s*=)',
  directory_path: 'Sources',
  file_pattern: '*.swift',
  include_context: true
});
```

### 2. リファクタリング支援

```typescript
// 1. 古いAPIの使用箇所特定
const oldAPI = await mcp.callTool('code_find_referencing_symbols', {
  target_file: '/path/to/LegacyService.swift',
  target_symbol: 'LegacyService',
  search_scope: 'workspace',
  include_context: true
});

// 2. 段階的にクラス名を更新
const renameClass = await mcp.callTool('smart_edit_file', {
  file_path: '/path/to/LegacyService.swift',
  old_text: 'class LegacyService',
  new_text: 'class UserService',
  create_backup: true
});

// 3. 各参照箇所の更新
for (const ref of oldAPI.referencing_symbols) {
  await mcp.callTool('smart_edit_file', {
    file_path: ref.file_path,
    old_text: 'LegacyService',
    new_text: 'UserService',
    create_backup: true
  });
}
```

## 📝 CLAUDE.mdへの推奨設定

プロジェクトの`CLAUDE.md`ファイルに以下の設定を追加することで、Claude Codeがeffortlessly-mcpのLSP統合機能を最大限活用できます。

### 🎯 Swift開発向け推奨設定

```markdown
# CLAUDE.md - Swift Development Configuration

## MCP Server Information

This project uses **effortlessly-mcp** with SourceKit-LSP integration for advanced Swift development.

### Available Tools Priority

**Primary Tools (LSP統合済み - 高速・高精度)**:
1. `mcp__effortlessly-mcp__code_find_symbol` - シンボル検索（クラス、関数、プロトコル）
2. `mcp__effortlessly-mcp__code_find_references` - 参照検索
3. `mcp__effortlessly-mcp__code_get_symbols_overview` - 階層構造分析
4. `mcp__effortlessly-mcp__code_analyze_dependencies` - 依存関係分析
5. `mcp__effortlessly-mcp__smart_edit_file` - 安全なファイル編集
6. `mcp__effortlessly-mcp__smart_insert_text` - 精密なコード挿入

**Development Commands**:
```bash
# Building and Testing
swift build              # Swift Package Manager build
swift test              # Run tests
xcodebuild              # Xcode project build
```

### Swift Development Guidelines

**Symbol Search Patterns**:
- Classes: `MyViewController`, `UserService`
- Protocols: `Delegate`, `DataSource` 
- SwiftUI Views: `ContentView`, `SettingsView`
- Functions: `viewDidLoad`, `configureUI`

**Code Analysis Priorities**:
1. **Architecture Analysis**: MVVM, MVC, VIPER パターンの識別
2. **SwiftUI Components**: @State, @Binding, @ObservedObject の使用分析
3. **Protocol Conformance**: Codable, Equatable, Hashable の実装確認
4. **Memory Management**: weak, unowned キーワードの使用パターン

**Security Considerations**:
- API キーやシークレットのハードコーディング検出
- keychain使用パターンの分析
- ネットワーク通信のセキュリティ確認

### Project Structure Recognition

**Automatic Detection**:
- Package.swift → Swift Package Manager project
- *.xcodeproj → iOS/macOS Xcode project  
- Podfile → CocoaPods integration
- Sources/ → Source code directory
- Tests/ → Test code directory

**Optimization Settings**:
```markdown
## Performance Optimization

- Use `mcp__effortlessly-mcp__search_files` for basic file operations
- Use LSP-integrated tools for semantic code analysis
- Limit search scope with `file_pattern: "*.swift"` 
- Use `max_results` parameter for large codebases
```
```

### 🔧 開発効率向上のための設定例

```markdown
## Swift-Specific Workflow

### Daily Development Tasks

1. **Feature Development**:
   ```
   1. Use code_find_symbol to locate relevant classes
   2. Use code_get_symbols_overview for architecture understanding
   3. Use smart_edit_file for implementation
   4. Use code_find_references for impact analysis
   ```

2. **Code Review**:
   ```
   1. Search for TODO comments: pattern: "//\\s*TODO.*"
   2. Find force unwraps: pattern: "\\w+!(?!\\s*=)"
   3. Check deprecated APIs: pattern: "@available\\(.*,\\s*deprecated"
   ```

3. **Refactoring**:
   ```
   1. Find all references before renaming
   2. Use smart_edit_file with backup enabled
   3. Validate changes with dependency analysis
   ```

### Testing Integration

**XCTest Pattern Detection**:
- Test classes: `class.*Tests.*: XCTestCase`
- Test methods: `func test\\w+\\(\\)`
- Setup/teardown: `setUp|tearDown`

**SwiftUI Testing**:
- Preview providers: `struct.*_Previews.*: PreviewProvider`
- View modifiers: `\\.\\w+\\(`
- State management: `@State|@Binding|@ObservedObject`
```

### 🛡️ セキュリティ設定

```markdown
## Security Configuration

### Sensitive Pattern Detection

The effortlessly-mcp automatically detects and masks:
- API keys: `api_key|apikey`
- Passwords: `password|pwd`  
- Tokens: `token|bearer`
- Private keys: `private_key|privateKey`

### Safe Development Practices

1. **Always use smart_edit_file** - automatic backup creation
2. **Enable preview_mode** for large changes
3. **Validate file paths** - automatic path sanitization
4. **Audit logging** - all operations logged in .claude/workspace/

### Code Quality Gates

**Before Commit**:
1. Search for hardcoded secrets
2. Check force unwraps and implicitly unwrapped optionals
3. Validate error handling patterns
4. Review memory management (weak/unowned)

**Security Checklist**:
- [ ] No hardcoded API keys or secrets
- [ ] Proper keychain usage for sensitive data
- [ ] Network security (certificate pinning, HTTPS)
- [ ] Input validation and sanitization
```

### 📊 パフォーマンス設定

```markdown
## Performance Guidelines

### Large Codebase (1000+ files)

```markdown
# Optimize for large Swift projects
max_results: 50              # Limit search results
file_pattern: "Sources/*.swift"  # Narrow search scope  
recursive: false             # Avoid deep recursion
include_context: false       # Reduce token usage
```

### Memory Management

```markdown
# LSP server resource management
lsp_servers: ["swift"]       # Single LSP instance
index_enabled: true          # Cache symbol information
auto_save_logs: false        # Reduce I/O for performance
```

### Response Time Targets

- Symbol search: <50ms
- Reference finding: <200ms  
- File reading: <100ms
- Dependency analysis: <500ms
```

## 📖 関連リソース

### Apple公式ドキュメント
- [SourceKit-LSP](https://github.com/apple/sourcekit-lsp) - Apple公式LSPサーバー
- [Swift Package Manager](https://swift.org/package-manager/) - 依存関係管理
- [Swift.org](https://swift.org/) - Swift言語公式サイト

### effortlessly-mcp関連
- [SETUP.md](./SETUP.md) - 基本セットアップ
- [USAGE.md](./USAGE.md) - 一般的な使用方法
- [TOOLS.md](./TOOLS.md) - 全ツールリファレンス
- [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) - 問題解決ガイド

## 🔄 Claude Code再起動後の確認手順

### 基本動作確認

Claude Code再起動後、以下の手順でAutoWorkspaceManagerの動作を確認できます：

#### 1. 基本接続テスト

```typescript
// MCP接続とAutoWorkspaceManagerトリガー
const test = await mcp.callTool('echo', {
  message: "再起動テスト開始！"
});
```

**期待される動作**:
- **初回**: カスタムバナーとワークスペース初期化メッセージ
- **再起動後**: エコーメッセージのみ（既存ワークスペースを検出）

#### 2. ワークスペース状態確認

```typescript
// 現在のワークスペース状態取得
const info = await mcp.callTool('workspace_get_info');
console.log('Workspace Status:', info.workspace.status);
console.log('LSP Servers:', info.workspace.settings.lsp_servers);
```

**確認項目**:
- ✅ `status: "active"`
- ✅ `lsp_servers: ["swift"]` (設定ファイルから読み込み)
- ✅ ワークスペース名が正しく設定されている

#### 3. 設定ファイル内容確認

```typescript
// 設定ファイルの直接確認
const config = await mcp.callTool('read_file', {
  file_path: '/Users/username/.claude/workspace/effortlessly/auto-workspace.yaml'
});
console.log('Config loaded:', config.content.includes('type: "swift"'));
```

#### 4. Swiftプロジェクト認識テスト

```typescript
// Swiftファイルの検索テスト
const swiftFiles = await mcp.callTool('search_files', {
  directory: '.',
  file_pattern: '*.swift',
  recursive: true,
  max_results: 5
});
console.log('Swift files found:', swiftFiles.length);
```

### 確認チェックリスト

| 項目 | 期待値 | 確認方法 | 状態 |
|------|--------|----------|------|
| ワークスペース状態 | `active` | `workspace_get_info` | ✅ |
| LSPサーバー設定 | `["swift"]` | `workspace_get_info` | ✅ |
| プロジェクトタイプ | `swift (configured)` | 初回ツール実行ログ | ✅ |
| カスタムバナー | 表示（初回のみ） | 初回ツール実行ログ | ✅ |
| 設定ファイル | 正常読み込み | `read_file` | ✅ |

### トラブル時の対処

**設定が反映されない場合**:
1. 設定ファイルパスの確認
2. YAML構文の検証
3. ファイル権限の確認
4. ワークスペースの再有効化

**緊急時の設定リセット**:
```bash
# ワークスペース設定をリセット
rm -rf ~/.claude/workspace/effortlessly/
# 次回ツール実行時に自動再初期化される
```

---

**Swift Development Guide for effortlessly-mcp** - Version 1.1.0

SourceKit-LSP統合による高度なSwift開発支援 - iOSからサーバーサイドSwiftまで完全対応  
**New**: AutoWorkspaceManager機能による自動設定とClaude Code再起動対応