import CoreGraphics
import UIKit

// Shared by the QA extractor and its synthetic iOS coordinate tests. Pixels
// remain in memory and never cross the module's JavaScript boundary.
enum SkinIAFrameCoordinates {
  struct FaceRect {
    let x: Double
    let y: Double
    let width: Double
    let height: Double
  }

  static func renderUpright(_ source: UIImage, longestSide: Double = 640) -> CGImage? {
    let sourceWidth = Double(source.size.width * source.scale)
    let sourceHeight = Double(source.size.height * source.scale)
    guard sourceWidth.isFinite, sourceHeight.isFinite,
          sourceWidth > 0, sourceHeight > 0,
          longestSide.isFinite, longestSide > 0 else { return nil }
    let factor = min(1.0, longestSide / max(sourceWidth, sourceHeight))
    let width = max(1, Int((sourceWidth * factor).rounded()))
    let height = max(1, Int((sourceHeight * factor).rounded()))
    let format = UIGraphicsImageRendererFormat()
    format.opaque = true
    format.scale = 1
    let rendered = UIGraphicsImageRenderer(
      size: CGSize(width: CGFloat(width), height: CGFloat(height)), format: format
    ).image { _ in
      source.draw(in: CGRect(x: 0, y: 0, width: CGFloat(width), height: CGFloat(height)))
    }
    return rendered.cgImage
  }

  // CGContext's packed bytes are already in top-left row order for this
  // rendered CGImage. A vertical CTM flip reverses the rows on iOS.
  static func topLeftRGBA(_ image: CGImage) -> [UInt8]? {
    let width = image.width
    let height = image.height
    guard width > 0, height > 0 else { return nil }
    let (rowBytes, rowOverflow) = width.multipliedReportingOverflow(by: 4)
    guard !rowOverflow else { return nil }
    let (bufferBytes, bufferOverflow) = rowBytes.multipliedReportingOverflow(by: height)
    guard !bufferOverflow else { return nil }
    var rgba = [UInt8](repeating: 0, count: bufferBytes)
    let drawn = rgba.withUnsafeMutableBytes { bytes -> Bool in
      guard let address = bytes.baseAddress,
            let context = CGContext(
              data: address, width: width, height: height,
              bitsPerComponent: 8, bytesPerRow: rowBytes,
              space: CGColorSpaceCreateDeviceRGB(),
              bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue |
                          CGBitmapInfo.byteOrder32Big.rawValue
            ) else { return false }
      context.draw(image, in: CGRect(x: 0, y: 0, width: CGFloat(width), height: CGFloat(height)))
      return true
    }
    return drawn ? rgba : nil
  }

  // Vision bounding boxes use a bottom-left origin. The decoded RGBA array
  // uses a top-left origin, so only the box's y coordinate is converted.
  static func topLeftFaceRect(fromVisionBox box: CGRect, width: Int, height: Int) -> FaceRect? {
    guard width > 0, height > 0,
          box.minX.isFinite, box.minY.isFinite,
          box.maxX.isFinite, box.maxY.isFinite,
          box.width > 0, box.height > 0,
          box.minX >= 0, box.minY >= 0,
          box.maxX <= 1, box.maxY <= 1 else { return nil }
    return FaceRect(
      x: Double(box.minX) * Double(width),
      y: (1.0 - Double(box.maxY)) * Double(height),
      width: Double(box.width) * Double(width),
      height: Double(box.height) * Double(height)
    )
  }
}
