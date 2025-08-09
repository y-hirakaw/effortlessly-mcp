import Foundation
import SwiftyJSON

// MARK: - Data Models for CocoaPods Test App

struct Post: Codable {
    let id: Int
    let userId: Int
    let title: String
    let body: String
}

struct Comment: Codable {
    let id: Int
    let postId: Int
    let name: String
    let email: String
    let body: String
}

// MARK: - Network Response Models

class APIResponse {
    let data: Data
    let json: JSON
    
    init(data: Data) {
        self.data = data
        self.json = JSON(data)
    }
}

// MARK: - Configuration

struct AppConfiguration {
    static let baseURL = "https://jsonplaceholder.typicode.com"
    static let timeoutInterval: TimeInterval = 30.0
    static let maxRetries = 3
}