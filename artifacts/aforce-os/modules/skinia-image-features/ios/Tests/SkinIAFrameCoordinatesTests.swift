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

  func testProductionQaZonesAddressDistinctSyntheticPixels() throws {
    let width = 400, height = 400
    let cases: [(SkinIAFrameCoordinates.QASampleZone, CGRect, Int, Int, UInt8)] = [
      (.forehead, CGRect(x: 140, y: 86, width: 120, height: 48), 200, 110, 41),
      (.leftCheek, CGRect(x: 89, y: 194, width: 75, height: 60), 126, 224, 83),
      (.rightCheek, CGRect(x: 236, y: 194, width: 75, height: 60), 274, 224, 125),
      (.nose, CGRect(x: 179, y: 176, width: 42, height: 72), 200, 212, 167),
      (.chin, CGRect(x: 155, y: 275, width: 90, height: 39), 200, 294, 209),
    ]
    var pixels = [UInt8](repeating: 0, count: width * height * 4)
    for i in stride(from: 3, to: pixels.count, by: 4) { pixels[i] = 255 }
    for (_, _, x, y, value) in cases {
      for dy in -2...2 {
        for dx in -2...2 {
          let i = ((y + dy) * width + x + dx) * 4
          pixels[i] = value
          pixels[i + 1] = value
          pixels[i + 2] = value
        }
      }
    }
    let bitmapInfo = CGBitmapInfo(rawValue: CGImageAlphaInfo.premultipliedLast.rawValue |
                                             CGBitmapInfo.byteOrder32Big.rawValue)
    let provider = try XCTUnwrap(CGDataProvider(data: Data(pixels) as CFData))
    let source = try XCTUnwrap(CGImage(
      width: width, height: height, bitsPerComponent: 8, bitsPerPixel: 32,
      bytesPerRow: width * 4, space: CGColorSpaceCreateDeviceRGB(),
      bitmapInfo: bitmapInfo, provider: provider, decode: nil,
      shouldInterpolate: false, intent: .defaultIntent
    ))
    let upright = try XCTUnwrap(SkinIAFrameCoordinates.renderUpright(
      UIImage(cgImage: source, scale: 1, orientation: .up)
    ))
    let rgba = try XCTUnwrap(SkinIAFrameCoordinates.topLeftRGBA(upright))
    let face = try XCTUnwrap(SkinIAFrameCoordinates.topLeftFaceRect(
      fromVisionBox: CGRect(x: 0.125, y: 0.125, width: 0.75, height: 0.75),
      width: width, height: height
    ))
    for (zone, expected, x, y, value) in cases {
      let rect = try XCTUnwrap(SkinIAFrameCoordinates.qaSampleRect(
        zone, in: face, imageWidth: width, imageHeight: height
      ))
      XCTAssertEqual(rect.x0, expected.minX, accuracy: 0.0001, "x0 for \(zone)")
      XCTAssertEqual(rect.y0, expected.minY, accuracy: 0.0001, "y0 for \(zone)")
      XCTAssertEqual(rect.x1, expected.maxX, accuracy: 0.0001, "x1 for \(zone)")
      XCTAssertEqual(rect.y1, expected.maxY, accuracy: 0.0001, "y1 for \(zone)")
      XCTAssertGreaterThanOrEqual(Double(x), rect.x0)
      XCTAssertLessThan(Double(x), rect.x1)
      XCTAssertGreaterThanOrEqual(Double(y), rect.y0)
      XCTAssertLessThan(Double(y), rect.y1)
      XCTAssertEqual(rgba[(y * width + x) * 4], value, "pixel for \(zone)")
    }
  }

  func testQaZonesRejectCroppedOrInvalidFaceGeometry() {
    let face = SkinIAFrameCoordinates.FaceRect(x: -200, y: 50, width: 300, height: 300)
    XCTAssertNil(SkinIAFrameCoordinates.qaSampleRect(
      .leftCheek, in: face, imageWidth: 400, imageHeight: 400
    ))
    let invalid = SkinIAFrameCoordinates.FaceRect(x: .nan, y: 50, width: 300, height: 300)
    XCTAssertNil(SkinIAFrameCoordinates.qaSampleRect(
      .forehead, in: invalid, imageWidth: 400, imageHeight: 400
    ))
  }
}
