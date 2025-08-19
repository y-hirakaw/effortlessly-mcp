import { TypeScriptLSP } from './typescript-lsp.js';
import { SwiftLSP } from './swift-lsp.js';
import { Logger } from '../logger.js';
import { TypeScriptLSPHelper } from './typescript-lsp-helper.js';
import { getOrCreateSwiftLSP } from '../../tools/code-analysis/swift-lsp-helper.js';
import path from 'path';

/**
 * 統一LSPマネージャー
 * 全言語のLSPクライアントを統一的に管理
 */
export class UnifiedLSPManager {
  private static instance: UnifiedLSPManager;
  private logger: Logger;
  private typeScriptHelper: TypeScriptLSPHelper;

  // 言語検出パターン
  private readonly languagePatterns: Record<string, string[]> = {
    typescript: ['.ts', '.tsx'],
    javascript: ['.js', '.jsx'],
    swift: ['.swift']
  };

  private constructor() {
    this.logger = Logger.getInstance();
    this.typeScriptHelper = TypeScriptLSPHelper.getInstance();
  }

  /**
   * UnifiedLSPManagerのシングルトンインスタンスを取得
   */
  public static getInstance(): UnifiedLSPManager {
    if (!UnifiedLSPManager.instance) {
      UnifiedLSPManager.instance = new UnifiedLSPManager();
    }
    return UnifiedLSPManager.instance;
  }

  /**
   * 言語を検出
   * @param filePath ファイルパス
   * @returns 言語種別
   */
  public detectLanguage(filePath: string): 'typescript' | 'javascript' | 'swift' | 'unknown' {
    const extension = path.extname(filePath);
    
    for (const [language, extensions] of Object.entries(this.languagePatterns)) {
      if (extensions.includes(extension)) {
        return language as 'typescript' | 'javascript' | 'swift';
      }
    }
    
    return 'unknown';
  }

  /**
   * ファイルに対応するLSPクライアントを取得
   * @param filePath ファイルパス
   * @param workspaceRoot ワークスペースのルートパス
   * @returns LSPクライアント
   */
  public async getLSPClient(filePath: string, workspaceRoot: string): Promise<TypeScriptLSP | SwiftLSP | null> {
    const language = this.detectLanguage(filePath);
    
    try {
      switch (language) {
        case 'typescript':
        case 'javascript':
          this.logger.debug(`Getting TypeScript LSP client for ${filePath}`);
          return await this.typeScriptHelper.getOrCreateTypeScriptLSP(workspaceRoot);
          
        case 'swift':
          this.logger.debug(`Getting Swift LSP client for ${filePath}`);
          return await getOrCreateSwiftLSP(workspaceRoot, this.logger);
          
        default:
          this.logger.warn(`Unsupported language for file: ${filePath}`);
          return null;
      }
    } catch (error) {
      this.logger.error(`Failed to get LSP client for ${filePath}`, error as Error);
      return null;
    }
  }

  /**
   * 言語に対応するLSPクライアントを直接取得
   * @param language 言語種別
   * @param workspaceRoot ワークスペースのルートパス
   * @returns LSPクライアント
   */
  public async getLSPClientByLanguage(
    language: 'typescript' | 'javascript' | 'swift',
    workspaceRoot: string
  ): Promise<TypeScriptLSP | SwiftLSP | null> {
    try {
      switch (language) {
        case 'typescript':
        case 'javascript':
          return await this.typeScriptHelper.getOrCreateTypeScriptLSP(workspaceRoot);
          
        case 'swift':
          return await getOrCreateSwiftLSP(workspaceRoot, this.logger);
          
        default:
          this.logger.warn(`Unsupported language: ${language}`);
          return null;
      }
    } catch (error) {
      this.logger.error(`Failed to get LSP client for language ${language}`, error as Error);
      return null;
    }
  }

  /**
   * 特定のワークスペースのLSPクライアントの状態を取得
   * @param workspaceRoot ワークスペースのルートパス
   * @returns クライアント状態の概要
   */
  public getWorkspaceStatus(workspaceRoot: string): {
    typescript: { cached: boolean; count: number };
    swift: { cached: boolean; count: number };
    workspaces: string[];
  } {
    const typeScriptClient = this.typeScriptHelper.getClient(workspaceRoot);
    const typeScriptWorkspaces = this.typeScriptHelper.getCachedWorkspaces();
    
    return {
      typescript: {
        cached: !!typeScriptClient,
        count: this.typeScriptHelper.getCachedClientCount()
      },
      swift: {
        cached: false, // Swift LSPヘルパーからは状態取得できないため
        count: 0
      },
      workspaces: [...new Set([...typeScriptWorkspaces])]
    };
  }

  /**
   * 特定のワークスペースのLSPクライアントをクリーンアップ
   * @param workspaceRoot ワークスペースのルートパス
   */
  public async cleanupWorkspace(workspaceRoot: string): Promise<void> {
    this.logger.info(`Cleaning up LSP clients for workspace: ${workspaceRoot}`);
    
    try {
      // TypeScript LSPクライアントをクリーンアップ
      this.typeScriptHelper.removeClient(workspaceRoot);
      
      // Swift LSPクライアントは個別管理のためログのみ
      this.logger.info('Swift LSP clients are managed individually');
      
    } catch (error) {
      this.logger.error(`Failed to cleanup workspace ${workspaceRoot}`, error as Error);
    }
  }

  /**
   * すべてのLSPクライアントをクリーンアップ
   */
  public async cleanupAll(): Promise<void> {
    this.logger.info('Cleaning up all LSP clients');
    
    try {
      // TypeScript LSPクライアントをすべてクリーンアップ
      this.typeScriptHelper.clearAll();
      
      this.logger.info('All LSP clients cleaned up');
    } catch (error) {
      this.logger.error('Failed to cleanup all LSP clients', error as Error);
    }
  }

  /**
   * サポートされている言語の一覧を取得
   * @returns サポート言語の配列
   */
  public getSupportedLanguages(): string[] {
    return Object.keys(this.languagePatterns);
  }

  /**
   * 言語がサポートされているかチェック
   * @param language 言語種別
   * @returns サポート状況
   */
  public isLanguageSupported(language: string): boolean {
    return language in this.languagePatterns;
  }

  /**
   * ファイル拡張子から言語を推定
   * @param extension ファイル拡張子
   * @returns 言語種別
   */
  public getLanguageFromExtension(extension: string): string | null {
    for (const [language, extensions] of Object.entries(this.languagePatterns)) {
      if (extensions.includes(extension)) {
        return language;
      }
    }
    return null;
  }

  /**
   * 統計情報を取得
   * @returns LSP使用統計
   */
  public getStatistics(): {
    totalWorkspaces: number;
    languageSupport: Record<string, boolean>;
    cachedClients: {
      typescript: number;
      swift: number;
      total: number;
    };
  } {
    const typeScriptCount = this.typeScriptHelper.getCachedClientCount();
    const workspaces = this.typeScriptHelper.getCachedWorkspaces();
    
    return {
      totalWorkspaces: workspaces.length,
      languageSupport: {
        typescript: true,
        javascript: true,
        swift: true
      },
      cachedClients: {
        typescript: typeScriptCount,
        swift: 0, // Swift LSPヘルパーからは取得できない
        total: typeScriptCount
      }
    };
  }
}