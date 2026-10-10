package expo.modules.localtreeai

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.media.MediaCodec
import android.media.MediaExtractor
import android.media.MediaFormat
import android.net.Uri
import android.os.SystemClock
import android.os.PowerManager
import android.util.Log
import com.geniex.sdk.GenieXSdk
import com.geniex.sdk.bean.*
import java.io.DataInputStream
import java.io.File
import java.net.URL
import java.nio.ByteBuffer
import java.nio.ByteOrder
import java.util.UUID

/** Omni's GGUF understands images/audio; video and speech output are not supported. */
object QwenEngine {
  private val lock = Any()
  private fun directory(context: Context) = File(context.filesDir, "qwen25-omni")
  fun status(context: Context): Map<String, Any> {
    val installed = File(directory(context), "model.gguf").length() > 0 && File(directory(context), "mmproj.gguf").length() > 0
    return mapOf("installed" to installed, "modelName" to "Qwen2.5-Omni-7B (GGUF)", "vision" to installed, "audio" to installed)
  }
  private fun open(context: Context, uri: String) = if (uri.startsWith("http://") || uri.startsWith("https://")) {
    URL(uri).openConnection().apply { connectTimeout = 15000; readTimeout = 30000 }.getInputStream()
  } else context.contentResolver.openInputStream(Uri.parse(uri)) ?: error("Could not read the selected file")
  private fun copyGguf(context: Context, uri: String, target: File) {
    open(context, uri).use { input -> target.outputStream().use { input.copyTo(it) } }
    val header = ByteArray(4)
    DataInputStream(target.inputStream()).use { it.readFully(header) }
    require(header.contentEquals("GGUF".toByteArray())) { "Both files must be GGUF: the Omni model and matching mmproj." }
  }
  fun importModel(context: Context, uri: String, projectorUri: String): Map<String, Any> = synchronized(lock) {
    val target = directory(context)
    val staging = File(context.filesDir, "qwen25-omni-import-${UUID.randomUUID()}").apply { mkdirs() }
    val backup = File(context.filesDir, "qwen25-omni-backup-${UUID.randomUUID()}")
    try {
      copyGguf(context, uri, File(staging, "model.gguf"))
      copyGguf(context, projectorUri, File(staging, "mmproj.gguf"))
      if (target.exists()) check(target.renameTo(backup)) { "Could not replace existing model" }
      if (!staging.renameTo(target)) {
        if (backup.exists()) check(backup.renameTo(target)) { "Could not restore the previous model" }
        error("Could not save Omni. Check free storage and retry.")
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
        while (maxOf(bounds.outWidth, bounds.outHeight) / inSampleSize > 1280) inSampleSize *= 2
      }
      val bitmap = BitmapFactory.decodeFile(source.path, options) ?: error("Could not decode evidence image")
      val scale = minOf(1f, 640f / maxOf(bitmap.width, bitmap.height))
      val resized = Bitmap.createScaledBitmap(bitmap, maxOf(1, (bitmap.width * scale).toInt()), maxOf(1, (bitmap.height * scale).toInt()), true)
      try { target.outputStream().use { check(resized.compress(Bitmap.CompressFormat.JPEG, 90, it)) } }
      finally { if (resized !== bitmap) resized.recycle(); bitmap.recycle() }
      return target.path
    } finally { source.delete() }
  }
  // mtmd expects WAV. Decode AAC/M4A as well as native WAV recordings into mono 16 kHz PCM.
  private fun audio(context: Context, uri: String, target: File): String {
    val source = File(target.parentFile, "source-audio")
    val extractor = MediaExtractor()
    var codec: MediaCodec? = null
    try {
      open(context, uri).use { input -> source.outputStream().use { input.copyTo(it) } }
      extractor.setDataSource(source.path)
      val track = (0 until extractor.trackCount).firstOrNull { extractor.getTrackFormat(it).getString(MediaFormat.KEY_MIME)?.startsWith("audio/") == true } ?: error("Recording contains no audio")
      extractor.selectTrack(track)
      val format = extractor.getTrackFormat(track)
      if (format.containsKey(MediaFormat.KEY_DURATION)) require(format.getLong(MediaFormat.KEY_DURATION) <= 31_000_000) { "Use a recording of 30 seconds or less" }
      codec = MediaCodec.createDecoderByType(format.getString(MediaFormat.KEY_MIME)!!)
      codec.configure(format, null, null, 0); codec.start()
      var rate = format.getInteger(MediaFormat.KEY_SAMPLE_RATE)
      var channels = format.getInteger(MediaFormat.KEY_CHANNEL_COUNT)
      var floatPcm = false
      val samples = ArrayList<Float>()
      val info = MediaCodec.BufferInfo()
      var inputEnded = false
      var outputEnded = false
      val deadline = SystemClock.elapsedRealtime() + 30000
      while (!outputEnded) {
        check(SystemClock.elapsedRealtime() < deadline) { "Audio decoding timed out" }
        if (!inputEnded) {
          val index = codec.dequeueInputBuffer(10000)
          if (index >= 0) {
            val size = extractor.readSampleData(codec.getInputBuffer(index)!!, 0)
            if (size < 0) { codec.queueInputBuffer(index, 0, 0, 0, MediaCodec.BUFFER_FLAG_END_OF_STREAM); inputEnded = true }
            else { codec.queueInputBuffer(index, 0, size, extractor.sampleTime, 0); extractor.advance() }
          }
        }
        val index = codec.dequeueOutputBuffer(info, 10000)
        if (index == MediaCodec.INFO_OUTPUT_FORMAT_CHANGED) {
          val output = codec.outputFormat
          rate = output.getInteger(MediaFormat.KEY_SAMPLE_RATE); channels = output.getInteger(MediaFormat.KEY_CHANNEL_COUNT)
          val encoding = if (output.containsKey(MediaFormat.KEY_PCM_ENCODING)) output.getInteger(MediaFormat.KEY_PCM_ENCODING) else 2
          require(encoding == 2 || encoding == 4) { "Unsupported recording PCM format" }; floatPcm = encoding == 4
        } else if (index >= 0) {
          val buffer = codec.getOutputBuffer(index)!!.duplicate().order(ByteOrder.LITTLE_ENDIAN)
          buffer.position(info.offset); buffer.limit(info.offset + info.size)
          while (buffer.remaining() >= channels * if (floatPcm) 4 else 2) {
            var mono = 0f
            repeat(channels) { mono += if (floatPcm) buffer.float else buffer.short / 32768f }
            samples.add(mono / channels)
            require(samples.size <= rate * 31) { "Use a recording of 30 seconds or less" }
          }
          codec.releaseOutputBuffer(index, false)
          outputEnded = info.flags and MediaCodec.BUFFER_FLAG_END_OF_STREAM != 0
        }
      }
      require(samples.isNotEmpty()) { "Recording contains no decoded samples" }
      val count = (samples.size.toLong() * 16000 / rate).toInt()
      val wav = ByteBuffer.allocate(44 + count * 2).order(ByteOrder.LITTLE_ENDIAN)
      wav.put("RIFF".toByteArray()).putInt(36 + count * 2).put("WAVEfmt ".toByteArray()).putInt(16).putShort(1).putShort(1).putInt(16000).putInt(32000).putShort(2).putShort(16).put("data".toByteArray()).putInt(count * 2)
      repeat(count) { n ->
        val pos = n * rate.toDouble() / 16000
        val i = pos.toInt().coerceAtMost(samples.lastIndex)
        val next = minOf(i + 1, samples.lastIndex)
        val sample = samples[i] + (samples[next] - samples[i]) * (pos - i).toFloat()
        wav.putShort((sample.coerceIn(-1f, 1f) * 32767).toInt().toShort())
      }
      target.writeBytes(wav.array()); return target.path
    } finally { codec?.runCatching { stop() }; codec?.release(); extractor.release(); source.delete() }
  }
  fun generate(context: Context, prompt: String, imageUris: List<String>, audioUri: String?): String = synchronized(lock) {
    require(prompt.length in 1..14000 && imageUris.size <= 3) { "Evidence or prompt exceeds the local model limit" }
    require(status(context)["installed"] == true) { "Import Qwen2.5-Omni-7B and its matching mmproj first." }
    val temporary = File(context.cacheDir, "omni-evidence-${UUID.randomUUID()}").apply { mkdirs() }
    val wakeLock = (context.getSystemService(Context.POWER_SERVICE) as PowerManager).newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "PuneReports:OmniInference")
    wakeLock.acquire(1200000)
    val vlm = OmniRuntime()
    var handle = 0L
    try {
      val images = imageUris.mapIndexed { i, uri -> image(context, uri, File(temporary, "$i.jpg")) }
      val recording = audioUri?.let { audio(context, it, File(temporary, "recording.wav")) }
      GenieXSdk.getInstance().init(context)
      handle = vlm.create(VlmCreateInput(model_path = File(directory(context), "model.gguf").path,
        mmproj_path = File(directory(context), "mmproj.gguf").path,
        config = ModelConfig(nCtx = 4096, nThreads = 4, nThreadsBatch = 4, nBatch = 256, nUBatch = 128, nGpuLayers = 999),
        runtime_id = "llama_cpp", compute_unit = "npu"))
      check(handle != 0L) { "Omni model could not be loaded" }
      val capabilities = vlm.getCapabilities(handle)
      check(capabilities.supportsVision && capabilities.supportsAudio) { "Omni projector could not load with vision and audio support. Import the matching mmproj." }
      Log.i("LocalQwen", "Omni loaded with vision and audio")
      // Omni uses ChatML. Build its single-turn prompt directly: GenieX 0.4.0's
      // generic Jinja template path stalls for this model's multimodal template.
      // These are the same mtmd media markers used by GenieX's VLM adapter.
      val safePrompt = prompt.replace("<|", "< | ").replace("|>", " | >").replace("<__media__>", "[media marker]")
      val mediaMarkers = "<__media__>".repeat(images.size + if (recording != null) 1 else 0)
      val formatted = "<|im_start|>system\nYou are a helpful multimodal assistant.<|im_end|>\n<|im_start|>user\n$mediaMarkers$safePrompt<|im_end|>\n<|im_start|>assistant\n"
      val deadline = SystemClock.elapsedRealtime() + 900000
      var completion: String? = null
      vlm.generate(handle, formatted, GenerationConfig(maxTokens = 900,
        samplerConfig = SamplerConfig(temperature = 0.1f, topP = 0.8f), imagePaths = images.toTypedArray(), imageCount = images.size,
        audioPaths = recording?.let { arrayOf(it) }, audioCount = if (recording != null) 1 else 0), object : LLMTokenCallback {
          override fun onToken(token: String) = SystemClock.elapsedRealtime() < deadline
          override fun onComplete(result: LlmGenerateResult) { completion = result.fullText }
        })
      check(SystemClock.elapsedRealtime() < deadline) { "Omni analysis timed out. Keep the app open and retry." }
      // The SDK returns null when a callback is used; its completion callback holds full text.
      val output = completion
      check(!output.isNullOrBlank()) { "Omni returned no completion. Retry." }
      output
    } finally {
      try { if (handle != 0L) vlm.destroy(handle) }
      finally { temporary.deleteRecursively(); if (wakeLock.isHeld) wakeLock.release(); Log.i("LocalQwen", "Omni released") }
    }
  }
}
