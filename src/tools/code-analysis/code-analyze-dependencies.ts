/**
 * code_analyze_dependencies 機能実装
 * ファイルの依存関係を分析
 */

import { z } from 'zod';
import path from 'path';
import { FileSystemService } from '../../services/FileSystemService.js';
import { WorkspaceManager } from '../project-management/workspace-manager.js';
import { Logger } from '../../services/logger.js';
import { LogManager } from '../../utils/log-manager.js';

/**
 * 依存関係分析パラメータスキーマ
 */
export const CodeAnalyzeDependenciesParamsSchema = z.object({
  file_path: z.string().min(1).describe('分析対象のファイルパス'),
  depth: z.number().min(1).max(10).optional().default(3).describe('依存関係の追跡深度'),
  include_external: z.boolean().optional().default(true).describe('外部ライブラリの依存関係も含めるか'),
  include_dev_dependencies: z.boolean().optional().default(false).describe('開発依存関係も含めるか'),
  resolve_imports: z.boolean().optional().default(true).describe('インポートパスを解決するか')
});

export type CodeAnalyzeDependenciesParams = z.infer<typeof CodeAnalyzeDependenciesParamsSchema>;

/**
 * 依存関係の種類
 */
export type DependencyType = 'import' | 'export' | 'dynamic_import' | 'require' | 'external' | 'internal';

/**
 * 依存関係エントリ
 */
export interface DependencyEntry {
  /** インポート/エクスポート元のパス */
  source: string;
  /** インポート/エクスポート先のパス（解決済み） */
  resolved_path?: string;
  /** 依存関係の種類 */
  type: DependencyType;
  /** インポートされる名前（デフォルト、名前付き、名前空間など） */
  imported_names: string[];
  /** インポート文の行番号 */
  line_number: number;
  /** 元のインポート文 */
  original_statement: string;
  /** 外部ライブラリかどうか */
  is_external: boolean;
  /** 開発依存関係かどうか */
  is_dev_dependency: boolean;
}

/**
 * ファイルの依存関係情報
 */
export interface FileDependencyInfo {
  /** ファイルパス（相対パス） */
  file: string;
  /** 言語タイプ */
  language: 'typescript' | 'javascript' | 'swift' | 'unknown';
  /** インポートする依存関係 */
  imports: DependencyEntry[];
  /** エクスポートする依存関係 */
  exports: DependencyEntry[];
  /** 依存関係の深度 */
  depth: number;
  /** 循環依存の有無 */
  has_circular_dependency: boolean;
  /** 循環依存のパス */
  circular_paths?: string[];
}

/**
 * 依存関係グラフ
 */
export interface DependencyGraph {
  /** ルートファイル */
  root_file: string;
  /** 全ファイルの依存関係情報 */
  files: FileDependencyInfo[];
  /** 依存関係のエッジ（from -> to） */
  edges: Array<{
    from: string;
    to: string;
    type: DependencyType;
    line_number: number;
  }>;
  /** 循環依存の検出結果 */
  circular_dependencies: Array<{
    cycle: string[];
    severity: 'warning' | 'error';
  }>;
  /** 外部依存関係の一覧 */
  external_dependencies: string[];
}

/**
 * code_analyze_dependencies ツール実装
 */
export const codeAnalyzeDependenciesTool = {
  name: 'code_analyze_dependencies',
  description: 'ファイルのインポート/エクスポート依存関係を分析し、依存関係グラフを生成します。循環依存の検出も行います。',
  inputSchema: CodeAnalyzeDependenciesParamsSchema,

  async execute(params: CodeAnalyzeDependenciesParams): Promise<{
    dependency_graph: DependencyGraph;
    stats: {
      total_files: number;
      total_dependencies: number;
      external_dependencies: number;
      circular_dependencies: number;
      max_depth_reached: number;
      analysis_scope: string;
    };
  }> {
    const logger = Logger.getInstance();
    
    try {
      // アクティブなワークスペースを確認
      const workspaceManager = WorkspaceManager.getInstance();
      const workspace = await workspaceManager.getCurrentWorkspace();
      
      if (!workspace) {
        throw new Error('No active workspace. Please activate a workspace first using workspace_activate.');
      }

      const workspaceRoot = workspace.root_path;
      
      // ファイルパスを絶対パスに変換
      const absoluteFilePath = path.isAbsolute(params.file_path)
        ? params.file_path
        : path.resolve(workspaceRoot, params.file_path);

      logger.info(`Analyzing dependencies for: ${absoluteFilePath}`);

      // ファイルが存在することを確認
      const fsService = FileSystemService.getInstance();
      try {
        await fsService.access(absoluteFilePath);
      } catch {
        throw new Error(`File not found: ${params.file_path}`);
      }

      // 依存関係分析を実行
      const analyzer = new DependencyAnalyzer(workspaceRoot, params, logger);
      const dependencyGraph = await analyzer.analyze(absoluteFilePath);

      // 統計情報を計算
      const stats = {
        total_files: dependencyGraph.files.length,
        total_dependencies: dependencyGraph.edges.length,
        external_dependencies: dependencyGraph.external_dependencies.length,
        circular_dependencies: dependencyGraph.circular_dependencies.length,
        max_depth_reached: Math.max(...dependencyGraph.files.map(f => f.depth), 0),
        analysis_scope: path.relative(workspaceRoot, absoluteFilePath)
      };

      logger.info(`Dependency analysis completed: ${stats.total_files} files, ${stats.total_dependencies} dependencies`);

      // 操作ログ記録
      const logManager = LogManager.getInstance();
      await logManager.logLSPOperation(
        'ANALYZE_DEPENDENCIES',
        path.basename(absoluteFilePath),
        absoluteFilePath,
        stats.total_dependencies
      );

      return {
        dependency_graph: dependencyGraph,
        stats
      };

    } catch (error) {
      logger.error('Dependency analysis failed', error as Error);
      throw error;
    }
  }
};

/**
 * 依存関係分析器
 */
class DependencyAnalyzer {
  private workspaceRoot: string;
  private params: CodeAnalyzeDependenciesParams;
  private logger: Logger;
  private visitedFiles = new Set<string>();
  private fileInfoMap = new Map<string, FileDependencyInfo>();
  private edges: Array<{ from: string; to: string; type: DependencyType; line_number: number }> = [];
  private externalDeps = new Set<string>();

  constructor(workspaceRoot: string, params: CodeAnalyzeDependenciesParams, logger: Logger) {
    this.workspaceRoot = workspaceRoot;
    this.params = params;
    this.logger = logger;
  }

  async analyze(rootFile: string): Promise<DependencyGraph> {
    // 依存関係を再帰的に分析
    await this.analyzeFile(rootFile, 0);

    // 循環依存を検出
    const circularDependencies = this.detectCircularDependencies();

    return {
      root_file: path.relative(this.workspaceRoot, rootFile),
      files: Array.from(this.fileInfoMap.values()),
      edges: this.edges,
      circular_dependencies: circularDependencies,
      external_dependencies: Array.from(this.externalDeps)
    };
  }

  private async analyzeFile(filePath: string, depth: number): Promise<void> {
    // 深度制限をチェック
    if (depth >= this.params.depth!) {
      return;
    }

    // 既に訪問済みの場合はスキップ
    if (this.visitedFiles.has(filePath)) {
      return;
    }

    this.visitedFiles.add(filePath);

    try {
      const language = this.getLanguageFromFile(filePath);
      const fsService = FileSystemService.getInstance();
      const content = await fsService.readFile(filePath, { encoding: 'utf-8' }) as string;
      
      // インポート/エクスポート文を解析
      const imports = await this.parseImports(content, filePath, language);
      const exports = this.parseExports(content, filePath, language);

      // ファイル情報を記録
      const fileInfo: FileDependencyInfo = {
        file: path.relative(this.workspaceRoot, filePath),
        language,
        imports,
        exports,
        depth,
        has_circular_dependency: false, // 後で更新
        circular_paths: []
      };

      this.fileInfoMap.set(filePath, fileInfo);

      // 依存ファイルを再帰的に分析
      for (const imp of imports) {
        if (imp.resolved_path && !imp.is_external) {
          // エッジを追加
          this.edges.push({
            from: path.relative(this.workspaceRoot, filePath),
            to: path.relative(this.workspaceRoot, imp.resolved_path),
            type: imp.type,
            line_number: imp.line_number
          });

          // 再帰分析
          await this.analyzeFile(imp.resolved_path, depth + 1);
        } else if (imp.is_external) {
          this.externalDeps.add(imp.source);
        }
      }

    } catch (error) {
      this.logger.warn(`Failed to analyze file ${filePath}:`, { error: (error as Error).message });
    }
  }

  private async parseImports(content: string, filePath: string, language: string): Promise<DependencyEntry[]> {
    const imports: DependencyEntry[] = [];
    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      const lineNumber = i + 1;

      // TypeScript/JavaScript のインポート文を解析
      if (language === 'typescript' || language === 'javascript') {
        // import文
        const importMatch = line.match(/^import\s+(.+?)\s+from\s+['"`](.+?)['"`]/);
        if (importMatch) {
          const imported_names = this.parseImportedNames(importMatch[1]);
          const source = importMatch[2];
          const isExternal = this.isExternalDependency(source);
          
          imports.push({
            source,
            resolved_path: isExternal ? undefined : await this.resolveImportPath(source, filePath),
            type: 'import',
            imported_names: imported_names,
            line_number: lineNumber,
            original_statement: line,
            is_external: isExternal,
            is_dev_dependency: false // package.jsonから判定が必要
          });
          continue;
        }

        // require文
        const requireMatch = line.match(/require\s*\(\s*['"`](.+?)['"`]\s*\)/);
        if (requireMatch) {
          const source = requireMatch[1];
          const isExternal = this.isExternalDependency(source);
          
          imports.push({
            source,
            resolved_path: isExternal ? undefined : await this.resolveImportPath(source, filePath),
            type: 'require',
            imported_names: ['*'],
            line_number: lineNumber,
            original_statement: line,
            is_external: isExternal,
            is_dev_dependency: false
          });
          continue;
        }

        // 動的インポート
        const dynamicImportMatch = line.match(/import\s*\(\s*['"`](.+?)['"`]\s*\)/);
        if (dynamicImportMatch) {
          const source = dynamicImportMatch[1];
          const isExternal = this.isExternalDependency(source);
          
          imports.push({
            source,
            resolved_path: isExternal ? undefined : await this.resolveImportPath(source, filePath),
            type: 'dynamic_import',
            imported_names: ['*'],
            line_number: lineNumber,
            original_statement: line,
            is_external: isExternal,
            is_dev_dependency: false
          });
        }
      }

      // Swift のインポート文を解析
      if (language === 'swift') {
        const importMatch = line.match(/^import\s+(.+)$/);
        if (importMatch) {
          const source = importMatch[1].trim();
          const isExternal = this.isExternalSwiftDependency(source);
          
          imports.push({
            source,
            resolved_path: undefined, // Swiftは複雑なモジュール解決が必要
            type: 'import',
            imported_names: [source],
            line_number: lineNumber,
            original_statement: line,
            is_external: isExternal,
            is_dev_dependency: false
          });
        }
      }
    }

    return imports;
  }

  private parseExports(content: string, filePath: string, language: string): DependencyEntry[] {
    const exports: DependencyEntry[] = [];
    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      const lineNumber = i + 1;

      if (language === 'typescript' || language === 'javascript') {
        // export文を解析
        const exportMatch = line.match(/^export\s+(.+)/);
        if (exportMatch) {
          const exportedNames = this.parseExportedNames(exportMatch[1]);
          
          exports.push({
            source: filePath,
            type: 'export',
            imported_names: exportedNames,
            line_number: lineNumber,
            original_statement: line,
            is_external: false,
            is_dev_dependency: false
          });
        }
      }
    }

    return exports;
  }

  private parseImportedNames(importClause: string): string[] {
    const names: string[] = [];
    
    // デフォルトインポート
    const defaultMatch = importClause.match(/^(\w+)/);
    if (defaultMatch) {
      names.push(defaultMatch[1]);
    }
    
    // 名前付きインポート
    const namedMatch = importClause.match(/\{\s*(.+?)\s*\}/);
    if (namedMatch) {
      const namedImports = namedMatch[1].split(',').map(name => name.trim());
      names.push(...namedImports);
    }
    
    // 名前空間インポート
    const namespaceMatch = importClause.match(/\*\s+as\s+(\w+)/);
    if (namespaceMatch) {
      names.push(namespaceMatch[1]);
    }
    
    return names.filter(name => name.length > 0);
  }

  private parseExportedNames(exportClause: string): string[] {
    const names: string[] = [];
    
    // export { ... }
    const namedMatch = exportClause.match(/\{\s*(.+?)\s*\}/);
    if (namedMatch) {
      const namedExports = namedMatch[1].split(',').map(name => name.trim());
      names.push(...namedExports);
    }
    
    // export default
    if (exportClause.includes('default')) {
      names.push('default');
    }
    
    // export function/class/const など
    const declarationMatch = exportClause.match(/(?:function|class|const|let|var)\s+(\w+)/);
    if (declarationMatch) {
      names.push(declarationMatch[1]);
    }
    
    return names.filter(name => name.length > 0);
  }

  private isExternalDependency(source: string): boolean {
    // 相対パスまたは絶対パスでない場合は外部依存関係
    return !source.startsWith('.') && !source.startsWith('/');
  }

  private isExternalSwiftDependency(source: string): boolean {
    // Swiftの標準ライブラリやフレームワークを判定
    const swiftFrameworks = ['Foundation', 'UIKit', 'SwiftUI', 'Combine', 'Darwin'];
    return swiftFrameworks.includes(source) || !source.includes('.');
  }

  private async resolveImportPath(source: string, fromFile: string): Promise<string | undefined> {
    if (!this.params.resolve_imports) {
      return undefined;
    }

    try {
      const fromDir = path.dirname(fromFile);
      
      // 相対パスの場合
      if (source.startsWith('.')) {
        let resolvedPath = path.resolve(fromDir, source);
        
        // 拡張子を補完
        const fsService = FileSystemService.getInstance();
        const extensions = ['.ts', '.tsx', '.js', '.jsx', '.swift'];
        for (const ext of extensions) {
          const pathWithExt = resolvedPath + ext;
          try {
            await fsService.access(pathWithExt);
            return pathWithExt;
          } catch {
            // ファイルが存在しない場合は続行
          }
        }
        
        // index.* を試行
        for (const ext of extensions) {
          const indexPath = path.join(resolvedPath, `index${ext}`);
          try {
            await fsService.access(indexPath);
            return indexPath;
          } catch {
            // ファイルが存在しない場合は続行
          }
        }
        
        return resolvedPath;
      }
      
      return undefined;
    } catch {
      return undefined;
    }
  }

  private getLanguageFromFile(filePath: string): 'typescript' | 'javascript' | 'swift' | 'unknown' {
    const ext = path.extname(filePath);
    
    switch (ext) {
      case '.ts':
      case '.tsx':
        return 'typescript';
      case '.js':
      case '.jsx':
        return 'javascript';
      case '.swift':
        return 'swift';
      default:
        return 'unknown';
    }
  }

  private detectCircularDependencies(): Array<{ cycle: string[]; severity: 'warning' | 'error' }> {
    const circularDeps: Array<{ cycle: string[]; severity: 'warning' | 'error' }> = [];
    const visited = new Set<string>();
    const recursionStack = new Set<string>();
    const pathStack: string[] = [];

    const detectCycle = (file: string): boolean => {
      if (recursionStack.has(file)) {
        // 循環依存を発見
        const cycleStart = pathStack.indexOf(file);
        const cycle = pathStack.slice(cycleStart).concat([file]);
        
        circularDeps.push({
          cycle,
          severity: cycle.length > 3 ? 'error' : 'warning'
        });
        
        // ファイル情報を更新
        for (const f of cycle) {
          const absolutePath = path.resolve(this.workspaceRoot, f);
          const fileInfo = this.fileInfoMap.get(absolutePath);
          if (fileInfo) {
            fileInfo.has_circular_dependency = true;
            fileInfo.circular_paths = cycle;
          }
        }
        
        return true;
      }

      if (visited.has(file)) {
        return false;
      }

      visited.add(file);
      recursionStack.add(file);
      pathStack.push(file);

      // 依存先を再帰的にチェック
      const outgoingEdges = this.edges.filter(edge => edge.from === file);
      for (const edge of outgoingEdges) {
        if (detectCycle(edge.to)) {
          return true;
        }
      }

      recursionStack.delete(file);
      pathStack.pop();
      return false;
    };

    // 全ファイルから循環依存を検索
    for (const fileInfo of this.fileInfoMap.values()) {
      if (!visited.has(fileInfo.file)) {
        detectCycle(fileInfo.file);
      }
    }

    return circularDeps;
  }
}