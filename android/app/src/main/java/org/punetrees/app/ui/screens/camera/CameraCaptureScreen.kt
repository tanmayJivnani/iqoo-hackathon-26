package org.punetrees.app.ui.screens.camera

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Matrix
import android.media.ExifInterface
import android.net.Uri
import android.util.Base64
import android.widget.Toast
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
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
import org.punetrees.app.core.location.LocationProvider
import org.punetrees.app.core.sensors.DeviceTiltSensor
import org.punetrees.app.ui.theme.ForestGreenDark
import org.punetrees.app.ui.theme.ForestGreenPrimary
import java.io.ByteArrayOutputStream
import java.io.File

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun CameraCaptureScreen(
    category: String,
    onPhotosCaptured: (treePhotos: List<Pair<Bitmap, String>>, latitude: Double, longitude: Double) -> Unit,
    onBack: () -> Unit,
    locationProvider: LocationProvider
) {
    val context = LocalContext.current
    val coroutineScope = rememberCoroutineScope()

    var currentCoords by remember { mutableStateOf<Pair<Double, Double>?>(null) }
    var isProcessing by remember { mutableStateOf(false) }

    // Multi-shot state (Mandatory 3 photos)
    val capturedTreePhotos = remember { mutableStateListOf<Pair<Bitmap, String>>() }
    var currentImageUri by remember { mutableStateOf<Uri?>(null) }
    var currentImageFile by remember { mutableStateOf<File?>(null) }

    val currentCategory = remember(category) { org.punetrees.app.core.category.TreeCategories.getByKey(category) }
    val angleTitles = remember(currentCategory) { currentCategory.photoSteps.map { it.stepTitle } }
    val angleGuides = remember(currentCategory) { currentCategory.photoSteps.map { it.instruction } }

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

    val takePictureLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.TakePicture()
    ) { success ->
        if (success && currentImageFile != null && currentImageFile!!.exists()) {
            isProcessing = true
            coroutineScope.launch {
                val pair = withContext(Dispatchers.IO) {
                    processImageFile(currentImageFile!!)
                }
                isProcessing = false
                if (pair != null) {
                    capturedTreePhotos.add(pair)
                    if (capturedTreePhotos.size >= 3) {
                        val lat = currentCoords?.first ?: 18.5196
                        val lon = currentCoords?.second ?: 73.8436
                        onPhotosCaptured(capturedTreePhotos.toList(), lat, lon)
                    }
                }
            }
        } else {
            isProcessing = false
        }
    }

    fun launchCamera() {
        if (capturedTreePhotos.size >= 3) {
            val lat = currentCoords?.first ?: 18.5196
            val lon = currentCoords?.second ?: 73.8436
            onPhotosCaptured(capturedTreePhotos.toList(), lat, lon)
            return
        }
        val (uri, file) = createTempImageUri()
        currentImageUri = uri
        currentImageFile = file
        takePictureLauncher.launch(uri)
    }

    LaunchedEffect(Unit) {
        currentCoords = locationProvider.getCurrentLocation()
        if (capturedTreePhotos.isEmpty()) {
            launchCamera()
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Step 3: Capture 3 Photos", fontWeight = FontWeight.Bold, fontSize = 17.sp) },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.Default.ArrowBack, contentDescription = "Back")
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
                        text = "Saving Photo ${capturedTreePhotos.size + 1}...",
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
                                text = "Target: ${angleTitles[currentIdx]}",
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

                    // Thumbnails of already captured photos
                    if (capturedTreePhotos.isNotEmpty()) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.spacedBy(10.dp)
                        ) {
                            capturedTreePhotos.forEachIndexed { index, (bmp, _) ->
                                Column(
                                    modifier = Modifier.weight(1f),
                                    horizontalAlignment = Alignment.CenterHorizontally
                                ) {
                                    Image(
                                        bitmap = bmp.asImageBitmap(),
                                        contentDescription = "Shot ${index + 1}",
                                        modifier = Modifier
                                            .fillMaxWidth()
                                            .height(110.dp)
                                            .clip(RoundedCornerShape(8.dp)),
                                        contentScale = ContentScale.Crop
                                    )
                                    Spacer(modifier = Modifier.height(4.dp))
                                    Text("Photo ${index + 1} ✓", fontSize = 11.sp, fontWeight = FontWeight.Bold, color = ForestGreenPrimary)
                                }
                            }
                            // Empty placeholders if less than 3
                            for (i in capturedTreePhotos.size..2) {
                                Box(
                                    modifier = Modifier
                                        .weight(1f)
                                        .height(110.dp)
                                        .background(Color(0xFFFAFAFA), RoundedCornerShape(8.dp))
                                        .clip(RoundedCornerShape(8.dp)),
                                    contentAlignment = Alignment.Center
                                ) {
                                    Text("Slot ${i + 1}", color = Color.LightGray, fontSize = 11.sp)
                                }
                            }
                        }
                    }

                    Spacer(modifier = Modifier.weight(1f))

                    // Launch Camera CTA
                    Button(
                        onClick = { launchCamera() },
                        colors = ButtonDefaults.buttonColors(containerColor = ForestGreenPrimary),
                        shape = RoundedCornerShape(10.dp),
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(52.dp)
                    ) {
                        Icon(Icons.Default.CameraAlt, contentDescription = null)
                        Spacer(modifier = Modifier.width(8.dp))
                        Text(
                            text = "📸 Snap ${angleTitles[currentIdx].substringBefore(':')}",
                            fontWeight = FontWeight.Bold,
                            fontSize = 15.sp
                        )
                    }
                }
            }
        }
    }
}

private fun processImageFile(file: File): Pair<Bitmap, String>? {
    try {
        val exif = ExifInterface(file.absolutePath)
        val orientation = exif.getAttributeInt(ExifInterface.TAG_ORIENTATION, ExifInterface.ORIENTATION_UNDEFINED)

        val boundsOptions = BitmapFactory.Options().apply { inJustDecodeBounds = true }
        BitmapFactory.decodeFile(file.absolutePath, boundsOptions)
        val origWidth = boundsOptions.outWidth
        val origHeight = boundsOptions.outHeight

        val maxDim = 1280
        var sampleSize = 1
        while ((origWidth / sampleSize) > maxDim * 1.5 || (origHeight / sampleSize) > maxDim * 1.5) {
            sampleSize *= 2
        }

        val decodeOptions = BitmapFactory.Options().apply { inSampleSize = sampleSize }
        val sampledBitmap = BitmapFactory.decodeFile(file.absolutePath, decodeOptions) ?: return null

        val matrix = Matrix()
        when (orientation) {
            ExifInterface.ORIENTATION_ROTATE_90 -> matrix.postRotate(90f)
            ExifInterface.ORIENTATION_ROTATE_180 -> matrix.postRotate(180f)
            ExifInterface.ORIENTATION_ROTATE_270 -> matrix.postRotate(270f)
        }

        val rotatedBitmap = if (!matrix.isIdentity) {
            Bitmap.createBitmap(sampledBitmap, 0, 0, sampledBitmap.width, sampledBitmap.height, matrix, true)
        } else {
            sampledBitmap
        }

        val scaledBitmap = if (rotatedBitmap.width > maxDim || rotatedBitmap.height > maxDim) {
            val scale = maxDim.toFloat() / maxOf(rotatedBitmap.width, rotatedBitmap.height)
            Bitmap.createScaledBitmap(rotatedBitmap, (rotatedBitmap.width * scale).toInt(), (rotatedBitmap.height * scale).toInt(), true)
        } else {
            rotatedBitmap
        }

        val outStream = ByteArrayOutputStream()
        scaledBitmap.compress(Bitmap.CompressFormat.JPEG, 85, outStream)
        val bytes = outStream.toByteArray()
        val b64 = Base64.encodeToString(bytes, Base64.NO_WRAP)
        return Pair(scaledBitmap, b64)
    } catch (e: Exception) {
        e.printStackTrace()
        return null
    }
}
