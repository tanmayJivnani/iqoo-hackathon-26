package org.punetrees.app

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Bundle
import android.provider.Settings
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.ui.unit.dp
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.ui.Modifier
import androidx.core.content.ContextCompat
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.lifecycle.compose.LocalLifecycleOwner
import org.punetrees.app.core.location.LocationProvider
import org.punetrees.app.ui.navigation.AppNavHost
import org.punetrees.app.ui.theme.PuneTreeComplaintTheme

class MainActivity : ComponentActivity() {

    private lateinit var locationProvider: LocationProvider
    private val isGpsEnabledState = mutableStateOf(true)

    private val permissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) { _ ->
        checkGpsStatus()
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        enableEdgeToEdge()
        super.onCreate(savedInstanceState)

        locationProvider = LocationProvider(this)
        requestRequiredPermissions()

        setContent {
            PuneTreeComplaintTheme {
                val isGpsEnabled by isGpsEnabledState

                val lifecycleOwner = LocalLifecycleOwner.current
                DisposableEffect(lifecycleOwner) {
                    val observer = LifecycleEventObserver { _, event ->
                        if (event == Lifecycle.Event.ON_RESUME) {
                            checkGpsStatus()
                        }
                    }
                    lifecycleOwner.lifecycle.addObserver(observer)
                    onDispose {
                        lifecycleOwner.lifecycle.removeObserver(observer)
                    }
                }

                Surface(
                    modifier = Modifier
                        .fillMaxSize()
                        .statusBarsPadding()
                        .padding(top = 10.dp),
                    color = MaterialTheme.colorScheme.background
                ) {
                    if (!isGpsEnabled) {
                        GpsRequiredDialog(
                            onEnableGpsClick = {
                                startActivity(Intent(Settings.ACTION_LOCATION_SOURCE_SETTINGS))
                            }
                        )
                    }

                    AppNavHost(
                        locationProvider = locationProvider
                    )
                }
            }
        }
    }

    override fun onResume() {
        super.onResume()
        checkGpsStatus()
    }

    private fun checkGpsStatus() {
        isGpsEnabledState.value = locationProvider.isLocationHardwareEnabled()
    }

    private fun requestRequiredPermissions() {
        val permissions = arrayOf(
            Manifest.permission.CAMERA,
            Manifest.permission.ACCESS_FINE_LOCATION,
            Manifest.permission.ACCESS_COARSE_LOCATION
        )
        val needed = permissions.filter {
            ContextCompat.checkSelfPermission(this, it) != PackageManager.PERMISSION_GRANTED
        }
        if (needed.isNotEmpty()) {
            permissionLauncher.launch(needed.toTypedArray())
        } else {
            checkGpsStatus()
        }
    }
}

@Composable
fun GpsRequiredDialog(onEnableGpsClick: () -> Unit) {
    AlertDialog(
        onDismissRequest = { /* Non-dismissible: GPS hardware lock is mandatory */ },
        title = {
            Text("GPS Location Required")
        },
        text = {
            Text(
                "Pune Trees requires GPS enabled to capture statutory geocodes and correlate with the PMC Tree Census database.\n\nPlease enable Location/GPS in device settings to proceed."
            )
        },
        confirmButton = {
            Button(
                onClick = onEnableGpsClick,
                colors = ButtonDefaults.buttonColors(
                    containerColor = MaterialTheme.colorScheme.primary
                )
            ) {
                Text("Open Location Settings")
            }
        }
    )
}
