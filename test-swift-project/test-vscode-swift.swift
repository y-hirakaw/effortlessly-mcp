// Test Swift file for VS Code SourceKit-LSP integration test
import Foundation

public class TestDataManager {
    private var data: [String] = []
    
    public init() {
        print("TestDataManager initialized")
    }
    
    public func addData(_ item: String) {
        data.append(item)
    }
    
    public func getData() -> [String] {
        return data
    }
}

struct TestConfig {
    let name: String
    let version: Int
    
    static let shared = TestConfig(name: "Test", version: 1)
}

enum TestError: Error {
    case invalidData
    case networkError(String)
    case unknown
}

protocol TestProtocol {
    func performTest() -> Bool
    func resetTest()
}

func testFunction() -> String {
    return "Hello from Swift!"
}