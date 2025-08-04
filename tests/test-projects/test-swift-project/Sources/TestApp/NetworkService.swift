import Foundation

/// ネットワーク通信サービス
public class NetworkService {
    private let logger = AppLogger(label: "NetworkService")
    private let session: URLSession
    
    /// HTTPメソッド
    public enum HTTPMethod: String {
        case GET = "GET"
        case POST = "POST"
        case PUT = "PUT"
        case DELETE = "DELETE"
        case PATCH = "PATCH"
    }
    
    /// リクエスト設定
    public struct RequestConfig {
        public let url: URL
        public let method: HTTPMethod
        public let headers: [String: String]
        public let body: Data?
        public let timeout: TimeInterval
        
        public init(
            url: URL,
            method: HTTPMethod = .GET,
            headers: [String: String] = [:],
            body: Data? = nil,
            timeout: TimeInterval = 30.0
        ) {
            self.url = url
            self.method = method
            self.headers = headers
            self.body = body
            self.timeout = timeout
        }
    }
    
    /// レスポンスデータ
    public struct ResponseData {
        public let data: Data
        public let response: HTTPURLResponse
        public let statusCode: Int
        
        public init(data: Data, response: HTTPURLResponse) {
            self.data = data
            self.response = response
            self.statusCode = response.statusCode
        }
    }
    
    /// 初期化
    /// - Parameter configuration: URLSession設定
    public init(configuration: URLSessionConfiguration = .default) {
        self.session = URLSession(configuration: configuration)
        logger.info("NetworkService initialized")
    }
    
    /// HTTPリクエストを送信
    /// - Parameter config: リクエスト設定
    /// - Returns: レスポンスデータ
    /// - Throws: ネットワークエラー
    public func request(_ config: RequestConfig) async throws -> ResponseData {
        logger.debug("Sending HTTP request", metadata: [
            "url": config.url.absoluteString,
            "method": config.method.rawValue
        ])
        
        var request = URLRequest(url: config.url)
        request.httpMethod = config.method.rawValue
        request.timeoutInterval = config.timeout
        
        // ヘッダーを設定
        for (key, value) in config.headers {
            request.setValue(value, forHTTPHeaderField: key)
        }
        
        // ボディを設定
        if let body = config.body {
            request.httpBody = body
        }
        
        do {
            let (data, response) = try await session.data(for: request)
            
            guard let httpResponse = response as? HTTPURLResponse else {
                logger.error("Invalid response type")
                throw DataManager.DataError.networkError("Invalid response type")
            }
            
            let responseData = ResponseData(data: data, response: httpResponse)
            
            logger.info("HTTP request completed", metadata: [
                "statusCode": String(responseData.statusCode),
                "dataSize": String(data.count)
            ])
            
            return responseData
            
        } catch {
            logger.error("HTTP request failed", error: error)
            throw DataManager.DataError.networkError(error.localizedDescription)
        }
    }
    
    /// JSONデータをデコード
    /// - Parameters:
    ///   - type: デコード対象の型
    ///   - data: JSONデータ
    /// - Returns: デコードされたオブジェクト
    /// - Throws: デコードエラー
    public func decode<T: Codable>(_ type: T.Type, from data: Data) throws -> T {
        logger.debug("Decoding JSON data to \(type)")
        
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        
        do {
            let object = try decoder.decode(type, from: data)
            logger.debug("JSON decoding successful")
            return object
        } catch {
            logger.error("JSON decoding failed", error: error)
            throw DataManager.DataError.invalidData("Failed to decode JSON: \(error.localizedDescription)")
        }
    }
    
    /// オブジェクトをJSONエンコード
    /// - Parameter object: エンコード対象のオブジェクト
    /// - Returns: JSONデータ
    /// - Throws: エンコードエラー
    public func encode<T: Codable>(_ object: T) throws -> Data {
        logger.debug("Encoding object to JSON: \(type(of: object))")
        
        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .iso8601
        encoder.outputFormatting = .prettyPrinted
        
        do {
            let data = try encoder.encode(object)
            logger.debug("JSON encoding successful", metadata: [
                "dataSize": String(data.count)
            ])
            return data
        } catch {
            logger.error("JSON encoding failed", error: error)
            throw DataManager.DataError.invalidData("Failed to encode JSON: \(error.localizedDescription)")
        }
    }
    
    /// GET リクエスト（便利メソッド）
    /// - Parameter url: URL
    /// - Returns: レスポンスデータ
    /// - Throws: ネットワークエラー
    public func get(from url: URL) async throws -> ResponseData {
        let config = RequestConfig(url: url, method: .GET)
        return try await request(config)
    }
    
    /// POST リクエスト（便利メソッド）
    /// - Parameters:
    ///   - url: URL
    ///   - body: リクエストボディ
    ///   - contentType: コンテンツタイプ
    /// - Returns: レスポンスデータ
    /// - Throws: ネットワークエラー
    public func post<T: Codable>(
        to url: URL,
        body: T,
        contentType: String = "application/json"
    ) async throws -> ResponseData {
        let jsonData = try encode(body)
        let config = RequestConfig(
            url: url,
            method: .POST,
            headers: ["Content-Type": contentType],
            body: jsonData
        )
        return try await request(config)
    }
}