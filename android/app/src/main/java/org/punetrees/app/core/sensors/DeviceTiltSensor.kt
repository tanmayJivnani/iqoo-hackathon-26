package org.punetrees.app.core.sensors

import android.content.Context
import android.hardware.Sensor
import android.hardware.SensorEvent
import android.hardware.SensorEventListener
import android.hardware.SensorManager
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlin.math.acos
import kotlin.math.sqrt

/**
 * Reads live device orientation and calculates the tilt angle (in degrees from vertical).
 * Essential for quantitative measurement of leaning trees / fall risk on hardware like iQOO 15.
 */
class DeviceTiltSensor(context: Context) : SensorEventListener {

    private val sensorManager = context.getSystemService(Context.SENSOR_SERVICE) as SensorManager
    private val accelerometer: Sensor? = sensorManager.getDefaultSensor(Sensor.TYPE_ACCELEROMETER)

    private val _tiltAngleDegrees = MutableStateFlow(0.0f)
    val tiltAngleDegrees: StateFlow<Float> = _tiltAngleDegrees.asStateFlow()

    private val _isCriticalLean = MutableStateFlow(false)
    val isCriticalLean: StateFlow<Boolean> = _isCriticalLean.asStateFlow()

    fun startListening() {
        accelerometer?.let {
            sensorManager.registerListener(this, it, SensorManager.SENSOR_DELAY_UI)
        }
    }

    fun stopListening() {
        sensorManager.unregisterListener(this)
    }

    override fun onSensorChanged(event: SensorEvent?) {
        if (event == null || event.sensor.type != Sensor.TYPE_ACCELEROMETER) return

        val x = event.values[0]
        val y = event.values[1]
        val z = event.values[2]

        val norm = sqrt(x * x + y * y + z * z)
        if (norm > 0) {
            // Angle between phone's Y/Z plane and gravity vertical
            // When phone is held upright, Y is ~9.8 m/s^2, pitch is 0.
            val cosAngle = (y / norm).coerceIn(-1.0f, 1.0f)
            val angleDeg = Math.toDegrees(acos(cosAngle.toDouble())).toFloat()
            
            // Normalize deviation from 90° portrait alignment
            val deviationFromVertical = kotlin.math.abs(90.0f - angleDeg)
            _tiltAngleDegrees.value = deviationFromVertical
            _isCriticalLean.value = deviationFromVertical >= 20.0f
        }
    }

    override fun onAccuracyChanged(sensor: Sensor?, accuracy: Int) {}
}
