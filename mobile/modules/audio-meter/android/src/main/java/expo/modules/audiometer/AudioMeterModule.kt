package expo.modules.audiometer

import android.Manifest
import android.content.pm.PackageManager
import android.media.AudioFormat
import android.media.AudioManager
import android.media.AudioRecord
import android.media.MediaRecorder
import androidx.core.content.ContextCompat
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.File
import java.io.FileOutputStream
import java.io.RandomAccessFile
import java.util.UUID
import java.util.concurrent.atomic.AtomicBoolean
import kotlin.math.max
import kotlin.math.min

class AudioMeterModule : Module() {
  private val lifecycle = Any()
  private val metricsLock = Any()
  private val running = AtomicBoolean(false)
  private var worker: Thread? = null
  private var recorder: AudioRecord? = null
  private var output: File? = null
  private var failure: Exception? = null
  private var metrics = AudioMetrics()
  private var currentDbfs = -160.0
  private var currentDba = 0.0
  private var audioSource = ""

  override fun definition() = ModuleDefinition {
    Name("AudioMeter")
    Function("isAvailable") {
      AudioRecord.getMinBufferSize(AudioMetrics.SAMPLE_RATE, AudioFormat.CHANNEL_IN_MONO, AudioFormat.ENCODING_PCM_16BIT) > 0
    }
    AsyncFunction("startRecording") { synchronized(lifecycle) { start() } }
    Function("getCurrentLevel") {
      synchronized(metricsLock) {
        mapOf("isRecording" to running.get(), "durationMs" to metrics.durationMs,
          "currentDbfs" to currentDbfs, "currentDba" to currentDba,
          "peakDbfs" to metrics.peakDbfs, "peakDba" to metrics.peakDba)
      }
    }
    AsyncFunction("stopRecording") {
      synchronized(lifecycle) {
        if (output == null) throw IllegalStateException("No measurement is active.")
        stopWorker()
        val file = output!!
        output = null
        val error = synchronized(metricsLock) { failure }
        if (error != null) { file.delete(); throw IllegalStateException("Audio capture failed. Please record again.", error) }
        synchronized(metricsLock) {
          if (metrics.durationMs < 5000) { file.delete(); throw IllegalStateException("Record at least five seconds. Please try again.") }
          writeHeader(file, metrics.sampleCount * 2)
          mapOf("uri" to "file://${file.absolutePath}", "durationMs" to metrics.durationMs,
            "sampleCount" to metrics.sampleCount, "averageDbfs" to metrics.averageDbfs,
            "peakDbfs" to metrics.peakDbfs, "averageDba" to metrics.averageDba,
            "peakDba" to metrics.peakDba, "usable" to (metrics.peakDbfs > -60),
            "audioSource" to audioSource, "calibrationOffsetDb" to AudioMetrics.NOMINAL_OFFSET_DB)
        }
      }
    }
    AsyncFunction("cancelRecording") { synchronized(lifecycle) { cancel(); true } }
    OnDestroy { synchronized(lifecycle) { cancel() } }
  }

  private fun start(): Map<String, Any> {
    val context = appContext.reactContext ?: throw IllegalStateException("React context unavailable.")
    if (ContextCompat.checkSelfPermission(context, Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
      throw SecurityException("Microphone permission is required.")
    }
    if (output != null || worker != null) throw IllegalStateException("A measurement is already active.")
    val minimum = AudioRecord.getMinBufferSize(AudioMetrics.SAMPLE_RATE, AudioFormat.CHANNEL_IN_MONO, AudioFormat.ENCODING_PCM_16BIT)
    if (minimum <= 0) throw IllegalStateException("Audio capture is unavailable on this device.")
    val bufferBytes = max(minimum * 2, 4096)
    val manager = context.getSystemService(android.content.Context.AUDIO_SERVICE) as AudioManager
    val sources = mutableListOf<Int>()
    if (manager.getProperty(AudioManager.PROPERTY_SUPPORT_AUDIO_SOURCE_UNPROCESSED) == "true") sources.add(MediaRecorder.AudioSource.UNPROCESSED)
    sources.add(MediaRecorder.AudioSource.VOICE_RECOGNITION)
    // Avoid MIC/DEFAULT: device gain control can invalidate even a nominal estimate.
    var selected: AudioRecord? = null
    for (source in sources) {
      var candidate: AudioRecord? = null
      try {
        candidate = AudioRecord(source, AudioMetrics.SAMPLE_RATE, AudioFormat.CHANNEL_IN_MONO, AudioFormat.ENCODING_PCM_16BIT, bufferBytes)
        if (candidate.state != AudioRecord.STATE_INITIALIZED) throw IllegalStateException("Audio input not initialized.")
        candidate.startRecording()
        if (candidate.recordingState != AudioRecord.RECORDSTATE_RECORDING) throw IllegalStateException("Audio input did not start.")
        selected = candidate
        audioSource = if (source == MediaRecorder.AudioSource.UNPROCESSED) "UNPROCESSED" else "VOICE_RECOGNITION"
        break
      } catch (_: Exception) { candidate?.release() }
    }
    val input = selected ?: throw IllegalStateException("An unprocessed audio input could not be started. Please retry.")
    val file = File(context.cacheDir, "noise_${UUID.randomUUID()}.wav")
    val stream = try { FileOutputStream(file).also { it.write(ByteArray(44)) } }
      catch (error: Exception) { input.stop(); input.release(); file.delete(); throw error }
    synchronized(metricsLock) { metrics = AudioMetrics(); failure = null; currentDbfs = -160.0; currentDba = 0.0 }
    output = file
    recorder = input
    running.set(true)
    worker = Thread({
      val pcm = ShortArray(bufferBytes / 2)
      val bytes = ByteArray(bufferBytes)
      val filter = AWeighting()
      try {
        while (running.get()) {
          val read = input.read(pcm, 0, pcm.size)
          if (read <= 0) {
            if (!running.get()) break
            throw IllegalStateException("Microphone read failed ($read).")
          }
          val remaining = synchronized(metricsLock) { AudioMetrics.SAMPLE_RATE * 30L - metrics.sampleCount }
          val count = min(read.toLong(), remaining).toInt()
          if (count <= 0) break
          val block = AudioMetrics()
          for (i in 0 until count) {
            bytes[i * 2] = (pcm[i].toInt() and 255).toByte()
            bytes[i * 2 + 1] = ((pcm[i].toInt() shr 8) and 255).toByte()
            val raw = pcm[i].toDouble() / 32768.0
            block.add(raw, filter.process(raw))
          }
          stream.write(bytes, 0, count * 2)
          synchronized(metricsLock) { metrics.merge(block); currentDbfs = block.averageDbfs; currentDba = block.averageDba }
          if (count < read || synchronized(metricsLock) { metrics.durationMs >= 30_000 }) break
        }
      } catch (error: Exception) { synchronized(metricsLock) { failure = error } }
      finally {
        running.set(false)
        try { input.stop() } catch (_: Exception) {}
        input.release()
        try { stream.close() } catch (error: Exception) { synchronized(metricsLock) { failure = error } }
      }
    }, "AudioMeter-PCM").also { it.start() }
    return mapOf("started" to true, "sampleRate" to AudioMetrics.SAMPLE_RATE)
  }

  private fun stopWorker() {
    running.set(false)
    // Stop unblocks AudioRecord.read; never finalize/delete a file still being written.
    try { recorder?.stop() } catch (_: Exception) {}
    worker?.join(2000)
    if (worker?.isAlive == true) throw IllegalStateException("Microphone is still stopping. Please retry.")
    worker = null
    recorder = null
  }

  private fun cancel() {
    stopWorker()
    output?.delete()
    output = null
  }

  private fun writeHeader(file: File, dataBytes: Long) {
    val header = java.nio.ByteBuffer.allocate(44).order(java.nio.ByteOrder.LITTLE_ENDIAN)
    header.put("RIFF".toByteArray()); header.putInt((dataBytes + 36).toInt()); header.put("WAVEfmt ".toByteArray())
    header.putInt(16); header.putShort(1); header.putShort(1); header.putInt(AudioMetrics.SAMPLE_RATE)
    header.putInt(AudioMetrics.SAMPLE_RATE * 2); header.putShort(2); header.putShort(16)
    header.put("data".toByteArray()); header.putInt(dataBytes.toInt())
    RandomAccessFile(file, "rw").use { it.seek(0); it.write(header.array()) }
  }
}
