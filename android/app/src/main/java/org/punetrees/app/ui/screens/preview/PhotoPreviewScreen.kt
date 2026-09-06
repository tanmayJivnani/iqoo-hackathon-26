package org.punetrees.app.ui.screens.preview

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
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
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
import org.punetrees.app.core.ai.local.LocalGemmaEngine
import org.punetrees.app.core.image.ImageUtils
import org.punetrees.app.core.user.UserProfileManager
import org.punetrees.app.data.remote.ApiClient
import org.punetrees.app.data.remote.model.AnalyzeAndDraftRequest
import org.punetrees.app.data.remote.model.AnalyzeAndDraftResponse
import org.punetrees.app.ui.theme.ForestGreenDark
import org.punetrees.app.ui.theme.ForestGreenPrimary
import java.io.ByteArrayOutputStream
import java.io.File

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun PhotoPreviewScreen(
    category: String,
    treePhotosList: List<Pair<Bitmap, String>>,
    perpetratorName: String?,
    perpetratorPhone: String?,
    perpetratorPhotosBase64: List<String>,
    latitude: Double,
    longitude: Double,
    onDraftReady: (draft: AnalyzeAndDraftResponse, primaryPhotoBase64: String) -> Unit,
    onBack: () -> Unit
) {
    val context = LocalContext.current
    val coroutineScope = rememberCoroutineScope()
    val api = remember { ApiClient.getService() }
    val userProfileManager = remember { UserProfileManager(context) }
    val antiSpamManager = remember { org.punetrees.app.core.security.AntiSpamManager(context) }
    val localGemmaEngine = remember { LocalGemmaEngine(context) }

    val currentPhotos = remember { mutableStateListOf<Pair<Bitmap, String>>().apply { addAll(treePhotosList) } }
    var citizenNotes by remember { mutableStateOf("") }
    var addressLandmark by remember { mutableStateOf("") }
    var perpetratorNameInput by remember { mutableStateOf(perpetratorName ?: "") }
    var perpetratorPhoneInput by remember { mutableStateOf(perpetratorPhone ?: "") }
    val perpetratorPhotos = remember { mutableStateListOf<Pair<Bitmap, String>>() }
    var isProcessing by remember { mutableStateOf(false) }
    var processingStatus by remember { mutableStateOf("Executing analysis...") }
    var errorMessage by remember { mutableStateOf<String?>(null) }

    // Live Geotagging
    var geotaggedAddress by remember { mutableStateOf<String?>(null) }
    var isGeocoding by remember { mutableStateOf(false) }
    
    // Anti-spam warning & cooldown dialog states
    var rejectionDialogText by remember { mutableStateOf<String?>(null) }
    var cooldownDialogText by remember { mutableStateOf<String?>(null) }

    // Retake / photo replacement state
    var retakeIndex by remember { mutableStateOf(-1) }
    var retakeFile by remember { mutableStateOf<File?>(null) }
    var showPhotoSourceDialogForIndex by remember { mutableStateOf<Int?>(null) }
    var showContractorSourceDialog by remember { mutableStateOf(false) }

    val perpetratorLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.TakePicturePreview()
    ) { bmp ->
        if (bmp != null) {
            val stream = ByteArrayOutputStream()
            bmp.compress(Bitmap.CompressFormat.JPEG, 85, stream)
            val b64 = Base64.encodeToString(stream.toByteArray(), Base64.NO_WRAP)
            perpetratorPhotos.add(Pair(bmp, b64))
            Toast.makeText(context, "Contractor photo ${perpetratorPhotos.size}/4 attached", Toast.LENGTH_SHORT).show()
        }
    }

    val perpetratorGalleryLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.GetContent()
    ) { uri: Uri? ->
        if (uri != null) {
            coroutineScope.launch {
                val pair = withContext(Dispatchers.IO) {
                    ImageUtils.processImageUri(context, uri)
                }
                if (pair != null) {
                    perpetratorPhotos.add(pair)
                    Toast.makeText(context, "Contractor photo ${perpetratorPhotos.size}/4 attached", Toast.LENGTH_SHORT).show()
                }
            }
        }
    }

    val retakeLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.TakePicture()
    ) { success ->
        if (success && retakeFile != null && retakeFile!!.exists() && retakeIndex in 0..2) {
            coroutineScope.launch {
                val pair = withContext(Dispatchers.IO) {
                    ImageUtils.processImageFile(retakeFile!!)
                }
                if (pair != null) {
                    currentPhotos[retakeIndex] = pair
                }
            }
        }
    }

    val retakeGalleryLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.GetContent()
    ) { uri: Uri? ->
        if (uri != null && retakeIndex in 0..2) {
            coroutineScope.launch {
                val pair = withContext(Dispatchers.IO) {
                    ImageUtils.processImageUri(context, uri)
                }
                if (pair != null) {
                    currentPhotos[retakeIndex] = pair
                }
            }
        }
    }

    var isModelInstalledState by remember { mutableStateOf(localGemmaEngine.isModelInstalled()) }

    LaunchedEffect(latitude, longitude) {
        isGeocoding = true
        withContext(Dispatchers.IO) {
            try {
                val geocoder = android.location.Geocoder(context, java.util.Locale.ENGLISH)
                var resolved: String? = null
                if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.TIRAMISU) {
                    geocoder.getFromLocation(latitude, longitude, 1) { list ->
                        val addr = list.firstOrNull()
                        if (addr != null) {
                            val line = addr.getAddressLine(0)
                            val subLoc = addr.subLocality ?: ""
                            val loc = addr.locality ?: "Pune"
                            val thoroughfare = addr.thoroughfare ?: ""
                            resolved = line ?: listOfNotNull(thoroughfare, subLoc, loc).filter { it.isNotBlank() }.joinToString(", ")
                            geotaggedAddress = resolved
                        }
                        isGeocoding = false
                    }
                } else {
                    @Suppress("DEPRECATION")
                    val list = geocoder.getFromLocation(latitude, longitude, 1)
                    val addr = list?.firstOrNull()
                    if (addr != null) {
                        val line = addr.getAddressLine(0)
                        val subLoc = addr.subLocality ?: ""
                        val loc = addr.locality ?: "Pune"
                        val thoroughfare = addr.thoroughfare ?: ""
                        resolved = line ?: listOfNotNull(thoroughfare, subLoc, loc).filter { it.isNotBlank() }.joinToString(", ")
                        geotaggedAddress = resolved
                    }
                    isGeocoding = false
                }
            } catch (e: Exception) {
                e.printStackTrace()
                isGeocoding = false
            }

            if (geotaggedAddress == null) {
                val nearest = org.punetrees.app.core.location.LocationProvider.DEMO_PRESETS.minByOrNull {
                    val dLat = it.latitude - latitude
                    val dLon = it.longitude - longitude
                    dLat * dLat + dLon * dLon
                }
                if (nearest != null) {
                    val approx = "${nearest.name}, ${nearest.ward}, Pune"
                    geotaggedAddress = approx
                }
            }
        }
    }

    fun launchRetake(index: Int) {
        retakeIndex = index
        val imagesDir = File(context.cacheDir, "camera_images").apply { mkdirs() }
        val file = File(imagesDir, "retake_evidence_${System.currentTimeMillis()}.jpg")
        retakeFile = file
        val uri = FileProvider.getUriForFile(context, "${context.packageName}.fileprovider", file)
        retakeLauncher.launch(uri)
    }

    fun executeAnalysis() {
        val (isBlocked, remainingMinutes) = antiSpamManager.isUnderCooldown()
        if (isBlocked) {
            cooldownDialogText = "🚫 Spam Protection Activated (3-Hour Cooldown)\n\nYou have submitted 3 consecutive non-tree photos. To conserve arborist AI resources and prevent spam, please wait $remainingMinutes minutes before submitting another report."
            return
        }

        if (currentPhotos.size < 3) {
            errorMessage = "Please capture all 3 mandatory tree evidence photos."
            return
        }

        isProcessing = true
        processingStatus = "Verifying tree presence & running arborist audit..."
        errorMessage = null

        coroutineScope.launch {
            try {
                val profile = userProfileManager.getProfile()
                val treePhotosBase64 = currentPhotos.map { it.second }
                val primaryPhoto = treePhotosBase64[0]
                val allPerpPhotos = (perpetratorPhotosBase64 + perpetratorPhotos.map { it.second }).distinct()

                val req = AnalyzeAndDraftRequest(
                    photoBase64 = primaryPhoto,
                    photosBase64 = treePhotosBase64,
                    perpetratorPhotosBase64 = allPerpPhotos.ifEmpty { null },
                    citizenSelectedCategory = category,
                    latitude = latitude,
                    longitude = longitude,
                    sensorTiltAngle = null,
                    citizenNotes = citizenNotes.ifBlank { null },
                    addressLandmark = addressLandmark.ifBlank { geotaggedAddress },
                    citizenName = profile.name.ifBlank { "Pune Citizen" },
                    citizenPhone = profile.phone.ifBlank { null },
                    citizenEmail = profile.email.ifBlank { null },
                    perpetratorName = perpetratorNameInput.ifBlank { null },
                    perpetratorPhone = perpetratorPhoneInput.ifBlank { null }
                )

                val response = api.analyzeAndDraft(req)
                if (response.isSuccessful && response.body() != null) {
                    val draft = response.body()!!
                    
                    if (!draft.treeDetected) {
                        isProcessing = false
                        val (failedCount, isNowBlocked) = antiSpamManager.recordInvalidAttempt()
                        val maxAttempts = org.punetrees.app.core.security.AntiSpamManager.MAX_INVALID_ATTEMPTS
                        val remainingAttempts = maxAttempts - failedCount
                        if (isNowBlocked) {
                            cooldownDialogText = "🚫 Spam Protection Activated (3-Hour Cooldown)\n\nYou have exceeded $maxAttempts invalid photo attempts with no tree detected. To preserve civic resources, submission is paused for 3 hours."
                        } else {
                            val attemptsMsg = if (remainingAttempts == 1) "1 attempt remaining" else "$remainingAttempts attempts remaining"
                            rejectionDialogText = "⚠️ Tree Not Detected (Attempt $failedCount/$maxAttempts)\n\n${draft.rejectionReason ?: "The AI verified that no tree, branch, or botanical subject is visible in the photos."}\n\nPlease tap any photo above to retake clear photos of the actual tree. You have $attemptsMsg before a 3-hour cooldown."
                        }
                    } else {
                        antiSpamManager.reset()
                        isProcessing = false
                        onDraftReady(draft, primaryPhoto)
                    }
                } else {
                    isProcessing = false
                    errorMessage = "Server error (${response.code()}). Please try again."
                }
            } catch (e: Exception) {
                e.printStackTrace()
                isProcessing = false
                errorMessage = "Network or timeout error: ${e.localizedMessage ?: "Please check internet connection"}"
            }
        }
    }

    fun executeLocalInference() {
        if (currentPhotos.size < 3) {
            errorMessage = "Please capture all 3 mandatory tree evidence photos."
            return
        }

        isProcessing = true
        processingStatus = "Running on-device edge AI inference..."
        errorMessage = null

        coroutineScope.launch {
            try {
                val profile = userProfileManager.getProfile()
                val categoriesList = category.split(",").map { it.trim() }.filter { it.isNotEmpty() }
                val draft = withContext(Dispatchers.IO) {
                    localGemmaEngine.analyzeAndDraftLocal(
                        photos = currentPhotos.toList(),
                        selectedCategories = categoriesList,
                        latitude = latitude,
                        longitude = longitude,
                        citizenNotes = citizenNotes,
                        addressLandmark = addressLandmark.ifBlank { geotaggedAddress ?: "Pune Municipal Corporation" },
                        citizenName = profile.name.ifBlank { "Pune Citizen" },
                        citizenPhone = profile.phone.ifBlank { null },
                        citizenEmail = profile.email.ifBlank { null },
                        perpetratorName = perpetratorNameInput.ifBlank { null },
                        perpetratorPhone = perpetratorPhoneInput.ifBlank { null }
                    )
                }
                if (!draft.treeDetected) {
                    isProcessing = false
                    val (failedCount, isNowBlocked) = antiSpamManager.recordInvalidAttempt()
                    val maxAttempts = org.punetrees.app.core.security.AntiSpamManager.MAX_INVALID_ATTEMPTS
                    val remainingAttempts = maxAttempts - failedCount
                    if (isNowBlocked) {
                        cooldownDialogText = "🚫 Spam Protection Activated (3-Hour Cooldown)\n\nYou have exceeded $maxAttempts invalid photo attempts with no tree detected. To preserve civic resources, submission is paused for 3 hours."
                    } else {
                        val attemptsMsg = if (remainingAttempts == 1) "1 attempt remaining" else "$remainingAttempts attempts remaining"
                        rejectionDialogText = "⚠️ Tree Not Detected (Attempt $failedCount/$maxAttempts)\n\n${draft.rejectionReason ?: "On-device Gemma 3n verified that no tree, branch, or botanical subject is visible in the photos."}\n\nPlease tap any photo above to retake clear photos of the actual tree. You have $attemptsMsg before a 3-hour cooldown."
                    }
                } else {
                    antiSpamManager.reset()
                    isProcessing = false
                    onDraftReady(draft, currentPhotos[0].second)
                }
            } catch (e: Exception) {
                e.printStackTrace()
                isProcessing = false
                errorMessage = "Local inference error: ${e.localizedMessage}"
            }
        }
    }

    // 1. Rejection Dialog (Attempt 1 of 2)
    if (rejectionDialogText != null) {
        AlertDialog(
            onDismissRequest = { rejectionDialogText = null },
            icon = { Icon(Icons.Default.Warning, contentDescription = null, tint = Color(0xFFE65100)) },
            title = { Text("Photo Verification Failed", fontWeight = FontWeight.Bold) },
            text = { Text(rejectionDialogText!!) },
            confirmButton = {
                Button(
                    onClick = { rejectionDialogText = null },
                    colors = ButtonDefaults.buttonColors(containerColor = ForestGreenPrimary)
                ) {
                    Text("Retake Photos")
                }
            }
        )
    }

    // 2. Anti-Spam Cooldown Dialog (Blocked for 3 hours)
    if (cooldownDialogText != null) {
        AlertDialog(
            onDismissRequest = { cooldownDialogText = null },
            icon = { Icon(Icons.Default.Warning, contentDescription = null, tint = Color(0xFFC62828)) },
            title = { Text("Anti-Spam Protection", fontWeight = FontWeight.Bold, color = Color(0xFFC62828)) },
            text = { Text(cooldownDialogText!!) },
            confirmButton = {
                Button(
                    onClick = {
                        cooldownDialogText = null
                        onBack()
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = Color(0xFFC62828))
                ) {
                    Text("Understood")
                }
            }
        )
    }

    val currentCategory = remember(category) { org.punetrees.app.core.category.TreeCategories.getByKey(category) }
    val photoLabels = remember(currentCategory) {
        currentCategory.photoSteps.map { it.previewLabel }
    }

    // 3. Photo Replacement Source Dialog
    if (showPhotoSourceDialogForIndex != null) {
        val targetIdx = showPhotoSourceDialogForIndex!!
        AlertDialog(
            onDismissRequest = { showPhotoSourceDialogForIndex = null },
            icon = { Icon(Icons.Default.AddPhotoAlternate, contentDescription = null, tint = ForestGreenPrimary) },
            title = { Text("Replace Photo ${targetIdx + 1}", fontWeight = FontWeight.Bold) },
            text = { Text("Choose how you want to provide evidence for:\n${photoLabels.getOrElse(targetIdx) { "Photo ${targetIdx + 1}" }}") },
            confirmButton = {
                Button(
                    onClick = {
                        val idx = targetIdx
                        showPhotoSourceDialogForIndex = null
                        launchRetake(idx)
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = ForestGreenPrimary)
                ) {
                    Icon(Icons.Default.CameraAlt, contentDescription = null, modifier = Modifier.size(16.dp))
                    Spacer(modifier = Modifier.width(6.dp))
                    Text("Camera")
                }
            },
            dismissButton = {
                OutlinedButton(
                    onClick = {
                        val idx = targetIdx
                        showPhotoSourceDialogForIndex = null
                        retakeIndex = idx
                        retakeGalleryLauncher.launch("image/*")
                    }
                ) {
                    Icon(Icons.Default.PhotoLibrary, contentDescription = null, modifier = Modifier.size(16.dp))
                    Spacer(modifier = Modifier.width(6.dp))
                    Text("Gallery")
                }
            }
        )
    }

    // 4. Contractor Photo Source Dialog
    if (showContractorSourceDialog) {
        AlertDialog(
            onDismissRequest = { showContractorSourceDialog = false },
            icon = { Icon(Icons.Default.CameraAlt, contentDescription = null, tint = Color(0xFFE65100)) },
            title = { Text("Attach Contractor Evidence", fontWeight = FontWeight.Bold) },
            text = { Text("Choose photo source for contractor or equipment evidence:") },
            confirmButton = {
                Button(
                    onClick = {
                        showContractorSourceDialog = false
                        perpetratorLauncher.launch(null)
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = Color(0xFFE65100))
                ) {
                    Icon(Icons.Default.CameraAlt, contentDescription = null, modifier = Modifier.size(16.dp))
                    Spacer(modifier = Modifier.width(6.dp))
                    Text("Camera")
                }
            },
            dismissButton = {
                OutlinedButton(
                    onClick = {
                        showContractorSourceDialog = false
                        perpetratorGalleryLauncher.launch("image/*")
                    }
                ) {
                    Icon(Icons.Default.PhotoLibrary, contentDescription = null, modifier = Modifier.size(16.dp))
                    Spacer(modifier = Modifier.width(6.dp))
                    Text("Gallery")
                }
            }
        )
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Step 4: Preview Evidence", fontWeight = FontWeight.Bold, fontSize = 17.sp) },
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
                    verticalArrangement = Arrangement.spacedBy(16.dp),
                    modifier = Modifier.padding(24.dp)
                ) {
                    CircularProgressIndicator(
                        color = ForestGreenPrimary,
                        strokeWidth = 4.dp,
                        modifier = Modifier.size(56.dp)
                    )
                    Text(
                        text = processingStatus,
                        fontWeight = FontWeight.Bold,
                        fontSize = 15.sp,
                        color = ForestGreenDark
                    )
                    Text(
                        text = "Running vision model sequence, arborist morphology audit, and compiling official PMC complaint...",
                        fontSize = 12.sp,
                        color = Color.Gray,
                        lineHeight = 16.sp
                    )
                }
            } else {
                Column(
                    modifier = Modifier
                        .fillMaxSize()
                        .verticalScroll(rememberScrollState()),
                    verticalArrangement = Arrangement.spacedBy(14.dp)
                ) {
                    // Header card
                    Card(
                        colors = CardDefaults.cardColors(containerColor = Color(0xFFE8F5E9)),
                        shape = RoundedCornerShape(10.dp),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(12.dp),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Column {
                                Text("Grievance Category", fontSize = 11.sp, color = Color.Gray)
                                Text(category.replace('_', ' '), fontWeight = FontWeight.Bold, fontSize = 14.sp, color = ForestGreenDark)
                            }
                            Surface(
                                color = ForestGreenPrimary,
                                shape = RoundedCornerShape(12.dp)
                            ) {
                                Text("3 / 3 Photos Ready", color = Color.White, fontSize = 11.sp, fontWeight = FontWeight.Bold, modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp))
                            }
                        }
                    }

                    // 3 Photo Cards
                    for (i in 0..2) {
                        val photo = currentPhotos.getOrNull(i)
                        Card(
                            colors = CardDefaults.cardColors(containerColor = Color.White),
                            shape = RoundedCornerShape(12.dp),
                            border = BorderStroke(1.dp, Color(0xFFE0E0E0)),
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            Column(modifier = Modifier.padding(10.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                                Row(
                                    modifier = Modifier.fillMaxWidth(),
                                    horizontalArrangement = Arrangement.SpaceBetween,
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    Text(
                                        text = photoLabels.getOrElse(i) { "Photo ${i + 1}" },
                                        fontWeight = FontWeight.Bold,
                                        fontSize = 13.sp,
                                        color = ForestGreenDark
                                    )
                                    TextButton(onClick = {
                                        retakeIndex = i
                                        showPhotoSourceDialogForIndex = i
                                    }) {
                                        Icon(Icons.Default.Refresh, contentDescription = null, modifier = Modifier.size(16.dp), tint = ForestGreenPrimary)
                                        Spacer(modifier = Modifier.width(4.dp))
                                        Text("Change", fontSize = 12.sp, color = ForestGreenPrimary)
                                    }
                                }

                                if (photo != null) {
                                    Image(
                                        bitmap = photo.first.asImageBitmap(),
                                        contentDescription = "Tree Evidence Photo ${i + 1}",
                                        modifier = Modifier
                                            .fillMaxWidth()
                                            .height(180.dp)
                                            .clip(RoundedCornerShape(8.dp)),
                                        contentScale = ContentScale.Crop
                                    )
                                } else {
                                    Box(
                                        modifier = Modifier
                                            .fillMaxWidth()
                                            .height(140.dp)
                                            .background(Color(0xFFF5F5F5), RoundedCornerShape(8.dp))
                                            .clickable {
                                                retakeIndex = i
                                                showPhotoSourceDialogForIndex = i
                                            },
                                        contentAlignment = Alignment.Center
                                    ) {
                                        Text("Tap to capture or upload photo ${i + 1}", color = Color.Gray, fontSize = 12.sp)
                                    }
                                }
                            }
                        }
                    }

                    // GPS Geotagged Evidence Card
                    Card(
                        colors = CardDefaults.cardColors(containerColor = Color(0xFFF1F8E9)),
                        shape = RoundedCornerShape(12.dp),
                        border = BorderStroke(1.5.dp, ForestGreenPrimary.copy(alpha = 0.5f)),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Column(modifier = Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Row(verticalAlignment = Alignment.CenterVertically) {
                                    Icon(Icons.Default.LocationOn, contentDescription = null, tint = ForestGreenPrimary, modifier = Modifier.size(16.dp))
                                    Spacer(modifier = Modifier.width(6.dp))
                                    Text(
                                        text = "Geotagged Evidence Location",
                                        fontSize = 13.sp,
                                        fontWeight = FontWeight.Bold,
                                        color = ForestGreenDark
                                    )
                                }
                                Surface(
                                    color = ForestGreenPrimary,
                                    shape = RoundedCornerShape(4.dp)
                                ) {
                                    Text(
                                        text = "GPS LOCKED ✓",
                                        color = Color.White,
                                        fontSize = 9.sp,
                                        fontWeight = FontWeight.Bold,
                                        modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp)
                                    )
                                }
                            }

                            Row(verticalAlignment = Alignment.Top) {
                                Icon(Icons.Default.LocationOn, contentDescription = null, tint = Color(0xFFC62828), modifier = Modifier.size(18.dp).padding(top = 1.dp))
                                Spacer(modifier = Modifier.width(6.dp))
                                Column {
                                    if (isGeocoding) {
                                        Row(verticalAlignment = Alignment.CenterVertically) {
                                            CircularProgressIndicator(modifier = Modifier.size(12.dp), strokeWidth = 2.dp, color = ForestGreenPrimary)
                                            Spacer(modifier = Modifier.width(6.dp))
                                            Text("Geotagging street & area...", fontSize = 12.sp, color = Color.Gray)
                                        }
                                    } else {
                                        Text(
                                            text = geotaggedAddress ?: "Pune Municipal Corporation Area",
                                            fontSize = 13.sp,
                                            fontWeight = FontWeight.SemiBold,
                                            color = Color(0xFF263238),
                                            lineHeight = 17.sp
                                        )
                                    }
                                    Spacer(modifier = Modifier.height(3.dp))
                                    Text(
                                        text = "Recorded GPS: ${String.format("%.5f° N, %.5f° E", latitude, longitude)}",
                                        fontSize = 11.sp,
                                        color = Color(0xFF546E7A)
                                    )
                                }
                            }
                        }
                    }

                    // 1. Citizen Observation (Optional)
                    OutlinedTextField(
                        value = citizenNotes,
                        onValueChange = { citizenNotes = it },
                        label = { Text("Citizen Observation (Optional)") },
                        placeholder = { Text("e.g. Tree has large hollow, branch leaning over road...") },
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(8.dp),
                        minLines = 3
                    )

                    // 2. Nearby Landmark (Optional)
                    OutlinedTextField(
                        value = addressLandmark,
                        onValueChange = { addressLandmark = it },
                        label = { Text("Nearby Landmark (Optional)") },
                        placeholder = { Text("e.g. Opposite Gate 2, near Goodluck Cafe...") },
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(8.dp),
                        singleLine = true
                    )

                    // 3. Contractor / Cutter Info Card (if Felling or Unauthorized Pruning)
                    if (category in listOf("ILLEGAL_FELLING", "UNAUTHORIZED_PRUNING")) {
                        Card(
                            colors = CardDefaults.cardColors(containerColor = Color(0xFFFFF3E0)),
                            shape = RoundedCornerShape(10.dp),
                            border = BorderStroke(1.dp, Color(0xFFFFB74D)),
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            Column(modifier = Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                                Text(
                                    text = "👤 Accused Contractor / Cutter Info (Optional)",
                                    fontWeight = FontWeight.Bold,
                                    fontSize = 13.sp,
                                    color = Color(0xFFE65100)
                                )
                                Text(
                                    text = "Enter contractor details or photograph workers/machinery (Saved for official penal records).",
                                    fontSize = 11.sp,
                                    color = Color(0xFF795548),
                                    lineHeight = 15.sp
                                )

                                OutlinedTextField(
                                    value = perpetratorNameInput,
                                    onValueChange = { perpetratorNameInput = it },
                                    label = { Text("Contractor / Tree Cutter Name (Optional)") },
                                    placeholder = { Text("e.g. ABC Agency / Contractor Name") },
                                    modifier = Modifier.fillMaxWidth(),
                                    shape = RoundedCornerShape(8.dp),
                                    singleLine = true
                                )

                                OutlinedTextField(
                                    value = perpetratorPhoneInput,
                                    onValueChange = { perpetratorPhoneInput = it },
                                    label = { Text("Contractor Phone / Vehicle Reg (Optional)") },
                                    placeholder = { Text("e.g. 98XXXXXXXX / MH-12-XX-XXXX") },
                                    modifier = Modifier.fillMaxWidth(),
                                    shape = RoundedCornerShape(8.dp),
                                    singleLine = true
                                )

                                if (perpetratorPhotos.isNotEmpty()) {
                                    Row(
                                        modifier = Modifier
                                            .fillMaxWidth()
                                            .horizontalScroll(rememberScrollState()),
                                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                                    ) {
                                        perpetratorPhotos.forEachIndexed { index, (bmp, _) ->
                                            Box(modifier = Modifier.size(70.dp)) {
                                                Image(
                                                    bitmap = bmp.asImageBitmap(),
                                                    contentDescription = "Contractor Photo ${index + 1}",
                                                    modifier = Modifier
                                                        .fillMaxSize()
                                                        .clip(RoundedCornerShape(8.dp)),
                                                    contentScale = ContentScale.Crop
                                                )
                                                Box(
                                                    modifier = Modifier
                                                        .align(Alignment.TopEnd)
                                                        .size(20.dp)
                                                        .background(Color.Black.copy(alpha = 0.65f), CircleShape)
                                                        .clickable { perpetratorPhotos.removeAt(index) },
                                                    contentAlignment = Alignment.Center
                                                ) {
                                                    Icon(
                                                        Icons.Default.Close,
                                                        contentDescription = "Remove",
                                                        tint = Color.White,
                                                        modifier = Modifier.size(12.dp)
                                                    )
                                                }
                                            }
                                        }

                                        if (perpetratorPhotos.size < 4) {
                                            Card(
                                                colors = CardDefaults.cardColors(containerColor = Color.White),
                                                shape = RoundedCornerShape(8.dp),
                                                border = BorderStroke(1.dp, Color(0xFFFFB74D)),
                                                modifier = Modifier
                                                    .size(70.dp)
                                                    .clickable { showContractorSourceDialog = true }
                                            ) {
                                                Column(
                                                    modifier = Modifier.fillMaxSize(),
                                                    horizontalAlignment = Alignment.CenterHorizontally,
                                                    verticalArrangement = Arrangement.Center
                                                ) {
                                                    Icon(Icons.Default.AddAPhoto, contentDescription = "Add", tint = Color(0xFFE65100), modifier = Modifier.size(20.dp))
                                                    Spacer(modifier = Modifier.height(2.dp))
                                                    Text("Add", fontSize = 10.sp, color = Color(0xFFE65100), fontWeight = FontWeight.Bold)
                                                }
                                            }
                                        }
                                    }
                                } else {
                                    OutlinedButton(
                                        onClick = { showContractorSourceDialog = true },
                                        modifier = Modifier.fillMaxWidth(),
                                        colors = ButtonDefaults.outlinedButtonColors(contentColor = Color(0xFFE65100))
                                    ) {
                                        Icon(Icons.Default.CameraAlt, contentDescription = null, modifier = Modifier.size(16.dp))
                                        Spacer(modifier = Modifier.width(6.dp))
                                        Text("📸 Attach Contractor / Equipment Photo (up to 4)", fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
                                    }
                                }
                            }
                        }
                    }

                    if (errorMessage != null) {
                        Text(
                            text = errorMessage!!,
                            color = MaterialTheme.colorScheme.error,
                            fontSize = 12.sp,
                            fontWeight = FontWeight.SemiBold
                        )
                    }

                    // Hackathon AI Inference Engine Selection
                    Column(
                        modifier = Modifier.fillMaxWidth(),
                        verticalArrangement = Arrangement.spacedBy(10.dp)
                    ) {
                        Text(
                            text = "🤖 Select AI Inference Engine (Hackathon Showcase)",
                            fontWeight = FontWeight.Bold,
                            fontSize = 13.sp,
                            color = ForestGreenDark
                        )

                        val isModelFound = isModelInstalledState || localGemmaEngine.isModelInstalled()

                        // 1. On-Device AI (Gemma 3n / Edge)
                        OutlinedButton(
                            onClick = { executeLocalInference() },
                            enabled = currentPhotos.size >= 3,
                            border = BorderStroke(1.5.dp, ForestGreenPrimary),
                            shape = RoundedCornerShape(10.dp),
                            colors = ButtonDefaults.outlinedButtonColors(containerColor = Color(0xFFF1F8E9)),
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(56.dp)
                        ) {
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Row(
                                    verticalAlignment = Alignment.CenterVertically,
                                    modifier = Modifier.weight(1f)
                                ) {
                                    Icon(Icons.Default.PhoneAndroid, contentDescription = null, tint = ForestGreenDark, modifier = Modifier.size(20.dp))
                                    Spacer(modifier = Modifier.width(8.dp))
                                    Column {
                                        Text(
                                            text = if (isModelFound) "📱 On-Device Gemma 3n AI" else "📱 On-Device Edge AI",
                                            fontWeight = FontWeight.Bold,
                                            fontSize = 13.sp,
                                            color = ForestGreenDark
                                        )
                                        Text(
                                            text = if (isModelFound) "⚡ 100% Offline • NPU Accelerated • Edge Privacy" else "⚡ 100% Offline • Instant Rule-Based Draft",
                                            fontSize = 10.sp,
                                            color = Color.DarkGray
                                        )
                                    }
                                }
                                Surface(
                                    color = if (isModelFound) ForestGreenPrimary else Color(0xFF757575),
                                    shape = RoundedCornerShape(4.dp)
                                ) {
                                    Text(
                                        text = if (isModelFound) "Gemma 3n ✓" else "On-Device ✓",
                                        color = Color.White,
                                        fontSize = 9.sp,
                                        fontWeight = FontWeight.Bold,
                                        modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp)
                                    )
                                }
                            }
                        }

                        // 2. Cloud Multimodal AI (Census + Vision)
                        Button(
                            onClick = { executeAnalysis() },
                            enabled = currentPhotos.size >= 3,
                            colors = ButtonDefaults.buttonColors(containerColor = ForestGreenPrimary),
                            shape = RoundedCornerShape(10.dp),
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(56.dp)
                        ) {
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Row(
                                    verticalAlignment = Alignment.CenterVertically,
                                    modifier = Modifier.weight(1f)
                                ) {
                                    Icon(Icons.Default.Cloud, contentDescription = null, tint = Color.White, modifier = Modifier.size(20.dp))
                                    Spacer(modifier = Modifier.width(8.dp))
                                    Column {
                                        Text(
                                            text = "☁️ Cloud Multimodal AI",
                                            fontWeight = FontWeight.Bold,
                                            fontSize = 13.sp,
                                            color = Color.White
                                        )
                                        Text(
                                            text = "🌐 Tree Census GIS Match + Vision Inspection",
                                            fontSize = 10.sp,
                                            color = Color.White.copy(alpha = 0.9f)
                                        )
                                    }
                                }
                                Surface(
                                    color = Color.White.copy(alpha = 0.25f),
                                    shape = RoundedCornerShape(4.dp)
                                ) {
                                    Text(
                                        text = "Cloud AI ✓",
                                        color = Color.White,
                                        fontSize = 9.sp,
                                        fontWeight = FontWeight.Bold,
                                        modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp)
                                    )
                                }
                            }
                        }
                    }

                    Spacer(modifier = Modifier.height(16.dp))
                }
            }
        }
    }
}
