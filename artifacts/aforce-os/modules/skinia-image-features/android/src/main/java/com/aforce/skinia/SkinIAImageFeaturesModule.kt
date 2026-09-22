package com.aforce.skinia

import android.graphics.Bitmap
import android.graphics.Color
import com.google.android.gms.tasks.Tasks
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.face.FaceDetection
import com.google.mlkit.vision.face.FaceDetectorOptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.sharedobjects.SharedRef
import kotlin.math.abs
import kotlin.math.max
import kotlin.math.min
import kotlin.math.roundToInt

class SkinIAImageFeaturesModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("SkinIAImageFeatures")

    // No URI, encoding, image bytes or face coordinates cross the JS bridge.
    AsyncFunction("extractAsync") { picture: SharedRef<Bitmap> ->
      extract(picture.ref)
    }
  }
}

private data class Region(val x0: Double, val y0: Double, val x1: Double, val y1: Double)
private data class Measures(
  val brightness: Double, val redness: Double, val shine: Double,
  val texture: Double, val brightEdges: Double, val clipping: Double
)

private fun extract(source: Bitmap): Map<String, Any> {
  if (source.width < 480 || source.height < 480) return mapOf("state" to "DIMENSIONS_UNUSABLE")
  val factor = min(1.0, 640.0 / max(source.width, source.height))
  val width = (source.width * factor).roundToInt()
  val height = (source.height * factor).roundToInt()
  // This bitmap and the pixel array are temporary, in-memory working data.
  val image = Bitmap.createScaledBitmap(source, width, height, true)
  val options = FaceDetectorOptions.Builder()
    .setPerformanceMode(FaceDetectorOptions.PERFORMANCE_MODE_ACCURATE)
    .setLandmarkMode(FaceDetectorOptions.LANDMARK_MODE_ALL)
    .setClassificationMode(FaceDetectorOptions.CLASSIFICATION_MODE_ALL)
    .build()
  val detector = FaceDetection.getClient(options)
  try {
    val faces = Tasks.await(detector.process(InputImage.fromBitmap(image, 0)))
    if (faces.isEmpty()) return mapOf("state" to "NO_FACE")
    if (faces.size != 1) return mapOf("state" to "MULTIPLE_FACES")
    val face = faces.first()
    val box = face.boundingBox
    if (box.width() < width * 0.22 || box.height() < height * 0.22) return mapOf("state" to "FACE_TOO_SMALL")
    if (abs(face.headEulerAngleY) > 15 || abs(face.headEulerAngleZ) > 15) return mapOf("state" to "NOT_FRONTAL")
    if ((face.leftEyeOpenProbability ?: 1f) < 0.5f || (face.rightEyeOpenProbability ?: 1f) < 0.5f) {
      return mapOf("state" to "FACE_NOT_CLEAR")
    }
    val pixels = IntArray(width * height)
    image.getPixels(pixels, 0, width, 0, 0, width, height)
    fun region(unit: Region): Measures = measure(pixels, width, height, Region(
      box.left + unit.x0 * box.width(), box.top + unit.y0 * box.height(),
      box.left + unit.x1 * box.width(), box.top + unit.y1 * box.height()
    ))
    val forehead = region(Region(0.30, 0.12, 0.70, 0.28))
    val leftCheek = region(Region(0.13, 0.48, 0.38, 0.68))
    val rightCheek = region(Region(0.62, 0.48, 0.87, 0.68))
    val nose = region(Region(0.43, 0.42, 0.57, 0.66))
    val chin = region(Region(0.35, 0.75, 0.65, 0.88))
    val brightness = (leftCheek.brightness + rightCheek.brightness) / 2
    val clipping = (leftCheek.clipping + rightCheek.clipping) / 2
    val sharpness = (leftCheek.texture + rightCheek.texture) / 2
    // Conservative extrema only; device and skin-tone validation is pending.
    if (brightness < 20) return mapOf("state" to "TOO_DARK")
    if (brightness > 235 || clipping > 0.18) return mapOf("state" to "OVEREXPOSED")
    if (sharpness < 2.5) return mapOf("state" to "BLURRY")
    return mapOf(
      "state" to "PASS",
      "metrics" to mapOf(
        "cheekBrightness" to brightness,
        "cheekRedness" to (leftCheek.redness + rightCheek.redness) / 2,
        "surfaceShine" to (forehead.shine + nose.shine) / 2,
        "cheekTexture" to sharpness,
        "brightEdgeDensity" to (leftCheek.brightEdges + rightCheek.brightEdges + chin.brightEdges) / 3,
        "clippingFraction" to clipping
      )
    )
  } catch (_: Exception) {
    return mapOf("state" to "UNAVAILABLE")
  } finally {
    detector.close()
    // Never recycle source: Expo camera owns that SharedRef until JS releases it.
    if (image !== source) image.recycle()
  }
}

private fun measure(pixels: IntArray, width: Int, height: Int, box: Region): Measures {
  val x0 = box.x0.toInt().coerceIn(1, width - 2)
  val y0 = box.y0.toInt().coerceIn(1, height - 2)
  val x1 = box.x1.toInt().coerceIn(x0 + 1, width - 1)
  val y1 = box.y1.toInt().coerceIn(y0 + 1, height - 1)
  var count = 0.0
  var brightness = 0.0
  var redness = 0.0
  var shine = 0.0
  var texture = 0.0
  var brightEdges = 0.0
  var clipping = 0.0
  fun luminance(x: Int, y: Int): Double {
    val pixel = pixels[y * width + x]
    return 0.2126 * Color.red(pixel) + 0.7152 * Color.green(pixel) + 0.0722 * Color.blue(pixel)
  }
  for (y in y0 until y1 step 2) {
    for (x in x0 until x1 step 2) {
      val pixel = pixels[y * width + x]
      val r = Color.red(pixel).toDouble()
      val g = Color.green(pixel).toDouble()
      val b = Color.blue(pixel).toDouble()
      val luma = 0.2126 * r + 0.7152 * g + 0.0722 * b
      val edge = (abs(luma - luminance(x + 1, y)) + abs(luma - luminance(x, y + 1))) / 2
      count += 1
      brightness += luma
      redness += (r - (g + b) / 2) / (r + g + b + 1)
      if (min(r, min(g, b)) > 190 && max(r, max(g, b)) > 230) shine += 1
      texture += edge
      if (luma > 170 && edge > 18) brightEdges += 1
      if (luma < 5 || luma > 250) clipping += 1
    }
  }
  val denominator = max(1.0, count)
  return Measures(brightness / denominator, redness / denominator, shine / denominator,
    texture / denominator, brightEdges / denominator, clipping / denominator)
}
