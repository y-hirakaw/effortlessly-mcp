// swift-tools-version: 5.7
import PackageDescription

let package = Package(
    name: "TestApp",
    platforms: [
        .macOS(.v11),
        .iOS(.v14)
    ],
    products: [
        .library(
            name: "TestApp",
            targets: ["TestApp"]
        ),
        .executable(
            name: "test-cli",
            targets: ["TestCLI"]
        )
    ],
    dependencies: [
        .package(url: "https://github.com/apple/swift-argument-parser.git", from: "1.2.0"),
        .package(url: "https://github.com/apple/swift-log.git", from: "1.0.0")
    ],
    targets: [
        .target(
            name: "TestApp",
            dependencies: [
                .product(name: "Logging", package: "swift-log")
            ]
        ),
        .executableTarget(
            name: "TestCLI",
            dependencies: [
                "TestApp",
                .product(name: "ArgumentParser", package: "swift-argument-parser")
            ]
        ),
        .testTarget(
            name: "TestAppTests",
            dependencies: ["TestApp"]
        )
    ]
)