package org.punetrees.app.ui.navigation

import android.graphics.Bitmap
import androidx.compose.runtime.*
import androidx.navigation.NavHostController
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import org.punetrees.app.core.location.LocationProvider
import org.punetrees.app.core.sensors.DeviceTiltSensor
import org.punetrees.app.data.remote.model.AnalyzeAndDraftResponse
import org.punetrees.app.ui.screens.camera.CameraCaptureScreen
import org.punetrees.app.ui.screens.category.CategorySelectionScreen
import org.punetrees.app.ui.screens.dispatch.DispatchScreen
import org.punetrees.app.ui.screens.draft.DraftReviewScreen
import org.punetrees.app.ui.screens.guidance.PhotoGuidanceScreen
import org.punetrees.app.ui.screens.preview.PhotoPreviewScreen
import org.punetrees.app.ui.screens.tracker.TrackerScreen
import org.punetrees.app.ui.screens.verify.ReverificationScreen

sealed class Screen(val route: String) {
    object Tracker : Screen("tracker")
    object Category : Screen("category")
    object Guidance : Screen("guidance")
    object Camera : Screen("camera")
    object Preview : Screen("preview")
    object Draft : Screen("draft")
    object Dispatch : Screen("dispatch")
    object Reverification : Screen("reverification/{complaintId}/{trackingId}") {
        fun createRoute(complaintId: String, trackingId: String) = "reverification/$complaintId/$trackingId"
    }
}

@Composable
fun AppNavHost(
    navController: NavHostController = rememberNavController(),
    locationProvider: LocationProvider,
    tiltSensor: DeviceTiltSensor
) {
    // Flow State
    var selectedCategory by remember { mutableStateOf("DANGEROUS_LEANING_FALL_RISK") }
    var perpetratorName by remember { mutableStateOf<String?>(null) }
    var perpetratorPhone by remember { mutableStateOf<String?>(null) }
    var perpetratorPhotosBase64 by remember { mutableStateOf<List<String>>(emptyList()) }

    // 3 Mandatory Captured Tree Photos
    var capturedTreePhotos by remember { mutableStateOf<List<Pair<Bitmap, String>>>(emptyList()) }
    var capturedLat by remember { mutableStateOf(18.5196) }
    var capturedLon by remember { mutableStateOf(73.8436) }

    // Draft & Dispatch State
    var currentDraft by remember { mutableStateOf<AnalyzeAndDraftResponse?>(null) }
    var primaryPhotoBase64 by remember { mutableStateOf("") }

    NavHost(
        navController = navController,
        startDestination = Screen.Tracker.route
    ) {
        // 0. Tracker Screen
        composable(Screen.Tracker.route) {
            TrackerScreen(
                onNewComplaintClick = { navController.navigate(Screen.Category.route) },
                onVerifyClick = { id, trackingId ->
                    navController.navigate(Screen.Reverification.createRoute(id, trackingId))
                }
            )
        }

        // Step 1: Category Selection
        composable(Screen.Category.route) {
            CategorySelectionScreen(
                onProceedToGuidance = { category ->
                    selectedCategory = category
                    navController.navigate(Screen.Guidance.route)
                },
                onBack = { navController.popBackStack() }
            )
        }

        // Step 2: Photographic Guidelines
        composable(Screen.Guidance.route) {
            PhotoGuidanceScreen(
                category = selectedCategory,
                onStartCapture = { navController.navigate(Screen.Camera.route) },
                onBack = { navController.popBackStack() }
            )
        }

        // Step 3: Camera Capture (3 Mandatory Photos)
        composable(Screen.Camera.route) {
            CameraCaptureScreen(
                category = selectedCategory,
                locationProvider = locationProvider,
                onPhotosCaptured = { treePhotos, lat, lon ->
                    capturedTreePhotos = treePhotos
                    capturedLat = lat
                    capturedLon = lon
                    navController.navigate(Screen.Preview.route)
                },
                onBack = { navController.popBackStack() }
            )
        }

        // Step 4: Preview 3 Photos & Run AI Analysis
        composable(Screen.Preview.route) {
            PhotoPreviewScreen(
                category = selectedCategory,
                treePhotosList = capturedTreePhotos,
                perpetratorName = perpetratorName,
                perpetratorPhone = perpetratorPhone,
                perpetratorPhotosBase64 = perpetratorPhotosBase64,
                latitude = capturedLat,
                longitude = capturedLon,
                onDraftReady = { draft, photoB64 ->
                    currentDraft = draft
                    primaryPhotoBase64 = photoB64
                    navController.navigate(Screen.Draft.route)
                },
                onBack = { navController.popBackStack() }
            )
        }

        // Step 5: Draft Review & Customization
        composable(Screen.Draft.route) {
            currentDraft?.let { draft ->
                DraftReviewScreen(
                    draft = draft,
                    photoBase64 = primaryPhotoBase64,
                    onProceedToDispatch = { updatedDraft ->
                        currentDraft = updatedDraft
                        navController.navigate(Screen.Dispatch.route)
                    },
                    onBack = { navController.popBackStack() }
                )
            }
        }

        // Step 6: Dispatch Notice
        composable(Screen.Dispatch.route) {
            currentDraft?.let { draft ->
                DispatchScreen(
                    draft = draft,
                    photoBase64 = primaryPhotoBase64,
                    onDone = {
                        navController.navigate(Screen.Tracker.route) {
                            popUpTo(Screen.Tracker.route) { inclusive = true }
                        }
                    }
                )
            }
        }

        // Verification
        composable(Screen.Reverification.route) { backStackEntry ->
            val complaintId = backStackEntry.arguments?.getString("complaintId") ?: ""
            val trackingId = backStackEntry.arguments?.getString("trackingId") ?: ""

            ReverificationScreen(
                complaintId = complaintId,
                trackingId = trackingId,
                locationProvider = locationProvider,
                onDone = {
                    navController.navigate(Screen.Tracker.route) {
                        popUpTo(Screen.Tracker.route) { inclusive = true }
                    }
                }
            )
        }
    }
}
