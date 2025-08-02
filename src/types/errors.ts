/**
 * Base error class for all MCP server errors
 */
export abstract class McpError extends Error {
  abstract readonly code: string;
  abstract readonly statusCode: number;

  constructor(
    message: string,
    public readonly _details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = this.constructor.name;
  }

  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      statusCode: this.statusCode,
      details: this._details,
    };
  }
}

/**
 * Validation error for invalid input parameters
 */
export class ValidationError extends McpError {
  readonly code = 'VALIDATION_ERROR';
  readonly statusCode = 400;
}

/**
 * Security error for unauthorized access attempts
 */
export class SecurityError extends McpError {
  readonly code = 'SECURITY_ERROR';
  readonly statusCode = 403;
}

/**
 * File system error for file/directory operations
 */
export class FileSystemError extends McpError {
  readonly code = 'FILESYSTEM_ERROR';
  readonly statusCode = 500;
}

/**
 * Configuration error for invalid configuration
 */
export class ConfigurationError extends McpError {
  readonly code = 'CONFIGURATION_ERROR';
  readonly statusCode = 500;
}

/**
 * Tool execution error for general tool failures
 */
export class ToolExecutionError extends McpError {
  readonly code = 'TOOL_EXECUTION_ERROR';
  readonly statusCode = 500;
}