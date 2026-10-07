package expo.modules.localtreeai

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.net.Uri
import com.google.mediapipe.framework.image.BitmapImageBuilder
import com.google.mediapipe.tasks.genai.llminference.GraphOptions
import com.google.mediapipe.tasks.genai.llminference.LlmInference
import com.google.mediapipe.tasks.genai.llminference.LlmInferenceSession
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import org.json.JSONObject
import java.io.File

class LocalTreeAIModule : Module() {
  private val modelName = "gemma-3n-E2B-it-int4.task"

  private fun modelFile(): File? {
    val context = appContext.reactContext ?: return null
    return File(context.filesDir, modelName).takeIf { it.exists() && it.length() > 0L }
  }

  override fun definition() = ModuleDefinition {
    Name("LocalTreeAI")

    Function("getModelStatus") {
      val model = modelFile()
      mapOf(
        "installed" to (model != null),
        "modelName" to modelName,
        "modelPath" to model?.absolutePath
      )
    }

    AsyncFunction("importModelFromUri") { uriString: String ->
      val context = appContext.reactContext ?: throw IllegalStateException("App context is unavailable")
      val target = File(context.filesDir, modelName)
      val source = context.contentResolver.openInputStream(Uri.parse(uriString))
        ?: throw IllegalArgumentException("Could not read the selected model file")
      source.use { input -> target.outputStream().use { output -> input.copyTo(output) } }
      mapOf("installed" to (target.exists() && target.length() > 0L), "modelPath" to target.absolutePath)
    }

    AsyncFunction("analyzePhoto") { photoUri: String, category: String, address: String ->
      val context = appContext.reactContext ?: throw IllegalStateException("App context is unavailable")
      val model = modelFile() ?: return@AsyncFunction mapOf("available" to false, "treeDetected" to true)
      val bitmap = context.contentResolver.openInputStream(Uri.parse(photoUri))?.use {
        BitmapFactory.decodeStream(it)
      } ?: throw IllegalArgumentException("Could not read the evidence photo")
      try {
        val prompt = """
          <start_of_turn>user
          Inspect the attached real-world photo as evidence for a Pune tree complaint.
          Determine whether a real tree, tree trunk, stump, foliage, or branch is visible.
          If no botanical tree subject is visible, return only JSON with tree_detected false and a short rejection_reason.
          If a tree is visible, assess the reported issue category $category near ${address.ifBlank { "Pune" }}.
          Return only JSON with tree_detected true, rejection_reason null, estimated_tree_species, visual_damage_summary, and urgency_level.
          <end_of_turn>
          <start_of_turn>model
        """.trimIndent()
        val options = LlmInference.LlmInferenceOptions.builder()
          .setModelPath(model.absolutePath)
          .setMaxTokens(512)
          .setMaxNumImages(1)
        val inference = try {
          LlmInference.createFromOptions(context, options.setPreferredBackend(LlmInference.Backend.GPU).build())
        } catch (_: Throwable) {
          LlmInference.createFromOptions(context, options.setPreferredBackend(LlmInference.Backend.DEFAULT).build())
        }
        val raw = try {
          val session = LlmInferenceSession.createFromOptions(
            inference,
            LlmInferenceSession.LlmInferenceSessionOptions.builder()
              .setGraphOptions(GraphOptions.builder().setEnableVisionModality(true).build())
              .build()
          )
          try {
            session.addQueryChunk(prompt)
            val scaled = scaleBitmap(bitmap, 1024)
            session.addImage(BitmapImageBuilder(scaled).build())
            session.generateResponse()
          } finally {
            session.close()
          }
        } finally {
          inference.close()
        }
        val jsonText = raw.substringAfter('{', "").let { if (it.isEmpty()) "" else "{$it" }
        val result = runCatching { JSONObject(jsonText) }.getOrNull()
        if (result == null) {
          mapOf("available" to true, "treeDetected" to true, "rawResponse" to raw)
        } else {
          mapOf(
            "available" to true,
            "treeDetected" to result.optBoolean("tree_detected", true),
            "rejectionReason" to result.optString("rejection_reason").takeIf { it.isNotBlank() && it != "null" },
            "estimatedTreeSpecies" to result.optString("estimated_tree_species").takeIf { it.isNotBlank() },
            "visualDamageSummary" to result.optString("visual_damage_summary").takeIf { it.isNotBlank() },
            "urgencyLevel" to result.optString("urgency_level").takeIf { it.isNotBlank() }
          )
        }
      } finally {
        if (!bitmap.isRecycled) bitmap.recycle()
      }
    }
  }

  private fun scaleBitmap(source: Bitmap, maxDimension: Int): Bitmap {
    val largest = maxOf(source.width, source.height)
    if (largest <= maxDimension) return source
    val ratio = maxDimension.toFloat() / largest.toFloat()
    return Bitmap.createScaledBitmap(
      source,
      (source.width * ratio).toInt().coerceAtLeast(1),
      (source.height * ratio).toInt().coerceAtLeast(1),
      true
    )
  }
}
