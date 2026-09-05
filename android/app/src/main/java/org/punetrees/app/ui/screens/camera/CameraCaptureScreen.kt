package org.punetrees.app.ui.screens.camera

import android.content.Context
import android.graphics.Bitmap
import android.net.Uri
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.content.FileProvider
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import org.punetrees.app.core.category.TreeCategories
import org.punetrees.app.core.image.ImageUtils
import org.punetrees.app.core.location.LocationProvider
import org.punetrees.app.core.sensors.DeviceTiltSensor
import org.punetrees.app.ui.components.LiveTiltIndicator
import org.punetrees.app.ui.theme.ForestGreenDark
import org.punetrees.app.ui.theme.ForestGreenPrimary
import java.io.File

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun CameraCaptureScreen(
    category: String,
    onPhotosCaptured: (treePhotos: List<Pair<Bitmap, String>>, latitude: Double, longitude: Double, tiltAngle: Float?) -> Unit,
    onBack: () -> Unit,
    locationProvider: LocationProvider,
    tiltSensor: DeviceTiltSensor? = null
) {
    val context = LocalContext.current
    val coroutineScope = rememberCoroutineScope()

    val liveTilt by (tiltSensor?.tiltAngleDegrees?.collectAsState() ?: remember { mutableStateOf(0.0f) })
    var capturedTilt by remember { mutableStateOf<Float?>(null) }

    var currentCoords by remember { mutableStateOf<Pair<Double, Double>?>(null) }
    var isProcessing by remember { mutableStateOf(false) }
    var processingMessage by remember { mutableStateOf("Processing photo...") }

    // Multi-shot state (Mandatory 3 photos)
    val capturedTreePhotos = remember { mutableStateListOf<Pair<Bitmap, String>>() }
    var currentImageUri by remember { mutableStateOf<Uri?>(null) }
    var currentImageFile by remember { mutableStateOf<File?>(null) }

    val currentCategory = remember(category) { TreeCategories.getByKey(category) }
    val angleTitles = remember(currentCategory) { currentCategory.photoSteps.map { it.stepTitle } }
    val angleGuides = remember(currentCategory) { currentCategory.photoSteps.map { it.instruction } }

    fun checkAndComplete() {
        if (capturedTreePhotos.size >= 3) {
            val lat = currentCoords?.first ?: 18.5196
            val lon = currentCoords?.second ?: 73.8436
            val finalTilt = capturedTilt ?: liveTilt
            onPhotosCaptured(capturedTreePhotos.toList(), lat, lon, finalTilt)
        }
    }

    fun createTempImageUri(): Pair<Uri, File> {
        val imagesDir = File(context.cacheDir, "camera_images").apply { mkdirs() }
        val file = File(imagesDir, "tree_shot_${capturedTreePhotos.size + 1}_${System.currentTimeMillis()}.jpg")
        val uri = FileProvider.getUriForFile(
            context,
            "${context.packageName}.fileprovider",
            file
        )
        return Pair(uri, file)
    }

    // 1. Native Camera Launcher
    val takePictureLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.TakePicture()
    ) { success ->
        if (success && currentImageFile != null && currentImageFile!!.exists()) {
            capturedTilt = liveTilt
            isProcessing = true
            processingMessage = "Optimizing camera photo..."
            coroutineScope.launch {
                val pair = withContext(Dispatchers.IO) {
                    ImageUtils.processImageFile(currentImageFile!!)
                }
                isProcessing = false
                if (pair != null) {
                    capturedTreePhotos.add(pair)
                    checkAndComplete()
                }
            }
        } else {
            isProcessing = false
        }
    }

    // 2. Single Gallery Picker (for 1 shot)
    val pickSingleLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.GetContent()
    ) { uri: Uri? ->
        if (uri != null) {
            isProcessing = true
            processingMessage = "Importing photo from gallery..."
            coroutineScope.launch {
                val pair = withContext(Dispatchers.IO) {
                    ImageUtils.processImageUri(context, uri)
                }
                isProcessing = false
                if (pair != null) {
                    capturedTreePhotos.add(pair)
                    checkAndComplete()
                }
            }
        }
    }

    // 3. Multi Gallery Picker (Batch upload for presentation)
    val pickMultipleLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.GetMultipleContents()
    ) { uris: List<Uri> ->
        if (uris.isNotEmpty()) {
            isProcessing = true
            processingMessage = "Batch importing ${uris.size} photos..."
            coroutineScope.launch {
                val processed = withContext(Dispatchers.IO) {
                    uris.take(3).mapNotNull { uri -> ImageUtils.processImageUri(context, uri) }
                }
                isProcessing = false
                if (processed.isNotEmpty()) {
                    for (pair in processed) {
                        if (capturedTreePhotos.size < 3) {
                            capturedTreePhotos.add(pair)
                        }
                    }
                    checkAndComplete()
                }
            }
        }
    }

    fun launchCamera() {
        if (capturedTreePhotos.size >= 3) {
            checkAndComplete()
            return
        }
        val (uri, file) = createTempImageUri()
        currentImageUri = uri
        currentImageFile = file
        takePictureLauncher.launch(uri)
    }

    LaunchedEffect(Unit) {
        currentCoords = locationProvider.getCurrentLocation()
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Step 3: Tree Evidence (${capturedTreePhotos.size}/3)", fontWeight = FontWeight.Bold, fontSize = 17.sp) },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.Default.ArrowBack, contentDescription = "Back")
                    }
                },
                actions = {
                    if (capturedTreePhotos.isNotEmpty()) {
                        TextButton(onClick = { capturedTreePhotos.clear() }) {
                            Text("Reset", color = Color(0xFFC62828), fontWeight = FontWeight.Bold)
                        }
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = MaterialTheme.colorScheme.background)
            )
        }
    ) { padding ->
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .padding(16.dp),
            contentAlignment = Alignment.Center
        ) {
            if (isProcessing) {
                Column(
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.spacedBy(16.dp)
                ) {
                    CircularProgressIndicator(color = ForestGreenPrimary, modifier = Modifier.size(48.dp))
                    Text(
                        text = processingMessage,
                        fontWeight = FontWeight.Bold,
                        color = ForestGreenDark,
                        fontSize = 15.sp
                    )
                }
            } else {
                Column(
                    modifier = Modifier
                        .fillMaxSize()
                        .verticalScroll(rememberScrollState()),
                    verticalArrangement = Arrangement.spacedBy(16.dp),
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    // Progress Indicator (1 of 3, 2 of 3, 3 of 3)
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        for (i in 0..2) {
                            val isDone = i < capturedTreePhotos.size
                            val isCurrent = i == capturedTreePhotos.size
                            Surface(
                                color = if (isDone) ForestGreenPrimary else if (isCurrent) Color(0xFFE8F5E9) else Color(0xFFEEEEEE),
                                shape = RoundedCornerShape(8.dp),
                                border = BorderStroke(1.dp, if (isCurrent) ForestGreenPrimary else Color.Transparent),
                                modifier = Modifier
                                    .weight(1f)
                                    .padding(horizontal = 4.dp)
                                    .height(36.dp)
                            ) {
                                Row(
                                    modifier = Modifier.fillMaxSize(),
                                    horizontalArrangement = Arrangement.Center,
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    if (isDone) {
                                        Icon(Icons.Default.Check, contentDescription = null, tint = Color.White, modifier = Modifier.size(16.dp))
                                        Spacer(modifier = Modifier.width(4.dp))
                                    }
                                    Text(
                                        text = "Shot ${i + 1}",
                                        color = if (isDone) Color.White else if (isCurrent) ForestGreenDark else Color.Gray,
                                        fontWeight = if (isCurrent || isDone) FontWeight.Bold else FontWeight.Normal,
                                        fontSize = 12.sp
                                    )
                                }
                            }
                        }
                    }

                    // Live device tilt sensor overlay for leaning/fall hazard
                    if (category.contains("LEAN") || currentCategory.key == "DANGEROUS_LEANING_FALL_RISK") {
                        LiveTiltIndicator(angleDegrees = liveTilt)
                    }

                    // Current shot instruction card
                    val currentIdx = capturedTreePhotos.size.coerceIn(0, 2)
                    Card(
                        colors = CardDefaults.cardColors(containerColor = Color(0xFFF1F8E9)),
                        shape = RoundedCornerShape(12.dp),
                        border = BorderStroke(1.5.dp, ForestGreenPrimary),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                            Text(
                                text = "Target Shot ${currentIdx + 1}: ${angleTitles[currentIdx]}",
                                fontWeight = FontWeight.Bold,
                                fontSize = 15.sp,
                                color = ForestGreenDark
                            )
                            Text(
                                text = angleGuides[currentIdx],
                                fontSize = 13.sp,
                                color = Color.DarkGray,
                                lineHeight = 17.sp
                            )
                        }
                    }

                    // Thumbnails of captured photos & placeholders
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(10.dp)
                    ) {
                        capturedTreePhotos.forEachIndexed { index, (bmp, _) ->
                            Column(
                                modifier = Modifier.weight(1f),
                                horizontalAlignment = Alignment.CenterHorizontally
                            ) {
                                Box(
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .height(110.dp)
                                ) {
                                    Image(
                                        bitmap = bmp.asImageBitmap(),
                                        contentDescription = "Shot ${index + 1}",
                                        modifier = Modifier
                                            .fillMaxSize()
                                            .clip(RoundedCornerShape(8.dp)),
                                        contentScale = ContentScale.Crop
                                    )
                                    IconButton(
                                        onClick = { capturedTreePhotos.removeAt(index) },
                                        modifier = Modifier
                                            .align(Alignment.TopEnd)
                                            .size(22.dp)
                                            .background(Color.Black.copy(alpha = 0.65f), RoundedCornerShape(4.dp))
                                    ) {
                                        Icon(
                                            Icons.Default.Close,
                                            contentDescription = "Remove",
                                            tint = Color.White,
                                            modifier = Modifier.size(14.dp)
                                        )
                                    }
                                }
                                Spacer(modifier = Modifier.height(4.dp))
                                Text("Shot ${index + 1} ✓", fontSize = 11.sp, fontWeight = FontWeight.Bold, color = ForestGreenPrimary)
                            }
                        }

                        // Empty placeholders if less than 3 (clickable to pick from gallery)
                        for (i in capturedTreePhotos.size..2) {
                            Box(
                                modifier = Modifier
                                    .weight(1f)
                                    .height(110.dp)
                                    .background(Color(0xFFFAFAFA), RoundedCornerShape(8.dp))
                                    .border(1.dp, Color(0xFFE0E0E0), RoundedCornerShape(8.dp))
                                    .clip(RoundedCornerShape(8.dp))
                                    .clickable { pickSingleLauncher.launch("image/*") },
                                contentAlignment = Alignment.Center
                            ) {
                                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                                    Icon(Icons.Default.AddPhotoAlternate, contentDescription = null, tint = Color.Gray, modifier = Modifier.size(22.dp))
                                    Spacer(modifier = Modifier.height(4.dp))
                                    Text("Slot ${i + 1}", color = Color.Gray, fontSize = 11.sp)
                                }
                            }
                        }
                    }

                    Spacer(modifier = Modifier.weight(1f))

                    // Action Buttons (Camera / Gallery / Fast-Track)
                    val currentShotName = angleTitles[currentIdx].substringBefore(':')
                    Column(
                        modifier = Modifier.fillMaxWidth(),
                        verticalArrangement = Arrangement.spacedBy(10.dp)
                    ) {
                        // 1. Camera Snap
                        Button(
                            onClick = { launchCamera() },
                            colors = ButtonDefaults.buttonColors(containerColor = ForestGreenPrimary),
                            shape = RoundedCornerShape(10.dp),
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(50.dp)
                        ) {
                            Icon(Icons.Default.CameraAlt, contentDescription = null)
                            Spacer(modifier = Modifier.width(8.dp))
                            Text(
                                text = "📸 Snap Shot ${currentIdx + 1} ($currentShotName)",
                                fontWeight = FontWeight.Bold,
                                fontSize = 14.sp
                            )
                        }

                        // 2. Pick from Gallery
                        OutlinedButton(
                            onClick = { pickSingleLauncher.launch("image/*") },
                            colors = ButtonDefaults.outlinedButtonColors(contentColor = ForestGreenDark),
                            border = BorderStroke(1.5.dp, ForestGreenPrimary),
                            shape = RoundedCornerShape(10.dp),
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(50.dp)
                        ) {
                            Icon(Icons.Default.PhotoLibrary, contentDescription = null, tint = ForestGreenDark)
                            Spacer(modifier = Modifier.width(8.dp))
                            Text(
                                text = "🖼️ Upload Shot ${currentIdx + 1} from Gallery",
                                fontWeight = FontWeight.Bold,
                                fontSize = 14.sp
                            )
                        }

                        // 3. Fast-Track Presentation Batch Upload
                        FilledTonalButton(
                            onClick = { pickMultipleLauncher.launch("image/*") },
                            colors = ButtonDefaults.filledTonalButtonColors(
                                containerColor = Color(0xFFE8F5E9),
                                contentColor = ForestGreenDark
                            ),
                            shape = RoundedCornerShape(10.dp),
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(46.dp)
                        ) {
                            Icon(Icons.Default.Bolt, contentDescription = null, tint = ForestGreenDark)
                            Spacer(modifier = Modifier.width(6.dp))
                            Text(
                                text = "⚡ Hackathon Demo: Select 3 Photos at Once",
                                fontWeight = FontWeight.SemiBold,
                                fontSize = 13.sp
                            )
                        }
                    }
                }
            }
        }
    }
}
