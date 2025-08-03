import Foundation
import ArgumentParser
import TestApp

/// テストCLIアプリケーション
@main
struct TestCLI: AsyncParsableCommand {
    static let configuration = CommandConfiguration(
        commandName: "test-cli",
        abstract: "Test CLI application for Swift LSP integration testing",
        version: "1.0.0",
        subcommands: [DataCommand.self, NetworkCommand.self, LogCommand.self]
    )
}

/// データ管理コマンド
struct DataCommand: AsyncParsableCommand {
    static let configuration = CommandConfiguration(
        commandName: "data",
        abstract: "Data management operations"
    )
    
    @Option(name: .shortAndLong, help: "Data store name")
    var name: String = "test-store"
    
    @Option(name: .shortAndLong, help: "Operation type")
    var operation: String = "create"
    
    @Flag(name: .shortAndLong, help: "Enable verbose output")
    var verbose: Bool = false
    
    mutating func run() async throws {
        let logger = AppLogger(label: "CLI-Data")
        let dataManager = DataManager.shared
        
        if verbose {
            logger.info("Starting data operation", metadata: [
                "operation": operation,
                "name": name
            ])
        }
        
        switch operation.lowercased() {
        case "create":
            let store = dataManager.createDataStore(
                name: name,
                metadata: ["source": "cli", "timestamp": ISO8601DateFormatter().string(from: Date())]
            )
            print("✅ Created data store: \(store.id) (\(store.name))")
            
        case "list":
            let stores = dataManager.searchDataStores { _ in true }
            print("📋 Found \(stores.count) data stores:")
            for store in stores {
                print("  - \(store.id): \(store.name) (created: \(store.createdAt))")
            }
            
        case "clear":
            dataManager.clearAll()
            print("🗑️ Cleared all data")
            
        case "size":
            let size = dataManager.getCacheSize()
            print("📊 Cache size: \(size) items")
            
        default:
            throw ValidationError("Unknown operation: \(operation). Use: create, list, clear, size")
        }
    }
}

/// ネットワークコマンド
struct NetworkCommand: AsyncParsableCommand {
    static let configuration = CommandConfiguration(
        commandName: "network",
        abstract: "Network operations"
    )
    
    @Option(name: .shortAndLong, help: "URL to request")
    var url: String = "https://httpbin.org/get"
    
    @Option(name: .shortAndLong, help: "HTTP method")
    var method: String = "GET"
    
    @Flag(name: .shortAndLong, help: "Pretty print JSON response")
    var pretty: Bool = false
    
    mutating func run() async throws {
        let logger = AppLogger(label: "CLI-Network")
        let networkService = NetworkService()
        
        guard let requestURL = URL(string: url) else {
            throw ValidationError("Invalid URL: \(url)")
        }
        
        logger.info("Making network request", metadata: [
            "url": url,
            "method": method
        ])
        
        do {
            let httpMethod = NetworkService.HTTPMethod(rawValue: method.uppercased()) ?? .GET
            let config = NetworkService.RequestConfig(url: requestURL, method: httpMethod)
            let response = try await networkService.request(config)
            
            print("🌐 Response Status: \(response.statusCode)")
            print("📡 Response Size: \(response.data.count) bytes")
            
            if pretty && response.data.count > 0 {
                if let jsonObject = try? JSONSerialization.jsonObject(with: response.data),
                   let prettyData = try? JSONSerialization.data(withJSONObject: jsonObject, options: .prettyPrinted),
                   let prettyString = String(data: prettyData, encoding: .utf8) {
                    print("📄 Response Body:")
                    print(prettyString)
                } else {
                    print("📄 Response Body (raw):")
                    print(String(data: response.data, encoding: .utf8) ?? "Unable to decode response")
                }
            }
            
        } catch {
            logger.error("Network request failed", error: error)
            throw ExitCode.failure
        }
    }
}

/// ログコマンド
struct LogCommand: ParsableCommand {
    static let configuration = CommandConfiguration(
        commandName: "log",
        abstract: "Logging operations"
    )
    
    @Option(name: .shortAndLong, help: "Log message")
    var message: String = "Test log message"
    
    @Option(name: .shortAndLong, help: "Log level")
    var level: String = "info"
    
    @Option(name: .shortAndLong, help: "Number of log entries")
    var count: Int = 1
    
    func run() throws {
        let logger = AppLogger(label: "CLI-Log")
        
        for i in 1...count {
            let indexedMessage = count > 1 ? "\(message) #\(i)" : message
            
            switch level.lowercased() {
            case "debug":
                logger.debug(indexedMessage)
            case "info":
                logger.info(indexedMessage)
            case "warning":
                logger.warning(indexedMessage)
            case "error":
                logger.error(indexedMessage)
            default:
                throw ValidationError("Unknown log level: \(level). Use: debug, info, warning, error")
            }
        }
        
        print("📝 Logged \(count) message(s) at \(level) level")
    }
}