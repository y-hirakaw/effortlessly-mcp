/**
 * プロジェクトメモリ更新ワークフロー生成ツール
 * プロジェクトメモリを最新化するための手順を生成
 */

import { z } from 'zod';
import { BaseTool } from './base.js';
import { IToolMetadata, IToolResult } from '../types/common.js';
import { LogManager } from '../utils/log-manager.js';

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
      case 'structure_index':
        return this.generateStructureIndexWorkflow(scope, focusAreas, preview, classification);
      
      case 'dependencies_map':
        return this.generateDependenciesMapWorkflow(scope, focusAreas, preview, classification);
      
      case 'tech_stack_inventory':
        return this.generateTechStackInventoryWorkflow(scope, focusAreas, preview, classification);
      
      case 'development_context':
        return this.generateDevelopmentContextWorkflow(scope, focusAreas, preview, classification);
      
      default:
        return null;
    }
  }

  /**
   * プロジェクト構造インデックス更新ワークフロー
   */
  private generateStructureIndexWorkflow(scope: string, focusAreas?: string[], preview: boolean = false, classification?: string): WorkflowPlan {
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

    // 結果をプロジェクトメモリに保存
    if (!preview) {
      steps.push({
        step: stepCounter++,
        tool: 'project_memory_write',
        params: {
          memory_name: 'project_structure_index',
          content: this.generateClassificationPrompt(classification, 'project_structure_index', 'Markdown形式のプロジェクト構造インデックス'),
          tags: ['index', 'structure', 'auto-generated', scope, ...(classification ? [classification] : [])]
        },
        purpose: 'プロジェクト構造情報をメモリに保存',
        expected_output: 'プロジェクトメモリへの保存完了確認'
      });
    }

    return {
      workflow_name: 'プロジェクト構造インデックス更新',
      description: `プロジェクトの${scope === 'full' ? '完全な' : scope === 'incremental' ? '差分' : '指定された'}構造情報を最新化します`,
      estimated_time: scope === 'full' ? '3-5分' : '2-3分',
      steps,
      next_actions: [
        '依存関係の詳細が必要な場合: project_memory_update_workflow task="dependencies_map"',
        '技術スタック情報が必要な場合: project_memory_update_workflow task="tech_stack_inventory"'
      ],
      notes: preview ? [
        'これはプレビューです。実際の実行時は各ステップを順番に実行してください。',
        'project_memory_writeの際は、前のステップで得られた実際の情報を使用してください。'
      ] : [
        '各ステップを順番に実行し、最後のproject_memory_writeで統合された情報を保存してください。',
        'エラーが発生した場合は、該当ステップをスキップして次に進んでも構いません。'
      ]
    };
  }

  /**
   * 依存関係マップ更新ワークフロー
   */
  private generateDependenciesMapWorkflow(scope: string, focusAreas?: string[], preview: boolean = false, classification?: string): WorkflowPlan {
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

    // 結果保存
    if (!preview) {
      steps.push({
        step: stepCounter++,
        tool: 'project_memory_write',
        params: {
          memory_name: 'dependencies_map',
          content: this.generateClassificationPrompt(classification, 'dependencies_map', '依存関係分析結果をまとめたMarkdown'),
          tags: ['dependencies', 'analysis', 'auto-generated', scope, ...(classification ? [classification] : [])]
        },
        purpose: '依存関係マップをプロジェクトメモリに保存'
      });
    }

    return {
      workflow_name: '依存関係マップ更新',
      description: 'プロジェクトの依存関係情報を最新化し、循環依存などの問題を検出します',
      estimated_time: '3-5分',
      steps,
      next_actions: [
        '構造情報も必要な場合: project_memory_update_workflow task="structure_index"'
      ]
    };
  }

  /**
   * 技術スタック棚卸しワークフロー
   */
  private generateTechStackInventoryWorkflow(_scope: string, _focusAreas?: string[], preview: boolean = false, _classification?: string): WorkflowPlan {
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

    // 結果保存
    if (!preview) {
      steps.push({
        step: stepCounter++,
        tool: 'project_memory_write',
        params: {
          memory_name: 'tech_stack_inventory',
          content: '技術スタック棚卸し結果のMarkdown',
          tags: ['tech-stack', 'inventory', 'auto-generated']
        },
        purpose: '技術スタック情報をプロジェクトメモリに保存'
      });
    }

    return {
      workflow_name: '技術スタック棚卸し',
      description: 'プロジェクトで使用されている技術・ツール・ライブラリを整理します',
      estimated_time: '4-6分',
      steps
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
      steps.push({
        step: stepCounter++,
        tool: 'project_memory_write',
        params: {
          memory_name: 'development_context',
          content: '開発コンテキスト情報を統合したMarkdown',
          tags: ['context', 'development', 'onboarding', 'auto-generated']
        },
        purpose: '開発コンテキストをプロジェクトメモリに保存'
      });
    }

    return {
      workflow_name: '開発コンテキスト整備',
      description: '新規開発者の参画や開発再開時に必要な情報を整備します',
      estimated_time: '5-8分',
      steps,
      notes: [
        '新規参画者向けの包括的な情報が生成されます',
        '既存の知識と重複する場合は、より新しい情報で更新されます'
      ]
    };
  }

  /**
   * 分類に応じたプロンプトを生成
   */
  private generateClassificationPrompt(classification: string | undefined, memoryType: string, taskContext: string): string {
    const basePrompt = `前のステップで収集した情報を統合した${taskContext}`;
    
    if (!classification) {
      return basePrompt;
    }

    const prompts = {
      template: this.getTemplatePrompts(),
      generic: this.getGenericPrompts(), 
      project_specific: this.getProjectSpecificPrompts()
    };

    const promptMap = prompts[classification as keyof typeof prompts];
    return promptMap[memoryType as keyof typeof promptMap] || basePrompt;
  }

  /**
   * テンプレート用プロンプト
   */
  private getTemplatePrompts() {
    return {
      project_structure_index: `
テンプレート(.claude/workspace/effortlessly/memory/templates/project_structure_template.md)を使用して、
このプロジェクトの構造インデックスを作成してください。

以下のプレースホルダーを実際のプロジェクト情報で置換してください：
- [PROJECT_NAME] → 検出されたプロジェクト名
- [PROJECT_TYPE] → プロジェクトタイプ（MCP Server等）
- [TECH_STACK] → 使用技術スタック
- [PROJECT_DIRECTORY_TREE] → 実際のディレクトリ構造
- [TOTAL_FILES] → ファイル総数
- [LANGUAGE_BREAKDOWN] → 言語構成比率

前のステップで収集した実際の情報を基に、具体的で有用なドキュメントを作成してください。
      `,

      dependencies_map: `
プロジェクトの依存関係マップをテンプレート形式で作成してください。
外部ライブラリの選択理由、バージョン情報、セキュリティ評価を含めて
他のプロジェクトでも参考になる形式で記録してください。
      `
    };
  }

  /**
   * 汎用プロンプト
   */
  private getGenericPrompts() {
    return {
      project_structure_index: `
このプロジェクトの汎用的な構造インデックスをMarkdown形式で作成してください。

含めるべき情報：
- プロジェクト全体のアーキテクチャ概要
- 主要ディレクトリとその役割
- 重要なファイルとその説明
- 開発・ビルド・テストの手順
- 他のプロジェクトでも参考になる設計パターン

プロジェクト固有の詳細は最小限に抑え、
再利用可能な知識として価値のある内容を重視してください。
      `,

      dependencies_map: `
汎用的な依存関係分析ドキュメントを作成してください。

分析観点：
- 各ライブラリの選択基準と理由
- セキュリティ・ライセンス観点での評価
- パフォーマンス・保守性への影響
- 代替ライブラリとの比較検討結果
- 他プロジェクトでの採用可能性

技術選定のベストプラクティスとして活用できる形式で記録してください。
      `
    };
  }

  /**
   * プロジェクト固有プロンプト
   */
  private getProjectSpecificPrompts() {
    return {
      project_structure_index: `
effortlessly-mcpプロジェクトの実装固有の構造情報を記録してください。

このプロジェクト特有の内容：
- LSP統合の実装アプローチ
- セキュリティ機能の実装状況
- MCP仕様への準拠状況
- 開発中の機能と未実装箇所
- プロジェクト固有の設計判断と背景
- 今後の開発計画と課題

開発者が実装を継続するために必要な
具体的で実用的な情報を重視してください。
      `,

      lsp_integration_status: `
effortlessly-mcpのLSP統合機能について、
現在の実装状況と今後のタスクを詳細に記録してください。

含める情報：
- TypeScript/Swift LSPの実装状況
- symbol-indexerの設計と実装詳細
- 自動起動システムの開発状況
- パフォーマンス最適化の進捗
- 未対応言語の対応計画
- 発見された技術的課題と解決方法
      `
    };
  }
}