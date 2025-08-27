import { ITool } from '../types/common.js';
import { Logger } from '../services/logger.js';
// import { EchoTool } from './echo.js'; // デバッグ用途のみ
import { ReadFileTool } from './file-operations/read-file-adapter.js';
import { ListDirectoryTool } from './file-operations/list-directory-adapter.js';
import { GetFileMetadataTool } from './file-operations/get-file-metadata-adapter.js';
// import { SearchFilesTool } from './file-operations/search-files-adapter.js'; // 廃止: search_with_learningで代替
import { 
  WorkspaceActivateTool, 
  WorkspaceGetInfoTool, 
  WorkspaceListAllTool 
} from './project-management/index.js';
import { 
  CodeFindSymbolTool, 
  CodeFindReferencesTool,
  CodeGetSymbolHierarchyTool,
  CodeAnalyzeDependenciesTool,
  CodeSearchPatternTool,
  CodeFindReferencingSymbolsTool,
  CodeGetSymbolsOverviewTool
} from './code-analysis/index.js';
import {
  ProjectMemoryWriteTool,
  ProjectMemoryReadTool,
  ProjectMemoryListTool,
  ProjectMemorySmartReadTool
} from './project-memory/index.js';
import { ProjectMemoryUpdateWorkflowTool } from './project-memory-update-workflow.js';
import {
  CodeReplaceSymbolBodyTool,
  CodeInsertAtSymbolTool,
  CodeReplaceWithRegexTool
} from './code-editing/index.js';
import {
  SmartEditFileTool,
  SmartInsertTextTool,
  OverrideTextTool,
  SmartRangeOptimizerTool
} from './file-operations/index.js';
import { JavaLSPBasicDiagnosticsTool } from './code-analysis/java-lsp-basic-diagnostics.js';
import { 
  searchWithLearning
  // optimizeSearchQuery, getSearchStatistics, updateSearchPatterns は廃止済み
} from './project-memory/search-learning-engine.js';

/**
 * Tool registry for managing and accessing all available tools
 */
export class ToolRegistry {
  private static instance: ToolRegistry;
  private readonly tools = new Map<string, ITool>();
  private readonly logger = Logger.getInstance();

  private constructor() {
    this.registerDefaultTools();
  }

  static getInstance(): ToolRegistry {
    if (!ToolRegistry.instance) {
      ToolRegistry.instance = new ToolRegistry();
    }
    return ToolRegistry.instance;
  }

  /**
   * Register default tools
   */
  private registerDefaultTools(): void {
    // 基本ツール
    // this.registerTool(new EchoTool()); // デバッグ・接続テスト用途のみ
    
    // ファイル操作ツール
    this.registerTool(new ReadFileTool());
    this.registerTool(new ListDirectoryTool());
    this.registerTool(new GetFileMetadataTool());
    // this.registerTool(new SearchFilesTool()); // → search_with_learningで代替
    
    // プロジェクト管理ツール
    this.registerTool(new WorkspaceActivateTool());
    this.registerTool(new WorkspaceGetInfoTool());
    this.registerTool(new WorkspaceListAllTool());
    
    // コード解析ツール
    this.registerTool(new CodeFindSymbolTool());
    this.registerTool(new CodeFindReferencesTool());
    this.registerTool(new CodeGetSymbolHierarchyTool());
    this.registerTool(new CodeAnalyzeDependenciesTool());
    this.registerTool(new CodeSearchPatternTool());
    this.registerTool(new CodeFindReferencingSymbolsTool());
    this.registerTool(new CodeGetSymbolsOverviewTool());
    
    // プロジェクト知識管理ツール
    this.registerTool(new ProjectMemoryWriteTool());
    this.registerTool(new ProjectMemoryReadTool());
    this.registerTool(new ProjectMemoryListTool());
    this.registerTool(new ProjectMemorySmartReadTool());
    
    // プロジェクト更新ワークフローツール
    this.registerTool(new ProjectMemoryUpdateWorkflowTool());
    
    // 精密コード編集ツール
    this.registerTool(new CodeReplaceSymbolBodyTool());
    this.registerTool(new CodeInsertAtSymbolTool());
    this.registerTool(new CodeReplaceWithRegexTool());
    
    // スマート編集ツール
    this.registerTool(new SmartEditFileTool());
    this.registerTool(new SmartInsertTextTool());
    this.registerTool(new OverrideTextTool());
    
    // スマート読み込みツール（新規追加 ROI 400%）
    this.registerTool(new SmartRangeOptimizerTool());
    
    // Java LSP基本診断ツール（Phase 2A）
    this.registerTool(new JavaLSPBasicDiagnosticsTool());
    
    // 🆕 AI強化検索機能（v2.0新機能・最高ROI：350%）
    this.registerTool(searchWithLearning);
    // 廃止済み: optimizeSearchQuery, getSearchStatistics, updateSearchPatterns
    // → search_with_learningに統合・自動化
  }

  /**
   * Register a tool
   */
  registerTool(tool: ITool): void {
    const name = tool.metadata.name;
    
    if (this.tools.has(name)) {
      this.logger.warn(`Tool ${name} is already registered, overwriting`);
    }
    
    this.tools.set(name, tool);
    this.logger.info(`Registered tool: ${name}`, { 
      description: tool.metadata.description,
      parameters: Object.keys(tool.metadata.parameters),
    });
  }

  /**
   * Get a tool by name
   */
  getTool(name: string): ITool | undefined {
    return this.tools.get(name);
  }

  /**
   * Get all registered tools
   */
  getAllTools(): Map<string, ITool> {
    return new Map(this.tools);
  }

  /**
   * Get tool names
   */
  getToolNames(): string[] {
    return Array.from(this.tools.keys());
  }

  /**
   * Check if a tool is registered
   */
  hasTool(name: string): boolean {
    return this.tools.has(name);
  }

  /**
   * Unregister a tool
   */
  unregisterTool(name: string): boolean {
    const removed = this.tools.delete(name);
    if (removed) {
      this.logger.info(`Unregistered tool: ${name}`);
    }
    return removed;
  }
}