package expo.modules.localtreeai

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.net.Uri
import android.os.SystemClock
import android.os.PowerManager
import android.util.Log
import com.geniex.sdk.GenieXSdk
import com.geniex.sdk.bean.*
import java.io.DataInputStream
import java.io.File
import java.net.URL
import java.util.UUID

/** Qwen3.5 uses a GGUF language model and matching vision projector. */
object QwenEngine {
  private val lock = Any()
  // Bound only the temporary AI input. Original evidence remains full resolution.
  private const val MAX_ANALYSIS_EDGE = 512
  private const val MAX_DECODE_EDGE = 1024
  private const val ANALYSIS_JPEG_QUALITY = 85
  private fun directory(context: Context) = File(context.filesDir, "qwen35-4b")
  fun status(context: Context): Map<String, Any> {
    val installed = File(directory(context), "model.gguf").length() > 0 && File(directory(context), "mmproj.gguf").length() > 0
    return mapOf("installed" to installed, "modelName" to "Qwen3.5-4B (GGUF - Multimodal)", "vision" to installed, "audio" to false)
  }
  private fun open(context: Context, uri: String) = if (uri.startsWith("http://") || uri.startsWith("https://")) {
    URL(uri).openConnection().apply { connectTimeout = 15000; readTimeout = 30000 }.getInputStream()
  } else context.contentResolver.openInputStream(Uri.parse(uri)) ?: error("Could not read the selected file")
  private fun copyGguf(context: Context, uri: String, target: File) {
    open(context, uri).use { input -> target.outputStream().use { input.copyTo(it) } }
    val header = ByteArray(4)
    DataInputStream(target.inputStream()).use { it.readFully(header) }
    require(header.contentEquals("GGUF".toByteArray())) { "Both files must be GGUF: the Qwen3.5 model and matching mmproj." }
  }
  fun importModel(context: Context, uri: String, projectorUri: String): Map<String, Any> = synchronized(lock) {
    val target = directory(context)
    val staging = File(context.filesDir, "qwen35-4b-import-${UUID.randomUUID()}").apply { mkdirs() }
    val backup = File(context.filesDir, "qwen35-4b-backup-${UUID.randomUUID()}")
    try {
      copyGguf(context, uri, File(staging, "model.gguf"))
      copyGguf(context, projectorUri, File(staging, "mmproj.gguf"))
      if (target.exists()) check(target.renameTo(backup)) { "Could not replace existing model" }
      if (!staging.renameTo(target)) {
        if (backup.exists()) check(backup.renameTo(target)) { "Could not restore the previous model" }
        error("Could not save Qwen3.5. Check free storage and retry.")
      }
      backup.deleteRecursively()
      status(context)
    } finally { staging.deleteRecursively() }
  }
  private fun image(context: Context, uri: String, target: File): String {
    val source = File(target.parentFile, "source-${target.name}")
    try {
      open(context, uri).use { input -> source.outputStream().use { input.copyTo(it) } }
      val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
      BitmapFactory.decodeFile(source.path, bounds)
      require(bounds.outWidth > 0 && bounds.outHeight > 0) { "Could not decode evidence image" }
      val options = BitmapFactory.Options().apply {
        inSampleSize = 1
        while (maxOf(bounds.outWidth, bounds.outHeight) / inSampleSize > MAX_DECODE_EDGE) inSampleSize *= 2
      }
      val bitmap = BitmapFactory.decodeFile(source.path, options) ?: error("Could not decode evidence image")
      val scale = minOf(1f, MAX_ANALYSIS_EDGE.toFloat() / maxOf(bitmap.width, bitmap.height))
      val resized = Bitmap.createScaledBitmap(bitmap, maxOf(1, (bitmap.width * scale).toInt()), maxOf(1, (bitmap.height * scale).toInt()), true)
      Log.i("LocalQwen", "AI image ${bounds.outWidth}x${bounds.outHeight} -> ${resized.width}x${resized.height}")
      try { target.outputStream().use { check(resized.compress(Bitmap.CompressFormat.JPEG, ANALYSIS_JPEG_QUALITY, it)) } }
      finally { if (resized !== bitmap) resized.recycle(); bitmap.recycle() }
      return target.path
    } finally { source.delete() }
  }
  fun generate(context: Context, prompt: String, imageUris: List<String>, audioUri: String?): String = synchronized(lock) {
    require(prompt.length in 1..14000 && imageUris.size <= 3) { "Evidence or prompt exceeds the local model limit" }
    require(audioUri == null) { "Audio is not supplied for AI analysis; use measured dB levels." }
    require(status(context)["installed"] == true) { "Import Qwen3.5-4B and its matching mmproj first." }
    val temporary = File(context.cacheDir, "qwen35-evidence-${UUID.randomUUID()}").apply { mkdirs() }
    val wakeLock = (context.getSystemService(Context.POWER_SERVICE) as PowerManager).newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "PuneReports:QwenInference")
    wakeLock.acquire(1200000)
    val vlm = QwenRuntime()
    var handle = 0L
    try {
      val images = imageUris.mapIndexed { i, uri -> image(context, uri, File(temporary, "$i.jpg")) }
      GenieXSdk.getInstance().init(context)
      handle = vlm.create(VlmCreateInput(model_path = File(directory(context), "model.gguf").path,
        mmproj_path = File(directory(context), "mmproj.gguf").path,
        config = ModelConfig(nCtx = 4096, nThreads = 4, nThreadsBatch = 4, nBatch = 256, nUBatch = 128, nGpuLayers = 999),
        runtime_id = "llama_cpp", compute_unit = "npu"))
      check(handle != 0L) { "Qwen3.5 model could not be loaded" }
      val capabilities = vlm.getCapabilities(handle)
      check(capabilities.supportsVision) { "Qwen3.5 projector could not load with vision support. Import the matching mmproj." }
      Log.i("LocalQwen", "Qwen3.5 loaded with vision")
      // Match Qwen3.5 single-turn ChatML with thinking disabled. GenieX mtmd
      // replaces the media markers with embeddings from the vision projector.
      val safePrompt = prompt.replace("<|", "< | ").replace("|>", " | >").replace("<__media__>", "[media marker]")
      val mediaMarkers = "<__media__>".repeat(images.size)
      val formatted = "<|im_start|>system\nYou are a helpful multimodal assistant.<|im_end|>\n<|im_start|>user\n$mediaMarkers$safePrompt<|im_end|>\n<|im_start|>assistant\n<think>\n\n</think>\n\n"
      val deadline = SystemClock.elapsedRealtime() + 900000
      var completion: String? = null
      vlm.generate(handle, formatted, GenerationConfig(maxTokens = 900,
        samplerConfig = SamplerConfig(temperature = 0.1f, topP = 0.8f), imagePaths = images.toTypedArray(), imageCount = images.size,
        audioPaths = null, audioCount = 0), object : LLMTokenCallback {
          override fun onToken(token: String) = SystemClock.elapsedRealtime() < deadline
          override fun onComplete(result: LlmGenerateResult) { completion = result.fullText }
        })
      check(SystemClock.elapsedRealtime() < deadline) { "Qwen3.5 analysis timed out. Keep the app open and retry." }
      // The SDK returns null when a callback is used; its completion callback holds full text.
      val output = completion
      check(!output.isNullOrBlank()) { "Qwen3.5 returned no completion. Retry." }
      output
    } finally {
      try { if (handle != 0L) vlm.destroy(handle) }
      finally { temporary.deleteRecursively(); if (wakeLock.isHeld) wakeLock.release(); Log.i("LocalQwen", "Qwen3.5 released") }
    }
  }
}
