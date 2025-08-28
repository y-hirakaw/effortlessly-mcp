#!/usr/bin/env node

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { Logger } from './services/logger.js';
import { ToolRegistry } from './tools/registry.js';
import { AutoWorkspaceManager } from './services/AutoWorkspaceManager.js';
import { WorkspaceManager } from './tools/project-management/workspace-manager.js';
import { McpError } from './types/errors.js';
import { ITool } from './types/common.js';

// Server information
const SERVER_NAME = 'effortlessly-mcp';
const SERVER_VERSION = '1.0.0';

// Initialize logger and tool registry
const logger = Logger.getInstance();
const toolRegistry = ToolRegistry.getInstance();

// Initialize workspace manager and auto workspace manager
const workspaceManager = WorkspaceManager.getInstance();
const autoWorkspaceManager = new AutoWorkspaceManager(workspaceManager);

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
    // Register tool based on its name with appropriate schema
    switch (name) {
      // case 'echo': // デバッグ・接続テスト用途のみ、エンドユーザー不要
        /*
        server.tool(
          name,
          tool.metadata.description,
          {
            message: z.string().describe('The message to echo back'),
            prefix: z.string().optional().describe('Optional prefix for the message'),
          },
          createToolHandler(name, tool)
        );
        break;
        */
        
      case 'read_file':
        server.tool(
          name,
          tool.metadata.description,
          {
            file_path: z.string().describe('Path to the file to read'),
            encoding: z.string().optional().default('utf-8').describe('File encoding (default: utf-8)'),
            offset: z.number().optional().describe('Starting line number (1-based)'),
            limit: z.number().optional().describe('Number of lines to read'),
            include_line_numbers: z.boolean().optional().default(false).describe('Whether to include line numbers'),
          },
          createToolHandler(name, tool)
        );
        break;
        
      case 'list_directory':
        server.tool(
          name,
          tool.metadata.description,
          {
            directory_path: z.string().describe('Path to the directory to list'),
            recursive: z.boolean().optional().default(false).describe('Whether to list recursively'),
            pattern: z.string().optional().describe('File name filter pattern (regex)'),
          },
          createToolHandler(name, tool)
        );
        break;
        
      case 'get_file_metadata':
        server.tool(
          name,
          tool.metadata.description,
          {
            file_path: z.string().describe('Path to the file/directory to get metadata'),
          },
          createToolHandler(name, tool)
        );
        break;
        
      // case 'search_files': // → search_with_learningで代替可能（learn_patterns: false で軽量実行）
        /*
        server.tool(
          name,
          tool.metadata.description,
          {
            directory: z.string().describe('検索対象のディレクトリパス'),
            file_pattern: z.string().optional().describe('ファイル名のパターン（glob形式）'),
            content_pattern: z.string().optional().describe('ファイル内容の検索パターン（正規表現）'),
            recursive: z.boolean().optional().default(false).describe('再帰的に検索するかどうか'),
            case_sensitive: z.boolean().optional().default(false).describe('大文字小文字を区別するかどうか'),
            max_depth: z.number().optional().describe('最大検索深度'),
            max_results: z.number().optional().default(100).describe('最大結果数'),
            include_content: z.boolean().optional().default(false).describe('マッチした内容を含めるかどうか'),
          },
          createToolHandler(name, tool)
        );
        break;
        */
        
      case 'workspace_setup':
        server.tool(
          name,
          tool.metadata.description,
          {
            workspace_path: z.string().describe('Root directory path of the workspace'),
            name: z.string().optional().describe('Workspace name (optional, auto-generated from directory name if not specified)'),
            index_enabled: z.boolean().optional().describe('Enable indexing functionality (default: true)'),
            auto_save_logs: z.boolean().optional().describe('ログの自動保存を有効にするか（デフォルト: true）'),
            log_retention_days: z.number().optional().describe('ログの保持日数（デフォルト: 30）'),
          },
          createToolHandler(name, tool)
        );
        break;
        
      case 'workspace_get_info':
        server.tool(
          name,
          tool.metadata.description,
          {},
          createToolHandler(name, tool)
        );
        break;
        
      case 'workspace_list_all':
        server.tool(
          name,
          tool.metadata.description,
          {},
          createToolHandler(name, tool)
        );
        break;
        
      // LSP機能無効化 (v2.0方針転換) - code_find_symbol
      // case 'code_find_symbol':
      //   server.tool(
      //     name,
      //     tool.metadata.description,
      //     {
      //       symbol_name: z.string().min(1).describe('検索するシンボル名'),
      //       search_type: z.enum(['exact', 'fuzzy']).optional().default('fuzzy').describe('検索タイプ'),
      //       symbol_kind: z.number().optional().describe('シンボルの種類（SymbolKind）'),
      //       file_pattern: z.string().optional().describe('ファイルパターン（部分マッチ）'),
      //       max_results: z.number().min(1).max(1000).optional().default(100).describe('最大結果数'),
      //       enable_fallback: z.boolean().optional().default(true).describe('フォールバック検索を有効にするか（デフォルト: true）')
      //     },
      //     createToolHandler(name, tool)
      //   );
      //   break;
        
      // LSP機能無効化 (v2.0方針転換) - code_find_references
      // case 'code_find_references':
      //   server.tool(
      //     name,
      //     tool.metadata.description,
      //     {
      //       file_path: z.string().min(1).describe('ファイルパス'),
      //       line: z.number().min(0).describe('行番号（0から開始）'),
      //       column: z.number().min(0).describe('列番号（0から開始）'),
      //       include_declaration: z.boolean().optional().default(true).describe('宣言も含めるかどうか')
      //     },
      //     createToolHandler(name, tool)
      //   );
      //   break;
        
      // LSP機能無効化 (v2.0方針転換) - code_get_symbol_hierarchy
      // case 'code_get_symbol_hierarchy':
      //   server.tool(
      //     name,
      //     tool.metadata.description,
      //     {
      //       file_path: z.string().optional().describe('特定のファイルのシンボル階層を取得（省略時はディレクトリ全体）'),
      //       directory_path: z.string().optional().describe('特定のディレクトリのシンボル階層を取得（省略時は全体）'),
      //       max_depth: z.number().min(1).max(10).optional().default(3).describe('最大階層深度'),
      //       include_private: z.boolean().optional().default(false).describe('プライベートシンボルも含めるか'),
      //       symbol_kinds: z.array(z.number()).optional().describe('含めるシンボル種類の配列（SymbolKind）')
      //     },
      //     createToolHandler(name, tool)
      //   );
      //   break;
        
      // LSP機能無効化 (v2.0方針転換) - code_analyze_dependencies
      // case 'code_analyze_dependencies':
      //   server.tool(
      //     name,
      //     tool.metadata.description,
      //     {
      //       file_path: z.string().min(1).describe('分析対象のファイルパス'),
      //       depth: z.number().min(1).max(10).optional().default(3).describe('依存関係の追跡深度'),
      //       include_external: z.boolean().optional().default(true).describe('外部ライブラリの依存関係も含めるか'),
      //       include_dev_dependencies: z.boolean().optional().default(false).describe('開発依存関係も含めるか'),
      //       resolve_imports: z.boolean().optional().default(true).describe('インポートパスを解決するか')
      //     },
      //     createToolHandler(name, tool)
      //   );
      //   break;
        
      case 'smart_edit_file':
        server.tool(
          name,
          tool.metadata.description,
          {
            file_path: z.string().describe('Target file path to edit'),
            old_text: z.string().describe('Text to be replaced'),
            new_text: z.string().describe('Replacement text'),
            preview_mode: z.boolean().optional().default(false).describe('Preview mode (no actual changes)'),
            create_backup: z.boolean().optional().default(true).describe('Create backup file (default: true)'),
            case_sensitive: z.boolean().optional().default(true).describe('Case sensitive match (default: true)'),
            replace_all: z.boolean().optional().default(false).describe('Replace all occurrences (default: false)'),
            max_file_size: z.number().optional().default(1048576).describe('Maximum file size in bytes (default: 1MB)'),
          },
          createToolHandler(name, tool)
        );
        break;
        
      case 'smart_insert_text':
        server.tool(
          name,
          tool.metadata.description,
          {
            file_path: z.string().describe('Target file path to edit'),
            text: z.string().describe('Text to insert'),
            position_type: z.enum(['line_number', 'after_text', 'before_text', 'start', 'end']).describe('Position specification method'),
            line_number: z.number().optional().describe('Line number (1-based, when position_type="line_number")'),
            reference_text: z.string().optional().describe('Reference text (for after_text/before_text)'),
            auto_indent: z.boolean().optional().default(true).describe('Auto indent adjustment (default: true)'),
            preserve_empty_lines: z.boolean().optional().default(true).describe('Preserve empty lines (default: true)'),
            preview_mode: z.boolean().optional().default(false).describe('Preview mode (no actual insertion)'),
            create_backup: z.boolean().optional().default(true).describe('Create backup file (default: true)'),
            max_file_size: z.number().optional().default(1048576).describe('Maximum file size in bytes (default: 1MB)'),
          },
          createToolHandler(name, tool)
        );
        break;
        
      case 'override_text':
        server.tool(
          name,
          tool.metadata.description,
          {
            file_path: z.string().describe('Target file path'),
            text: z.string().describe('New file content (complete replacement)'),
            preview_mode: z.boolean().optional().default(false).describe('Preview mode (no actual changes)'),
            create_backup: z.boolean().optional().default(true).describe('Create backup file'),
            max_file_size: z.number().optional().default(10485760).describe('Maximum file size in bytes (default: 10MB)'),
            confirm_override: z.boolean().optional().default(false).describe('Explicit confirmation of override intent'),
            allow_new_file: z.boolean().optional().default(true).describe('Allow new file creation'),
          },
          createToolHandler(name, tool)
        );
        break;
        
      case 'project_memory_update_workflow':
        server.tool(
          name,
          tool.metadata.description,
          {
            task: z.string().optional().describe('更新タスクの種類'),
            scope: z.enum(['full', 'incremental', 'targeted']).optional().default('full').describe('更新の範囲'),
            focus_areas: z.array(z.string()).optional().describe('特定のフォーカスエリア'),
            preview: z.boolean().optional().default(false).describe('手順のプレビューのみ表示')
          },
          createToolHandler(name, tool)
        );
        break;
        
      case 'project_memory_write':
        server.tool(
          name,
          tool.metadata.description,
          {
            memory_name: z.string().describe('メモリファイル名'),
            content: z.string().describe('保存する内容'),
            tags: z.array(z.string()).optional().describe('タグのリスト'),
            overwrite: z.boolean().optional().default(false).describe('既存ファイルを上書きするか')
          },
          createToolHandler(name, tool)
        );
        break;
        
      case 'project_memory_read':
        server.tool(
          name,
          tool.metadata.description,
          {
            memory_name: z.string().describe('読み取るメモリファイル名')
          },
          createToolHandler(name, tool)
        );
        break;
        
      case 'project_memory_list':
        server.tool(
          name,
          tool.metadata.description,
          {
            tag_filter: z.string().optional().describe('タグによるフィルタリング'),
            include_statistics: z.boolean().optional().default(false).describe('統計情報を含める')
          },
          createToolHandler(name, tool)
        );
        break;
        
      case 'project_memory_smart_read':
        server.tool(
          name,
          tool.metadata.description,
          {
            query: z.string().min(1).describe('What information are you looking for?'),
            max_results: z.number().min(1).max(10).default(3).describe('Maximum number of memory files to return'),
            include_content: z.boolean().default(true).describe('Whether to include full content or just metadata')
          },
          createToolHandler(name, tool)
        );
        break;
        
      // LSP機能無効化 (v2.0方針転換) - code_search_pattern
      // case 'code_search_pattern':
      //   server.tool(
      //     name,
      //     tool.metadata.description,
      //     {
      //       pattern: z.string().describe('検索パターン（正規表現）'),
      //       file_pattern: z.string().optional().describe('対象ファイルのパターン（glob形式）'),
      //       directory_path: z.string().optional().describe('検索対象ディレクトリ'),
      //       max_results: z.number().optional().default(100).describe('最大結果数'),
      //       include_context: z.boolean().optional().default(true).describe('コンテキストを含める'),
      //       case_sensitive: z.boolean().optional().default(false).describe('大文字小文字を区別')
      //     },
      //     createToolHandler(name, tool)
      //   );
      //   break;
        
      // LSP機能無効化 (v2.0方針転換) - code_find_referencing_symbols
      // case 'code_find_referencing_symbols':
      //   server.tool(
      //     name,
      //     tool.metadata.description,
      //     {
      //       target_file: z.string().describe('対象ファイルパス'),
      //       target_symbol: z.string().describe('対象シンボル名'),
      //       search_scope: z.enum(['workspace', 'project', 'directory']).optional().default('workspace').describe('検索範囲'),
      //       max_results: z.number().optional().default(100).describe('最大結果数'),
      //       include_context: z.boolean().optional().default(true).describe('コンテキストを含める')
      //     },
      //     createToolHandler(name, tool)
      //   );
      //   break;
        
      // LSP機能無効化 (v2.0方針転換) - code_get_symbols_overview
      // case 'code_get_symbols_overview':
      //   server.tool(
      //     name,
      //     tool.metadata.description,
      //     {
      //       relative_path: z.string().describe('対象パス（ファイルまたはディレクトリ）'),
      //       max_depth: z.number().optional().default(3).describe('最大階層深度'),
      //       include_private: z.boolean().optional().default(false).describe('プライベートシンボルを含める'),
      //       symbol_kinds: z.array(z.number()).optional().describe('含めるシンボル種類')
      //     },
      //     createToolHandler(name, tool)
      //   );
      //   break;
        
      // LSP機能無効化 (v2.0方針転換) - code_replace_symbol_body
      // case 'code_replace_symbol_body':
      //   server.tool(
      //     name,
      //     tool.metadata.description,
      //     {
      //       file_path: z.string().describe('対象ファイルパス'),
      //       symbol_name: z.string().describe('置換対象のシンボル名'),
      //       new_body: z.string().describe('新しいシンボル本体'),
      //       backup: z.boolean().optional().default(true).describe('バックアップを作成')
      //     },
      //     createToolHandler(name, tool)
      //   );
      //   break;
        
      // LSP機能無効化 (v2.0方針転換) - code_insert_at_symbol
      // case 'code_insert_at_symbol':
      //   server.tool(
      //     name,
      //     tool.metadata.description,
      //     {
      //       file_path: z.string().describe('対象ファイルパス'),
      //       symbol_name: z.string().describe('挿入位置のシンボル名'),
      //       content: z.string().describe('挿入するコンテンツ'),
      //       position: z.enum(['before', 'after', 'inside']).describe('挿入位置'),
      //       backup: z.boolean().optional().default(true).describe('バックアップを作成')
      //     },
      //     createToolHandler(name, tool)
      //   );
      //   break;
        
      // LSP機能無効化 (v2.0方針転換) - code_replace_with_regex
      // case 'code_replace_with_regex':
      //   server.tool(
      //     name,
      //     tool.metadata.description,
      //     {
      //       file_path: z.string().describe('対象ファイルパス'),
      //       search_pattern: z.string().describe('検索パターン（正規表現）'),
      //       replacement: z.string().describe('置換文字列'),
      //       flags: z.string().optional().describe('正規表現フラグ'),
      //       backup: z.boolean().optional().default(true).describe('バックアップを作成')
      //     },
      //     createToolHandler(name, tool)
      //   );
      //   break;

      // LSP機能廃止予定のため一時無効化
      // case 'java_lsp_basic_diagnostics':
      //   server.tool(
      //     name,
      //     tool.metadata.description,
      //     {
      //       detailed: z.boolean().optional().default(false).describe('詳細情報を含めるか')
      //     },
      //     createToolHandler(name, tool)
      //   );
      //   break;
        
      // 🆕 Search Learning Engine ツール群 (v2.0 AI強化機能)
      case 'search_with_learning':
        server.tool(
          name,
          tool.metadata.description,
          {
            query: z.string().describe('Search query'),
            directory: z.string().optional().describe('Search target directory (default: current directory)'),
            file_pattern: z.string().optional().describe('File name pattern (glob format)'),
            content_pattern: z.string().optional().describe('File content search pattern (regex)'),
            case_sensitive: z.boolean().optional().default(false).describe('Case sensitive search'),
            recursive: z.boolean().optional().default(true).describe('Recursive search'),
            max_results: z.number().optional().default(100).describe('Maximum number of results'),
            learn_patterns: z.boolean().optional().default(true).describe('Learn search patterns')
          },
          createToolHandler(name, tool)
        );
        break;
      // 🆕 Smart Range Optimizer (v2.0 最高ROI 400%)
      case 'smart_range_optimizer':
        server.tool(
          name,
          tool.metadata.description,
          {
            file_path: z.string().describe('File path to analyze'),
            intent: z.enum([
              'bug_investigation',
              'code_review',
              'feature_addition',
              'refactoring',
              'documentation',
              'testing',
              'general'
            ]).optional().default('general').describe('Intent or purpose for reading the file'),
            max_ranges: z.number().optional().default(5).describe('Maximum number of ranges to suggest (default: 5)'),
            semantic_queries: z.array(z.string()).optional().describe('Natural language search queries for semantic search (e.g., "error handling", "database connection", "authentication logic")'),
          },
          createToolHandler(name, tool)
        );
        break;

      default:
        logger.warn(`Unknown tool: ${name}, skipping registration`);
        continue;
    }
    
    logger.info(`Registered MCP tool: ${name}`);
  }
}

/**
 * Create a generic tool handler for MCP server
 */
function createToolHandler(name: string, tool: ITool) {
  return async (parameters: Record<string, unknown>) => {
    try {
      // 🚀 自動ワークスペースアクティベーション（初回のツール呼び出し時のみ）
      await autoWorkspaceManager.ensureWorkspaceActive();
      
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
  };
}

/**
 * Main function to run the server
 */
async function main(): Promise<void> {
  try {
    // 起動ログの強制出力（ファイルとコンソール両方）
    const startMessage = `Starting ${SERVER_NAME} v${SERVER_VERSION}`;
    logger.info(startMessage);
    console.error(`[${new Date().toISOString()}] ${startMessage}`);
    
    // Register tools
    registerTools();
    
    // Connect to transport
    const transport = new StdioServerTransport();
    await server.connect(transport);
    
    const runningMessage = `${SERVER_NAME} v${SERVER_VERSION} running on stdio`;
    logger.info(runningMessage);
    console.error(`[${new Date().toISOString()}] ${runningMessage}`);
  } catch (error) {
    const errorMessage = `Failed to start server: ${error instanceof Error ? error.message : String(error)}`;
    const errorStack = error instanceof Error && error.stack ? error.stack : '';
    
    // エラーログの強制出力（ファイルとコンソール両方）
    logger.error(errorMessage, error instanceof Error ? error : new Error(String(error)));
    console.error(`[${new Date().toISOString()}] ERROR: ${errorMessage}`);
    if (errorStack) {
      console.error(errorStack);
    }
    
    // エラーファイルに直接書き込み（ログシステムが初期化されていない場合のフォールバック）
    try {
      const fs = await import('fs/promises');
      const path = await import('path');
      const os = await import('os');
      
      const errorLogDir = path.join(os.homedir(), '.claude', 'workspace', 'effortlessly', 'logs', 'startup-errors');
      await fs.mkdir(errorLogDir, { recursive: true });
      
      const errorLogFile = path.join(errorLogDir, `startup-error-${Date.now()}.txt`);
      const errorContent = `
========================================
MCP Server Startup Error
========================================
Time: ${new Date().toISOString()}
Server: ${SERVER_NAME} v${SERVER_VERSION}
Node Version: ${process.version}
Platform: ${process.platform}
Current Directory: ${process.cwd()}

Error Message:
${errorMessage}

Stack Trace:
${errorStack || 'No stack trace available'}

Environment Variables:
${JSON.stringify(process.env, null, 2)}
========================================
`;
      
      await fs.writeFile(errorLogFile, errorContent, 'utf-8');
      console.error(`[${new Date().toISOString()}] Error details written to: ${errorLogFile}`);
    } catch (writeError) {
      console.error(`[${new Date().toISOString()}] Failed to write error log file:`, writeError);
    }
    
    throw error;
  }
}

// Run the server
main().catch((error: unknown) => {
  const fatalMessage = `Fatal error in main(): ${error instanceof Error ? error.message : String(error)}`;
  const errorStack = error instanceof Error && error.stack ? error.stack : '';
  
  // 致命的エラーの強制出力
  logger.error(fatalMessage, error instanceof Error ? error : new Error(String(error)));
  console.error(`[${new Date().toISOString()}] FATAL: ${fatalMessage}`);
  if (errorStack) {
    console.error(errorStack);
  }
  
  // プロセス情報も出力
  console.error(`[${new Date().toISOString()}] Process Info:`);
  console.error(`  - Node Version: ${process.version}`);
  console.error(`  - Platform: ${process.platform}`);
  console.error(`  - Current Directory: ${process.cwd()}`);
  console.error(`  - Exit Code: 1`);
  
  process.exit(1);
});