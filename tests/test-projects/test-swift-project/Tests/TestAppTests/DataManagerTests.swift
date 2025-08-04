import XCTest
@testable import TestApp

/// DataManagerのテストクラス
final class DataManagerTests: XCTestCase {
    var dataManager: DataManager!
    
    override func setUp() {
        super.setUp()
        dataManager = DataManager.shared
        dataManager.clearAll()
    }
    
    override func tearDown() {
        dataManager.clearAll()
        super.tearDown()
    }
    
    /// データの保存と取得をテスト
    func testStoreAndRetrieve() throws {
        let testString = "Hello, Swift LSP!"
        let testKey = "test-string"
        
        dataManager.store(testString, forKey: testKey)
        let retrievedString = try dataManager.retrieve(String.self, forKey: testKey)
        
        XCTAssertEqual(testString, retrievedString)
    }
    
    /// 存在しないキーでの取得エラーをテスト
    func testRetrieveNonExistentKey() {
        XCTAssertThrowsError(try dataManager.retrieve(String.self, forKey: "non-existent")) { error in
            guard case DataManager.DataError.notFound(let key) = error else {
                XCTFail("Expected DataError.notFound, got \(error)")
                return
            }
            XCTAssertEqual(key, "non-existent")
        }
    }
    
    /// 型の不一致エラーをテスト
    func testRetrieveTypeMismatch() {
        dataManager.store("string", forKey: "test")
        
        XCTAssertThrowsError(try dataManager.retrieve(Int.self, forKey: "test")) { error in
            guard case DataManager.DataError.invalidData = error else {
                XCTFail("Expected DataError.invalidData, got \(error)")
                return
            }
        }
    }
    
    /// データストアの作成をテスト
    func testCreateDataStore() {
        let storeName = "Test Store"
        let metadata = ["category": "test", "priority": "high"]
        
        let store = dataManager.createDataStore(name: storeName, metadata: metadata)
        
        XCTAssertEqual(store.name, storeName)
        XCTAssertEqual(store.metadata, metadata)
        XCTAssertFalse(store.id.isEmpty)
        XCTAssertTrue(store.createdAt <= Date())
    }
    
    /// データストアの検索をテスト
    func testSearchDataStores() {
        let store1 = dataManager.createDataStore(name: "Store One", metadata: ["type": "primary"])
        let store2 = dataManager.createDataStore(name: "Store Two", metadata: ["type": "secondary"])
        let store3 = dataManager.createDataStore(name: "Another Store", metadata: ["type": "primary"])
        
        let primaryStores = dataManager.searchDataStores { store in
            store.metadata["type"] == "primary"
        }
        
        XCTAssertEqual(primaryStores.count, 2)
        XCTAssertTrue(primaryStores.contains { $0.id == store1.id })
        XCTAssertTrue(primaryStores.contains { $0.id == store3.id })
        XCTAssertFalse(primaryStores.contains { $0.id == store2.id })
    }
    
    /// 非同期でのデータストア取得をテスト
    func testRetrieveDataStoreAsync() async throws {
        let store = dataManager.createDataStore(name: "Async Store")
        
        let retrievedStore = try await dataManager.retrieveDataStoreAsync(forKey: store.id)
        
        XCTAssertEqual(retrievedStore.id, store.id)
        XCTAssertEqual(retrievedStore.name, store.name)
    }
    
    /// キャッシュサイズの計算をテスト
    func testCacheSize() {
        XCTAssertEqual(dataManager.getCacheSize(), 0)
        
        dataManager.store("test1", forKey: "key1")
        XCTAssertEqual(dataManager.getCacheSize(), 1)
        
        dataManager.store("test2", forKey: "key2")
        XCTAssertEqual(dataManager.getCacheSize(), 2)
        
        dataManager.clearAll()
        XCTAssertEqual(dataManager.getCacheSize(), 0)
    }
    
    /// データエラーのローカライズされた説明をテスト
    func testDataErrorDescriptions() {
        let notFoundError = DataManager.DataError.notFound("test-id")
        XCTAssertEqual(notFoundError.errorDescription, "Data not found: test-id")
        
        let invalidDataError = DataManager.DataError.invalidData("Type mismatch")
        XCTAssertEqual(invalidDataError.errorDescription, "Invalid data: Type mismatch")
        
        let networkError = DataManager.DataError.networkError("Connection failed")
        XCTAssertEqual(networkError.errorDescription, "Network error: Connection failed")
        
        let unknownError = DataManager.DataError.unknownError
        XCTAssertEqual(unknownError.errorDescription, "Unknown error occurred")
    }
}