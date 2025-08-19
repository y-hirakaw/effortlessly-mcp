
export const CONFIG = {
  apiUrl: 'http://localhost:3000',
  timeout: 5000,
  retries: 3
};

export interface AppConfig {
  apiUrl: string;
  timeout: number;
  retries: number;
}
