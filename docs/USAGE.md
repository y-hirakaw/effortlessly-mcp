# Usage Guide - effortlessly-mcp

完全な使い方ガイド - effortlessly-mcp MCP Serverを使った効率的なコード分析とファイル操作

## 概要

effortlessly-mcpは、Claude Codeと統合されたMCP (Model Context Protocol) サーバーで、以下の機能を提供します：

- **セキュアなファイル操作**: 読み取り、編集、検索、メタデータ取得
- **コード解析**: シンボル検索、参照検索、依存関係分析  
- **プロジェクト管理**: ワークスペース管理、メモリシステム（3分類対応）
- **LSP統合**: TypeScript、Swift、Java（Phase 2A）サポート
- **Intent Logging**: 編集操作の目的・理由記録による開発履歴追跡

## 基本的な使い方

### 1. ワークスペースの有効化

プロジェクトで作業を開始する前に、ワークスペースを有効化します：

```typescript
// ワークスペースを有効化
const result = await mcp.callTool('workspace_activate', {
  workspace_path: '/path/to/your/project',
  name: 'my-project',
  lsp_servers: ['typescript', 'swift'],
  index_enabled: true
});
```

### 2. ファイル操作

#### ファイルの読み取り

```typescript
// 基本的なファイル読み取り
const content = await mcp.callTool('read_file', {
  file_path: '/path/to/file.ts',
  encoding: 'utf-8'
});

// ファイルメタデータの取得
const metadata = await mcp.callTool('get_file_metadata', {
  file_path: '/path/to/file.ts'
});
```

#### ディレクトリの一覧表示

```typescript
// ディレクトリ内のファイル一覧
const files = await mcp.callTool('list_directory', {
  directory_path: '/path/to/directory',
  recursive: true,
  pattern: '*.ts'
});
```

#### ファイル検索

```typescript
// ファイル名とコンテンツによる検索
const results = await mcp.callTool('search_files', {
  directory: '/path/to/project',
  file_pattern: '*.ts',
  content_pattern: 'function.*export',
  recursive: true,
  case_sensitive: false,
  max_results: 100,
  include_content: true
});
```

### 3. スマートファイル編集

#### 安全なファイル編集

```typescript
// 基本的な文字列置換
const editResult = await mcp.callTool('smart_edit_file', {
  file_path: '/path/to/file.ts',
  old_text: 'const oldVariable',
  new_text: 'const newVariable',
  create_backup: true,
  preview_mode: false
});

// プレビューモードで変更内容を確認
const preview = await mcp.callTool('smart_edit_file', {
  file_path: '/path/to/file.ts',
  old_text: 'function oldName(',
  new_text: 'function newName(',
  preview_mode: true
});
```

#### スマートテキスト挿入

```typescript
// 行番号指定で挿入
const insertResult = await mcp.callTool('smart_insert_text', {
  file_path: '/path/to/file.ts',
  text: 'console.log("Debug message");',
  position_type: 'line_number',
  line_number: 10,
  auto_indent: true
});

// ファイル末尾に追加
const appendResult = await mcp.callTool('smart_insert_text', {
  file_path: '/path/to/file.ts',
  text: '\nexport default MyClass;',
  position_type: 'end',
  create_backup: true
});

// 特定のテキストの後に挿入
const insertAfter = await mcp.callTool('smart_insert_text', {
  file_path: '/path/to/file.ts',
  text: '    // TODO: Implement this method',
  position_type: 'after_text',
  reference_text: 'function myMethod() {',
  auto_indent: true
});
```

## コード解析機能

### 1. シンボル検索

#### 基本的なシンボル検索

```typescript
// 関数名でシンボルを検索
const symbols = await mcp.callTool('code_find_symbol', {
  symbol_name: 'calculateTotal',
  search_type: 'fuzzy',
  max_results: 50
});

// クラス内のメソッドを検索
const methods = await mcp.callTool('code_find_symbol', {
  symbol_name: 'UserService',
  search_type: 'exact',
  file_pattern: 'services',
  max_results: 100
});
```

#### シンボル階層の取得

```typescript
// ファイル内のシンボル構造を取得
const hierarchy = await mcp.callTool('code_get_symbol_hierarchy', {
  file_path: '/path/to/service.ts',
  max_depth: 3,
  include_private: false
});

// プロジェクト全体のシンボル概要
const overview = await mcp.callTool('code_get_symbols_overview', {
  relative_path: 'src',
  max_depth: 2,
  symbol_kinds: [5, 6, 12]  // Class, Method, Function
});
```

### 2. 参照検索

#### シンボルの参照を検索

```typescript
// 特定のシンボルを参照している箇所を検索
const references = await mcp.callTool('code_find_references', {
  file_path: '/path/to/file.ts',
  line: 15,
  column: 10,
  include_declaration: true
});

// シンボルを参照しているシンボルを検索
const referencingSymbols = await mcp.callTool('code_find_referencing_symbols', {
  target_file: '/path/to/file.ts',
  target_symbol: 'MyClass',
  search_scope: 'workspace',
  include_context: true,
  max_results: 100
});
```

### 3. 依存関係分析

```typescript
// ファイルの依存関係を分析
const dependencies = await mcp.callTool('code_analyze_dependencies', {
  file_path: '/path/to/main.ts',
  depth: 3,
  include_external: true,
  include_dev_dependencies: false,
  resolve_imports: true
});
```

### 4. パターン検索

```typescript
// 正規表現による高度な検索
const patterns = await mcp.callTool('code_search_pattern', {
  pattern: 'class\\s+\\w+\\s+extends\\s+\\w+',
  directory_path: 'src',
  file_pattern: '*.ts',
  case_sensitive: true,
  include_context: true,
  max_results: 50
});
```

## プロジェクトメモリ機能

### 🔍 AI搭載学習型検索システム（v2.0+）

effortlessly-mcpでは、AI搭載の学習型検索システムを提供しています。検索パターンを自動学習し、プロジェクトの変更に応じてキャッシュを最適化します。

#### 高速検索機能の活用

```typescript
// 包括的コード検索 - ファイル名・内容・パターンを統合検索
const searchResults = await mcp.callTool('search_with_learning', {
  query: 'authentication logic',
  learn_patterns: true,
  max_results: 50,
  recursive: true
});

// 特定ファイルタイプの検索
const componentSearch = await mcp.callTool('search_with_learning', {
  query: 'React component',
  file_pattern: '**/*.{tsx,jsx}',
  learn_patterns: true
});

// 内容パターン検索（正規表現対応）
const errorHandling = await mcp.callTool('search_with_learning', {
  query: 'error handling',
  content_pattern: 'try.*catch|throw.*Error',
  learn_patterns: true
});
```

#### 検索システムの活用パターン

```typescript
// 新機能実装前の影響調査
async function investigateImpact(featureName: string) {
  // 1. 関連コードの検索
  const relatedCode = await mcp.callTool('search_with_learning', {
    query: featureName,
    learn_patterns: true,
    max_results: 100
  });
  
  // 2. 類似実装の探索
  const similarImplementations = await mcp.callTool('search_with_learning', {
    query: `${featureName} implementation pattern`,
    content_pattern: 'class.*Manager|interface.*Service',
    learn_patterns: true
  });
  
  // 3. テストファイルの確認
  const testFiles = await mcp.callTool('search_with_learning', {
    query: `${featureName} test`,
    file_pattern: '**/*.{test,spec}.{ts,js}',
    learn_patterns: true
  });
  
  return {
    relatedCode: relatedCode.results,
    similarImplementations: similarImplementations.results,
    testFiles: testFiles.results
  };
}

// セキュリティ要件の確認
async function checkSecurityRequirements() {
  const securityFiles = await mcp.callTool('search_with_learning', {
    query: 'security implementation',
    content_pattern: 'security|auth|validation|sanitize',
    learn_patterns: true
  });
  
  console.log('セキュリティ関連ファイル:', securityFiles.results);
}
```

#### 検索パターン最適化のベストプラクティス

```typescript
// 検索結果の活用による開発効率化
const optimizedSearch = await mcp.callTool('search_with_learning', {
  memory_name: 'project_structure_index',
  content: `# Project Structure Index - Updated ${new Date().toISOString()}

## Quick Reference
- **Total Files**: ${fileCount} files, ${lineCount} lines
- **Core Components**: ${componentCount} components
- **Architecture**: 5-layer security-first design

## Major Components → [詳細はspecialized indexes参照]
...
`,
  overwrite: true
});
```

**重要**: 固定ファイル名使用により、常に最新情報にアクセス可能。古い情報参照問題が根本解決されています。

### 効率的なプロジェクト情報管理

```typescript
// アーキテクチャ関連ファイルの包括検索
const architectureFiles = await mcp.callTool('search_with_learning', {
  query: 'architecture decisions database auth',
  content_pattern: 'PostgreSQL|Prisma|JWT|OAuth',
  file_pattern: '**/*.{md,ts,js,json}',
  learn_patterns: true,
  max_results: 100
});

// 検索結果から構造化情報を抽出
const projectKnowledge = architectureFiles.results.map(file => ({
  path: file.path,
  type: file.name.includes('.md') ? 'documentation' : 'code',
  relevance: file.name.toLowerCase().includes('architecture') ? 'high' : 'medium'
}));

// 関連するドキュメントファイルの詳細検索  
const docFiles = await mcp.callTool('search_with_learning', {
  query: 'architecture decisions',
  file_pattern: '**/*.md',
  learn_patterns: true
});

// 検索パフォーマンス統計の確認
console.log('検索結果統計:', {
  architectureFiles: architectureFiles.metadata,
  docFiles: docFiles.metadata,
  totalResults: architectureFiles.results.length + docFiles.results.length
});
```

### 更新ワークフローの生成

```typescript
// プロジェクト更新手順の生成
const workflow = await mcp.callTool('project_update_workflow', {
  task: 'security-audit',
  scope: 'full',
  focus_areas: ['authentication', 'data-validation', 'dependencies'],
  preview: true
});
```

## 実践的な使用例

### 1. コードレビューワークフロー

```typescript
// 1. 変更されたファイルを検索
const changedFiles = await mcp.callTool('search_files', {
  directory: 'src',
  content_pattern: 'TODO|FIXME|HACK',
  recursive: true
});

// 2. 各ファイルのシンボル構造を確認
for (const file of changedFiles) {
  const symbols = await mcp.callTool('code_get_symbols_overview', {
    relative_path: file.path,
    include_private: false
  });
  
  // 3. 公開APIの変更をチェック
  const publicMethods = symbols.filter(s => s.kind === 6 && s.access === 'public');
  
  // 4. 変更による影響を分析
  for (const method of publicMethods) {
    const references = await mcp.callTool('code_find_referencing_symbols', {
      target_file: file.path,
      target_symbol: method.name,
      search_scope: 'workspace'
    });
  }
}
```

### 2. リファクタリング支援

```typescript
// 1. リファクタリング対象のクラスを特定
const targetClass = await mcp.callTool('code_find_symbol', {
  symbol_name: 'LegacyUserService',
  search_type: 'exact'
});

// 2. クラスのすべての参照を検索
const allReferences = await mcp.callTool('code_find_referencing_symbols', {
  target_file: targetClass.file_path,
  target_symbol: 'LegacyUserService',
  search_scope: 'workspace',
  include_context: true
});

// 3. 段階的にリネーム
const renameResult = await mcp.callTool('smart_edit_file', {
  file_path: targetClass.file_path,
  old_text: 'export class LegacyUserService',
  new_text: 'export class UserService',
  create_backup: true
});

// 4. 各参照箇所を更新
for (const ref of allReferences) {
  await mcp.callTool('smart_edit_file', {
    file_path: ref.file_path,
    old_text: 'LegacyUserService',
    new_text: 'UserService',
    create_backup: true
  });
}
```

### 3. ドキュメント生成

```typescript
// 1. プロジェクト構造の分析
const projectStructure = await mcp.callTool('code_get_symbols_overview', {
  relative_path: 'src',
  max_depth: 3,
  include_private: false
});

// 2. 各モジュールのAPIドキュメントを生成
const apiDoc = `# API Documentation

## Core Services

${projectStructure.map(module => `
### ${module.name}

**Location**: \`${module.file_path}\`

**Public Methods**:
${module.children?.filter(c => c.kind === 6).map(method => `
- \`${method.name}(${method.parameters || ''})\`: ${method.description || 'No description'}
`).join('') || 'No public methods'}

**Dependencies**:
${module.dependencies?.map(dep => `- ${dep}`).join('\n') || 'No dependencies'}
`).join('\n')}
`;

// 3. ドキュメントファイルとして保存
await mcp.callTool('smart_edit_file', {
  file_path: 'docs/API.md',
  old_text: '',
  new_text: apiDoc,
  create_new_file: true
});
```

### 4. セキュリティ監査

```typescript
// 1. 潜在的なセキュリティ問題を検索
const securityPatterns = [
  'eval\\(',              // eval使用
  'innerHTML\\s*=',       // innerHTML代入
  'document\\.write',     // document.write使用
  'localStorage\\.',      // localStorage使用
  'sessionStorage\\.',    // sessionStorage使用
  '\\$\\{.*\\}',          // テンプレート文字列
];

for (const pattern of securityPatterns) {
  const issues = await mcp.callTool('code_search_pattern', {
    pattern,
    directory_path: 'src',
    file_pattern: '*.{ts,js}',
    include_context: true
  });
  
  if (issues.length > 0) {
    // セキュリティ問題の詳細検索（学習型）
    const relatedSecurityFiles = await mcp.callTool('search_with_learning', {
      query: `security issues ${pattern}`,
      content_pattern: 'vulnerability|security|auth|sanitize',
      learn_patterns: true,
      max_results: 20
    });
    
    console.log('セキュリティ問題検出:', {
      pattern,
      issueCount: issues.length,
      relatedFiles: relatedSecurityFiles.results.length
    });
  }
}
```

## 高度な機能

### 1. 正規表現による置換

```typescript
// 複雑なパターンマッチングと置換
const regexReplace = await mcp.callTool('code_replace_with_regex', {
  file_path: '/path/to/file.ts',
  search_pattern: 'function\\s+(\\w+)\\s*\\(',
  replacement: 'const $1 = (',
  flags: 'g',
  backup: true
});
```

### 2. シンボルの完全置換

```typescript
// メソッドの実装を完全に置き換え
const symbolReplace = await mcp.callTool('code_replace_symbol_body', {
  file_path: '/path/to/service.ts',
  symbol_name: 'calculateTotal',
  new_body: `calculateTotal(items: Item[]): number {
    return items.reduce((sum, item) => {
      return sum + (item.price * item.quantity);
    }, 0);
  }`,
  backup: true
});
```

### 3. シンボルの前後にコード挿入

```typescript
// メソッドの前に型定義を追加
const insertBefore = await mcp.callTool('code_insert_at_symbol', {
  file_path: '/path/to/service.ts',
  symbol_name: 'UserService',
  position: 'before',
  content: `interface UserServiceConfig {
  apiUrl: string;
  timeout: number;
}

`,
  backup: true
});

// クラスの最後に新しいメソッドを追加
const insertAfter = await mcp.callTool('code_insert_at_symbol', {
  file_path: '/path/to/service.ts',
  symbol_name: 'UserService',
  position: 'inside',
  content: `
  private validateUser(user: User): boolean {
    return user.email && user.email.includes('@');
  }`,
  backup: true
});
```

## パフォーマンス最適化

### 1. 検索結果の制限

```typescript
// 大きなプロジェクトでのパフォーマンス最適化
const optimizedSearch = await mcp.callTool('code_find_symbol', {
  symbol_name: 'Component',
  search_type: 'fuzzy',
  file_pattern: 'components',  // 検索範囲を限定
  max_results: 20              // 結果数を制限
});
```

### 2. バッチ処理

```typescript
// 複数ファイルの一括処理
const files = ['file1.ts', 'file2.ts', 'file3.ts'];
const results = await Promise.all(
  files.map(file => 
    mcp.callTool('code_get_symbols_overview', {
      relative_path: file,
      max_depth: 1
    })
  )
);
```

### 3. キャッシュの活用

```typescript
// ワークスペース情報をキャッシュ
let workspaceInfo = null;

async function getWorkspaceInfo() {
  if (!workspaceInfo) {
    workspaceInfo = await mcp.callTool('workspace_get_info');
  }
  return workspaceInfo;
}
```

## エラーハンドリング

### 一般的なエラーパターン

```typescript
try {
  const result = await mcp.callTool('smart_edit_file', {
    file_path: '/path/to/file.ts',
    old_text: 'target',
    new_text: 'replacement'
  });
  
  if (result.isError) {
    console.error('Edit failed:', result.content[0].text);
    return;
  }
  
  const data = JSON.parse(result.content[0].text);
  if (!data.success) {
    console.warn('Edit succeeded but no changes made:', data.message);
  }
  
} catch (error) {
  console.error('MCP call failed:', error);
  // フォールバック処理
}
```

### バックアップからの復旧

```typescript
// バックアップファイルから復旧
const editResult = await mcp.callTool('smart_edit_file', {
  file_path: '/path/to/file.ts',
  old_text: 'current content',
  new_text: 'new content',
  create_backup: true
});

if (editResult.isError) {
  console.error('Edit failed, restoring from backup...');
  
  // バックアップファイルの内容を取得
  const backup = await mcp.callTool('read_file', {
    file_path: editResult.backup_path
  });
  
  // 元のファイルに復旧
  await mcp.callTool('smart_edit_file', {
    file_path: '/path/to/file.ts',
    old_text: '', // 全内容を置換
    new_text: backup.content[0].text,
    create_backup: false
  });
}
```

## ベストプラクティス

### 1. セキュリティ

- **常にバックアップを作成**: `create_backup: true`を使用
- **プレビューモードを活用**: 重要な変更前に`preview_mode: true`で確認
- **適切なファイルサイズ制限**: `max_file_size`パラメータを設定
- **ワークスペースの境界を尊重**: 許可されたパス以外にアクセスしない

### 2. パフォーマンス

- **検索範囲を限定**: `file_pattern`や`directory_path`で範囲を絞る
- **結果数を制限**: `max_results`パラメータを適切に設定
- **インクリメンタル処理**: 大量のファイルは分割して処理
- **キャッシュを活用**: 同じクエリの繰り返しを避ける

### 3. 保守性

- **意味のあるメモリ名**: プロジェクトメモリには説明的な名前を使用
- **適切なタグ付け**: 検索しやすいようにタグを設定
- **ドキュメント化**: 重要な決定や手順をメモリに記録
- **バージョン管理**: 設定ファイルはgitで管理

### 4. 開発効率

- **自動化スクリプト**: 繰り返し作業はスクリプト化
- **エラーハンドリング**: 適切な例外処理とフォールバック
- **ログ記録**: 監査ログを定期的に確認
- **テスト環境**: 本番前にテスト環境で検証

## トラブルシューティング

よくある問題と解決方法については、[TROUBLESHOOTING.md](./TROUBLESHOOTING.md)を参照してください。

## 設定とカスタマイズ

### ログとDiff設定 (v1.0.6新機能)

操作ログとファイル編集時の差分表示を統一設定で管理：

```yaml
# .claude/workspace/effortlessly/config.yaml
logging:
  operations:
    enabled: true
  diff:
    enabled: true
    max_lines_for_detailed_diff: 500
    display_options:
      default_context_lines: 3
```

**主要設定オプション**：
- `operations.enabled`: MCPツール操作ログの有効/無効
- `diff.enabled`: Diff表示の有効/無効
- `max_lines_for_detailed_diff`: 詳細diff vs サマリー表示の閾値
- `default_context_lines`: diff表示時のコンテキスト行数

詳細は [ログ・Diff設定ガイド](./LOGGING-CONFIGURATION.md) をご確認ください。

## 関連ドキュメント

- [セットアップガイド](./SETUP.md) - インストールと初期設定
- [APIリファレンス](./API.md) - 全ツールの詳細仕様
- [ログ・Diff設定ガイド](./LOGGING-CONFIGURATION.md) - 操作ログとdiff表示の設定
- [セキュリティガイド](./SECURITY.md) - セキュリティ設定と監査
- [トラブルシューティング](./TROUBLESHOOTING.md) - 問題解決ガイド

---

**effortlessly-mcp Usage Guide** - Version 1.0.0

実践的な使い方ガイド - 効率的なコード分析とファイル操作