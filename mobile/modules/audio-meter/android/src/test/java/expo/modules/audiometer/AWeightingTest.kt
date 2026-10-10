package expo.modules.audiometer

import org.junit.Assert.*
import org.junit.Test
import kotlin.math.*

class AWeightingTest {
  @Test fun filterResponseMatchesReferenceAtRepresentativeFrequencies() {
    for ((frequency, expectedDb) in listOf(31.5 to -39.5, 100.0 to -19.1, 1000.0 to 0.0, 8000.0 to -1.8)) {
      val filter = AWeighting()
      var rawEnergy = 0.0; var weightedEnergy = 0.0
      for (i in 0 until AudioMetrics.SAMPLE_RATE * 2) {
        val raw = 0.1 * sin(2 * PI * frequency * i / AudioMetrics.SAMPLE_RATE)
        val weighted = filter.process(raw)
        if (i >= AudioMetrics.SAMPLE_RATE) { rawEnergy += raw * raw; weightedEnergy += weighted * weighted }
      }
      assertEquals("Frequency $frequency", expectedDb, 10 * log10(weightedEnergy / rawEnergy), 0.3)
    }
  }
  @Test fun durationUsesCapturedSamplesAndAverageUsesEnergy() {
    val metrics = AudioMetrics()
    repeat(AudioMetrics.SAMPLE_RATE) { metrics.add(0.1, 0.1) }
    assertEquals(1000L, metrics.durationMs)
    assertEquals(-20.0, metrics.averageDbfs, 0.001)
    assertEquals(76.0, metrics.averageDba, 0.001)
    val quiet = AudioMetrics()
    repeat(AudioMetrics.SAMPLE_RATE) { quiet.add(0.01, 0.01) }
    metrics.merge(quiet)
    assertEquals(2000L, metrics.durationMs)
    assertEquals(-22.967086, metrics.averageDbfs, 0.001)
    assertEquals(-20.0, metrics.peakDbfs, 0.001)
  }
  @Test fun silenceStaysFinite() {
    val metrics = AudioMetrics()
    repeat(1000) { metrics.add(0.0, 0.0) }
    assertEquals(-160.0, metrics.averageDbfs, 0.0)
    assertEquals(0.0, metrics.averageDba, 0.0)
  }
}
