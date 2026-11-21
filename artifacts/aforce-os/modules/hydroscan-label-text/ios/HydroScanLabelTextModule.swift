import ExpoModulesCore
import ImageIO
import UIKit
import Vision

public final class HydroScanLabelTextModule: Module {
  public func definition() -> ModuleDefinition {
    Name("HydroScanLabelText")

    // The camera's SharedRef<UIImage> is consumed in memory. No image bytes,
    // URI or thumbnail is created, and the recognised text is returned to JS
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
    return ["state": "OK", "lines": lines]
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
