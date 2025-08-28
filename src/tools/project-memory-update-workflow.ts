/**
 * プロジェクトメモリ更新ワークフロー生成ツール
 * プロジェクトメモリを最新化するための手順を生成
 * 
 * v2.0.0 - セルフドキュメンティング型命名規則を採用
 * AIが内容を理解しやすい説明的なファイル名を自動生成
 */

import { z } from 'zod';
import { BaseTool } from './base.js';
import { IToolMetadata, IToolResult } from '../types/common.js';
import { LogManager } from '../utils/log-manager.js';
import * as fs from 'fs';
import * as path from 'path';

const ProjectMemoryUpdateWorkflowSchema = z.object({
  task: z.string().optional().describe('更新タスクの種類'),
  scope: z.enum(['full', 'incremental', 'targeted']).optional().default('full').describe('更新の範囲'),
  focus_areas: z.array(z.string()).optional().describe('特定のフォーカスエリア'),
  preview: z.boolean().optional().default(false).describe('手順のプレビューのみ表示'),
  classification: z.enum(['generic', 'project_specific', 'template']).optional().describe('メモリの分類')
});

type ProjectMemoryUpdateWorkflowParams = z.infer<typeof ProjectMemoryUpdateWorkflowSchema>;

interface WorkflowStep {
  step: number;
  tool: string;
  params: Record<string, any>;
  purpose: string;
  expected_output?: string;
}

interface WorkflowPlan {
  workflow_name: string;
  description: string;
  estimated_time: string;
  steps: WorkflowStep[];
  final_prompt: string;
  target_file: string;
  next_actions?: string[];
  notes?: string[];
}

interface TaskCatalog {
  [key: string]: {
    description: string;
    use_cases: string[];
    estimated_time: string;
    scope_options: string[];
  };
}

/**
 * プロジェクトメモリ更新ワークフロー生成ツール
 */
export class ProjectMemoryUpdateWorkflowTool extends BaseTool {
  readonly metadata: IToolMetadata = {
    name: 'project_memory_update_workflow',
    description: 'プロジェクトメモリを最新化するための手順を生成します',
    parameters: {
      task: {
        type: 'string',
        description: '更新タスクの種類 (省略時は利用可能タスクを表示)',
        required: false
      },
      scope: {
        type: 'string',
        description: '更新の範囲: full(完全), incremental(差分), targeted(特定箇所)',
        required: false
      },
      focus_areas: {
        type: 'array',
        description: '特定のフォーカスエリア (例: ["src/", "docs/"])',
        required: false
      },
      preview: {
        type: 'boolean',
        description: '手順のプレビューのみ表示 (実行用の詳細は含めない)',
        required: false
      },
      classification: {
        type: 'string',
        description: 'メモリの分類: generic(汎用), project_specific(プロジェクト固有), template(テンプレート)',
        required: false
      }
    }
  };

  protected readonly schema = ProjectMemoryUpdateWorkflowSchema;
  /**
   * プロジェクトサイズを判定（ファイル数とディレクトリ構造ベース）
   */
  private getProjectScale(): 'small' | 'medium' | 'large' {
    try {
      const srcPath = path.join(process.cwd(), 'src');
      if (!fs.existsSync(srcPath)) return 'small';
      
      const countFiles = (dir: string): number => {
        if (!fs.existsSync(dir)) return 0;
        let count = 0;
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
          if (entry.isFile() && entry.name.endsWith('.ts')) count++;
          if (entry.isDirectory()) count += countFiles(path.join(dir, entry.name));
        }
        return count;
      };
      
      const fileCount = countFiles(srcPath);
      const directories = fs.readdirSync(srcPath, { withFileTypes: true })
        .filter(entry => entry.isDirectory()).length;
      
      if (fileCount > 100 || directories > 10) return 'large';
      if (fileCount > 30 || directories > 5) return 'medium';
      return 'small';
    } catch {
      return 'small';
    }
  }

  /**
   * プロジェクト情報を取得
   */
  private getProjectInfo(): { name: string; version: string } {
    try {
      const packageJsonPath = path.join(process.cwd(), 'package.json');
      if (fs.existsSync(packageJsonPath)) {
        const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
        return {
          name: packageJson.name || 'project',
          version: packageJson.version || '1.0.0'
        };
      }
    } catch (error) {
      // エラー時はデフォルト値を返す
    }
    return { name: 'project', version: '1.0.0' };
  }

  /**
   * トークン効率重視のJSON出力プロンプト生成
   */
  private generateJSONPrompt(taskType: string, category?: string): string {
    const scale = this.getProjectScale();
    const projectInfo = this.getProjectInfo();
    
    // プロジェクトサイズに応じた出力戦略
    const outputStrategy = {
      small: {
        fileName: 'project_index.json',
        approach: 'unified'  // 1ファイルに全情報統合
      },
      medium: {
        fileName: category ? `${category}.json` : `${taskType}.json`,
        approach: 'selective'  // 中規模は選択的分割
      },
      large: {
        fileName: category ? `${category}.json` : `${taskType}.json`, 
        approach: 'modular'  // 完全モジュール分割
      }
    }[scale];

    const basePrompt = `Analyze ${projectInfo.name} project and create lightweight JSON index:

**Project Scale**: ${scale}
**Output Strategy**: ${outputStrategy.approach}
**Target File**: ${outputStrategy.fileName}

**Core Analysis Areas:**
- Framework/runtime: TypeScript, Node.js, MCP protocol
- Dependencies: production & development
- Architecture: core modules, services, tools
- Entry points: main files, configuration
- Security: access control, audit systems

**Output Format:**`;

    // プロジェクトサイズ別のJSON構造定義
    const jsonTemplates = {
      small: `
\`\`\`json
{
  "project": "${projectInfo.name}",
  "framework": "Node.js + TypeScript",
  "scale": "${scale}",
  "architecture": {
    "core": ["mcp_protocol", "tool_handlers", "security"],
    "services": ["file_system", "project_memory", "search_engine"],
    "tools": ["read_file", "search_with_learning", "project_memory_*"]
  },
  "dependencies": {
    "runtime": {"@modelcontextprotocol/sdk": "^0.5.0", "sqlite3": "^5.1.0"},
    "dev": {"vitest": "^2.0.0", "typescript": "^5.5.0"}
  },
  "entry_points": ["src/index.ts"],
  "config": ["tsconfig.json", "package.json"],
  "security": ["whitelist", "audit_logs", "data_filter"]
}
\`\`\``,

      medium: category === 'architecture' ? `
\`\`\`json
{
  "architecture": {
    "layers": ["protocol", "tools", "services", "utils"],
    "patterns": ["factory", "observer", "strategy"],
    "core_modules": [
      {"name": "SecurityManager", "path": "src/services/", "role": "access_control"},
      {"name": "FileSystemService", "path": "src/services/", "role": "file_operations"},
      {"name": "SearchLearningEngine", "path": "src/tools/", "role": "ai_search"}
    ],
    "data_flow": ["request → validation → processing → response"],
    "dependencies": {"internal": 16, "external": 8}
  }
}
\`\`\`` : `
\`\`\`json
{
  "${taskType}": {
    "summary": "focused_${taskType}_analysis",
    "key_components": [],
    "relationships": [],
    "metrics": {}
  }
}
\`\`\``,

      large: `
\`\`\`json
{
  "${category || taskType}": {
    "scope": "${category || taskType}",
    "components": [],
    "interfaces": [],
    "dependencies": [],
    "patterns": [],
    "metrics": {
      "complexity": 0.0,
      "maintainability": 0.0,
      "coverage": 0.0
    }
  }
}
\`\`\``
    };

    return `${basePrompt}
${jsonTemplates[scale]}

**Requirements:**
- JSON only, no explanations
- Under 1500 tokens
- English keys/values only
- Focus on structural information
- Omit redundant descriptions`;
  }

  /**
   * プロジェクトサイズに応じたJSON出力ファイル名を生成
   * 小規模：統合JSON、大規模：分割JSON
   */
  private generateJSONFileName(
    taskType: string,
    category?: string
  ): string {
    const scale = this.getProjectScale();

    // プロジェクトサイズに応じたファイル名戦略
    switch (scale) {
      case 'small':
        return 'project_index';  // 統合インデックス
      case 'medium':
        return category ? `${category}_index` : `${taskType}_index`;
      case 'large':
        return category ? category : taskType;  // モジュール別分割
      default:
        return 'project_index';
    }
  }


  /**
   * プロンプトに説明的なファイル名の生成指示を追加
   */
  private enhancePromptWithNamingGuidance(basePrompt: string, fileName: string, description: string): string {
    return `${basePrompt}

  【重要】このドキュメントは以下の命名規則に従って保存されます：
  ファイル名: ${fileName}
  説明: ${description}

  このファイル名はAIが内容を理解しやすいセルフドキュメンティング型の名前です。
  ドキュメントの内容もこのファイル名に相応しい、包括的で構造化された情報を含めてください。

  ドキュメントの先頭には以下を含めてください：
  # ${description}
  *生成日時: ${new Date().toISOString().split('T')[0]}*
  *バージョン: ${this.getProjectInfo().version}*`;
  }
  protected async executeInternal(_validatedParameters: unknown): Promise<IToolResult> {
    const params = _validatedParameters as ProjectMemoryUpdateWorkflowParams;

    // タスクが指定されていない場合は利用可能タスクを表示
    if (!params.task) {
      const catalog = this.getTaskCatalog();
      return this.createTextResult(JSON.stringify({
        message: "利用可能なプロジェクト更新タスク",
        available_tasks: catalog,
        usage: "特定のタスクを実行するには: task パラメータを指定してください",
        example: 'project_memory_update_workflow task="structure_index" scope="full"'
      }, null, 2));
    }

    // ワークフローを生成 (分類を含む)
    const workflow = this.generateWorkflow(params.task, params.scope, params.focus_areas, params.preview, params.classification);
    
    if (!workflow) {
      return this.createErrorResult(`不明なタスク: ${params.task}. 利用可能タスクを確認するには task パラメータを省略してください。`);
    }

    // 操作ログ記録
    const logManager = LogManager.getInstance();
    await logManager.logOperation(
      'PROJECT_UPDATE_WORKFLOW',
      null,
      `Generated ${params.task || 'catalog'} workflow (${params.scope} scope)${params.focus_areas?.length ? ` focused on: ${params.focus_areas.join(', ')}` : ''}`
    );

    return this.createTextResult(JSON.stringify(workflow, null, 2));
  }

  /**
   * 利用可能なタスクカタログを取得
   */
  private getTaskCatalog(): TaskCatalog {
    return {
      "meta_index": {
        description: "🆕 メタインデックス（目次）を生成・更新",
        use_cases: [
          "プロジェクト知識の全体像を把握したい時",
          "新規参画者向けのナビゲーション提供",
          "既存インデックスの整理・統合"
        ],
        estimated_time: "1-2分",
        scope_options: ["full: 全インデックスを統合", "incremental: 新規項目のみ追加"]
      },
      "hierarchical_index": {
        description: "🆕 階層別カテゴリインデックスを生成",
        use_cases: [
          "特定領域（アーキテクチャ、クラス構成等）の詳細整理",
          "複雑な情報の体系的整理",
          "専門分野別の深掘り情報作成"
        ],
        estimated_time: "3-6分",
        scope_options: ["architecture: アーキテクチャ", "code_structure: コード構造", "data: データ管理", "security: セキュリティ", "integration: 外部統合"]
      },
      "structure_index": {
        description: "プロジェクト構造のインデックスを最新化",
        use_cases: [
          "新しいファイル/ディレクトリが追加された時",
          "大きなリファクタリング後",
          "新規参画者向けの情報整備"
        ],
        estimated_time: "2-4分",
        scope_options: ["full: 全体スキャン", "incremental: 変更差分のみ", "targeted: 指定エリアのみ"]
      },
      "dependencies_map": {
        description: "依存関係マップを更新", 
        use_cases: [
          "package.jsonが変更された時",
          "新しいライブラリを追加した時",
          "import文の大幅な変更後"
        ],
        estimated_time: "3-5分",
        scope_options: ["full: 全依存関係", "incremental: 変更分のみ", "targeted: 特定モジュールのみ"]
      },
      "tech_stack_inventory": {
        description: "技術スタック情報を棚卸し",
        use_cases: [
          "プロジェクト概要の更新時",
          "技術選定の見直し時",
          "ドキュメント更新時"
        ],
        estimated_time: "4-6分",
        scope_options: ["full: 全技術スタック", "targeted: 特定技術領域のみ"]
      },
      "development_context": {
        description: "開発コンテキストの整備",
        use_cases: [
          "新しい開発者の参画時",
          "開発環境の変更後",
          "プロジェクト再開時"
        ],
        estimated_time: "5-8分",
        scope_options: ["full: 完全な開発コンテキスト", "incremental: 差分情報のみ"]
      }
    };
  }

  /**
   * 指定されたタスクのワークフローを生成
   */
  private generateWorkflow(
    task: string, 
    scope: string = 'full', 
    focusAreas?: string[], 
    preview: boolean = false,
    classification?: string
  ): WorkflowPlan | null {
    
    switch (task) {
      case 'meta_index':
        return this.generateMetaIndexWorkflow(scope, focusAreas, preview, classification);
      
      case 'hierarchical_index':
        return this.generateHierarchicalIndexWorkflow(scope, focusAreas, preview, classification);
      
      case 'structure_index':
        return this.generateStructureIndexWorkflow(scope, focusAreas);
      
      case 'dependencies_map':
        return this.generateDependenciesMapWorkflow(scope, focusAreas);
      
      case 'tech_stack_inventory':
        return this.generateTechStackInventoryWorkflow(scope, focusAreas);
      
      case 'development_context':
        return this.generateDevelopmentContextWorkflow(scope, focusAreas, preview, classification);
      
      default:
        return null;
    }
  }

  /**
   * メタインデックス（目次）生成ワークフロー
   */
  private generateMetaIndexWorkflow(scope: string, _focusAreas?: string[], preview: boolean = false, _classification?: string): WorkflowPlan {
    const steps: WorkflowStep[] = [];
    let stepCounter = 1;

    // 既存のプロジェクトメモリを全て確認
    steps.push({
      step: stepCounter++,
      tool: 'project_memory_list',
      params: { include_statistics: true },
      purpose: '既存のプロジェクト知識・インデックスを全て取得',
      expected_output: '保存済みメモリファイルの一覧と統計情報'
    });

    // 階層別インデックスディレクトリの存在確認
    steps.push({
      step: stepCounter++,
      tool: 'list_directory',
      params: {
        directory_path: '.claude/workspace/effortlessly/index/knowledge',
        recursive: false
      },
      purpose: 'index/knowledge/ディレクトリ内のカテゴリ別インデックスを確認',
      expected_output: 'カテゴリ別知識インデックスファイルの存在状況'
    });

    // メタインデックスを生成・保存
    if (!preview) {
      const fileName = this.generateJSONFileName('meta_index');
      const description = 'プロジェクト全体の知識ナビゲーションインデックス';
      
      steps.push({
        step: stepCounter++,
        tool: 'project_memory_write',
        params: {
          memory_name: fileName,
          content: this.enhancePromptWithNamingGuidance(
            `前のステップで取得した既存インデックス情報を基に、階層的なメタインデックス（目次）をMarkdown形式で作成してください。

以下の構造で作成：

# effortlessly-mcp プロジェクト知識インデックス

## 🗺️ プロジェクト知識マップ

### パス: アーキテクチャについて
- **[システム設計](knowledge/architecture_index.md)** - アーキテクチャ概要と設計思想
- **[技術スタック](project/tech_stack_inventory.md)** - 使用技術とライブラリ選定理由

### パス: コード構造について  
- **[コード構造概要](knowledge/code_structure_index.md)** - 主要コンポーネントと責務分担
- **[LSP統合](lsp_symbols/)** - LSP関連設定とプロジェクトメモリ

### パス: データ管理について
- **[データ管理](knowledge/data_management_index.md)** - ストレージ戦略と永続化
- **[プロジェクト情報管理](project/project_structure_index.md)** - 知識・メタデータ管理システム

### パス: セキュリティ実装について
- **[セキュリティ設計](knowledge/security_index.md)** - セキュリティアーキテクチャ
- **[セキュリティ実装状況](project_specific/security_implementation_map.md)** - 実装詳細と対策状況

### パス: 外部統合について
- **[統合アーキテクチャ](knowledge/integration_index.md)** - 外部システム・プロトコル統合
- **[統合実装詳細](project_specific/lsp_integration_status.md)** - 具体的な統合実装と進捗

## 📚 詳細インデックス
各カテゴリの詳細情報へのリンクを含めてください。

## 🔄 更新情報
最終更新日時と更新内容を記録してください。`,
            fileName,
            description
          ),
          tags: ['meta-index', 'navigation', 'auto-generated', scope],
          overwrite: true
        },
        purpose: 'メタインデックス（プロジェクト知識の目次）を生成・保存',
        expected_output: 'メタインデックスの保存完了確認'
      });
    }

    const fileName = this.generateJSONFileName('meta_index');

    return {
      workflow_name: 'メタインデックス（目次）生成',
      description: `プロジェクト知識全体の${scope === 'full' ? '完全な' : '差分'}目次を生成します`,
      estimated_time: '1-2分',
      steps,
      final_prompt: this.generateJSONPrompt('meta_index'),
      target_file: `.claude/workspace/effortlessly/project_memory/${fileName}.json`,
      next_actions: [
        '特定カテゴリの詳細が必要な場合: project_memory_update_workflow task="hierarchical_index" scope="architecture"',
        'カテゴリ別インデックスの生成: hierarchical_index タスクを各カテゴリで実行'
      ],
      notes: preview ? [
        'これはプレビューです。実際の実行時は各ステップを順番に実行してください。',
        'メタインデックスは既存の全ての知識を統合した目次として機能します。'
      ] : [
        'メタインデックスは他の全てのインデックスへの入り口となります。',
        '既存のインデックスファイルが不足している場合は、hierarchical_indexタスクで生成してください。'
      ]
    };
  }

  /**
   * 階層別カテゴリインデックス生成ワークフロー
   */
  private generateHierarchicalIndexWorkflow(scope: string, _focusAreas?: string[], preview: boolean = false, classification?: string): WorkflowPlan {
    const category = scope || 'architecture'; // デフォルトはアーキテクチャ
    const steps: WorkflowStep[] = [];
    let stepCounter = 1;

    // カテゴリ別の情報収集ステップを生成
    const categorySteps = this.getCategorySpecificSteps(category);
    categorySteps.forEach(step => {
      steps.push({
        step: stepCounter++,
        ...step
      });
    });

    // 階層別インデックスディレクトリ作成（必要に応じて）
    steps.push({
      step: stepCounter++,
      tool: 'list_directory',
      params: {
        directory_path: '.claude/workspace/effortlessly/index/knowledge'
      },
      purpose: 'index/knowledge/ディレクトリの存在確認（作成が必要かチェック）',
      expected_output: 'knowledge/ディレクトリの状況'
    });

    // カテゴリ別インデックスを保存
    if (!preview) {
      const fileName = this.generateJSONFileName(`${category}_index`, category);
      const nameMapping: Record<string, string> = {
        'architecture': 'アーキテクチャ設計パターンのインデックス',
        'code_structure': 'コード構造と組織化のインデックス',
        'data': 'データ管理戦略のインデックス',
        'security': 'セキュリティ実装状況レポート',
        'integration': '外部システム統合のインデックス'
      };
      const description = nameMapping[category] || `${category}カテゴリのインデックス`;
      
      steps.push({
        step: stepCounter++,
        tool: 'project_memory_write',
        params: {
          memory_name: `knowledge/${fileName}`,
          content: this.enhancePromptWithNamingGuidance(this.getCategoryPrompt(category), fileName, description),
          tags: ['hierarchical-index', category, 'auto-generated', scope, ...(classification ? [classification] : [])],
          overwrite: true
        },
        purpose: `${category}カテゴリの階層別インデックスを生成・保存`,
        expected_output: 'カテゴリ別インデックスの保存完了確認'
      });
    }

    const fileName = this.generateJSONFileName(`${category}_index`, category);

    return {
      workflow_name: `階層別インデックス生成 (${category})`,
      description: `${category}カテゴリの詳細な階層的インデックスを生成します`,
      estimated_time: '3-6分',
      steps,
      final_prompt: this.generateJSONPrompt(`${category}_index`, category),
      target_file: `.claude/workspace/effortlessly/project_memory/${fileName}.json`,
      next_actions: [
        'メタインデックスの更新: project_memory_update_workflow task="meta_index"',
        '他のカテゴリも生成: hierarchical_index の scope を変更して実行'
      ],
      notes: preview ? [
        'これはプレビューです。実際の実行時は各ステップを順番に実行してください。',
        `${category}カテゴリに特化した詳細情報が生成されます。`
      ] : [
        `${category}カテゴリの階層的インデックスが index/knowledge/ ディレクトリに保存されます。`,
        'メタインデックスからこのカテゴリインデックスにリンクされます。'
      ]
    };
  }

  /**
   * カテゴリ別の情報収集ステップを取得
   */
  private getCategorySpecificSteps(category: string): Omit<WorkflowStep, 'step'>[] {
    const stepMap: Record<string, Omit<WorkflowStep, 'step'>[]> = {
      architecture: [
        {
          tool: 'code_get_symbols_overview',
          params: { relative_path: 'src', max_depth: 2 },
          purpose: 'アーキテクチャの主要コンポーネントを取得',
          expected_output: '主要クラス・インターフェースの構造'
        },
        {
          tool: 'read_file',
          params: { file_path: 'CLAUDE.md' },
          purpose: 'プロジェクト設計思想とアーキテクチャ概要を確認',
          expected_output: 'プロジェクトのアーキテクチャドキュメント'
        }
      ],
      code_structure: [
        {
          tool: 'code_get_symbols_overview',
          params: { relative_path: 'src', max_depth: 2 },
          purpose: '主要コンポーネントとモジュール構造を取得',
          expected_output: 'コードベースの主要構造と責務分担'
        },
        {
          tool: 'code_get_symbol_hierarchy',
          params: { directory_path: 'src', max_depth: 2 },
          purpose: 'コード階層とモジュール関係を分析',
          expected_output: 'モジュール間の依存関係と階層構造'
        }
      ],
      data: [
        {
          tool: 'search_files',
          params: { directory: 'src', content_pattern: 'database|storage|cache|persist|save|load', recursive: true, include_content: true },
          purpose: 'データ保存・管理関連の実装を自動検索',
          expected_output: 'データ関連実装の自動検出結果'
        },
        {
          tool: 'code_search_pattern',
          params: { pattern: 'class.*(?:Manager|Service|Repository|Store)', directory_path: 'src' },
          purpose: 'データ管理クラスパターンを自動検出',
          expected_output: 'データ管理に関連するクラス群'
        }
      ],
      security: [
        {
          tool: 'search_files',
          params: { directory: 'src', content_pattern: 'security|auth|audit|permission|validate|sanitize', recursive: true, include_content: true },
          purpose: 'セキュリティ関連実装を自動検索',
          expected_output: 'セキュリティ機能の自動検出結果'
        },
        {
          tool: 'code_search_pattern',
          params: { pattern: '(class|interface|function).*(?:Security|Auth|Audit|Validator)', directory_path: 'src' },
          purpose: 'セキュリティ関連クラス・関数を自動検出',
          expected_output: 'セキュリティコンポーネントの自動分析'
        }
      ],
      integration: [
        {
          tool: 'search_files',
          params: { directory: 'src', content_pattern: 'server|client|protocol|api|integration', recursive: true, include_content: true },
          purpose: '外部統合関連の実装を自動検索',
          expected_output: '統合機能の自動検出結果'
        },
        {
          tool: 'code_get_symbols_overview',
          params: { relative_path: 'src', max_depth: 3 },
          purpose: '統合関連コンポーネントの構造を自動分析',
          expected_output: '統合アーキテクチャの自動解析結果'
        }
      ]
    };

    return stepMap[category] || [];
  }

  /**
   * カテゴリ別のプロンプトを取得
   */
  private getCategoryPrompt(category: string): string {
    const prompts: Record<string, string> = {
      architecture: `前のステップで収集した情報を基に、effortlessly-mcpのアーキテクチャ詳細インデックスを作成してください。

# アーキテクチャインデックス

## 🏗️ システム設計概要
- 5層アーキテクチャの詳細
- 各層の責務と相互作用
- 設計原則と思想

## 🔧 主要コンポーネント
- 核となるクラス・サービス
- 依存関係と相互作用
- インターフェース設計

## 📦 モジュール構成
- ディレクトリ構造の意図
- パッケージ間の関係
- 拡張性への配慮

## 🔄 データフロー
- リクエスト処理の流れ
- エラーハンドリング戦略
- 非同期処理パターン`,

      code_structure: `前のステップで収集した情報を基に、プロジェクトのコード構造詳細インデックスを作成してください。

# コード構造インデックス

## 🏗️ 主要コンポーネント
検出されたクラス・インターフェース・関数を分析し、以下を自動生成：
- 主要なコンポーネントの分類と責務
- モジュール間の依存関係
- 設計パターンの検出結果

## 📦 モジュール構成
- ディレクトリ構造とその意図
- パッケージ・名前空間の組織化
- 層別アーキテクチャの実装状況

## 🔗 相互関係
- コンポーネント間の依存関係
- インターフェース・継承関係
- データフローと制御フロー

## 🛠️ 実装パターン
- 検出された設計パターン
- 共通ユーティリティの使用状況
- コード品質指標`,

      data: `前のステップで収集した情報を基に、プロジェクトのデータ管理詳細インデックスを作成してください。

# データ管理インデックス

## 🗄️ データストレージ
検出されたデータ保存実装を分析し、以下を自動生成：
- 使用されているストレージ技術（DB、ファイル、メモリ等）
- データ永続化パターンの実装状況
- パフォーマンス最適化手法

## 📁 データ構造
- データモデルとスキーマ設計
- ファイル形式とディレクトリ構造
- 設定・メタデータ管理

## 💾 メモリ管理
- キャッシュ戦略の実装
- 状態管理パターン
- リソース効率化手法

## 🔄 データフロー
- データの読み書きパターン
- 同期・非同期処理
- 整合性保証メカニズム`,

      security: `前のステップで収集した情報を基に、プロジェクトのセキュリティ実装詳細インデックスを作成してください。

# セキュリティ実装インデックス

## 🛡️ セキュリティ機能
検出されたセキュリティ実装を分析し、以下を自動生成：
- 認証・認可の実装パターン
- 入力検証・サニタイゼーション
- アクセス制御メカニズム

## 🔍 監査・ログ機能
- セキュリティログの実装状況
- 監査証跡の記録方法
- インシデント検出機能

## 🔒 データ保護
- 機密情報の保護実装
- 暗号化・ハッシュ化の使用
- 安全なデータ処理

## ⚠️ 脅威対策
- 脆弱性対策の実装状況
- セキュリティテスト機能
- エラーハンドリング`,

      integration: `前のステップで収集した情報を基に、プロジェクトの外部統合詳細インデックスを作成してください。

# 外部統合インデックス

## 🔗 統合アーキテクチャ
検出された統合実装を分析し、以下を自動生成：
- 使用されているプロトコル・API
- クライアント・サーバー実装
- 統合パターンとアーキテクチャ

## ⚡ 接続・通信管理
- 接続管理の実装方法
- 通信プロトコルの詳細
- エラーハンドリング・再試行機能

## 🛠️ 統合機能
- データ交換フォーマット
- 同期・非同期処理
- ステート管理

## 🔄 運用・保守
- 監視・ログ機能
- パフォーマンス最適化
- 障害対応・復旧機能`
    };

    return prompts[category] || `${category}カテゴリの詳細インデックスを作成してください。`;
  }

  /**
   * プロジェクト構造インデックス更新ワークフロー
   */
  private generateStructureIndexWorkflow(scope: string, focusAreas?: string[]): WorkflowPlan {
    const steps: WorkflowStep[] = [];
    let stepCounter = 1;

    // 基本的なディレクトリ構造取得
    steps.push({
      step: stepCounter++,
      tool: 'list_directory',
      params: {
        directory_path: '.',
        recursive: true,
        pattern: focusAreas ? `{${focusAreas.join(',')}}**/*` : undefined
      },
      purpose: 'プロジェクト全体のファイル構造を取得',
      expected_output: 'ディレクトリ階層とファイル一覧'
    });

    // シンボル概要取得
    if (scope === 'full' || scope === 'incremental') {
      steps.push({
        step: stepCounter++,
        tool: 'code_get_symbols_overview',
        params: {
          relative_path: focusAreas?.[0] || 'src',
          max_files: scope === 'full' ? 100 : 50
        },
        purpose: 'コードベースの主要コンポーネントとシンボル構造を把握',
        expected_output: 'クラス、関数、インターフェースの一覧'
      });
    }

    // 設定ファイル確認
    steps.push({
      step: stepCounter++,
      tool: 'read_file',
      params: {
        file_path: 'package.json'
      },
      purpose: 'プロジェクト基本情報と依存関係を確認',
      expected_output: 'プロジェクト名、バージョン、依存関係情報'
    });

    // TypeScript設定確認（存在する場合）
    if (scope === 'full') {
      steps.push({
        step: stepCounter++,
        tool: 'read_file',
        params: {
          file_path: 'tsconfig.json'
        },
        purpose: 'TypeScript設定とコンパイルオプションを確認',
        expected_output: 'TypeScript設定情報'
      });
    }

    const fileName = this.generateJSONFileName('structure_index');

    return {
      workflow_name: 'プロジェクト構造インデックス更新',
      description: `プロジェクトの${scope === 'full' ? '完全な' : scope === 'incremental' ? '差分' : '指定された'}構造情報を最新化します`,
      estimated_time: scope === 'full' ? '3-5分' : '2-3分',
      steps,
      final_prompt: this.generateJSONPrompt('structure_index'),
      target_file: `.claude/workspace/effortlessly/project_memory/${fileName}.json`,
      next_actions: [
        '依存関係の詳細が必要な場合: project_memory_update_workflow task="dependencies_map"',
        '技術スタック情報が必要な場合: project_memory_update_workflow task="tech_stack_inventory"'
      ],
      notes: [
        '各ステップを順番に実行し、最後のproject_memory_writeで統合された情報を保存してください。',
        'エラーが発生した場合は、該当ステップをスキップして次に進んでも構いません。'
      ]
    };
  }

  /**
   * 依存関係マップ更新ワークフロー
   */
  private generateDependenciesMapWorkflow(scope: string, focusAreas?: string[]): WorkflowPlan {
    const steps: WorkflowStep[] = [];
    let stepCounter = 1;

    // package.json読み取り
    steps.push({
      step: stepCounter++,
      tool: 'read_file',
      params: { file_path: 'package.json' },
      purpose: '依存関係の基本情報を取得',
      expected_output: 'dependencies, devDependencies の情報'
    });

    // 依存関係分析
    steps.push({
      step: stepCounter++,
      tool: 'code_analyze_dependencies',
      params: {
        file_path: focusAreas?.[0] || 'src/index.ts',
        depth: scope === 'full' ? 5 : 3,
        include_external: true
      },
      purpose: 'コード内の実際の依存関係を分析',
      expected_output: '依存関係グラフと循環依存の検出結果'
    });

    // インポート文検索
    if (scope === 'full') {
      steps.push({
        step: stepCounter++,
        tool: 'search_files',
        params: {
          directory: focusAreas?.[0] || 'src',
          content_pattern: 'import.*from|require\\(',
          recursive: true,
          include_content: true
        },
        purpose: 'すべてのインポート文を検索',
        expected_output: 'インポート文の使用箇所一覧'
      });
    }

    const fileName = this.generateJSONFileName('dependencies_map');

    return {
      workflow_name: '依存関係マップ更新',
      description: 'プロジェクトの依存関係情報を最新化し、循環依存などの問題を検出します',
      estimated_time: '3-5分',
      steps,
      final_prompt: this.generateJSONPrompt('dependencies_map'),
      target_file: `.claude/workspace/effortlessly/project_memory/${fileName}.json`,
      next_actions: [
        '構造情報も必要な場合: project_memory_update_workflow task="structure_index"'
      ]
    };
  }

  /**
   * 技術スタック棚卸しワークフロー
   */
  private generateTechStackInventoryWorkflow(_scope: string, _focusAreas?: string[]): WorkflowPlan {
    const steps: WorkflowStep[] = [];
    let stepCounter = 1;

    // 設定ファイル群を読み取り
    const configFiles = ['package.json', 'tsconfig.json', 'CLAUDE.md'];
    configFiles.forEach(file => {
      steps.push({
        step: stepCounter++,
        tool: 'read_file',
        params: { file_path: file },
        purpose: `${file}から技術構成情報を取得`,
        expected_output: `${file}の内容`
      });
    });

    // ファイル拡張子統計
    steps.push({
      step: stepCounter++,
      tool: 'search_files',
      params: {
        directory: '.',
        recursive: true,
        max_results: 1000
      },
      purpose: '使用されている技術・ファイル形式を統計',
      expected_output: 'ファイル種別ごとの統計情報'
    });

    const fileName = this.generateJSONFileName('tech_stack_inventory');

    return {
      workflow_name: '技術スタック棚卸し',
      description: 'プロジェクトで使用されている技術・ツール・ライブラリを整理します',
      estimated_time: '4-6分',
      steps,
      final_prompt: this.generateJSONPrompt('tech_stack_inventory'),
      target_file: `.claude/workspace/effortlessly/project_memory/${fileName}.json`
    };
  }

  /**
   * 開発コンテキスト整備ワークフロー
   */
  private generateDevelopmentContextWorkflow(_scope: string, _focusAreas?: string[], preview: boolean = false, _classification?: string): WorkflowPlan {
    const steps: WorkflowStep[] = [];
    let stepCounter = 1;

    // 既存のプロジェクトメモリ確認
    steps.push({
      step: stepCounter++,
      tool: 'project_memory_list',
      params: { include_statistics: true },
      purpose: '既存のプロジェクト知識を確認',
      expected_output: '保存済みメモリの一覧と統計情報'
    });

    // ワークスペース情報取得
    steps.push({
      step: stepCounter++,
      tool: 'workspace_get_info',
      params: {},
      purpose: '現在のワークスペース設定を確認',
      expected_output: 'アクティブなワークスペースの詳細情報'  
    });

    // プロジェクト構造の概要
    steps.push({
      step: stepCounter++,
      tool: 'code_get_symbols_overview',  
      params: { relative_path: '.' },
      purpose: 'プロジェクト全体のコード構造概要を取得',
      expected_output: '主要コンポーネントとシンボルの概要'
    });

    // 開発コンテキスト保存
    if (!preview) {
      const fileName = this.generateJSONFileName('development_context');
      
      steps.push({
        step: stepCounter++,
        tool: 'project_memory_write',
        params: {
          memory_name: fileName,
          content: this.generateJSONPrompt('development_context'),
          tags: ['context', 'development', 'onboarding', 'json-index', 'auto-generated']
        },
        purpose: '開発コンテキストをプロジェクトメモリに保存'
      });
    }

    const fileName = this.generateJSONFileName('development_context');

    return {
      workflow_name: '開発コンテキスト整備',
      description: '新規開発者の参画や開発再開時に必要な情報を整備します',
      estimated_time: '5-8分',
      steps,
      final_prompt: this.generateJSONPrompt('development_context'),
      target_file: `.claude/workspace/effortlessly/project_memory/${fileName}.json`,
      notes: [
        '新規参画者向けの包括的な情報が生成されます',
        '既存の知識と重複する場合は、より新しい情報で更新されます'
      ]
    };
  }

}