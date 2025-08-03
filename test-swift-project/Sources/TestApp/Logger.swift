import Foundation
import Logging

/// アプリケーション用ロガー
public class AppLogger {
    private let logger: Logger
    
    /// ログレベル
    public enum Level: String, CaseIterable {
        case debug = "DEBUG"
        case info = "INFO"
        case warning = "WARNING"
        case error = "ERROR"
        case critical = "CRITICAL"
    }
    
    /// 初期化
    /// - Parameter label: ロガーのラベル
    public init(label: String = "TestApp") {
        self.logger = Logger(label: label)
    }
    
    /// デバッグログを出力
    /// - Parameters:
    ///   - message: ログメッセージ
    ///   - metadata: メタデータ
    ///   - file: ファイル名
    ///   - function: 関数名
    ///   - line: 行番号
    public func debug(
        _ message: String,
        metadata: [String: String] = [:],
        file: String = #file,
        function: String = #function,
        line: UInt = #line
    ) {
        var logMetadata: Logger.Metadata = [:]
        metadata.forEach { logMetadata[$0.key] = .string($0.value) }
        logger.debug("\(message)", metadata: logMetadata, file: file, function: function, line: line)
    }
    
    /// 情報ログを出力
    /// - Parameters:
    ///   - message: ログメッセージ
    ///   - metadata: メタデータ
    ///   - file: ファイル名
    ///   - function: 関数名
    ///   - line: 行番号
    public func info(
        _ message: String,
        metadata: [String: String] = [:],
        file: String = #file,
        function: String = #function,
        line: UInt = #line
    ) {
        var logMetadata: Logger.Metadata = [:]
        metadata.forEach { logMetadata[$0.key] = .string($0.value) }
        logger.info("\(message)", metadata: logMetadata, file: file, function: function, line: line)
    }
    
    /// 警告ログを出力
    /// - Parameters:
    ///   - message: ログメッセージ
    ///   - metadata: メタデータ
    ///   - file: ファイル名
    ///   - function: 関数名
    ///   - line: 行番号
    public func warning(
        _ message: String,
        metadata: [String: String] = [:],
        file: String = #file,
        function: String = #function,
        line: UInt = #line
    ) {
        var logMetadata: Logger.Metadata = [:]
        metadata.forEach { logMetadata[$0.key] = .string($0.value) }
        logger.warning("\(message)", metadata: logMetadata, file: file, function: function, line: line)
    }
    
    /// エラーログを出力
    /// - Parameters:
    ///   - message: ログメッセージ
    ///   - error: エラーオブジェクト
    ///   - metadata: メタデータ
    ///   - file: ファイル名
    ///   - function: 関数名
    ///   - line: 行番号
    public func error(
        _ message: String,
        error: Error? = nil,
        metadata: [String: String] = [:],
        file: String = #file,
        function: String = #function,
        line: UInt = #line
    ) {
        var logMetadata: Logger.Metadata = [:]
        metadata.forEach { logMetadata[$0.key] = .string($0.value) }
        if let error = error {
            logMetadata["error"] = .string(String(describing: error))
        }
        logger.error("\(message)", metadata: logMetadata, file: file, function: function, line: line)
    }
}