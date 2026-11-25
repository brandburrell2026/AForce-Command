import ExpoModulesCore
import ImageIO
import UIKit
import Vision

public final class HydroScanLabelTextModule: Module {
  public func definition() -> ModuleDefinition {
    Name("HydroScanLabelText")

    // The camera's SharedRef<UIImage> is consumed in memory. No image bytes,
    // URI or thumbnail is created. The recognised text, one box around the
    // drink, the picture's shape and one brightness number are returned to JS
    // only. Nothing is written to disk, sent anywhere or logged.
    AsyncFunction("recognizeAsync") { (picture: SharedRef<UIImage>) -> [String: Any] in
      return HydroScanLabelText.recognize(picture.ref)
    }
  }
}

private enum HydroScanLabelText {
  private static let maxLines = 120

  static func recognize(_ source: UIImage) -> [String: Any] {
    guard let cgImage = source.cgImage else { return ["state": "UNAVAILABLE"] }

    let request = VNRecognizeTextRequest()
    request.recognitionLevel = .accurate
    // Brand names, flavours and sizes are not dictionary words.
    request.usesLanguageCorrection = false
    request.recognitionLanguages = ["en-US"]
    request.minimumTextHeight = 0.012

    do {
      // skipProcessing leaves the pixels unrotated; the orientation tells Vision how to read them.
      try VNImageRequestHandler(
        cgImage: cgImage,
        orientation: orientation(of: source),
        options: [:]
      ).perform([request])
    } catch {
      return ["state": "UNAVAILABLE"]
    }

    var lines: [[String: Any]] = []
    for observation in request.results ?? [] {
      guard let best = observation.topCandidates(1).first else { continue }
      let box = observation.boundingBox // normalised, bottom-left origin
      lines.append([
        "text": best.string,
        "confidence": Double(best.confidence),
        "box": [
          "x": Double(box.minX),
          "y": Double(1.0 - box.maxY), // top-left origin for JS
          "width": Double(box.width),
          "height": Double(box.height),
        ],
      ])
      if lines.count >= maxLines { break }
    }
    var result: [String: Any] = ["state": "OK", "lines": lines]

    // Where the drink is, so the frame can settle around it. A second,
    // separate request: if it fails, the text read above is still returned.
    // Only a box, the picture's shape and one brightness number leave here.
    let size = source.size
    if size.width > 0 && size.height > 0 {
      result["aspect"] = Double(size.width / size.height)
    }
    if let object = salientObject(in: cgImage, orientation: orientation(of: source)) {
      result["object"] = object
    }
    if let light = brightness(of: cgImage) {
      result["brightness"] = light
    }
    return result
  }

  /// The most prominent object in the picture, normalised with a top-left origin.
  private static func salientObject(in cgImage: CGImage, orientation: CGImagePropertyOrientation) -> [String: Any]? {
    let request = VNGenerateObjectnessBasedSaliencyImageRequest()
    do {
      try VNImageRequestHandler(cgImage: cgImage, orientation: orientation, options: [:]).perform([request])
    } catch {
      return nil
    }
    guard let observation = request.results?.first as? VNSaliencyImageObservation,
          let objects = observation.salientObjects, !objects.isEmpty else { return nil }
    var best: VNRectangleObservation? = nil
    var bestArea: CGFloat = 0
    for candidate in objects {
      let area = candidate.boundingBox.width * candidate.boundingBox.height
      if area > bestArea {
        bestArea = area
        best = candidate
      }
    }
    guard let chosen = best else { return nil }
    let box = chosen.boundingBox // normalised, bottom-left origin
    return [
      "x": Double(box.minX),
      "y": Double(1.0 - box.maxY),
      "width": Double(box.width),
      "height": Double(box.height),
      "confidence": Double(chosen.confidence),
    ]
  }

  /// Mean brightness, 0 (black) to 1 (white), from a 16 by 16 grey copy.
  private static func brightness(of cgImage: CGImage) -> Double? {
    let side = 16
    var pixels = [UInt8](repeating: 0, count: side * side)
    let drawn: Bool = pixels.withUnsafeMutableBytes { buffer -> Bool in
      guard let context = CGContext(
        data: buffer.baseAddress,
        width: side,
        height: side,
        bitsPerComponent: 8,
        bytesPerRow: side,
        space: CGColorSpaceCreateDeviceGray(),
        bitmapInfo: CGImageAlphaInfo.none.rawValue
      ) else { return false }
      context.interpolationQuality = .low
      context.draw(cgImage, in: CGRect(x: 0, y: 0, width: side, height: side))
      return true
    }
    guard drawn else { return nil }
    var total = 0
    for value in pixels { total += Int(value) }
    return Double(total) / Double(side * side * 255)
  }

  private static func orientation(of image: UIImage) -> CGImagePropertyOrientation {
    switch image.imageOrientation {
    case .up: return .up
    case .upMirrored: return .upMirrored
    case .down: return .down
    case .downMirrored: return .downMirrored
    case .left: return .left
    case .leftMirrored: return .leftMirrored
    case .right: return .right
    case .rightMirrored: return .rightMirrored
    @unknown default: return .up
    }
  }
}
