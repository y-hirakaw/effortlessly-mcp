// swift-tools-version: 5.8
import PackageDescription

let package = Package(
    name: "TestApp",
    platforms: [
        .macOS(.v10_15),
        .iOS(.v13)
    ],
    products: [
        .library(
            name: "TestApp",
            targets: ["TestApp"]),
    ],
    dependencies: [
        // Add package dependencies here
    ],
    targets: [
        .target(
            name: "TestApp",
            dependencies: []),
        .testTarget(
            name: "TestAppTests",
            dependencies: ["TestApp"]),
    ]
)