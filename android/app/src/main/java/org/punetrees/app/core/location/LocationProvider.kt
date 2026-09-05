package org.punetrees.app.core.location

import android.Manifest
import android.annotation.SuppressLint
import android.content.Context
import android.content.pm.PackageManager
import android.location.Location
import android.location.LocationManager
import android.os.Build
import androidx.core.content.ContextCompat
import com.google.android.gms.location.FusedLocationProviderClient
import com.google.android.gms.location.LocationServices
import com.google.android.gms.location.Priority
import com.google.android.gms.tasks.CancellationTokenSource
import kotlinx.coroutines.tasks.await

data class PuneLocationPreset(
    val name: String,
    val landmark: String,
    val ward: String,
    val latitude: Double,
    val longitude: Double
)

class LocationProvider(private val context: Context) {

    private val fusedLocationClient: FusedLocationProviderClient =
        LocationServices.getFusedLocationProviderClient(context)

    companion object {
        val DEMO_PRESETS = listOf(
            PuneLocationPreset("FC Road Goodluck Chowk", "Opposite Goodluck Cafe, FC Road", "Shivajinagar - Ghole Road", 18.5196, 73.8436),
            PuneLocationPreset("Baner High Street", "Near Balewadi High Street Corner", "Aundh - Baner", 18.5590, 73.7997),
            PuneLocationPreset("Kothrud Paud Road", "Near Karve Statue, Paud Road", "Kothrud - Bavdhan", 18.5074, 73.8077),
            PuneLocationPreset("Viman Nagar Phoenix", "Phoenix Marketcity Road", "Viman Nagar - Nagar Road", 18.5679, 73.9143),
            PuneLocationPreset("Shaniwar Wada", "Near Delhi Gate, Shaniwar Wada", "Kasba - Vishrambaug", 18.5195, 73.8553)
        )
    }

    var activePreset: PuneLocationPreset? = null

    fun isGpsEnabled(): Boolean {
        if (activePreset != null) return true

        val hasPermission = ContextCompat.checkSelfPermission(
            context,
            Manifest.permission.ACCESS_FINE_LOCATION
        ) == PackageManager.PERMISSION_GRANTED || ContextCompat.checkSelfPermission(
            context,
            Manifest.permission.ACCESS_COARSE_LOCATION
        ) == PackageManager.PERMISSION_GRANTED

        if (!hasPermission) return false

        val locationManager = context.getSystemService(Context.LOCATION_SERVICE) as? LocationManager ?: return false
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            locationManager.isLocationEnabled
        } else {
            locationManager.isProviderEnabled(LocationManager.GPS_PROVIDER) ||
            locationManager.isProviderEnabled(LocationManager.NETWORK_PROVIDER)
        }
    }

    fun isLocationHardwareEnabled(): Boolean {
        if (activePreset != null) return true
        val locationManager = context.getSystemService(Context.LOCATION_SERVICE) as? LocationManager ?: return false
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            locationManager.isLocationEnabled
        } else {
            locationManager.isProviderEnabled(LocationManager.GPS_PROVIDER) ||
            locationManager.isProviderEnabled(LocationManager.NETWORK_PROVIDER)
        }
    }

    @SuppressLint("MissingPermission")
    suspend fun getCurrentLocation(): Pair<Double, Double>? {
        // If demo preset is selected, use deterministic Pune coordinate
        activePreset?.let {
            return Pair(it.latitude, it.longitude)
        }

        if (!isGpsEnabled()) {
            return null
        }

        return try {
            val cts = CancellationTokenSource()
            val location: Location? = fusedLocationClient.getCurrentLocation(
                Priority.PRIORITY_HIGH_ACCURACY,
                cts.token
            ).await()

            if (location != null) {
                Pair(location.latitude, location.longitude)
            } else {
                val lastLoc: Location? = fusedLocationClient.lastLocation.await()
                if (lastLoc != null) {
                    Pair(lastLoc.latitude, lastLoc.longitude)
                } else {
                    null
                }
            }
        } catch (e: Exception) {
            null
        }
    }
}
