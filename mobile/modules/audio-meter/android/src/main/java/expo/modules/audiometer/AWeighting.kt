package expo.modules.audiometer

import kotlin.math.abs
import kotlin.math.log10
import kotlin.math.max

// Bilinear A-weighting cascade for 44.1 kHz, normalized at 1 kHz.
// This filter alone does not make the complete phone an IEC-compliant sound meter.
internal class AWeighting {
  private class Biquad(val b0: Double, val b1: Double, val b2: Double, val a1: Double, val a2: Double) {
    private var x1 = 0.0; private var x2 = 0.0; private var y1 = 0.0; private var y2 = 0.0
    fun process(x: Double): Double {
      val y = b0 * x + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2
      x2 = x1; x1 = x; y2 = y1; y1 = y
      return y
    }
  }
  private val filters = arrayOf(
    Biquad(0.2555878203785167, -0.5111756407570334, 0.2555878203785167, -1.9941388812663284, 0.9941474694464522),
    Biquad(1.0, -2.0, 1.0, -1.884901217428792, 0.8864213795101683),
    Biquad(1.0, 2.0, 1.0, -0.14053608242071078, 0.0049376036154694465)
  )
  fun process(raw: Double): Double = filters.fold(raw) { value, filter -> filter.process(value) }
}

internal class AudioMetrics {
  companion object {
    const val SAMPLE_RATE = 44100
    // Explicitly assumed sensitivity, NOT a measured phone calibration.
    const val NOMINAL_OFFSET_DB = 96.0
    private fun db(energy: Double): Double = if (energy > 1e-16) 10 * log10(energy) else -160.0
  }
  var sampleCount = 0L; private set
  private var rawEnergy = 0.0
  private var weightedEnergy = 0.0
  private var rawPeak = 0.0
  private var weightedPeak = 0.0
  val durationMs: Long get() = sampleCount * 1000 / SAMPLE_RATE
  val averageDbfs: Double get() = db(if (sampleCount > 0) rawEnergy / sampleCount else 0.0).coerceIn(-160.0, 0.0)
  val averageDba: Double get() = max(0.0, db(if (sampleCount > 0) weightedEnergy / sampleCount else 0.0) + NOMINAL_OFFSET_DB)
  val peakDbfs: Double get() = db(rawPeak * rawPeak).coerceIn(-160.0, 0.0)
  val peakDba: Double get() = max(0.0, db(weightedPeak * weightedPeak) + NOMINAL_OFFSET_DB)
  fun add(raw: Double, weighted: Double) {
    sampleCount++; rawEnergy += raw * raw; weightedEnergy += weighted * weighted
    rawPeak = max(rawPeak, abs(raw)); weightedPeak = max(weightedPeak, abs(weighted))
  }
  fun merge(block: AudioMetrics) {
    sampleCount += block.sampleCount; rawEnergy += block.rawEnergy; weightedEnergy += block.weightedEnergy
    rawPeak = max(rawPeak, block.rawPeak); weightedPeak = max(weightedPeak, block.weightedPeak)
  }
}
