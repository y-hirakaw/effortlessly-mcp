import { ITool } from '../types/common.js';
import { Logger } from '../services/logger.js';

import { 
  WorkspaceSetupTool
} from './project-management/index.js';
// LSP関連ツール (v2.0 戦略転換により廃止済み)
// LSP関連コード編集ツール (v2.0 戦略転換により廃止済み)
import {
  SmartEditFileTool,
  SmartInsertTextTool,
  OverrideTextTool,
  SmartRangeOptimizerTool
} from './file-operations/index.js';
// JavaLSP基本診断ツール (v2.0 戦略転換により廃止済み)
import { 
  searchFiles
  // optimizeSearchQuery, getSearchStatistics, updateSearchPatterns は廃止済み
} from './search-learning-engine.js';

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
    // プロジェクト管理ツール
    this.registerTool(new WorkspaceSetupTool());
    
    // コード解析ツール (LSP機能は v2.0 戦略転換により廃止済み)
    
    // プロジェクト知識管理ツール（廃止済み）
    
    // 精密コード編集ツール (LSP機能は v2.0 戦略転換により廃止済み)
    
    // スマート編集ツール
    this.registerTool(new SmartEditFileTool());
    this.registerTool(new SmartInsertTextTool());
    this.registerTool(new OverrideTextTool());
    
    // スマート読み込みツール（新規追加 ROI 400%）
    this.registerTool(new SmartRangeOptimizerTool());
    
    // Java LSP基本診断ツール (LSP機能は v2.0 戦略転換により廃止済み)
    
    // 🆕 AI強化検索機能（v2.0新機能・最高ROI：350%）
    this.registerTool(searchFiles);
    // 廃止済み: optimizeSearchQuery, getSearchStatistics, updateSearchPatterns
    // → search_filesに統合・自動化
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