# TypeScript Development Guide - effortlessly-mcp

effortlessly-mcpを使ったTypeScript開発の完全ガイド - TypeScript Language Server統合による高度なコード解析

## 🚀 概要

effortlessly-mcpは、TypeScript Language Serverと統合することで、TypeScriptプロジェクトに対して以下の機能を提供します：

- **高精度なシンボル検索**: クラス、関数、インターフェース、型の検索
- **依存関係分析**: npm、yarn、pnpm対応
- **参照検索**: シンボルの使用箇所を正確に特定
- **package.json自動認識**: Node.jsプロジェクトの自動設定
- **フレームワーク対応**: React、Vue、Angular、Express対応
- **フォールバック機能**: LSP障害時のテキストベース検索

## 📋 前提条件

### 必須要件

1. **Node.js & TypeScript**
   ```bash
   # Node.jsのバージョン確認
   node --version  # 推奨: 20.0.0以上
   
   # TypeScriptのインストール
   npm install -g typescript
   typescript --version  # 推奨: 5.0以上
   ```

2. **TypeScript Language Server**
   ```bash
   # TypeScript Language Serverのインストール
   npm install -g typescript-language-server
   
   # インストール確認
   typescript-language-server --version
   ```

3. **effortlessly-mcp**
   ```bash
   git clone https://github.com/y-hirakaw/effortlessly-mcp.git
   cd effortlessly-mcp
   npm install && npm run build
   ```

### 推奨環境

- **Node.js**: 20.0.0以上（ESM・パフォーマンス最適化のため）
- **TypeScript**: 5.0以上（最新の型システム機能のため）
- **エディタ**: VS Code、WebStorm等（型情報の可視化のため）

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
    type: "typescript"  # プロジェクトタイプを手動でTypeScriptに設定
    lsp_servers: ["typescript"]  # LSPサーバーを手動指定
    index_enabled: true
    auto_save_logs: true
  display:
    show_banner: true
    custom_banner: |
      ⚡ TypeScript Development Workspace Ready! 🚀
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
📁 Project: my-typescript-project
🔍 Project type: typescript (configured)  ← カスタム設定
⚙️  LSP servers: typescript (configured)   ← カスタム設定

⚡ TypeScript Development Workspace Ready! 🚀  ← カスタムバナー
Custom configuration loaded successfully!
```

**再起動時**（ワークスペースが既存の場合）：
- 自動初期化メッセージは表示されません（重複初期化防止）
- 設定ファイルからの値は引き続き有効
- `workspace_get_info` で設定内容を確認可能

### 2. TypeScript Language Serverの確認

```bash
# TypeScript Language Serverが利用可能か確認
which typescript-language-server

# TypeScriptバージョン確認
tsc --version
```

### 3. Claude Code設定

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

### 4. ワークスペース有効化

Claude Code内で以下を実行してTypeScriptワークスペースを有効化：

```typescript
// TypeScriptプロジェクトのワークスペースを有効化
const result = await mcp.callTool('workspace_activate', {
  workspace_path: '/path/to/your/typescript/project',
  name: 'my-typescript-project',
  lsp_servers: ['typescript'],
  index_enabled: true
});
```

## 📁 サポートするプロジェクト構造

### Node.js/TypeScript Project

```
MyTypeScriptProject/
├── package.json                     # ✅ 自動認識
├── tsconfig.json                    # ✅ TypeScript設定
├── src/
│   ├── index.ts
│   ├── types/
│   │   └── User.ts
│   ├── services/
│   │   └── UserService.ts
│   └── utils/
│       └── helpers.ts
├── tests/
│   └── UserService.test.ts
└── README.md
```

### React/Next.js Project

```
MyReactApp/
├── package.json
├── tsconfig.json
├── next.config.js                   # ✅ Next.js対応
├── src/
│   ├── app/                         # App Router
│   │   ├── page.tsx
│   │   └── layout.tsx
│   ├── components/
│   │   ├── Button.tsx
│   │   └── UserCard.tsx
│   ├── hooks/
│   │   └── useUser.ts
│   └── types/
│       └── api.ts
└── __tests__/
    └── components/
        └── Button.test.tsx
```

### Express.js API Project

```
MyAPIProject/
├── package.json
├── tsconfig.json
├── src/
│   ├── server.ts
│   ├── routes/
│   │   ├── users.ts
│   │   └── auth.ts
│   ├── middleware/
│   │   └── cors.ts
│   ├── models/
│   │   └── User.ts
│   └── controllers/
│       └── UserController.ts
├── tests/
│   └── integration/
│       └── users.test.ts
└── dist/                            # ✅ ビルド出力
```

### Monorepo Project (Lerna/Nx)

```
MyMonorepo/
├── package.json
├── lerna.json                       # ✅ Lerna対応
├── packages/
│   ├── shared/
│   │   ├── package.json
│   │   └── src/
│   │       └── types.ts
│   ├── api/
│   │   ├── package.json
│   │   └── src/
│   │       └── server.ts
│   └── web/
│       ├── package.json
│       └── src/
│           └── App.tsx
└── tools/
    └── build-scripts/
```

## 💻 基本的な使い方

### 1. TypeScript固有のシンボル検索

```typescript
// クラス検索
const classes = await mcp.callTool('code_find_symbol', {
  symbol_name: 'UserService',
  search_type: 'fuzzy',
  max_results: 20
});

// インターフェース検索
const interfaces = await mcp.callTool('code_find_symbol', {
  symbol_name: 'ApiResponse',
  search_type: 'fuzzy',
  max_results: 15
});

// 関数検索（複数パターン）
const functions = await mcp.callTool('code_find_symbol', {
  symbol_name: 'fetchUser',
  search_type: 'exact'
});

// 型エイリアス検索
const types = await mcp.callTool('code_find_symbol', {
  symbol_name: 'UserId',
  search_type: 'exact'
});
```

### 2. npm/yarn依存関係分析

```typescript
// package.jsonファイルの依存関係分析
const dependencies = await mcp.callTool('code_analyze_dependencies', {
  file_path: '/path/to/your/project/package.json',
  depth: 2,
  include_external: true,
  include_dev_dependencies: true,
  resolve_imports: true
});

// 結果例:
// {
//   "dependencies": {
//     "imports": [
//       {
//         "source": "react",
//         "version": "^18.2.0",
//         "is_external": true,
//         "import_type": "dependency"
//       },
//       {
//         "source": "@types/node", 
//         "version": "^20.0.0",
//         "is_external": true,
//         "import_type": "devDependency"
//       }
//     ]
//   }
// }
```

### 3. TypeScriptファイルの階層構造取得

```typescript
// UserServiceの構造を詳細取得
const hierarchy = await mcp.callTool('code_get_symbol_hierarchy', {
  file_path: '/path/to/UserService.ts',
  max_depth: 3,
  include_private: false
});

// プロジェクト全体の概要
const overview = await mcp.callTool('code_get_symbols_overview', {
  relative_path: 'src',
  max_depth: 2,
  symbol_kinds: [5, 6, 11, 12]  // Class, Method, Interface, Function
});
```

### 4. 参照検索

```typescript
// 特定のクラスを使用している箇所を検索
const references = await mcp.callTool('code_find_referencing_symbols', {
  target_file: '/path/to/User.ts',
  target_symbol: 'User',
  search_scope: 'workspace',
  include_context: true
});
```

## 🎯 TypeScript開発での実践例

### 1. React/Next.jsコンポーネント分析

```typescript
// Reactコンポーネントの構造分析
const reactComponents = await mcp.callTool('code_search_pattern', {
  pattern: 'const\\s+\\w+\\s*=\\s*\\(.*\\)\\s*=>\\s*\\{|function\\s+\\w+\\s*\\(.*\\)\\s*\\{.*return\\s*<',
  directory_path: 'src/components',
  file_pattern: '*.tsx',
  include_context: true
});

// hooks使用パターンの検索
const hooksUsage = await mcp.callTool('code_search_pattern', {
  pattern: 'use(State|Effect|Context|Reducer|Callback|Memo)\\s*\\(',
  directory_path: 'src',
  file_pattern: '*.ts,*.tsx',
  include_context: true
});

// Next.js固有のパターン検索
const nextjsPatterns = await mcp.callTool('code_search_pattern', {
  pattern: 'export\\s+(async\\s+)?function\\s+(getServerSideProps|getStaticProps|getStaticPaths)',
  directory_path: 'src',
  file_pattern: '*.ts,*.tsx',
  include_context: true
});
```

### 2. Express.js API分析

```typescript
// Express.jsルーターの検索
const routes = await mcp.callTool('code_search_pattern', {
  pattern: 'router\\.(get|post|put|delete|patch)\\s*\\(',
  directory_path: 'src/routes',
  file_pattern: '*.ts',
  include_context: true
});

// ミドルウェア関数の検索
const middleware = await mcp.callTool('code_search_pattern', {
  pattern: '\\(req:\\s*Request,\\s*res:\\s*Response,\\s*next:\\s*NextFunction\\)',
  directory_path: 'src',
  file_pattern: '*.ts',
  include_context: true
});

// コントローラー関数の検索
const controllers = await mcp.callTool('code_search_pattern', {
  pattern: 'export\\s+(const|async\\s+function)\\s+\\w+Controller',
  directory_path: 'src/controllers',
  file_pattern: '*.ts',
  include_context: true
});
```

### 3. 型定義とインターフェース分析

```typescript
// インターフェース定義の検索
const interfaces = await mcp.callTool('code_search_pattern', {
  pattern: 'interface\\s+\\w+\\s*\\{',
  directory_path: 'src/types',
  file_pattern: '*.ts',
  include_context: true
});

// 型エイリアスの検索
const typeAliases = await mcp.callTool('code_search_pattern', {
  pattern: 'type\\s+\\w+\\s*=',
  directory_path: 'src',
  file_pattern: '*.ts,*.tsx',
  include_context: true
});

// Generics使用パターンの検索
const generics = await mcp.callTool('code_search_pattern', {
  pattern: '<[A-Z]\\w*(?:,\\s*[A-Z]\\w*)*>',
  directory_path: 'src',
  file_pattern: '*.ts,*.tsx',
  include_context: true
});
```

### 4. エラーハンドリングパターン

```typescript
// try-catch文の検索
const errorHandling = await mcp.callTool('code_search_pattern', {
  pattern: 'try\\s*\\{[\\s\\S]*?\\}\\s*catch',
  directory_path: 'src',
  file_pattern: '*.ts,*.tsx',
  include_context: true
});

// カスタムエラークラスの検索
const customErrors = await mcp.callTool('code_search_pattern', {
  pattern: 'class\\s+\\w*Error\\s+extends\\s+Error',
  directory_path: 'src',
  file_pattern: '*.ts',
  include_context: true
});

// Promise rejectionの検索
const promiseErrors = await mcp.callTool('code_search_pattern', {
  pattern: '\\.catch\\s*\\(|Promise\\.reject',
  directory_path: 'src',
  file_pattern: '*.ts,*.tsx',
  include_context: true
});
```

## 🔧 高度な機能

### 1. package.json自動解析

effortlessly-mcpは、package.jsonファイルを自動認識し、以下を実行します：

- **依存関係の自動検出**
- **プロジェクト構造の把握**
- **TypeScript Language Serverの最適設定**

```typescript
// プロジェクト設定の確認
const workspaceInfo = await mcp.callTool('workspace_get_info');

// 出力例:
// {
//   "workspace": {
//     "name": "my-typescript-project",
//     "lsp_servers": ["typescript"],
//     "file_count": 125,
//     "symbol_count": 456
//   }
// }
```

### 2. フレームワーク固有の分析

```typescript
// React固有のパターン分析
const reactPatterns = await mcp.callTool('code_search_pattern', {
  pattern: 'import.*from\\s+[\'"]react[\'"]',
  directory_path: 'src',
  file_pattern: '*.tsx,*.ts',
  include_context: true
});

// Vue.js固有のパターン分析
const vuePatterns = await mcp.callTool('code_search_pattern', {
  pattern: '<script\\s+setup\\s+lang=[\'"]ts[\'"]>',
  directory_path: 'src',
  file_pattern: '*.vue',
  include_context: true
});

// Angular固有のパターン分析
const angularPatterns = await mcp.callTool('code_search_pattern', {
  pattern: '@(Component|Injectable|Directive)\\s*\\(',
  directory_path: 'src',
  file_pattern: '*.ts',
  include_context: true
});
```

### 3. テストコード分析

```typescript
// Jest/Vitest テストファイルの検索
const testFiles = await mcp.callTool('code_search_pattern', {
  pattern: 'describe\\s*\\(|test\\s*\\(|it\\s*\\(',
  directory_path: 'tests',
  file_pattern: '*.test.ts,*.spec.ts',
  include_context: true
});

// モックパターンの検索
const mocks = await mcp.callTool('code_search_pattern', {
  pattern: 'jest\\.mock\\s*\\(|vi\\.mock\\s*\\(',
  directory_path: 'tests',
  file_pattern: '*.ts,*.tsx',
  include_context: true
});

// テストユーティリティの検索
const testUtils = await mcp.callTool('code_search_pattern', {
  pattern: '@testing-library|render\\s*\\(|screen\\.',
  directory_path: 'tests',
  file_pattern: '*.ts,*.tsx',
  include_context: true
});
```

## 📝 コード編集機能

### 1. TypeScriptコードの精密編集

```typescript
// サービスクラスの実装を更新
const editResult = await mcp.callTool('smart_edit_file', {
  file_path: '/path/to/UserService.ts',
  old_text: 'async getUser(id: string): Promise<User> {\\n        // TODO: implement\\n    }',
  new_text: `async getUser(id: string): Promise<User> {
        const user = await this.repository.findById(id);
        if (!user) {
            throw new UserNotFoundError(id);
        }
        return user;
    }`,
  create_backup: true
});
```

### 2. インターフェースの追加

```typescript
// 型定義ファイルにインターフェースを追加
const insertResult = await mcp.callTool('smart_insert_text', {
  file_path: '/path/to/types/api.ts',
  text: `export interface CreateUserRequest {
    name: string;
    email: string;
    age?: number;
}`,
  position_type: 'after_text',
  reference_text: 'export interface User {',
  auto_indent: true
});
```

### 3. インポート文の管理

```typescript
// 新しいライブラリのインポートを追加
const importResult = await mcp.callTool('smart_insert_text', {
  file_path: '/path/to/UserService.ts',
  text: 'import { logger } from "../utils/logger";',
  position_type: 'after_text',
  reference_text: 'import { User } from "../types/User";',
  create_backup: true
});
```

## 🔧 プロジェクトメモリ活用

### TypeScript開発知識の保存

```typescript
// アーキテクチャ決定を記録
const architectureNotes = await mcp.callTool('project_memory_write', {
  memory_name: 'typescript-architecture-decisions',
  content: `# TypeScript Architecture Decisions

## Clean Architecture + DI Container

- **Domain Layer**: ビジネスロジックとエンティティ
- **Application Layer**: ユースケースとアプリケーションサービス  
- **Infrastructure Layer**: 外部システムとの連携
- **Presentation Layer**: API/UI層

## 依存関係注入

- InversifyJSを使用したDIコンテナ
- インターフェースベースの設計
- テスタビリティを重視

## エラーハンドリング

- Result<T, E>パターンの採用
- カスタムエラークラス階層
- 構造化ログによる詳細追跡

## 型安全性

- strict modeの徹底
- branded typesの活用
- discriminated unionsによる状態管理
`,
  tags: ['architecture', 'typescript', 'clean-architecture', 'di']
});

// 開発ガイドラインの保存
const guidelines = await mcp.callTool('project_memory_write', {
  memory_name: 'typescript-coding-guidelines',
  content: `# TypeScript Coding Guidelines

## 命名規則

- **クラス**: PascalCase (UserService)
- **関数・変数**: camelCase (fetchUserData)
- **定数**: UPPER_SNAKE_CASE (MAX_RETRY_COUNT)
- **インターフェース**: PascalCase (ApiResponse)
- **型エイリアス**: PascalCase (UserId)

## ファイル構成

- **1ファイル1エクスポート**原則
- **index.ts**でre-export
- **types/**ディレクトリで型定義を集約
- **__tests__/**でテストファイルを並置

## コード品質

- **ESLint + Prettier**の強制
- **husky**でpre-commit hooks
- **型注釈の省略**（推論可能な場合）
- **strict null checks**の徹底
`,
  tags: ['guidelines', 'typescript', 'naming', 'structure']
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

# YAML構文チェック（Node.jsの場合）
node -e "const yaml = require('js-yaml'); yaml.load(require('fs').readFileSync('~/.claude/workspace/effortlessly/auto-workspace.yaml', 'utf8'))"
```

#### 2. TypeScript Language Serverが認識されない

**設定ファイルで強制指定**:
```yaml
auto_workspace:
  project:
    type: "typescript"           # 手動でTypeScriptに設定
    lsp_servers: ["typescript"]  # LSPサーバーを手動指定
```

**確認コマンド**:
```typescript
const info = await mcp.callTool('workspace_get_info');
// project.type が "typescript (configured)" と表示されることを確認
```

### よくある問題と解決方法

#### 1. TypeScript Language Serverが見つからない

```bash
# TypeScript Language Serverのインストール状況確認
which typescript-language-server

# グローバルインストールされていない場合
npm install -g typescript-language-server typescript

# プロジェクトローカルの場合
npx typescript-language-server --version
```

#### 2. TypeScriptファイルが認識されない

```typescript
// ワークスペースの再有効化
const reactivate = await mcp.callTool('workspace_activate', {
  workspace_path: '/path/to/your/typescript/project',
  lsp_servers: ['typescript'],
  index_enabled: true
});

// TypeScriptファイル検出の確認
const files = await mcp.callTool('search_files', {
  directory: '/path/to/your/typescript/project',
  file_pattern: '*.ts,*.tsx',
  recursive: true
});
```

#### 3. tsconfig.jsonが認識されない

tsconfig.jsonファイルがプロジェクトルートにあることを確認：

```bash
# プロジェクト構造確認
ls -la /path/to/your/typescript/project/tsconfig.json

# tsconfig.jsonの内容確認
cat /path/to/your/typescript/project/tsconfig.json
```

#### 4. シンボル検索が動作しない（フォールバック機能）

effortlessly-mcpには、LSP障害時の**フォールバック機能**が実装されています：

```typescript
// シンボル検索（LSP → テキストベース自動切替）
const symbols = await mcp.callTool('code_find_symbol', {
  symbol_name: 'UserService',
  search_type: 'exact'
});

// フォールバック時は以下のパターンを自動検索：
// - class\s+UserService
// - interface\s+UserService  
// - function\s+UserService
// - const\s+UserService
// - export.*UserService
```

**手動フォールバック確認**:
```typescript
// 手動でのファイル検索テスト
const manualSearch = await mcp.callTool('search_files', {
  directory: '/path/to/your/typescript/project/src',
  content_pattern: 'class.*UserService',
  recursive: true,
  include_content: true
});
```

### デバッグ情報取得

```typescript
// 詳細なワークスペース情報
const debugInfo = await mcp.callTool('workspace_get_info');
console.log('Workspace Info:', JSON.stringify(debugInfo, null, 2));

// TypeScriptファイル一覧
const tsFiles = await mcp.callTool('search_files', {
  directory: '/path/to/your/typescript/project',
  file_pattern: '*.ts,*.tsx',
  recursive: true
});
console.log('TypeScript Files:', tsFiles.length);
```

## 📊 パフォーマンス最適化

### 大規模TypeScriptプロジェクト向け

```typescript
// 検索結果を制限
const optimizedSearch = await mcp.callTool('code_find_symbol', {
  symbol_name: 'Component',
  search_type: 'fuzzy',
  file_pattern: 'src/components',     // 検索範囲を限定
  max_results: 30                     // 結果数制限
});

// ディレクトリ単位での分析
const moduleAnalysis = await mcp.callTool('code_get_symbols_overview', {
  relative_path: 'src/services',       // 特定モジュールのみ
  max_depth: 2,                       // 深度制限
  include_private: false              // パブリックAPIのみ
});
```

### Monorepo対応

```typescript
// パッケージ単位での検索
const packageSearch = await mcp.callTool('code_find_symbol', {
  symbol_name: 'ApiClient',
  file_pattern: 'packages/shared/**/*.ts',
  max_results: 20
});

// クロスパッケージ依存関係分析
const crossDependencies = await mcp.callTool('code_analyze_dependencies', {
  file_path: 'packages/api/package.json',
  depth: 3,
  include_external: false,  // 内部パッケージのみ
  resolve_imports: true
});
```

## 🔗 統合ワークフロー例

### 1. コードレビューワークフロー

```typescript
// 1. TODOコメントの検索
const todos = await mcp.callTool('code_search_pattern', {
  pattern: '//\\s*TODO.*|//\\s*FIXME.*',
  directory_path: 'src',
  file_pattern: '*.ts,*.tsx',
  include_context: true
});

// 2. any型の使用箇所検索
const anyUsage = await mcp.callTool('code_search_pattern', {
  pattern: ':\\s*any\\b',
  directory_path: 'src',
  file_pattern: '*.ts,*.tsx',
  include_context: true
});

// 3. 非推奨APIの検索
const deprecated = await mcp.callTool('code_search_pattern', {
  pattern: '@deprecated',
  directory_path: 'src',
  file_pattern: '*.ts,*.tsx',
  include_context: true
});
```

### 2. リファクタリング支援

```typescript
// 1. 古いAPIの使用箇所特定
const oldAPI = await mcp.callTool('code_find_referencing_symbols', {
  target_file: '/path/to/LegacyService.ts',
  target_symbol: 'LegacyService',
  search_scope: 'workspace',
  include_context: true
});

// 2. 段階的にクラス名を更新
const renameClass = await mcp.callTool('smart_edit_file', {
  file_path: '/path/to/LegacyService.ts',
  old_text: 'export class LegacyService',
  new_text: 'export class UserService',
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

### 3. 型安全性向上ワークフロー

```typescript
// 1. any型の段階的置換
const anyTypes = await mcp.callTool('code_search_pattern', {
  pattern: ':\\s*any\\b',
  directory_path: 'src',
  file_pattern: '*.ts,*.tsx',
  include_context: true
});

// 2. 特定のany型を具体的な型に置換
const typeReplacement = await mcp.callTool('smart_edit_file', {
  file_path: '/path/to/api.ts',
  old_text: 'response: any',
  new_text: 'response: ApiResponse<User>',
  create_backup: true
});

// 3. 型ガードの追加
const addTypeGuard = await mcp.callTool('smart_insert_text', {
  file_path: '/path/to/utils/typeGuards.ts',
  text: `export function isUser(obj: unknown): obj is User {
  return typeof obj === 'object' && obj !== null &&
         'id' in obj && 'name' in obj && 'email' in obj;
}`,
  position_type: 'end'
});
```

## 📝 CLAUDE.mdへの推奨設定

プロジェクトの`CLAUDE.md`ファイルに以下の設定を追加することで、Claude Codeがeffortlessly-mcpのLSP統合機能を最大限活用できます。

### 🎯 TypeScript開発向け推奨設定

```markdown
# CLAUDE.md - TypeScript Development Configuration

## MCP Server Information

This project uses **effortlessly-mcp** with TypeScript Language Server integration for advanced TypeScript development.

### Available Tools Priority

**Primary Tools (LSP統合済み - 高速・高精度)**:
1. `mcp__effortlessly-mcp__code_find_symbol` - シンボル検索（クラス、関数、インターフェース、型）
2. `mcp__effortlessly-mcp__code_find_references` - 参照検索
3. `mcp__effortlessly-mcp__code_get_symbols_overview` - 階層構造分析
4. `mcp__effortlessly-mcp__code_analyze_dependencies` - 依存関係分析
5. `mcp__effortlessly-mcp__smart_edit_file` - 安全なファイル編集
6. `mcp__effortlessly-mcp__smart_insert_text` - 精密なコード挿入

**Development Commands**:
```bash
# Building and Testing
npm run build           # TypeScript build
npm run test           # Run tests
npm run type-check     # Type checking only
npm run lint           # ESLint
```

### TypeScript Development Guidelines

**Symbol Search Patterns**:
- Classes: `UserService`, `ApiClient`
- Interfaces: `ApiResponse`, `UserData`
- Types: `UserId`, `EventHandler`
- Functions: `fetchUser`, `validateInput`

**Code Analysis Priorities**:
1. **Type Safety**: any型の使用箇所特定と具体的な型への置換
2. **Architecture Analysis**: Clean Architecture、DDD パターンの識別
3. **Framework Integration**: React/Vue/Angular固有パターンの分析
4. **Error Handling**: try-catch、Result型、カスタムエラーの使用パターン

**Security Considerations**:
- API キーやシークレットのハードコーディング検出
- 入力値検証パターンの分析
- セキュリティヘッダーの設定確認

### Project Structure Recognition

**Automatic Detection**:
- package.json → Node.js/npm project
- tsconfig.json → TypeScript project
- next.config.js → Next.js application
- angular.json → Angular application
- vue.config.js → Vue.js application

**Framework-Specific Optimizations**:
```markdown
## React/Next.js Projects
- Focus on component analysis and hooks usage
- Priority: .tsx files over .ts files
- Search patterns: JSX elements, hook calls, component props

## Express.js APIs  
- Focus on route definitions and middleware
- Priority: controllers, routes, middleware directories
- Search patterns: HTTP methods, middleware functions

## Monorepo Projects
- Package-scoped symbol search
- Cross-package dependency analysis
- Workspace-aware path resolution
```
```

### 🔧 開発効率向上のための設定例

```markdown
## TypeScript-Specific Workflow

### Daily Development Tasks

1. **Feature Development**:
   ```
   1. Use code_find_symbol to locate relevant interfaces/types
   2. Use code_get_symbols_overview for architecture understanding
   3. Use smart_edit_file for implementation
   4. Use code_find_references for impact analysis
   ```

2. **Code Review**:
   ```
   1. Search for TODO comments: pattern: "//\\s*TODO.*"
   2. Find any types: pattern: ":\\s*any\\b"
   3. Check deprecated usage: pattern: "@deprecated"
   4. Validate error handling: pattern: "try\\s*\\{[\\s\\S]*?\\}\\s*catch"
   ```

3. **Type Safety Improvements**:
   ```
   1. Find and replace any types with specific types
   2. Add type guards for runtime validation
   3. Implement branded types for domain modeling
   4. Use discriminated unions for complex state
   ```

### Testing Integration

**Jest/Vitest Pattern Detection**:
- Test files: `*.test.ts`, `*.spec.ts`
- Test functions: `describe|test|it`
- Mock patterns: `jest.mock|vi.mock`

**React Testing Library**:
- Component testing: `render\\(`
- Query patterns: `screen\\.|getBy|findBy`
- User interactions: `fireEvent|userEvent`
```

### 🛡️ セキュリティ設定

```markdown
## Security Configuration

### Sensitive Pattern Detection

The effortlessly-mcp automatically detects and masks:
- API keys: `apiKey|api_key|API_KEY`
- Database URLs: `DATABASE_URL|DB_URL`
- JWT secrets: `JWT_SECRET|SECRET_KEY`
- Environment variables: `process.env`

### Safe Development Practices

1. **Always use smart_edit_file** - automatic backup creation
2. **Enable preview_mode** for large changes
3. **Validate file paths** - automatic path sanitization
4. **Audit logging** - all operations logged in .claude/workspace/

### Code Quality Gates

**Before Commit**:
1. Search for hardcoded secrets and credentials
2. Check for any types and unsafe type assertions
3. Validate error handling and exception management
4. Review async/await patterns and Promise handling

**Security Checklist**:
- [ ] No hardcoded API keys or secrets
- [ ] Proper input validation and sanitization
- [ ] Secure HTTP headers configuration
- [ ] Authentication and authorization logic
```

### 📊 パフォーマンス設定

```markdown
## Performance Guidelines

### Large TypeScript Codebase (1000+ files)

```markdown
# Optimize for large TypeScript projects
max_results: 50                      # Limit search results
file_pattern: "src/**/*.ts,src/**/*.tsx"  # Narrow search scope
recursive: false                     # Avoid deep recursion
include_context: false               # Reduce token usage
```

### Monorepo Optimization

```markdown
# Package-scoped searches for monorepos
file_pattern: "packages/shared/**/*.ts"  # Target specific packages
search_scope: "directory"               # Limit to package scope
max_depth: 2                           # Prevent deep traversal
```

### Response Time Targets

- Symbol search: <50ms
- Reference finding: <200ms
- File reading: <100ms
- Dependency analysis: <500ms
```

## 📖 関連リソース

### TypeScript公式ドキュメント
- [TypeScript Language Server](https://github.com/typescript-language-server/typescript-language-server) - 公式LSPサーバー
- [TypeScript Handbook](https://www.typescriptlang.org/docs/) - 型システムの詳細
- [TypeScript Compiler API](https://github.com/Microsoft/TypeScript/wiki/Using-the-Compiler-API) - コンパイラAPI

### フレームワーク統合
- [React TypeScript](https://reactjs.org/docs/static-type-checking.html) - React + TypeScript
- [Next.js TypeScript](https://nextjs.org/docs/basic-features/typescript) - Next.js + TypeScript
- [Vue TypeScript](https://vuejs.org/guide/typescript/overview.html) - Vue 3 + TypeScript
- [Angular TypeScript](https://angular.io/guide/typescript-configuration) - Angular + TypeScript

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
  message: "TypeScript開発環境テスト！"
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
- ✅ `lsp_servers: ["typescript"]` (設定ファイルから読み込み)
- ✅ ワークスペース名が正しく設定されている

#### 3. TypeScriptプロジェクト認識テスト

```typescript
// TypeScriptファイルの検索テスト
const tsFiles = await mcp.callTool('search_files', {
  directory: '.',
  file_pattern: '*.ts,*.tsx',
  recursive: true,
  max_results: 5
});
console.log('TypeScript files found:', tsFiles.length);

// tsconfig.jsonの確認
const tsConfig = await mcp.callTool('read_file', {
  file_path: './tsconfig.json'
});
console.log('tsconfig.json exists:', !!tsConfig.content);
```

#### 4. LSP機能テスト（フォールバック対応）

```typescript
// シンボル検索テスト（LSP + フォールバック）
const symbols = await mcp.callTool('code_find_symbol', {
  symbol_name: 'interface',
  search_type: 'fuzzy',
  max_results: 3
});
console.log('Symbols found:', symbols.stats.total_found);
```

### 確認チェックリスト

| 項目 | 期待値 | 確認方法 | 状態 |
|------|--------|----------|------|
| ワークスペース状態 | `active` | `workspace_get_info` | ✅ |
| LSPサーバー設定 | `["typescript"]` | `workspace_get_info` | ✅ |
| プロジェクトタイプ | `typescript (configured)` | 初回ツール実行ログ | ✅ |
| カスタムバナー | 表示（初回のみ） | 初回ツール実行ログ | ✅ |
| TypeScriptファイル | >0件 | `search_files` | ✅ |
| tsconfig.json | 存在 | `read_file` | ✅ |
| シンボル検索 | 動作（LSP/フォールバック） | `code_find_symbol` | ✅ |

### フォールバック機能の確認

effortlessly-mcpには**LSP障害時の自動フォールバック機能**が実装されています：

```typescript
// LSPサーバー停止時でも動作することを確認
const fallbackTest = await mcp.callTool('code_find_symbol', {
  symbol_name: 'UserService',
  search_type: 'exact'
});

// フォールバック時のログメッセージ例:
// "LSP API returned no results, falling back to text-based search"
// "Starting text-based symbol search for: UserService"
// "Found 3 matches with pattern: class\\s+UserService"
```

### トラブル時の対処

**設定が反映されない場合**:
1. 設定ファイルパスの確認: `~/.claude/workspace/effortlessly/auto-workspace.yaml`
2. YAML構文の検証: Node.jsで構文チェック
3. ファイル権限の確認: 読み取り権限があるか
4. ワークスペースの再有効化: `workspace_activate`を再実行

**LSP機能が動作しない場合**:
1. TypeScript Language Serverのインストール確認
2. tsconfig.jsonの存在確認
3. フォールバック機能が動作していることを確認
4. 手動でのファイル検索テストを実行

**緊急時の設定リセット**:
```bash
# ワークスペース設定をリセット
rm -rf ~/.claude/workspace/effortlessly/
# 次回ツール実行時に自動再初期化される
```

---

**TypeScript Development Guide for effortlessly-mcp** - Version 1.0.0

TypeScript Language Server統合による高度なTypeScript開発支援 - Node.js/React/Vue/Angularまで完全対応  
**Features**: AutoWorkspaceManager機能、フォールバック機能、Claude Code再起動対応
