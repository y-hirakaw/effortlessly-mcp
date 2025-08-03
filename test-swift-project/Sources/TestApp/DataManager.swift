import Foundation

/// データ管理クラス
public class DataManager {
    private let logger = AppLogger(label: "DataManager")
    private var cache: [String: Any] = [:]
    
    /// データストア
    public struct DataStore {
        public let id: String
        public let name: String
        public let createdAt: Date
        public var metadata: [String: String]
        
        public init(id: String, name: String, metadata: [String: String] = [:]) {
            self.id = id
            self.name = name
            self.createdAt = Date()
            self.metadata = metadata
        }
    }
    
    /// データエラー
    public enum DataError: Error, LocalizedError {
        case notFound(String)
        case invalidData(String)
        case networkError(String)
        case unknownError
        
        public var errorDescription: String? {
            switch self {
            case .notFound(let id):
                return "Data not found: \(id)"
            case .invalidData(let reason):
                return "Invalid data: \(reason)"
            case .networkError(let message):
                return "Network error: \(message)"
            case .unknownError:
                return "Unknown error occurred"
            }
        }
    }
    
    /// シングルトンインスタンス
    public static let shared = DataManager()
    
    /// プライベート初期化
    private init() {
        logger.info("DataManager initialized")
    }
    
    /// データを保存
    /// - Parameters:
    ///   - key: キー
    ///   - value: 値
    public func store<T>(_ value: T, forKey key: String) {
        logger.debug("Storing data for key: \(key)")
        cache[key] = value
    }
    
    /// データを取得
    /// - Parameter key: キー
    /// - Returns: 取得されたデータ
    /// - Throws: データが見つからない場合
    public func retrieve<T>(_ type: T.Type, forKey key: String) throws -> T {
        logger.debug("Retrieving data for key: \(key)")
        
        guard let value = cache[key] else {
            logger.error("Data not found for key: \(key)")
            throw DataError.notFound(key)
        }
        
        guard let typedValue = value as? T else {
            logger.error("Invalid data type for key: \(key)")
            throw DataError.invalidData("Expected \(type), got \(Swift.type(of: value))")
        }
        
        return typedValue
    }
    
    /// データストアを作成
    /// - Parameters:
    ///   - name: ストア名
    ///   - metadata: メタデータ
    /// - Returns: 作成されたデータストア
    public func createDataStore(name: String, metadata: [String: String] = [:]) -> DataStore {
        let id = UUID().uuidString
        let store = DataStore(id: id, name: name, metadata: metadata)
        
        logger.info("Created data store", metadata: [
            "id": id,
            "name": name
        ])
        
        self.store(store, forKey: id)
        return store
    }
    
    /// 全てのデータをクリア
    public func clearAll() {
        logger.warning("Clearing all cached data")
        cache.removeAll()
    }
    
    /// キャッシュサイズを取得
    /// - Returns: キャッシュ内のアイテム数
    public func getCacheSize() -> Int {
        return cache.count
    }
    
    /// データを非同期で取得
    /// - Parameter key: キー
    /// - Returns: 取得されたデータストア
    /// - Throws: データが見つからない場合
    public func retrieveDataStoreAsync(forKey key: String) async throws -> DataStore {
        // 非同期処理のシミュレーション
        try await Task.sleep(nanoseconds: 100_000_000) // 100ms
        
        return try retrieve(DataStore.self, forKey: key)
    }
    
    /// データを検索
    /// - Parameter predicate: 検索条件
    /// - Returns: 検索結果
    public func searchDataStores(where predicate: (DataStore) -> Bool) -> [DataStore] {
        logger.debug("Searching data stores")
        
        return cache.compactMap { _, value in
            guard let store = value as? DataStore else { return nil }
            return predicate(store) ? store : nil
        }
    }
}