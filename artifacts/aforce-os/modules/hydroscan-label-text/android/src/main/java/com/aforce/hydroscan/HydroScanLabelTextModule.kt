package com.aforce.hydroscan

import android.graphics.Bitmap
import com.google.android.gms.tasks.Tasks
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.text.TextRecognition
import com.google.mlkit.vision.text.latin.TextRecognizerOptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.sharedobjects.SharedRef

class HydroScanLabelTextModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("HydroScanLabelText")

    // The Bitmap stays in memory. Recognised text goes back to JS only; nothing
    // is written to disk, sent anywhere or logged.
    AsyncFunction("recognizeAsync") { picture: SharedRef<Bitmap> ->
      recognize(picture.ref)
    }
  }
}

private const val MAX_LINES = 120

private fun recognize(source: Bitmap): Map<String, Any> {
  val width = source.width.toDouble()
  val height = source.height.toDouble()
  if (width <= 0.0 || height <= 0.0) return mapOf("state" to "UNAVAILABLE")
  // On-device Latin recognizer with the bundled model.
  val recognizer = TextRecognition.getClient(TextRecognizerOptions.DEFAULT_OPTIONS)
  try {
    val result = Tasks.await(recognizer.process(InputImage.fromBitmap(source, 0)))
    val lines = ArrayList<Map<String, Any>>()
    loop@ for (block in result.textBlocks) {
      for (line in block.lines) {
        val entry = HashMap<String, Any>()
        entry["text"] = line.text
        entry["confidence"] = line.confidence.toDouble()
        line.boundingBox?.let {
          entry["box"] = mapOf(
            "x" to it.left / width,
            "y" to it.top / height,
            "width" to it.width() / width,
            "height" to it.height() / height,
          )
        }
        lines.add(entry)
        if (lines.size >= MAX_LINES) break@loop
      }
    }
    return mapOf("state" to "OK", "lines" to lines)
  } catch (e: Exception) {
    return mapOf("state" to "UNAVAILABLE")
  } finally {
    recognizer.close()
  }
}
