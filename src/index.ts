#!/usr/bin/env node

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { Logger } from './services/logger.js';
import { ToolRegistry } from './tools/registry.js';
import { McpError } from './types/errors.js';

// Server information
const SERVER_NAME = 'effortlessly-mcp';
const SERVER_VERSION = '1.0.0';

// Initialize logger and tool registry
const logger = Logger.getInstance();
const toolRegistry = ToolRegistry.getInstance();

// Create server instance
const server = new McpServer({
  name: SERVER_NAME,
  version: SERVER_VERSION,
  capabilities: {
    resources: {},
    tools: {},
  },
});

/**
 * Register all tools from the registry with the MCP server
 */
function registerTools(): void {
  const tools = toolRegistry.getAllTools();
  
  for (const [name, tool] of tools) {
    // For now, we'll use a simplified approach for the echo tool
    // In future iterations, we'll implement dynamic schema generation
    if (name === 'echo') {
      server.tool(
        name,
        tool.metadata.description,
        {
          message: z.string().describe('The message to echo back'),
          prefix: z.string().optional().describe('Optional prefix for the message'),
        },
        async (parameters) => {
          try {
            const result = await tool.execute(parameters);
            return result;
          } catch (error) {
            logger.error(`Tool execution failed: ${name}`, error instanceof Error ? error : new Error(String(error)));
            
            if (error instanceof McpError) {
              return {
                content: [
                  {
                    type: 'text' as const,
                    text: `Error (${error.code}): ${error.message}`,
                  },
                ],
                isError: true,
              };
            }
            
            return {
              content: [
                {
                  type: 'text' as const,
                  text: `Unexpected error: ${error instanceof Error ? error.message : String(error)}`,
                },
              ],
              isError: true,
            };
          }
        },
      );
    }
    
    logger.info(`Registered MCP tool: ${name}`);
  }
}

/**
 * Main function to run the server
 */
async function main(): Promise<void> {
  try {
    logger.info(`Starting ${SERVER_NAME} v${SERVER_VERSION}`);
    
    // Register tools
    registerTools();
    
    // Connect to transport
    const transport = new StdioServerTransport();
    await server.connect(transport);
    
    logger.info(`${SERVER_NAME} v${SERVER_VERSION} running on stdio`);
  } catch (error) {
    logger.error('Failed to start server', error instanceof Error ? error : new Error(String(error)));
    throw error;
  }
}

// Run the server
main().catch((error: unknown) => {
  logger.error('Fatal error in main()', error instanceof Error ? error : new Error(String(error)));
  process.exit(1);
});