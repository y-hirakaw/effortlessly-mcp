import { ITool } from '../types/common.js';
import { Logger } from '../services/logger.js';
import { EchoTool } from './echo.js';
import { ReadFileTool } from './file-operations/read-file-adapter.js';
import { ListDirectoryTool } from './file-operations/list-directory-adapter.js';
import { GetFileMetadataTool } from './file-operations/get-file-metadata-adapter.js';
import { SearchFilesTool } from './file-operations/search-files-adapter.js';
import { 
  WorkspaceActivateTool, 
  WorkspaceGetInfoTool, 
  WorkspaceListAllTool 
} from './project-management/index.js';
import { 
  CodeFindSymbolTool, 
  CodeFindReferencesTool,
  CodeGetSymbolHierarchyTool,
  CodeAnalyzeDependenciesTool
} from './code-analysis/index.js';

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
    this.registerTool(new EchoTool());
    
    // ファイル操作ツール
    this.registerTool(new ReadFileTool());
    this.registerTool(new ListDirectoryTool());
    this.registerTool(new GetFileMetadataTool());
    this.registerTool(new SearchFilesTool());
    
    // プロジェクト管理ツール
    this.registerTool(new WorkspaceActivateTool());
    this.registerTool(new WorkspaceGetInfoTool());
    this.registerTool(new WorkspaceListAllTool());
    
    // コード解析ツール
    this.registerTool(new CodeFindSymbolTool());
    this.registerTool(new CodeFindReferencesTool());
    this.registerTool(new CodeGetSymbolHierarchyTool());
    this.registerTool(new CodeAnalyzeDependenciesTool());
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