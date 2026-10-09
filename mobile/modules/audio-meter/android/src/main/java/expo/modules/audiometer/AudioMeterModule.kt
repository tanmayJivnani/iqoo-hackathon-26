package expo.modules.audiometer

import android.Manifest
import android.content.pm.PackageManager
import android.media.AudioFormat
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
import kotlin.math.abs
import kotlin.math.log10
import kotlin.math.max
import kotlin.math.min
import kotlin.math.sqrt

class AudioMeterModule : Module() {
  private val sampleRate = 44100
  private val channelConfig = AudioFormat.CHANNEL_IN_MONO
  private val audioFormat = AudioFormat.ENCODING_PCM_16BIT
  private val calibrationOffsetDb = 96.0 // Nominal mobile SPL calibration constant

  private val isRecording = AtomicBoolean(false)
  private var recordThread: Thread? = null
  private var currentFile: File? = null

  // Live state
  private var liveDbfs: Double = -160.0
  private var liveDba: Double = 0.0
  private var peakDbfs: Double = -160.0
  private var peakDba: Double = 0.0
  private var sumEnergyDbfs: Double = 0.0
  private var sumEnergyDba: Double = 0.0
  private var totalSamplesCount: Long = 0
  private var recordingStartTimeMs: Long = 0
  private var recordedDurationMs: Long = 0

  private class Biquad(
    private val b0: Double, private val b1: Double, private val b2: Double,
    private val a1: Double, private val a2: Double
  ) {
    private var x1 = 0.0
    private var x2 = 0.0
    private var y1 = 0.0
    private var y2 = 0.0

    fun process(x: Double): Double {
      val y = b0 * x + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2
      x2 = x1
      x1 = x
      y2 = y1
      y1 = y
      return y
    }

    fun reset() {
      x1 = 0.0; x2 = 0.0; y1 = 0.0; y2 = 0.0
    }
  }

  override fun definition() = ModuleDefinition {
    Name("AudioMeter")

    Function("isAvailable") {
      val context = appContext.reactContext ?: return@Function false
      val hasPermission = ContextCompat.checkSelfPermission(
        context, Manifest.permission.RECORD_AUDIO
      ) == PackageManager.PERMISSION_GRANTED
      val minBuf = AudioRecord.getMinBufferSize(sampleRate, channelConfig, audioFormat)
      hasPermission && minBuf > 0
    }

    AsyncFunction("startRecording") {
      val context = appContext.reactContext ?: throw IllegalStateException("React context is unavailable")
      if (ContextCompat.checkSelfPermission(context, Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
        throw SecurityException("RECORD_AUDIO permission is required.")
      }
      if (isRecording.get()) {
        throw IllegalStateException("A measurement is already in progress.")
      }

      val minBufferSize = AudioRecord.getMinBufferSize(sampleRate, channelConfig, audioFormat)
      if (minBufferSize <= 0) {
        throw IllegalStateException("AudioRecord buffer size is invalid on this device.")
      }
      val bufferSize = max(minBufferSize * 2, 4096)

      // Prefer unprocessed / voice recognition to minimize aggressive OEM AGC
      var audioRecord: AudioRecord? = null
      val audioSources = intArrayOf(
        MediaRecorder.AudioSource.VOICE_RECOGNITION,
        MediaRecorder.AudioSource.MIC,
        MediaRecorder.AudioSource.DEFAULT
      )

      for (source in audioSources) {
        try {
          val candidate = AudioRecord(source, sampleRate, channelConfig, audioFormat, bufferSize)
          if (candidate.state == AudioRecord.STATE_INITIALIZED) {
            audioRecord = candidate
            break
          } else {
            candidate.release()
          }
        } catch (_: Exception) {}
      }

      val recorder = audioRecord ?: throw IllegalStateException("Could not initialize AudioRecord on any audio source.")

      // Prepare WAV output file in app cache
      val tempFile = File(context.cacheDir, "noise_${UUID.randomUUID()}.wav")
      currentFile = tempFile
      val fileOut = FileOutputStream(tempFile)
      // Reserve 44 bytes for WAV header
      fileOut.write(ByteArray(44))

      // Initialize IEC 61672 A-weighting cascaded biquads
      val k = 0.2555878203785167
      val bq1 = Biquad(k, -2.0 * k, k, -1.9941388812663284, 0.9941474694464522)
      val bq2 = Biquad(1.0, -2.0, 1.0, -1.884901217428792, 0.8864213795101683)
      val bq3 = Biquad(1.0, 2.0, 1.0, -0.14053608242071078, 0.0049376036154694465)

      liveDbfs = -160.0
      liveDba = 0.0
      peakDbfs = -160.0
      peakDba = 0.0
      sumEnergyDbfs = 0.0
      sumEnergyDba = 0.0
      totalSamplesCount = 0
      recordingStartTimeMs = System.currentTimeMillis()
      recordedDurationMs = 0
      isRecording.set(true)

      val thread = Thread({
        val audioBuffer = ShortArray(bufferSize / 2)
        val byteBuffer = ByteArray(bufferSize)

        try {
          recorder.startRecording()
          while (isRecording.get()) {
            val shortsRead = recorder.read(audioBuffer, 0, audioBuffer.size)
            if (shortsRead > 0) {
              var blockEnergyRaw = 0.0
              var blockEnergyWeighted = 0.0
              var blockPeakRaw = 0.0
              var blockPeakWeighted = 0.0

              for (i in 0 until shortsRead) {
                val rawShort = audioBuffer[i]
                // 16-bit PCM little endian into byte buffer
                val byteIndex = i * 2
                byteBuffer[byteIndex] = (rawShort.toInt() and 0xFF).toByte()
                byteBuffer[byteIndex + 1] = ((rawShort.toInt() shr 8) and 0xFF).toByte()

                val normalized = rawShort.toDouble() / 32768.0
                val absRaw = abs(normalized)
                if (absRaw > blockPeakRaw) blockPeakRaw = absRaw
                blockEnergyRaw += normalized * normalized

                // Apply A-weighting filter cascade
                val weighted = bq3.process(bq2.process(bq1.process(normalized)))
                val absWeighted = abs(weighted)
                if (absWeighted > blockPeakWeighted) blockPeakWeighted = absWeighted
                blockEnergyWeighted += weighted * weighted
              }

              fileOut.write(byteBuffer, 0, shortsRead * 2)

              // Compute block metrics
              val blockRmsRaw = sqrt(blockEnergyRaw / shortsRead)
              val blockRmsWeighted = sqrt(blockEnergyWeighted / shortsRead)

              val blockDbfs = if (blockRmsRaw > 1e-8) 20.0 * log10(blockRmsRaw) else -160.0
              val blockDba = if (blockRmsWeighted > 1e-8) 20.0 * log10(blockRmsWeighted) + calibrationOffsetDb else 0.0
              val blockPeakDbfs = if (blockPeakRaw > 1e-8) 20.0 * log10(blockPeakRaw) else -160.0
              val blockPeakDba = if (blockPeakWeighted > 1e-8) 20.0 * log10(blockPeakWeighted) + calibrationOffsetDb else 0.0

              liveDbfs = max(-160.0, min(0.0, blockDbfs))
              liveDba = max(0.0, blockDba)
              if (blockPeakDbfs > peakDbfs) peakDbfs = max(-160.0, min(0.0, blockPeakDbfs))
              if (blockPeakDba > peakDba) peakDba = blockPeakDba

              sumEnergyDbfs += blockEnergyRaw
              sumEnergyDba += blockEnergyWeighted
              totalSamplesCount += shortsRead
              recordedDurationMs = System.currentTimeMillis() - recordingStartTimeMs
            }
          }
        } catch (_: Exception) {
        } finally {
          try {
            recorder.stop()
            recorder.release()
          } catch (_: Exception) {}
          try {
            fileOut.flush()
            fileOut.close()
          } catch (_: Exception) {}
        }
      }, "AudioMeter-RecordThread")

      recordThread = thread
      thread.start()

      mapOf("started" to true, "sampleRate" to sampleRate)
    }

    Function("getCurrentLevel") {
      val now = System.currentTimeMillis()
      val duration = if (recordingStartTimeMs > 0) now - recordingStartTimeMs else 0L
      mapOf(
        "isRecording" to isRecording.get(),
        "durationMs" to duration,
        "currentDbfs" to liveDbfs,
        "currentDba" to liveDba,
        "peakDbfs" to peakDbfs,
        "peakDba" to peakDba
      )
    }

    AsyncFunction("stopRecording") {
      if (!isRecording.get()) {
        throw IllegalStateException("No measurement is currently active.")
      }
      isRecording.set(false)
      recordThread?.join(2000)
      recordThread = null

      val file = currentFile ?: throw IllegalStateException("Audio file not found.")
      val durationMs = recordedDurationMs

      // Finalize WAV header
      if (file.exists() && file.length() >= 44L) {
        val totalAudioLen = file.length() - 44L
        val totalDataLen = totalAudioLen + 36L
        val channels = 1
        val byteRate = (sampleRate * channels * 16 / 8).toLong()

        RandomAccessFile(file, "rw").use { raf ->
          raf.seek(0)
          val header = ByteArray(44)
          header[0] = 'R'.code.toByte(); header[1] = 'I'.code.toByte(); header[2] = 'F'.code.toByte(); header[3] = 'F'.code.toByte()
          header[4] = (totalDataLen and 0xffL).toByte(); header[5] = ((totalDataLen shr 8) and 0xffL).toByte()
          header[6] = ((totalDataLen shr 16) and 0xffL).toByte(); header[7] = ((totalDataLen shr 24) and 0xffL).toByte()
          header[8] = 'W'.code.toByte(); header[9] = 'A'.code.toByte(); header[10] = 'V'.code.toByte(); header[11] = 'E'.code.toByte()
          header[12] = 'f'.code.toByte(); header[13] = 'm'.code.toByte(); header[14] = 't'.code.toByte(); header[15] = ' '.code.toByte()
          header[16] = 16; header[17] = 0; header[18] = 0; header[19] = 0 // subchunk1 size
          header[20] = 1; header[21] = 0 // PCM format
          header[22] = channels.toByte(); header[23] = 0
          header[24] = (sampleRate and 0xff).toByte(); header[25] = ((sampleRate shr 8) and 0xff).toByte()
          header[26] = ((sampleRate shr 16) and 0xff).toByte(); header[27] = ((sampleRate shr 24) and 0xff).toByte()
          header[28] = (byteRate and 0xffL).toByte(); header[29] = ((byteRate shr 8) and 0xffL).toByte()
          header[30] = ((byteRate shr 16) and 0xffL).toByte(); header[31] = ((byteRate shr 24) and 0xffL).toByte()
          header[32] = (channels * 2).toByte(); header[33] = 0 // block align
          header[34] = 16; header[35] = 0 // bits per sample
          header[36] = 'd'.code.toByte(); header[37] = 'a'.code.toByte(); header[38] = 't'.code.toByte(); header[39] = 'a'.code.toByte()
          header[40] = (totalAudioLen and 0xffL).toByte(); header[41] = ((totalAudioLen shr 8) and 0xffL).toByte()
          header[42] = ((totalAudioLen shr 16) and 0xffL).toByte(); header[43] = ((totalAudioLen shr 24) and 0xffL).toByte()
          raf.write(header)
        }
      }

      // Calculate global averages
      val avgRmsRaw = if (totalSamplesCount > 0) sqrt(sumEnergyDbfs / totalSamplesCount) else 0.0
      val avgRmsWeighted = if (totalSamplesCount > 0) sqrt(sumEnergyDba / totalSamplesCount) else 0.0

      val averageDbfs = if (avgRmsRaw > 1e-8) 20.0 * log10(avgRmsRaw) else -160.0
      val averageDba = if (avgRmsWeighted > 1e-8) 20.0 * log10(avgRmsWeighted) + calibrationOffsetDb else 0.0
      val usable = peakDbfs > -60.0 && totalSamplesCount > 1000

      mapOf(
        "uri" to "file://${file.absolutePath}",
        "durationMs" to durationMs,
        "sampleCount" to totalSamplesCount,
        "averageDbfs" to max(-160.0, min(0.0, averageDbfs)),
        "peakDbfs" to max(-160.0, min(0.0, peakDbfs)),
        "averageDba" to max(0.0, averageDba),
        "peakDba" to max(0.0, peakDba),
        "usable" to usable
      )
    }

    Function("cancelRecording") {
      isRecording.set(false)
      recordThread?.interrupt()
      recordThread = null
      currentFile?.delete()
      currentFile = null
      true
    }
  }
}
