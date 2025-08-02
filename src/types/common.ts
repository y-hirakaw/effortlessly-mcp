/**
 * Log levels for the MCP server
 */
export enum LogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error',
}

/**
 * Log entry structure
 */
export interface ILogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: Record<string, unknown>;
  error?: Error;
}

/**
 * Tool result content (compatible with MCP SDK)
 */
export interface IToolContent {
  [x: string]: unknown;
  type: 'text';
  text: string;
  _meta?: Record<string, unknown>;
}

/**
 * Tool execution result (compatible with MCP SDK)
 */
export interface IToolResult {
  [x: string]: unknown;
  content: IToolContent[];
  isError?: boolean;
}

/**
 * Tool parameter definition
 */
export interface IToolParameter {
  type: string;
  description: string;
  required?: boolean;
}

/**
 * Tool metadata
 */
export interface IToolMetadata {
  name: string;
  description: string;
  parameters: Record<string, IToolParameter>;
}

/**
 * Base tool interface
 */
export interface ITool {
  readonly metadata: IToolMetadata;
  execute(_parameters: Record<string, unknown>): Promise<IToolResult>;
}