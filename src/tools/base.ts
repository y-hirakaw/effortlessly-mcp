import { z } from 'zod';
import { ITool, IToolMetadata, IToolResult } from '../types/common.js';
import { ValidationError } from '../types/errors.js';
import { Logger } from '../services/logger.js';

/**
 * Base abstract class for all MCP tools
 */
export abstract class BaseTool implements ITool {
  protected readonly logger = Logger.getInstance();
  
  abstract readonly metadata: IToolMetadata;
  protected abstract readonly schema: z.ZodType<unknown>;

  /**
   * Validates input parameters against the tool's schema
   */
  protected validateParameters(parameters: Record<string, unknown>): unknown {
    try {
      return this.schema.parse(parameters);
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new ValidationError(
          `Invalid parameters for tool ${this.metadata.name}`,
          {
            tool: this.metadata.name,
            errors: error.errors,
            receivedParameters: parameters,
          },
        );
      }
      throw error;
    }
  }

  /**
   * Executes the tool with validated parameters
   */
  async execute(parameters: Record<string, unknown>): Promise<IToolResult> {
    this.logger.debug(`Executing tool: ${this.metadata.name}`, { parameters });

    try {
      const validatedParams = this.validateParameters(parameters);
      const result = await this.executeInternal(validatedParams);
      
      this.logger.debug(`Tool executed successfully: ${this.metadata.name}`);
      return result;
    } catch (error) {
      this.logger.error(
        `Tool execution failed: ${this.metadata.name}`,
        error instanceof Error ? error : new Error(String(error)),
        { parameters },
      );

      return {
        content: [
          {
            type: 'text' as const,
            text: error instanceof Error ? error.message : String(error),
          },
        ],
        isError: true,
      };
    }
  }

  /**
   * Internal execution method to be implemented by concrete tools
   */
  protected abstract executeInternal(_validatedParameters: unknown): Promise<IToolResult>;

  /**
   * Creates a successful text result
   */
  protected createTextResult(text: string): IToolResult {
    return {
      content: [
        {
          type: 'text' as const,
          text,
        },
      ],
    };
  }

  /**
   * Creates an error result
   */
  protected createErrorResult(message: string): IToolResult {
    return {
      content: [
        {
          type: 'text' as const,
          text: message,
        },
      ],
      isError: true,
    };
  }
}