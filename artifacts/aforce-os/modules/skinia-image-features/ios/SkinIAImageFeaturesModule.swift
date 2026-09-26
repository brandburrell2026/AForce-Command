import ExpoModulesCore
import UIKit
import Vision

public final class SkinIAImageFeaturesModule: Module {
  public func definition() -> ModuleDefinition {
    Name("SkinIAImageFeatures")

    // The camera's SharedRef<UIImage> is consumed in memory. No image bytes,
    // thumbnail, URI, landmark, or face box crosses the JS boundary.
    AsyncFunction("extractAsync") { (picture: SharedRef<UIImage>) -> [String: Any] in
      return SkinIAImageFeatures.extract(picture.ref)
    }
  }
}

private enum SkinIAImageFeatures {
  private struct Region {
    let x0: Double
    let y0: Double
    let x1: Double
    let y1: Double
  }

  private struct Measures {
    let sampleCount: Int
    let brightness: Double
    let redness: Double
    let shine: Double
    let texture: Double
    let brightEdges: Double
    let clipping: Double
  }

  static func extract(_ source: UIImage) -> [String: Any] {
    let sourceWidth = source.size.width * source.scale
    let sourceHeight = source.size.height * source.scale
    guard sourceWidth >= 480, sourceHeight >= 480 else { return ["state": "DIMENSIONS_UNUSABLE"] }

    // UIImage.draw applies orientation. The downscaled image exists only in RAM.
    let factor = min(1.0, 640.0 / max(sourceWidth, sourceHeight))
    let width = max(1, Int((sourceWidth * factor).rounded()))
    let height = max(1, Int((sourceHeight * factor).rounded()))
    let format = UIGraphicsImageRendererFormat()
    format.opaque = true
    format.scale = 1
    let rendered = UIGraphicsImageRenderer(size: CGSize(width: CGFloat(width), height: CGFloat(height)), format: format).image { _ in
      source.draw(in: CGRect(x: 0, y: 0, width: CGFloat(width), height: CGFloat(height)))
    }
    guard let cgImage = rendered.cgImage else { return ["state": "UNAVAILABLE"] }

    let request = VNDetectFaceLandmarksRequest()
    do {
      try VNImageRequestHandler(cgImage: cgImage, options: [:]).perform([request])
    } catch {
      return ["state": "UNAVAILABLE"]
    }
    guard let faces = request.results, !faces.isEmpty else { return ["state": "NO_FACE"] }
    guard faces.count == 1 else { return ["state": "MULTIPLE_FACES"] }
    let face = faces[0]
    let box = face.boundingBox
    guard box.width >= 0.22, box.height >= 0.22 else { return ["state": "FACE_TOO_SMALL"] }
    if abs(face.yaw?.doubleValue ?? 0) > 0.26 || abs(face.roll?.doubleValue ?? 0) > 0.26 {
      return ["state": "NOT_FRONTAL"]
    }
    guard face.landmarks?.leftEye != nil, face.landmarks?.rightEye != nil else {
      return ["state": "FACE_NOT_CLEAR"]
    }

    var rgba = [UInt8](repeating: 0, count: width * height * 4)
    let drawn = rgba.withUnsafeMutableBytes { bytes -> Bool in
      guard let address = bytes.baseAddress,
            let context = CGContext(data: address, width: width, height: height,
                                    bitsPerComponent: 8, bytesPerRow: width * 4,
                                    space: CGColorSpaceCreateDeviceRGB(),
                                    bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue | CGBitmapInfo.byteOrder32Big.rawValue) else {
        return false
      }
      context.translateBy(x: 0, y: CGFloat(height))
      context.scaleBy(x: 1, y: -1)
      context.draw(cgImage, in: CGRect(x: 0, y: 0, width: CGFloat(width), height: CGFloat(height)))
      return true
    }
    guard drawn else { return ["state": "UNAVAILABLE"] }

    // Vision's normalized box has a bottom-left origin; pixel rows are top-left.
    let faceX = Double(box.minX) * Double(width)
    let faceY = (1.0 - Double(box.maxY)) * Double(height)
    let faceW = Double(box.width) * Double(width)
    let faceH = Double(box.height) * Double(height)
    // These are coarse face-box sample zones, not landmark-verified skin or
    // evidence that any named appearance cue is observable. Do not silently
    // clamp a cropped zone onto background pixels.
    func region(_ unit: Region) -> Measures? {
      let pixels = Region(
        x0: faceX + unit.x0 * faceW, y0: faceY + unit.y0 * faceH,
        x1: faceX + unit.x1 * faceW, y1: faceY + unit.y1 * faceH)
      guard pixels.x0.isFinite, pixels.y0.isFinite, pixels.x1.isFinite, pixels.y1.isFinite,
            pixels.x0 >= 1, pixels.y0 >= 1,
            pixels.x1 <= Double(width - 1), pixels.y1 <= Double(height - 1),
            pixels.x1 > pixels.x0, pixels.y1 > pixels.y0 else { return nil }
      return measure(rgba, width, height, pixels)
    }
    guard let forehead = region(Region(x0: 0.30, y0: 0.12, x1: 0.70, y1: 0.28)),
          let leftCheek = region(Region(x0: 0.13, y0: 0.48, x1: 0.38, y1: 0.68)),
          let rightCheek = region(Region(x0: 0.62, y0: 0.48, x1: 0.87, y1: 0.68)),
          let nose = region(Region(x0: 0.43, y0: 0.42, x1: 0.57, y1: 0.66)),
          let chin = region(Region(x0: 0.35, y0: 0.75, x1: 0.65, y1: 0.88)),
          [forehead, leftCheek, rightCheek, nose, chin].allSatisfy({ $0.sampleCount >= 32 })
    else { return ["state": "REGIONS_UNUSABLE"] }
    let brightness = (leftCheek.brightness + rightCheek.brightness) / 2
    let clipping = (leftCheek.clipping + rightCheek.clipping) / 2
    let sharpness = (leftCheek.texture + rightCheek.texture) / 2
    // Conservative extrema only: face-tone-dependent exposure thresholds need
    // the diverse-device/skin-tone validation package before promotion.
    if brightness < 20 { return ["state": "TOO_DARK"] }
    if brightness > 235 || clipping > 0.18 { return ["state": "OVEREXPOSED"] }
    if sharpness < 2.5 { return ["state": "BLURRY"] }

    return [
      "state": "PASS",
      "metrics": [
        "cheekBrightness": brightness,
        "cheekRedness": (leftCheek.redness + rightCheek.redness) / 2,
        "surfaceShine": (forehead.shine + nose.shine) / 2,
        "cheekTexture": sharpness,
        "brightEdgeDensity": (leftCheek.brightEdges + rightCheek.brightEdges + chin.brightEdges) / 3,
        "clippingFraction": clipping
      ],
      // QA-only per-zone measurements. No pixel array, image, landmark,
      // bounding box, face template, appearance label, or confidence crosses.
      "qaSampleZones": [
        "revision": "FACE_BOX_SAMPLE_ZONES_V0_1",
        "forehead": qaMeasures(forehead),
        "leftCheek": qaMeasures(leftCheek),
        "rightCheek": qaMeasures(rightCheek),
        "nose": qaMeasures(nose),
        "chin": qaMeasures(chin)
      ]
    ]
  }

  private static func qaMeasures(_ values: Measures) -> [String: Any] {
    return [
      "sampleCount": values.sampleCount,
      "brightness": values.brightness,
      "redColorIndex": values.redness,
      "brightPixelFraction": values.shine,
      "edgeMagnitude": values.texture,
      "brightEdgeFraction": values.brightEdges,
      "clippingFraction": values.clipping
    ]
  }

  private static func measure(_ rgba: [UInt8], _ width: Int, _ height: Int, _ box: Region) -> Measures {
    let x0 = max(1, min(width - 2, Int(box.x0)))
    let y0 = max(1, min(height - 2, Int(box.y0)))
    let x1 = max(x0 + 1, min(width - 1, Int(box.x1)))
    let y1 = max(y0 + 1, min(height - 1, Int(box.y1)))
    var count = 0
    var brightness = 0.0
    var redness = 0.0
    var shine = 0.0
    var texture = 0.0
    var brightEdges = 0.0
    var clipping = 0.0
    func luminance(_ x: Int, _ y: Int) -> Double {
      let i = (y * width + x) * 4
      return 0.2126 * Double(rgba[i]) + 0.7152 * Double(rgba[i + 1]) + 0.0722 * Double(rgba[i + 2])
    }
    for y in stride(from: y0, to: y1, by: 2) {
      for x in stride(from: x0, to: x1, by: 2) {
        let i = (y * width + x) * 4
        let r = Double(rgba[i]), g = Double(rgba[i + 1]), b = Double(rgba[i + 2])
        let luma = 0.2126 * r + 0.7152 * g + 0.0722 * b
        let edge = (abs(luma - luminance(x + 1, y)) + abs(luma - luminance(x, y + 1))) / 2
        count += 1
        brightness += luma
        redness += (r - (g + b) / 2) / (r + g + b + 1)
        if min(r, g, b) > 190 && max(r, g, b) > 230 { shine += 1 }
        texture += edge
        if luma > 170 && edge > 18 { brightEdges += 1 }
        if luma < 5 || luma > 250 { clipping += 1 }
      }
    }
    let denominator = Double(max(1, count))
    return Measures(sampleCount: count, brightness: brightness / denominator,
                    redness: redness / denominator, shine: shine / denominator,
                    texture: texture / denominator, brightEdges: brightEdges / denominator,
                    clipping: clipping / denominator)
  }
}
