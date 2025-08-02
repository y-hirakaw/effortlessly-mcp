import { z } from 'zod';
import { BaseTool } from './base.js';
import { IToolMetadata, IToolResult } from '../types/common.js';

const EchoParametersSchema = z.object({
  message: z.string().describe('The message to echo back'),
  prefix: z.string().optional().describe('Optional prefix for the message'),
});

type EchoParameters = z.infer<typeof EchoParametersSchema>;

/**
 * Echo tool - returns the provided message with optional prefix
 */
export class EchoTool extends BaseTool {
  readonly metadata: IToolMetadata = {
    name: 'echo',
    description: 'Echo back the provided message with optional prefix',
    parameters: {
      message: {
        type: 'string',
        description: 'The message to echo back',
        required: true,
      },
      prefix: {
        type: 'string',
        description: 'Optional prefix for the message',
        required: false,
      },
    },
  };

  protected readonly schema = EchoParametersSchema;

  protected async executeInternal(_validatedParameters: unknown): Promise<IToolResult> {
    const params = _validatedParameters as EchoParameters;
    
    const prefix = params.prefix ? `${params.prefix}: ` : 'Echo: ';
    const resultMessage = `${prefix}${params.message}`;
    
    this.logger.info('Echo tool executed', { 
      originalMessage: params.message,
      prefix: params.prefix,
      result: resultMessage,
    });

    return this.createTextResult(resultMessage);
  }
}