/**
 * HTTP LSP Client
 * MCPサーバーからHTTP経由でLSP Proxy Serverと通信するクライアント
 */

import type { SymbolInformation } from 'vscode-languageserver-protocol';
import { Logger } from '../logger.js';

export interface HttpLSPClientConfig {
  baseUrl: string;
  timeout: number;
}

export interface SymbolSearchOptions {
  languages?: string[];
  maxResults?: number;
}

export class HttpLSPClient {
  private logger: Logger;
  
  constructor(private config: HttpLSPClientConfig) {
    this.logger = Logger.getInstance();
  }
  
  async searchSymbols(
    query: string, 
    options: SymbolSearchOptions = {}
  ): Promise<{
    query: string;
    languages: string[] | 'all';
    total: number;
    symbols: SymbolInformation[];
  }> {
    const response = await this.fetch('/symbols/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query,
        languages: options.languages
      })
    });
    
    const result = await response.json() as {
      query: string;
      languages: string[] | 'all';
      total: number;
      symbols: SymbolInformation[];
    };
    
    if (options.maxResults && result.symbols) {
      result.symbols = result.symbols.slice(0, options.maxResults);
      result.total = result.symbols.length;
    }
    
    return result;
  }
  
  private async fetch(path: string, options: RequestInit = {}): Promise<Response> {
    const url = `${this.config.baseUrl}${path}`;
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);
    
    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Unknown error' })) as any;
        throw new Error(`HTTP ${response.status}: ${error.error || error.message || 'Request failed'}`);
      }
      
      return response;
      
    } catch (error) {
      clearTimeout(timeoutId);
      
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error(`Request timeout: ${path}`);
      }
      
      this.logger.error(`HTTP request failed: ${path}`, error as Error);
      throw error;
    }
  }
}

let globalHttpLSPClient: HttpLSPClient | undefined;

export function getHttpLSPClient(config?: Partial<HttpLSPClientConfig>): HttpLSPClient {
  if (!globalHttpLSPClient) {
    const defaultConfig: HttpLSPClientConfig = {
      baseUrl: 'http://localhost:3001',
      timeout: 30000,
      ...config
    };
    
    globalHttpLSPClient = new HttpLSPClient(defaultConfig);
  }
  
  return globalHttpLSPClient;
}