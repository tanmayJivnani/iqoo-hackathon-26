package expo.modules.localtreeai

import android.content.Context
import android.net.Uri
import android.util.Log
import com.geniex.sdk.GenieXSdk
import com.geniex.sdk.LlmWrapper
import com.geniex.sdk.bean.ChatMessage
import com.geniex.sdk.bean.GenerationConfig
import com.geniex.sdk.bean.LlmCreateInput
import com.geniex.sdk.bean.LlmStreamResult
import com.geniex.sdk.bean.ModelConfig
import com.geniex.sdk.bean.SamplerConfig
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.withTimeout
import java.io.File
import java.io.DataInputStream

/** A text-only engine. Never passes photographs or recordings to an LLM without those modalities. */
object QwenEngine {
  private const val FILE_NAME = "qwen3-4b-instruct.gguf"
  private val lock = Any()
  private fun file(context: Context) = File(context.filesDir, FILE_NAME)

  fun status(context: Context): Map<String, Any> = mapOf(
    "installed" to (file(context).length() > 0),
    "modelName" to "Qwen3-4B-Instruct (GGUF)",
    "vision" to false,
    "audio" to false
  )

  fun importModel(context: Context, uri: String): Map<String, Any> = synchronized(lock) {
    val temporary = File(context.filesDir, "$FILE_NAME.importing")
    try {
      val input = context.contentResolver.openInputStream(Uri.parse(uri))
        ?: error("Could not open the GGUF file. Export it from GenieX and select it in Files.")
      input.use { source -> temporary.outputStream().use { output -> source.copyTo(output) } }
      val header = ByteArray(4)
      DataInputStream(temporary.inputStream()).use { it.readFully(header) }
      require(header.contentEquals("GGUF".toByteArray())) { "Select a GGUF model file, not a MediaPipe .task or an archive." }
      check(temporary.renameTo(file(context))) { "Could not save the model. Check free storage and retry." }
      status(context)
    } finally { temporary.delete() }
  }

  fun generate(context: Context, prompt: String): String = synchronized(lock) {
    require(prompt.length in 1..14000) { "Please keep observations under 10,000 characters." }
    require(file(context).length() > 0) { "Import your Qwen GGUF model in AI settings first." }
    runBlocking(Dispatchers.IO) {
      GenieXSdk.getInstance().init(context)
      // Run the GGUF on this Snapdragon phone's Hexagon NPU. Keep the app foregrounded during inference.
      val llm = LlmWrapper.builder().llmCreateInput(LlmCreateInput(
        model_path = file(context).absolutePath,
        config = ModelConfig(nCtx = 4096, nThreads = 4, nThreadsBatch = 4, nBatch = 256, nUBatch = 128, nGpuLayers = 999), runtime_id = "llama_cpp", compute_unit = "npu"
      )).build().getOrThrow()
      Log.i("LocalQwen", "Model loaded")
      try {
        withTimeout(180_000) {
          val formatted = llm.applyChatTemplate(arrayOf(ChatMessage("user", prompt)), null, false).getOrThrow()
          Log.i("LocalQwen", "Chat template prepared")
          val output = StringBuilder()
          llm.generateStreamFlow(formatted.formattedText, GenerationConfig(
            maxTokens = 900, samplerConfig = SamplerConfig(temperature = 0.1f, topP = 0.8f)
          )).collect { result ->
            when (result) {
              is LlmStreamResult.Token -> output.append(result.text)
              is LlmStreamResult.Error -> throw result.throwable
              is LlmStreamResult.Completed -> Log.i("LocalQwen", "Generation completed")
            }
          }
          check(output.isNotBlank()) { "Qwen returned no text. Retry or choose Cloud AI." }
          output.toString()
        }
      } finally {
        // Release weights after each task so camera/recording and other apps retain memory.
        Log.i("LocalQwen", "Releasing model")
        llm.stopStream()
        llm.close()
        Log.i("LocalQwen", "Model released")
      }
    }
  }
}
