/**
 * LSP設定とサーバー管理
 * 多言語LSPサーバーの設定と利用可能性チェック
 */

import { spawn } from 'child_process';
import { extname } from 'path';

/**
 * LSPサーバー設定
 */
export interface LSPServerConfig {
  /** 言語識別子 */
  language: string;
  /** 表示名 */
  displayName: string;
  /** 実行コマンド */
  command: string;
  /** コマンド引数 */
  args: string[];
  /** 対応ファイル拡張子 */
  fileExtensions: string[];
  /** 利用可能性チェックコマンド */
  checkCommand: string;
  /** インストールコマンド（参考用） */
  installCommand: string;
  /** 必須フラグ */
  required: boolean;
}

/**
 * サポートするLSPサーバー設定
 */
export const LSP_CONFIGS: LSPServerConfig[] = [
  {
    language: 'typescript',
    displayName: 'TypeScript/JavaScript',
    command: 'typescript-language-server',
    args: ['--stdio'],
    fileExtensions: ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'],
    checkCommand: 'typescript-language-server --version',
    installCommand: 'npm install -g typescript-language-server typescript',
    required: true
  },
  {
    language: 'python',
    displayName: 'Python',
    command: 'pylsp',
    args: [],
    fileExtensions: ['.py', '.pyi'],
    checkCommand: 'pylsp --help',
    installCommand: 'pip install python-lsp-server',
    required: false
  },
  {
    language: 'go',
    displayName: 'Go',
    command: 'gopls',
    args: [],
    fileExtensions: ['.go'],
    checkCommand: 'gopls version',
    installCommand: 'go install golang.org/x/tools/gopls@latest',
    required: false
  },
  {
    language: 'rust',
    displayName: 'Rust',
    command: 'rust-analyzer',
    args: [],
    fileExtensions: ['.rs'],
    checkCommand: 'rust-analyzer --version',
    installCommand: 'rustup component add rust-analyzer',
    required: false
  },
  {
    language: 'java',
    displayName: 'Java',
    command: 'java',
    args: ['-jar', '/path/to/jdtls/plugins/org.eclipse.equinox.launcher_*.jar'],
    fileExtensions: ['.java'],
    checkCommand: 'java --version',
    installCommand: 'Download Eclipse JDT Language Server',
    required: false
  },
  {
    language: 'cpp',
    displayName: 'C++',
    command: 'clangd',
    args: [],
    fileExtensions: ['.cpp', '.cxx', '.cc', '.h', '.hpp'],
    checkCommand: 'clangd --version',
    installCommand: 'Install LLVM/Clang tools',
    required: false
  },
  {
    language: 'csharp',
    displayName: 'C#',
    command: 'omnisharp',
    args: ['--languageserver'],
    fileExtensions: ['.cs'],
    checkCommand: 'omnisharp --version',
    installCommand: 'Install OmniSharp',
    required: false
  }
];

/**
 * 言語検出ユーティリティ
 */
export class LanguageDetector {
  /**
   * ファイルパスから言語を検出
   */
  static detectLanguage(filePath: string): string {
    const ext = extname(filePath).toLowerCase();
    
    for (const config of LSP_CONFIGS) {
      if (config.fileExtensions.includes(ext)) {
        return config.language;
      }
    }
    
    return 'unknown';
  }
  
  /**
   * 言語がサポートされているかチェック
   */
  static isLanguageSupported(language: string): boolean {
    return LSP_CONFIGS.some(config => config.language === language);
  }
  
  /**
   * 拡張子に対応する言語一覧を取得
   */
  static getLanguagesForFile(filePath: string): string[] {
    const ext = extname(filePath).toLowerCase();
    
    return LSP_CONFIGS
      .filter(config => config.fileExtensions.includes(ext))
      .map(config => config.language);
  }
}

/**
 * LSP利用可能性チェッカー
 */
export class LSPAvailabilityChecker {
  /**
   * 単一LSPの利用可能性をチェック
   */
  static async checkLSPAvailability(config: LSPServerConfig): Promise<boolean> {
    return new Promise((resolve) => {
      const [command, ...args] = config.checkCommand.split(' ');
      
      const child = spawn(command, args, {
        stdio: 'ignore',
        timeout: 5000
      });
      
      child.on('close', (code) => {
        resolve(code === 0);
      });
      
      child.on('error', () => {
        resolve(false);
      });
    });
  }
  
  /**
   * 全LSPの利用可能性をチェック
   */
  static async getAvailableLSPs(): Promise<LSPServerConfig[]> {
    const availabilityChecks = LSP_CONFIGS.map(async (config) => {
      const available = await this.checkLSPAvailability(config);
      return available ? config : null;
    });
    
    const results = await Promise.all(availabilityChecks);
    return results.filter((config): config is LSPServerConfig => config !== null);
  }
  
  /**
   * 必須LSPのチェック
   */
  static async checkRequiredLSPs(): Promise<{
    available: LSPServerConfig[];
    missing: LSPServerConfig[];
  }> {
    const requiredConfigs = LSP_CONFIGS.filter(config => config.required);
    const available: LSPServerConfig[] = [];
    const missing: LSPServerConfig[] = [];
    
    for (const config of requiredConfigs) {
      const isAvailable = await this.checkLSPAvailability(config);
      if (isAvailable) {
        available.push(config);
      } else {
        missing.push(config);
      }
    }
    
    return { available, missing };
  }
  
  /**
   * LSP設定を取得
   */
  static getLSPConfig(language: string): LSPServerConfig | undefined {
    return LSP_CONFIGS.find(config => config.language === language);
  }
  
  /**
   * 全設定を取得
   */
  static getAllConfigs(): LSPServerConfig[] {
    return [...LSP_CONFIGS];
  }
}