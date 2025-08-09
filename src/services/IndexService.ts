import path from 'path';
import { promises as fs } from 'fs';
import Database from 'better-sqlite3';
import { Logger } from './logger.js';
import { ConfigManager } from './ConfigManager.js';

export interface SymbolInfo {
  id?: number;
  name: string;
  kind: string;
  uri: string;
  range: {
    start: { line: number; character: number };
    end: { line: number; character: number };
  };
  containerName?: string;
  detail?: string;
  deprecated?: boolean;
}

export interface FileInfo {
  id?: number;
  uri: string;
  language: string;
  lastModified: number;
  size: number;
  indexed: boolean;
}

export class IndexService {
  private db: Database.Database | null = null;
  private configManager: ConfigManager;
  private logger = Logger.getInstance();
  private indexingInProgress = false;

  constructor() {
    this.configManager = new ConfigManager();
  }

  /**
   * Initialize the IndexService and create/connect to the database
   */
  async initialize(): Promise<void> {
    try {
      const config = await this.configManager.getIndexingConfig();
      if (!config?.enabled) {
        this.logger.info('Index service disabled in configuration');
        return;
      }

      const dbPath = config.database_path;
      await this.ensureDirectoryExists(path.dirname(dbPath));

      this.db = new Database(dbPath);
      await this.createTables();
      
      this.logger.info('IndexService initialized', { 
        database_path: dbPath 
      });
    } catch (error) {
      this.logger.error('Failed to initialize IndexService', error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  /**
   * Create database tables if they don't exist
   */
  private async createTables(): Promise<void> {
    if (!this.db) return;

    // Files table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS files (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        uri TEXT UNIQUE NOT NULL,
        language TEXT NOT NULL,
        last_modified INTEGER NOT NULL,
        size INTEGER NOT NULL,
        indexed BOOLEAN DEFAULT FALSE,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Symbols table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS symbols (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        kind TEXT NOT NULL,
        uri TEXT NOT NULL,
        start_line INTEGER NOT NULL,
        start_character INTEGER NOT NULL,
        end_line INTEGER NOT NULL,
        end_character INTEGER NOT NULL,
        container_name TEXT,
        detail TEXT,
        deprecated BOOLEAN DEFAULT FALSE,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (uri) REFERENCES files(uri)
      )
    `);

    // Create indexes for better query performance
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_symbols_name ON symbols(name);
      CREATE INDEX IF NOT EXISTS idx_symbols_uri ON symbols(uri);
      CREATE INDEX IF NOT EXISTS idx_symbols_kind ON symbols(kind);
      CREATE INDEX IF NOT EXISTS idx_files_uri ON files(uri);
      CREATE INDEX IF NOT EXISTS idx_files_language ON files(language);
    `);

    this.logger.info('Database tables created/verified');
  }

  /**
   * Index files in a workspace directory
   */
  async indexWorkspace(workspacePath: string): Promise<void> {
    if (this.indexingInProgress) {
      this.logger.warn('Indexing already in progress, skipping');
      return;
    }

    try {
      this.indexingInProgress = true;
      this.logger.info('Starting workspace indexing', { workspace_path: workspacePath });

      const files = await this.discoverFiles(workspacePath);
      let processedFiles = 0;
      let indexedSymbols = 0;

      for (const filePath of files) {
        try {
          const fileInfo = await this.processFile(filePath);
          if (fileInfo) {
            processedFiles++;
            // For now, we'll just store file info
            // Symbol extraction would require LSP integration
            await this.storeFileInfo(fileInfo);
          }
        } catch (error) {
          this.logger.warn('Failed to process file', { 
            file: filePath, 
            error: error instanceof Error ? error.message : String(error)
          });
        }
      }

      this.logger.info('Workspace indexing completed', {
        workspace_path: workspacePath,
        processed_files: processedFiles,
        indexed_symbols: indexedSymbols
      });

    } catch (error) {
      this.logger.error('Workspace indexing failed', error instanceof Error ? error : new Error(String(error)));
      throw error;
    } finally {
      this.indexingInProgress = false;
    }
  }

  /**
   * Discover indexable files in a directory
   */
  private async discoverFiles(dirPath: string): Promise<string[]> {
    const files: string[] = [];
    const supportedExtensions = ['.ts', '.js', '.tsx', '.jsx', '.py', '.swift', '.go', '.java', '.cpp', '.c', '.h'];

    const processDirectory = async (currentPath: string): Promise<void> => {
      try {
        const entries = await fs.readdir(currentPath, { withFileTypes: true });

        for (const entry of entries) {
          const fullPath = path.join(currentPath, entry.name);

          // Skip common ignore patterns
          if (this.shouldIgnorePath(entry.name)) {
            continue;
          }

          if (entry.isDirectory()) {
            await processDirectory(fullPath);
          } else if (entry.isFile()) {
            const ext = path.extname(entry.name).toLowerCase();
            if (supportedExtensions.includes(ext)) {
              files.push(fullPath);
            }
          }
        }
      } catch (error) {
        // Skip directories we can't read
        this.logger.debug('Skipping directory', { 
          path: currentPath, 
          error: error instanceof Error ? error.message : String(error)
        });
      }
    };

    await processDirectory(dirPath);
    return files;
  }

  /**
   * Check if a path should be ignored during indexing
   */
  private shouldIgnorePath(name: string): boolean {
    const ignorePatterns = [
      'node_modules',
      '.git',
      '.vscode',
      '.idea',
      'dist',
      'build',
      'out',
      'target',
      '.next',
      '.nuxt',
      'coverage',
      '.nyc_output',
      'logs',
      'tmp',
      'temp',
      '.cache',
      '.DS_Store',
      'Thumbs.db'
    ];

    return ignorePatterns.some(pattern => 
      name === pattern || name.startsWith('.')
    );
  }

  /**
   * Process a single file and extract metadata
   */
  private async processFile(filePath: string): Promise<FileInfo | null> {
    try {
      const stats = await fs.stat(filePath);
      const ext = path.extname(filePath).toLowerCase();
      
      // Map file extensions to languages
      const languageMap: Record<string, string> = {
        '.ts': 'typescript',
        '.tsx': 'typescript',
        '.js': 'javascript',
        '.jsx': 'javascript',
        '.py': 'python',
        '.swift': 'swift',
        '.go': 'go',
        '.java': 'java',
        '.cpp': 'cpp',
        '.c': 'c',
        '.h': 'c'
      };

      const language = languageMap[ext] || 'unknown';
      if (language === 'unknown') {
        return null;
      }

      return {
        uri: `file://${filePath}`,
        language,
        lastModified: stats.mtime.getTime(),
        size: stats.size,
        indexed: false
      };

    } catch (error) {
      this.logger.debug('Failed to process file metadata', { 
        file: filePath, 
        error: error instanceof Error ? error.message : String(error)
      });
      return null;
    }
  }

  /**
   * Store file information in the database
   */
  private async storeFileInfo(fileInfo: FileInfo): Promise<void> {
    if (!this.db) return;

    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO files (uri, language, last_modified, size, indexed, updated_at)
      VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `);

    stmt.run(
      fileInfo.uri,
      fileInfo.language,
      fileInfo.lastModified,
      fileInfo.size,
      fileInfo.indexed
    );
  }

  /**
   * Store symbol information in the database
   */
  async storeSymbol(symbol: SymbolInfo): Promise<void> {
    if (!this.db) return;

    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO symbols (
        name, kind, uri, start_line, start_character, 
        end_line, end_character, container_name, detail, deprecated
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      symbol.name,
      symbol.kind,
      symbol.uri,
      symbol.range.start.line,
      symbol.range.start.character,
      symbol.range.end.line,
      symbol.range.end.character,
      symbol.containerName || null,
      symbol.detail || null,
      symbol.deprecated || false
    );
  }

  /**
   * Search symbols by name pattern
   */
  async searchSymbols(pattern: string, limit: number = 100): Promise<SymbolInfo[]> {
    if (!this.db) return [];

    const stmt = this.db.prepare(`
      SELECT * FROM symbols 
      WHERE name LIKE ? 
      ORDER BY name 
      LIMIT ?
    `);

    const rows = stmt.all(`%${pattern}%`, limit) as any[];
    
    return rows.map(row => ({
      id: row.id,
      name: row.name,
      kind: row.kind,
      uri: row.uri,
      range: {
        start: { line: row.start_line, character: row.start_character },
        end: { line: row.end_line, character: row.end_character }
      },
      containerName: row.container_name,
      detail: row.detail,
      deprecated: row.deprecated
    }));
  }

  /**
   * Get indexing statistics
   */
  async getIndexStats(): Promise<{ files: number; symbols: number; languages: string[] }> {
    if (!this.db) return { files: 0, symbols: 0, languages: [] };

    const filesCount = this.db.prepare('SELECT COUNT(*) as count FROM files').get() as { count: number };
    const symbolsCount = this.db.prepare('SELECT COUNT(*) as count FROM symbols').get() as { count: number };
    const languagesResult = this.db.prepare('SELECT DISTINCT language FROM files ORDER BY language').all() as { language: string }[];

    return {
      files: filesCount.count,
      symbols: symbolsCount.count,
      languages: languagesResult.map(row => row.language)
    };
  }

  /**
   * Check if indexing is currently in progress
   */
  isIndexing(): boolean {
    return this.indexingInProgress;
  }

  /**
   * Close database connection
   */
  async close(): Promise<void> {
    if (this.db) {
      this.db.close();
      this.db = null;
      this.logger.info('IndexService database connection closed');
    }
  }

  /**
   * Ensure directory exists
   */
  private async ensureDirectoryExists(dirPath: string): Promise<void> {
    try {
      await fs.mkdir(dirPath, { recursive: true });
    } catch (error) {
      if (error instanceof Error && 'code' in error && error.code !== 'EEXIST') {
        throw error;
      }
    }
  }
}
