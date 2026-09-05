package org.punetrees.app.ui.screens.triage

import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.launch
import org.punetrees.app.data.remote.ApiClient
import org.punetrees.app.data.remote.model.AnalyzeAndDraftRequest
import org.punetrees.app.data.remote.model.AnalyzeAndDraftResponse
import org.punetrees.app.data.remote.model.DuplicateCheckRequest
import org.punetrees.app.data.remote.model.DuplicateCheckResponse
import org.punetrees.app.ui.components.DuplicateAlertBanner
import org.punetrees.app.ui.components.LiveTiltIndicator
import org.punetrees.app.ui.components.UrgencyBadge
import org.punetrees.app.ui.theme.ForestGreenPrimary

import android.graphics.BitmapFactory
import android.graphics.Bitmap
import android.util.Base64
import android.widget.Toast
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import java.io.ByteArrayOutputStream

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun TriageScreen(
    photoBase64: String,
    latitude: Double,
    longitude: Double,
    tiltAngle: Float,
    onDraftReady: (AnalyzeAndDraftResponse) -> Unit,
    onBack: () -> Unit
) {
    val context = LocalContext.current
    val coroutineScope = rememberCoroutineScope()
    val api = remember { ApiClient.getService() }

    val photoBitmap = remember(photoBase64) {
        try {
            val clean = if (photoBase64.contains(",")) photoBase64.substringAfter(",") else photoBase64
            val bytes = Base64.decode(clean, Base64.DEFAULT)
            BitmapFactory.decodeByteArray(bytes, 0, bytes.size)
        } catch (e: Exception) {
            null
        }
    }

    var duplicateResult by remember { mutableStateOf<DuplicateCheckResponse?>(null) }
    var isLoading by remember { mutableStateOf(false) }
    var citizenNotes by remember { mutableStateOf("") }
    var selectedCategory by remember { mutableStateOf("DANGEROUS_LEANING_FALL_RISK") }

    // Optional Auxiliary / Perpetrator photo evidence state
    var perpetratorPhotoBase64 by remember { mutableStateOf<String?>(null) }
    var perpetratorBitmap by remember { mutableStateOf<Bitmap?>(null) }

    val perpetratorLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.TakePicturePreview()
    ) { bmp ->
        if (bmp != null) {
            perpetratorBitmap = bmp
            val stream = ByteArrayOutputStream()
            bmp.compress(Bitmap.CompressFormat.JPEG, 80, stream)
            val b64 = Base64.encodeToString(stream.toByteArray(), Base64.NO_WRAP)
            perpetratorPhotoBase64 = b64
        }
    }

    val categories = listOf(
        "DANGEROUS_LEANING_FALL_RISK" to "⚠️ Leaning Tree / Fall Risk",
        "ILLEGAL_FELLING" to "🪓 Illegal Tree Felling",
        "UNAUTHORIZED_PRUNING" to "✂️ Unauthorized Heavy Pruning",
        "HAZARDOUS_BRANCH" to "🌿 Hazardous Broken Branch",
        "ROOT_CONCRETIZATION" to "🧱 Root Concretization",
        "DISEASE_PEST" to "🐛 Disease / Termite Decay"
    )

    var resolvedAddress by remember { mutableStateOf("Locating Pune area...") }

    // Check duplicates and reverse-geocode on launch
    LaunchedEffect(latitude, longitude) {
        if (latitude != 0.0 && longitude != 0.0) {
            kotlinx.coroutines.withContext(kotlinx.coroutines.Dispatchers.IO) {
                try {
                    val geocoder = android.location.Geocoder(context, java.util.Locale.getDefault())
                    val list = geocoder.getFromLocation(latitude, longitude, 1)
                    if (!list.isNullOrEmpty()) {
                        val a = list[0]
                        val feature = a.featureName ?: a.thoroughfare ?: a.subLocality ?: "Pune"
                        val full = a.getAddressLine(0) ?: "$feature, Pune"
                        resolvedAddress = full
                    } else {
                        resolvedAddress = "Near Fergusson College Road, Shivajinagar, Pune"
                    }
                } catch (e: Exception) {
                    resolvedAddress = "Near Fergusson College Road, Shivajinagar, Pune"
                }
            }
            try {
                val response = api.checkDuplicate(DuplicateCheckRequest(latitude, longitude, 30.0))
                if (response.isSuccessful) {
                    duplicateResult = response.body()
                }
            } catch (e: Exception) {
                e.printStackTrace()
            }
        } else {
            resolvedAddress = "Near Fergusson College Road, Shivajinagar, Pune"
        }
    }

    var isZoomModalOpen by remember { mutableStateOf(false) }
    var zoomBitmapTarget by remember { mutableStateOf<Bitmap?>(null) }

    if (isZoomModalOpen && (zoomBitmapTarget ?: photoBitmap) != null) {
        org.punetrees.app.ui.components.ZoomableImageDialog(
            bitmap = zoomBitmapTarget ?: photoBitmap!!,
            onDismiss = { isZoomModalOpen = false }
        )
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Triage & Evidence Review", fontWeight = FontWeight.Bold, fontSize = 18.sp) },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = MaterialTheme.colorScheme.background)
            )
        }
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .padding(horizontal = 16.dp)
                .verticalScroll(rememberScrollState()),
            verticalArrangement = Arrangement.spacedBy(14.dp)
        ) {
            // Photo Header (Vertical Portrait Aspect Ratio with Tap-to-Zoom)
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(300.dp)
                    .clip(RoundedCornerShape(12.dp))
                    .background(Color(0xFF1E1E1E))
                    .clickable { isZoomModalOpen = true }
            ) {
                if (photoBitmap != null) {
                    Image(
                        bitmap = photoBitmap.asImageBitmap(),
                        contentDescription = "Captured Tree Photo",
                        contentScale = ContentScale.Fit,
                        modifier = Modifier.fillMaxSize()
                    )
                }

                // Tap-to-Zoom guidance chip
                Surface(
                    color = Color.Black.copy(alpha = 0.7f),
                    shape = RoundedCornerShape(topStart = 8.dp),
                    modifier = Modifier.align(Alignment.BottomEnd)
                ) {
                    Row(
                        modifier = Modifier.padding(horizontal = 10.dp, vertical = 6.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text("🔍 Tap to Zoom", color = Color.White, fontSize = 11.sp, fontWeight = FontWeight.Bold)
                    }
                }
            }

            // Duplicate Detection Banner (If matching complaint exists within 30m)
            duplicateResult?.let { dup ->
                if (dup.hasDuplicates && dup.nearbyComplaints.isNotEmpty()) {
                    val firstDup = dup.nearbyComplaints.first()
                    DuplicateAlertBanner(
                        duplicateCount = dup.duplicateCount,
                        distanceM = firstDup.distanceMeters,
                        onUpvoteClick = {
                            coroutineScope.launch {
                                try {
                                    val upvoteRes = api.upvoteWitness(org.punetrees.app.data.remote.model.UpvoteWitnessRequest(complaintId = firstDup.id))
                                    if (upvoteRes.isSuccessful) {
                                        Toast.makeText(context, "Added as witness! Thank you for corroborating.", Toast.LENGTH_SHORT).show()
                                    }
                                } catch (e: Exception) {
                                    e.printStackTrace()
                                }
                            }
                        },
                        onProceedAnywayClick = {
                            duplicateResult = null // Dismiss banner
                        }
                    )
                }
            }

            // Location & Street Landmark Card
            Card(
                colors = CardDefaults.cardColors(containerColor = Color(0xFFF1F8E9)),
                shape = RoundedCornerShape(10.dp),
                modifier = Modifier.fillMaxWidth()
            ) {
                Column(modifier = Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    Text("📍 Detected Street & Location Landmark", fontSize = 11.sp, color = ForestGreenPrimary, fontWeight = FontWeight.Bold)
                    Text(
                        text = resolvedAddress,
                        fontWeight = FontWeight.Bold,
                        fontSize = 13.sp,
                        color = Color(0xFF1B5E20)
                    )
                    if (latitude != 0.0 && longitude != 0.0) {
                        Text(
                            text = "Coordinates: ${"%.5f".format(latitude)}° N, ${"%.5f".format(longitude)}° E",
                            fontSize = 11.sp,
                            color = Color.Gray
                        )
                    } else {
                        Text("Coordinates: Using Pune Central preset", fontSize = 11.sp, color = Color.Gray)
                    }
                }
            }

            // Category Selection
            Text("Issue Classification:", fontWeight = FontWeight.Bold, fontSize = 14.sp)
            Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                categories.forEach { (key, label) ->
                    val isSelected = selectedCategory == key
                    Surface(
                        onClick = { selectedCategory = key },
                        shape = RoundedCornerShape(8.dp),
                        color = if (isSelected) ForestGreenPrimary.copy(alpha = 0.12f) else Color.White,
                        border = androidx.compose.foundation.BorderStroke(
                            1.dp,
                            if (isSelected) ForestGreenPrimary else Color(0xFFE0E0E0)
                        ),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            modifier = Modifier.padding(horizontal = 12.dp, vertical = 10.dp)
                        ) {
                            RadioButton(selected = isSelected, onClick = null)
                            Spacer(modifier = Modifier.width(8.dp))
                            Text(label, fontSize = 13.sp, fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Normal)
                        }
                    }
                }
            }

            // Category-Specific Forensics Guidance Card
            val categoryGuidance = when (selectedCategory) {
                "ILLEGAL_FELLING" -> Pair(
                    "🪓 Illegal Tree Felling Evidence Guide",
                    "• Ensure freshly cut timber & stump diameter are clear.\n• If felling in progress, capture the perpetrator cutting, chainsaw/axe, or vehicle.\n• Lack of official PMC Tree Authority permission board will be cited."
                )
                "UNAUTHORIZED_PRUNING" -> Pair(
                    "✂️ Unauthorized Heavy Pruning Evidence Guide",
                    "• Capture drastically hacked canopy & lopped branch stubs.\n• Capture the contractor / persons on ladders or machinery executing unauthorized hacking."
                )
                "DANGEROUS_LEANING_FALL_RISK" -> Pair(
                    "📐 Leaning Fall Risk Evidence Guide",
                    "• Capture wide angle showing trunk lean relative to vertical buildings.\n• Highlight base root upheaval, cracked sidewalk, or powerline proximity."
                )
                "HAZARDOUS_BRANCH" -> Pair(
                    "🌿 Hazardous Broken Branch Guide",
                    "• Capture the cracked or split limb suspended overhead.\n• Show clearance over pedestrian walkways, traffic, or electrical wires."
                )
                "ROOT_CONCRETIZATION" -> Pair(
                    "🧱 Root Basin Concretization Guide",
                    "• Capture asphalt or paver blocks poured directly against the tree base.\n• Document violation of mandatory 1-meter unpaved soil basin per NGT/HC orders."
                )
                "DISEASE_PEST" -> Pair(
                    "🐛 Disease & Trunk Decay Guide",
                    "• Capture close-up of fungal conks, termite galleries, hollow trunk rot, or severe canopy dieback."
                )
                else -> null
            }

            if (categoryGuidance != null) {
                Card(
                    colors = CardDefaults.cardColors(containerColor = Color(0xFFF1F8E9)),
                    shape = RoundedCornerShape(10.dp),
                    border = androidx.compose.foundation.BorderStroke(1.dp, Color(0xFFC5E1A5)),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Column(modifier = Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                        Text(categoryGuidance.first, fontWeight = FontWeight.Bold, fontSize = 12.sp, color = ForestGreenPrimary)
                        Text(categoryGuidance.second, fontSize = 11.sp, color = Color(0xFF33691E), lineHeight = 15.sp)
                    }
                }
            }

            // Optional Perpetrator / Equipment Photo Slot (for Illegal Felling & Unauthorized Pruning)
            if (selectedCategory == "ILLEGAL_FELLING" || selectedCategory == "UNAUTHORIZED_PRUNING") {
                Card(
                    colors = CardDefaults.cardColors(containerColor = Color(0xFFFFF8E1)),
                    shape = RoundedCornerShape(10.dp),
                    border = androidx.compose.foundation.BorderStroke(1.dp, Color(0xFFFFD54F)),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Column(modifier = Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Text("👤 Optional: Offender / Equipment Evidence", fontWeight = FontWeight.Bold, fontSize = 12.sp, color = Color(0xFFE65100))
                            Spacer(modifier = Modifier.weight(1f))
                            Surface(
                                color = Color(0xFFFFECB3),
                                shape = RoundedCornerShape(4.dp)
                            ) {
                                Text("OPTIONAL", fontSize = 9.sp, fontWeight = FontWeight.Bold, color = Color(0xFFE65100), modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp))
                            }
                        }
                        Text(
                            text = "Capture the person cutting, contractor on ladder, chainsaw/axe, or timber truck without authorization. This is auxiliary evidence and does not block your submission.",
                            fontSize = 11.sp,
                            color = Color(0xFF5D4037),
                            lineHeight = 15.sp
                        )

                        if (perpetratorBitmap != null) {
                            Box(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .height(180.dp)
                                    .clip(RoundedCornerShape(8.dp))
                                    .background(Color(0xFF212121))
                                    .clickable {
                                        zoomBitmapTarget = perpetratorBitmap
                                        isZoomModalOpen = true
                                    }
                            ) {
                                Image(
                                    bitmap = perpetratorBitmap!!.asImageBitmap(),
                                    contentDescription = "Perpetrator Evidence",
                                    contentScale = ContentScale.Fit,
                                    modifier = Modifier.fillMaxSize()
                                )
                                TextButton(
                                    onClick = {
                                        perpetratorPhotoBase64 = null
                                        perpetratorBitmap = null
                                    },
                                    modifier = Modifier.align(Alignment.TopEnd)
                                ) {
                                    Text("✕ Remove", color = Color(0xFFFF5252), fontSize = 11.sp, fontWeight = FontWeight.Bold)
                                }
                            }
                        } else {
                            OutlinedButton(
                                onClick = { perpetratorLauncher.launch(null) },
                                shape = RoundedCornerShape(8.dp),
                                modifier = Modifier.fillMaxWidth()
                            ) {
                                Text("📸 Snap Photo of Person Cutting / Vehicle", fontSize = 12.sp, color = Color(0xFFE65100), fontWeight = FontWeight.Bold)
                            }
                        }
                    }
                }
            }

            // Citizen Field Notes
            OutlinedTextField(
                value = citizenNotes,
                onValueChange = { citizenNotes = it },
                label = { Text("Citizen Observations / Specific Danger") },
                placeholder = { Text("e.g. Leaning heavily towards road after heavy rain, cracked pavement") },
                modifier = Modifier.fillMaxWidth(),
                minLines = 2
            )

            // Submit Button
            Button(
                onClick = {
                    isLoading = true
                    coroutineScope.launch {
                        try {
                            val allPhotos = if (perpetratorPhotoBase64 != null) listOf(photoBase64, perpetratorPhotoBase64!!) else listOf(photoBase64)
                            val request = AnalyzeAndDraftRequest(
                                photoBase64 = photoBase64,
                                photosBase64 = allPhotos,
                                citizenSelectedCategory = selectedCategory,
                                latitude = latitude,
                                longitude = longitude,
                                sensorTiltAngle = tiltAngle,
                                citizenNotes = citizenNotes,
                                addressLandmark = resolvedAddress
                            )
                            val res = api.analyzeAndDraft(request)
                            if (res.isSuccessful && res.body() != null) {
                                onDraftReady(res.body()!!)
                            } else {
                                val errorMsg = res.errorBody()?.string() ?: "Server error (${res.code()})"
                                Toast.makeText(context, "Backend error: $errorMsg", Toast.LENGTH_LONG).show()
                            }
                        } catch (e: Exception) {
                            e.printStackTrace()
                            Toast.makeText(context, "Connection failed: Check if backend server is running (${e.localizedMessage ?: "Network error"})", Toast.LENGTH_LONG).show()
                        } finally {
                            isLoading = false
                        }
                    }
                },
                colors = ButtonDefaults.buttonColors(containerColor = ForestGreenPrimary),
                enabled = !isLoading,
                shape = RoundedCornerShape(10.dp),
                modifier = Modifier
                    .fillMaxWidth()
                    .height(50.dp)
            ) {
                if (isLoading) {
                    CircularProgressIndicator(color = Color.White, modifier = Modifier.size(22.dp))
                } else {
                    Text("🤖 AI Analyze & Draft Legal Grievance", fontWeight = FontWeight.Bold, fontSize = 15.sp)
                }
            }

            Spacer(modifier = Modifier.height(16.dp))
        }
    }
}
