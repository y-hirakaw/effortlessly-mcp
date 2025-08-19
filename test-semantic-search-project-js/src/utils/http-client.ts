
import { Logger } from './logger';

export class HttpClient {
  private logger: Logger;

  constructor() {
    this.logger = new Logger();
  }

  public async get(url: string): Promise<any> {
    this.logger.debug(`GET request to ${url}`);
    // モックレスポンス
    return [];
  }

  public async post(url: string, data: any): Promise<any> {
    this.logger.debug(`POST request to ${url}`);
    return { success: true };
  }

  private buildHeaders(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      'User-Agent': 'TestApp/1.0'
    };
  }
}
