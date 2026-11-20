// One Breath screen comparison (One Breath Final Build Spec, "Device checks").
//
// Puts an app capture beside the prototype screenshot at the same height and
// reports how different they are, so differences are listed from a picture and
// a number rather than from memory.
//
//   swift scripts/one-breath/compare-screens.swift <app.png> <prototype.png> <out.png>
//
// Output: <out.png> (app left, prototype right, difference map last) and one
// line with the mean difference, 0 (identical) to 100. macOS only (CoreGraphics).
// The number is a guide for where to look; the acceptance standard is still a
// person comparing the two on a device.
import Foundation
import CoreGraphics
import ImageIO
import UniformTypeIdentifiers

func load(_ path: String) -> CGImage {
  guard let src = CGImageSourceCreateWithURL(URL(fileURLWithPath: path) as CFURL, nil),
        let img = CGImageSourceCreateImageAtIndex(src, 0, nil) else {
    FileHandle.standardError.write("cannot open \(path)\n".data(using: .utf8)!); exit(1)
  }
  return img
}

func pixels(_ img: CGImage, _ w: Int, _ h: Int) -> [UInt8] {
  var buf = [UInt8](repeating: 0, count: w * h * 4)
  let ctx = CGContext(data: &buf, width: w, height: h, bitsPerComponent: 8, bytesPerRow: w * 4,
                      space: CGColorSpaceCreateDeviceRGB(), bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue)!
  ctx.interpolationQuality = .high
  ctx.draw(img, in: CGRect(x: 0, y: 0, width: w, height: h))
  return buf
}

let args = CommandLine.arguments
guard args.count == 4 else { print("usage: compare-screens.swift <app.png> <prototype.png> <out.png>"); exit(2) }
let app = load(args[1]), proto = load(args[2])

// Same size for both: the prototype's height, and the prototype's width.
let h = proto.height, w = proto.width
let a = pixels(app, w, h), p = pixels(proto, w, h)

var total = 0.0
var diff = [UInt8](repeating: 255, count: w * h * 4)
for i in stride(from: 0, to: w * h * 4, by: 4) {
  let d = (abs(Int(a[i]) - Int(p[i])) + abs(Int(a[i + 1]) - Int(p[i + 1])) + abs(Int(a[i + 2]) - Int(p[i + 2]))) / 3
  total += Double(d)
  diff[i] = UInt8(d); diff[i + 1] = UInt8(d); diff[i + 2] = UInt8(d)
}
let mean = total / Double(w * h) / 255.0 * 100.0

func image(_ buf: [UInt8]) -> CGImage {
  var b = buf
  let ctx = CGContext(data: &b, width: w, height: h, bitsPerComponent: 8, bytesPerRow: w * 4,
                      space: CGColorSpaceCreateDeviceRGB(), bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue)!
  return ctx.makeImage()!
}

let gap = 24
let sheet = CGContext(data: nil, width: w * 3 + gap * 2, height: h, bitsPerComponent: 8, bytesPerRow: 0,
                      space: CGColorSpaceCreateDeviceRGB(), bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue)!
sheet.setFillColor(CGColor(red: 0.5, green: 0.5, blue: 0.5, alpha: 1))
sheet.fill(CGRect(x: 0, y: 0, width: w * 3 + gap * 2, height: h))
for (n, img) in [image(a), image(p), image(diff)].enumerated() {
  sheet.draw(img, in: CGRect(x: n * (w + gap), y: 0, width: w, height: h))
}
let dest = CGImageDestinationCreateWithURL(URL(fileURLWithPath: args[3]) as CFURL, UTType.png.identifier as CFString, 1, nil)!
CGImageDestinationAddImage(dest, sheet.makeImage()!, nil)
guard CGImageDestinationFinalize(dest) else { print("cannot write \(args[3])"); exit(1) }

let ratio = Double(app.width) / Double(app.height), want = Double(w) / Double(h)
print(String(format: "app %dx%d  prototype %dx%d  mean difference %.2f / 100%@", app.width, app.height, w, h, mean,
             abs(ratio - want) > 0.01 ? "  (aspect ratios differ: the app capture was stretched to fit)" : ""))
