/**
 * LSP機能検証用テストファイル
 * シンボル検索と参照検索の動作を確認するためのTypeScriptコード
 */

interface UserProfile {
  id: number;
  name: string;
  email: string;
  isActive: boolean;
  roles: string[];
}

export class UserManager {
  private users: UserProfile[] = [];
  private nextId = 1;
  
  /**
   * ユーザーを追加
   */
  addUser(name: string, email: string, roles: string[] = ['user']): UserProfile {
    const user: UserProfile = {
      id: this.nextId++,
      name,
      email,
      isActive: true,
      roles
    };
    
    this.users.push(user);
    return user;
  }
  
  /**
   * IDでユーザーを検索
   */
  findUserById(id: number): UserProfile | undefined {
    return this.users.find(user => user.id === id);
  }
  
  /**
   * アクティブなユーザーを取得
   */
  getActiveUsers(): UserProfile[] {
    return this.users.filter(user => user.isActive);
  }
  
  /**
   * ユーザーを削除
   */
  removeUser(id: number): boolean {
    const index = this.users.findIndex(user => user.id === id);
    if (index >= 0) {
      this.users.splice(index, 1);
      return true;
    }
    return false;
  }
}

export function createUser(name: string, email: string): UserProfile {
  return {
    id: 0, // 一時的なID
    name,
    email,
    isActive: true,
    roles: ['user']
  };
}

export const defaultManager = new UserManager();

// 使用例
const manager = new UserManager();
const user1 = manager.addUser('John Doe', 'john@example.com', ['admin']);
const user2 = manager.addUser('Jane Smith', 'jane@example.com');

// 検証用ログ出力
console.log('Active users:', manager.getActiveUsers());
console.log('User by ID:', manager.findUserById(1));
console.log('Total users:', user1, user2);
