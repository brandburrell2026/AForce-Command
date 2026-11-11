// swift-tools-version: 6.0
import PackageDescription

let package = Package(
  name: "SkinIAFrameCoordinates",
  platforms: [.iOS(.v15)],
  products: [
    .library(name: "SkinIAFrameCoordinates", targets: ["SkinIAFrameCoordinates"]),
  ],
  targets: [
    .target(
      name: "SkinIAFrameCoordinates",
      path: ".",
      sources: ["SkinIAFrameCoordinates.swift"]
    ),
    .testTarget(
      name: "SkinIAFrameCoordinatesTests",
      dependencies: ["SkinIAFrameCoordinates"],
      path: "Tests"
    ),
  ]
)
