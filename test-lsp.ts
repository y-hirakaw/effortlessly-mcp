/**
 * LSP機能テスト用のTypeScriptファイル
 */

// インターフェースの定義
interface User {
    id: number;
    name: string;
    email: string;
    isActive: boolean;
}

// クラスの定義
export class UserManager {
    private users: User[] = [];

    constructor() {
        console.log('UserManager initialized');
    }

    // ユーザー追加メソッド
    addUser(user: User): void {
        this.users.push(user);
        console.log(`User added: ${user.name}`);
    }

    // ユーザー検索メソッド
    findUserById(id: number): User | undefined {
        return this.users.find(user => user.id === id);
    }

    // アクティブユーザー取得メソッド
    getActiveUsers(): User[] {
        return this.users.filter(user => user.isActive);
    }

    // ユーザー数取得メソッド
    getUserCount(): number {
        return this.users.length;
    }
}

// ヘルパー関数
export function createUser(name: string, email: string): User {
    return {
        id: Math.floor(Math.random() * 1000),
        name,
        email,
        isActive: true
    };
}

// 使用例
const manager = new UserManager();
const newUser = createUser("田中太郎", "tanaka@example.com");
manager.addUser(newUser);

console.log(`Total users: ${manager.getUserCount()}`);
