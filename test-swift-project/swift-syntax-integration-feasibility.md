# SwiftSyntax Node.js統合実現可能性分析

## 🎯 **統合アプローチの評価**

### **アプローチ1: node-ffi-napi + Swift Dynamic Library**

#### **実現可能性**: ⭐⭐⭐⭐ (高い)

**技術的詳細**:
```swift
// Swift側: @_cdecl で C互換関数をエクスポート
@_cdecl("parseSwiftCode")
public func parseSwiftCode(_ sourcePtr: UnsafePointer<CChar>, _ resultPtr: UnsafeMutablePointer<CChar>) -> Int32 {
    let source = String(cString: sourcePtr)
    
    let tree = Parser.parse(source: source)
    let visitor = SymbolExtractor()
    visitor.walk(tree)
    
    let jsonResult = visitor.exportAsJSON()
    strcpy(resultPtr, jsonResult)
    return 0
}
```

```javascript
// Node.js側: FFI binding
const ffi = require('ffi-napi');
const path = require('path');

const swiftSyntaxLib = ffi.Library(path.join(__dirname, 'libSwiftSyntaxParser.dylib'), {
  'parseSwiftCode': ['int', ['string', 'pointer']]
});

function parseSwiftCode(source) {
  const buffer = Buffer.alloc(1024 * 100); // 100KB buffer
  const result = swiftSyntaxLib.parseSwiftCode(source, buffer);
  return JSON.parse(buffer.toString('utf8').split('\0')[0]);
}
```

**メリット**:
- ✅ 既存の実装例がある（Codeberg.org/franzl96/FFI-NAPI-Swift-Native）
- ✅ node-ffi-napiは安定したライブラリ
- ✅ SwiftSyntaxの全機能にアクセス可能
- ✅ パフォーマンスが高い（ネイティブコード実行）

**デメリット**:
- ❌ プラットフォーム固有のバイナリが必要（.dylib/.so/.dll）
- ❌ メモリ管理の複雑性
- ❌ Electron v20.0.0+のサンドボックス制限

---

### **アプローチ2: Swift C++ Interop + Node.js Native Addons**

#### **実現可能性**: ⭐⭐⭐ (中程度)

**技術的詳細**:
```cpp
// C++ラッパー層
#include <napi.h>
#include "SwiftSyntaxBridge.h"

Napi::Value ParseSwiftCode(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    
    if (info.Length() < 1 || !info[0].IsString()) {
        Napi::TypeError::New(env, "String expected").ThrowAsJavaScriptException();
        return env.Null();
    }
    
    std::string source = info[0].As<Napi::String>();
    auto result = swift_syntax_parse(source.c_str());
    
    return Napi::String::New(env, result);
}

Napi::Object Init(Napi::Env env, Napi::Object exports) {
    exports.Set(Napi::String::New(env, "parseSwiftCode"), 
                Napi::Function::New(env, ParseSwiftCode));
    return exports;
}

NODE_API_MODULE(swiftsyntax, Init)
```

**メリット**:
- ✅ Node.js公式のネイティブアドオン機能
- ✅ TypeScript型定義の統合が容易
- ✅ npm配布が可能

**デメリット**:
- ❌ Swift C++ Interopは比較的新しい機能
- ❌ 複雑なビルドプロセス
- ❌ クロスプラットフォーム対応の複雑性

---

### **アプローチ3: WebAssembly (WASM) Bridge**

#### **実現可能性**: ⭐⭐ (低い)

**理由**:
- Swift WebAssembly サポートは実験段階
- SwiftSyntaxのWASMコンパイルは未検証
- パフォーマンスオーバーヘッドが大きい

---

## 🏆 **推奨実装アプローチ**

### **Phase 1: node-ffi-napi アプローチで実装**

**実装計画**:

1. **Swift Dynamic Library作成**
```swift
// Package.swift
let package = Package(
    name: "SwiftSyntaxParser",
    products: [
        .library(name: "SwiftSyntaxParser", type: .dynamic, targets: ["SwiftSyntaxParser"])
    ],
    dependencies: [
        .package(url: "https://github.com/apple/swift-syntax.git", from: "508.0.0")
    ],
    targets: [
        .target(
            name: "SwiftSyntaxParser",
            dependencies: [
                .product(name: "SwiftSyntax", package: "swift-syntax"),
                .product(name: "SwiftParser", package: "swift-syntax")
            ]
        )
    ]
)
```

2. **Core Symbol Extraction Functions**
```swift
import SwiftSyntax
import SwiftParser

public struct SymbolInfo {
    let name: String
    let kind: String
    let position: SourceLocation
    let range: SourceRange
}

@_cdecl("extractSymbols")
public func extractSymbols(_ sourcePtr: UnsafePointer<CChar>) -> UnsafePointer<CChar> {
    let source = String(cString: sourcePtr)
    let tree = Parser.parse(source: source)
    
    let extractor = SymbolExtractor()
    extractor.walk(tree)
    
    let symbols = extractor.symbols
    let jsonData = try! JSONEncoder().encode(symbols)
    let jsonString = String(data: jsonData, encoding: .utf8)!
    
    return UnsafePointer(strdup(jsonString))
}
```

3. **Node.js Integration Module**
```javascript
const ffi = require('ffi-napi');
const ref = require('ref-napi');
const path = require('path');

class SwiftSyntaxParser {
    constructor() {
        const libPath = this.findLibraryPath();
        this.lib = ffi.Library(libPath, {
            'extractSymbols': ['string', ['string']],
            'findReferences': ['string', ['string', 'int', 'int']],
            'getHoverInfo': ['string', ['string', 'int', 'int']]
        });
    }
    
    parseSymbols(source) {
        const result = this.lib.extractSymbols(source);
        return JSON.parse(result);
    }
    
    findSymbolReferences(source, line, column) {
        const result = this.lib.findReferences(source, line, column);
        return JSON.parse(result);
    }
}

module.exports = SwiftSyntaxParser;
```

### **期待される成果**

**パフォーマンス目標**:
- シンボル抽出: <50ms (1000行のSwiftコード)
- 参照検索: <100ms
- メモリ使用量: <200MB

**機能範囲**:
- ✅ クラス、構造体、列挙型の検出
- ✅ 関数、プロパティの抽出
- ✅ プロトコル準拠の解析
- ✅ インポート文の処理
- ✅ コメント・ドキュメンテーションの抽出

## 📋 **実装リスク評価**

### **技術的リスク**: 🟡 中程度
- Swift Dynamic Library のクロスプラットフォーム対応
- FFI メモリ管理の複雑性
- SwiftSyntax API の安定性

### **運用リスク**: 🟢 低い
- 既存のフォールバック機能でカバー可能
- 段階的導入が可能

### **保守リスク**: 🟡 中程度
- Swift/SwiftSyntax バージョン依存
- プラットフォーム固有のビルド要件

## 🎯 **結論**

**SwiftSyntax直接統合は実現可能**で、既存のSourceKit-LSPの問題を回避しつつ、より高精度なSwift言語サポートを提供できる。

**推奨実装順序**:
1. ✅ node-ffi-napi アプローチでプロトタイプ作成
2. 基本的なシンボル抽出機能の実装
3. 既存フォールバック機能との比較テスト
4. 段階的な機能拡張