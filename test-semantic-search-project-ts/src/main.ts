
import { UserService } from './services/user-service';
import { Logger } from './utils/logger';
import { CONFIG } from './config';

export class App {
  private userService: UserService;
  private logger: Logger;

  constructor() {
    this.userService = new UserService();
    this.logger = new Logger();
  }

  public async start(): Promise<void> {
    this.logger.info('Starting application');
    const users = await this.userService.getAllUsers();
    logger.info(`Found ${users.length} users`);
  }

  private validateConfig(): boolean {
    return CONFIG.apiUrl !== undefined;
  }
}
