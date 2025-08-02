import { ITool } from '../types/common.js';
import { Logger } from '../services/logger.js';
import { EchoTool } from './echo.js';

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
    this.registerTool(new EchoTool());
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