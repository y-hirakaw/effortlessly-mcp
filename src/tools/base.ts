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
    // パフォーマンス向上のため、詳細ログを条件付きで出力
    if (process.env.MCP_DEBUG === 'true' || process.env.NODE_ENV === 'development') {
      this.logger.debug(`Validating parameters for ${this.metadata.name}`, {
        parameterKeys: Object.keys(parameters),
        parameterTypes: Object.fromEntries(
          Object.entries(parameters).map(([key, value]) => [key, typeof value])
        ),
        // smart_edit_fileツール固有の要約情報のみ
        ...(this.metadata.name === 'smart_edit_file' && {
          hasNewText: 'new_text' in parameters,
          newTextType: typeof parameters.new_text,
          newTextLength: typeof parameters.new_text === 'string' ? (parameters.new_text as string).length : 'N/A'
        })
      });
    }

    try {
      return this.schema.parse(parameters);
    } catch (error) {
      if (error instanceof z.ZodError) {
        // 詳細なエラー情報をログ出力
        this.logger.error(`Parameter validation failed for ${this.metadata.name}`, error, {
          zodErrors: error.errors,
          receivedParameters: parameters,
          problematicFields: error.errors.map(e => e.path.join('.')),
          validationDetails: error.errors.map(e => ({
            field: e.path.join('.'),
            code: e.code,
            message: e.message,
            received: e.path.reduce((obj: unknown, path) => (obj as Record<string, unknown>)?.[path], parameters)
          }))
        });

        // より詳細なエラーメッセージを作成
        const fieldErrors = error.errors.map(e => {
          const fieldPath = e.path.join('.');
          const receivedValue = e.path.reduce((obj: unknown, path) => (obj as Record<string, unknown>)?.[path], parameters);
          return `${fieldPath}: ${e.message} (受信値: ${typeof receivedValue === 'undefined' ? 'undefined' : typeof receivedValue})`;
        }).join(', ');

        throw new ValidationError(
          `Invalid parameters for tool ${this.metadata.name}: ${fieldErrors}`,
          {
            tool: this.metadata.name,
            errors: error.errors,
            receivedParameters: parameters,
            detailedAnalysis: {
              parameterCount: Object.keys(parameters).length,
              missingRequiredFields: error.errors
                .filter(e => e.code === 'invalid_type' && e.received === 'undefined')
                .map(e => e.path.join('.')),
              invalidTypeFields: error.errors
                .filter(e => e.code === 'invalid_type')
                .map(e => ({ 
                  field: e.path.join('.'), 
                  expected: (e as any).expected, 
                  received: (e as any).received 
                }))
            }
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