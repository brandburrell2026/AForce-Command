import CoreGraphics
import Foundation
import UIKit
import XCTest
@testable import SkinIAFrameCoordinates

// Generated pixels only: this exercises the exact helper linked into the QA
// extractor without storing or analyzing a participant image.
final class SkinIAFrameCoordinatesTests: XCTestCase {
  private let rawWidth = 4
  private let rawHeight = 6

  private func sourceImage() throws -> CGImage {
    var rgba: [UInt8] = []
    for y in 0..<rawHeight {
      for x in 0..<rawWidth {
        let value = UInt8(y * rawWidth + x + 1)
        rgba.append(contentsOf: [value, value, value, 255])
      }
    }
    let bitmapInfo = CGBitmapInfo(rawValue: CGImageAlphaInfo.premultipliedLast.rawValue |
                                           CGBitmapInfo.byteOrder32Big.rawValue)
    let provider = try XCTUnwrap(CGDataProvider(data: Data(rgba) as CFData))
    return try XCTUnwrap(CGImage(width: rawWidth, height: rawHeight,
                                bitsPerComponent: 8, bitsPerPixel: 32,
                                bytesPerRow: rawWidth * 4,
                                space: CGColorSpaceCreateDeviceRGB(),
                                bitmapInfo: bitmapInfo, provider: provider,
                                decode: nil, shouldInterpolate: false,
                                intent: .defaultIntent))
  }

  func testRenderedTopLeftRowsAndVisionBoxForEveryUIImageOrientation() throws {
    let source = try sourceImage()
    let cases: [(UIImage.Orientation, [UInt8])] = [
      (.up, [1, 2, 3, 4]),
      (.upMirrored, [4, 3, 2, 1]),
      (.down, [24, 23, 22, 21]),
      (.downMirrored, [21, 22, 23, 24]),
      (.left, [4, 8, 12, 16, 20, 24]),
      (.right, [21, 17, 13, 9, 5, 1]),
      (.leftMirrored, [1, 5, 9, 13, 17, 21]),
      (.rightMirrored, [24, 20, 16, 12, 8, 4]),
    ]
    for (orientation, expectedTopRow) in cases {
      let input = UIImage(cgImage: source, scale: 1, orientation: orientation)
      let rendered = try XCTUnwrap(SkinIAFrameCoordinates.renderUpright(input))
      let rgba = try XCTUnwrap(SkinIAFrameCoordinates.topLeftRGBA(rendered))
      XCTAssertEqual(rendered.width, expectedTopRow.count, "width for \(orientation)")
      XCTAssertEqual(rgba.count, rendered.width * rendered.height * 4)
      let topRow = (0..<rendered.width).map { rgba[$0 * 4] }
      XCTAssertEqual(topRow, expectedTopRow, "top row for \(orientation)")

      // Vision's upper-left normalized quadrant must point to the same
      // upper-left pixels in the extractor's decoded buffer.
      let box = CGRect(x: 0, y: 0.5, width: 0.5, height: 0.5)
      let rect = try XCTUnwrap(SkinIAFrameCoordinates.topLeftFaceRect(
        fromVisionBox: box, width: rendered.width, height: rendered.height))
      XCTAssertEqual(rect.x, 0)
      XCTAssertEqual(rect.y, 0)
      XCTAssertEqual(rect.width, Double(rendered.width) / 2)
      XCTAssertEqual(rect.height, Double(rendered.height) / 2)
      let firstPixelOffset = (Int(rect.y) * rendered.width + Int(rect.x)) * 4
      XCTAssertEqual(rgba[firstPixelOffset], expectedTopRow[0], "Vision ROI for \(orientation)")
    }
  }

  func testVisionBottomLeftBoxMapsToBottomHalfOfTopLeftBuffer() throws {
    let box = CGRect(x: 0.25, y: 0, width: 0.5, height: 0.5)
    let rect = try XCTUnwrap(SkinIAFrameCoordinates.topLeftFaceRect(
      fromVisionBox: box, width: 200, height: 300))
    XCTAssertEqual(rect.x, 50)
    XCTAssertEqual(rect.y, 150)
    XCTAssertEqual(rect.width, 100)
    XCTAssertEqual(rect.height, 150)
    XCTAssertNil(SkinIAFrameCoordinates.topLeftFaceRect(
      fromVisionBox: CGRect(x: 0, y: 0, width: 1.1, height: 0.5), width: 200, height: 300))
  }
}
