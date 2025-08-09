// swift-tools-version:5.6
import PackageDescription

let package = Package(
    name: "TestCocoaPodsApp",
    platforms: [
        .iOS(.v12)
    ],
    products: [
        .library(
            name: "TestCocoaPodsApp",
            targets: ["TestCocoaPodsApp"]
        )
    ],
    dependencies: [
        .package(url: "https://github.com/Alamofire/Alamofire.git", from: "5.6.0"),
        .package(url: "https://github.com/SwiftyJSON/SwiftyJSON.git", from: "5.0.0"),
        .package(url: "https://github.com/SnapKit/SnapKit.git", from: "5.6.0")
    ],
    targets: [
        .target(
            name: "TestCocoaPodsApp",
            dependencies: [
                "Alamofire",
                "SwiftyJSON", 
                "SnapKit"
            ],
            path: "TestCocoaPodsApp"
        )
    ]
)