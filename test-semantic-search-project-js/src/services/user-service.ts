
import { HttpClient } from '../utils/http-client';
import { Logger } from '../utils/logger';

export interface User {
  id: number;
  name: string;
  email: string;
}

export class UserService {
  private httpClient: HttpClient;
  private logger: Logger;

  constructor() {
    this.httpClient = new HttpClient();
    this.logger = new Logger();
  }

  public async getAllUsers(): Promise<User[]> {
    this.logger.debug('Fetching all users');
    return await this.httpClient.get('/api/users');
  }

  public async getUserById(id: number): Promise<User | null> {
    try {
      return await this.httpClient.get(`/api/users/${id}`);
    } catch (error) {
      this.logger.error(`Failed to fetch user ${id}`, error);
      return null;
    }
  }

  private async validateUser(user: User): Promise<boolean> {
    return user.email.includes('@');
  }
}
