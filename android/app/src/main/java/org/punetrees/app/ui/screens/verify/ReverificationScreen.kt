package org.punetrees.app.ui.screens.verify

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Matrix
import android.media.ExifInterface
import android.util.Base64
import android.widget.Toast
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
import org.punetrees.app.core.location.LocationProvider
import org.punetrees.app.data.remote.ApiClient
import org.punetrees.app.data.remote.model.ComplaintDetailResponse
import org.punetrees.app.data.remote.model.ReverifyRequest
import org.punetrees.app.data.remote.model.ReverifyResponse
import org.punetrees.app.ui.theme.ForestGreenDark
import org.punetrees.app.ui.theme.ForestGreenPrimary
import java.io.ByteArrayOutputStream
import java.io.File

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ReverificationScreen(
    complaintId: String,
    trackingId: String,
    locationProvider: LocationProvider,
    onDone: () -> Unit
) {
    val context = LocalContext.current
    val coroutineScope = rememberCoroutineScope()
    val api = remember { ApiClient.getService() }

    var complaintDetail by remember { mutableStateOf<ComplaintDetailResponse?>(null) }
    var origBitmap by remember { mutableStateOf<Bitmap?>(null) }
    var currentCoords by remember { mutableStateOf<Pair<Double, Double>?>(null) }

    // Re-verification photo state
    var auditBitmap by remember { mutableStateOf<Bitmap?>(null) }
    var auditBase64 by remember { mutableStateOf<String?>(null) }
    var auditFile by remember { mutableStateOf<File?>(null) }
    var citizenNotes by remember { mutableStateOf("") }

    var isAuditing by remember { mutableStateOf(false) }
    var auditResult by remember { mutableStateOf<ReverifyResponse?>(null) }
    var errorMessage by remember { mutableStateOf<String?>(null) }

    // Native Camera Launcher
    val cameraLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.TakePicture()
    ) { success ->
        if (success && auditFile != null && auditFile!!.exists()) {
            coroutineScope.launch {
                val pair = withContext(Dispatchers.IO) {
                    processAuditFile(auditFile!!)
                }
                if (pair != null) {
                    auditBitmap = pair.first
                    auditBase64 = pair.second
                }
            }
        }
    }

    fun launchNativeCamera() {
        val imagesDir = File(context.cacheDir, "camera_images").apply { mkdirs() }
        val file = File(imagesDir, "reverify_${trackingId}_${System.currentTimeMillis()}.jpg")
        auditFile = file
        val uri = FileProvider.getUriForFile(context, "${context.packageName}.fileprovider", file)
        cameraLauncher.launch(uri)
    }

    LaunchedEffect(Unit) {
        currentCoords = locationProvider.getCurrentLocation()
        try {
            val resp = api.getComplaintDetail(complaintId)
            if (resp.isSuccessful && resp.body() != null) {
                val detail = resp.body()!!
                complaintDetail = detail
                val firstPhoto = detail.photoUrls?.firstOrNull()
                if (!firstPhoto.isNullOrEmpty()) {
                    val clean = if (firstPhoto.contains(",")) firstPhoto.substringAfter(",") else firstPhoto
                    val bytes = Base64.decode(clean, Base64.DEFAULT)
                    origBitmap = BitmapFactory.decodeByteArray(bytes, 0, bytes.size)
                }
            }
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    fun executeAudit() {
        if (auditBase64.isNullOrEmpty()) {
            Toast.makeText(context, "Please snap a re-verification photo first.", Toast.LENGTH_SHORT).show()
            return
        }

        isAuditing = true
        errorMessage = null
        coroutineScope.launch {
            try {
                val lat = currentCoords?.first ?: (complaintDetail?.latitude ?: 18.5196)
                val lon = currentCoords?.second ?: (complaintDetail?.longitude ?: 73.8436)

                val req = ReverifyRequest(
                    complaintId = complaintId,
                    photoBase64 = auditBase64!!,
                    latitude = lat,
                    longitude = lon,
                    citizenNotes = citizenNotes.ifBlank { null }
                )

                val res = api.verifyResolution(complaintId, req)
                if (res.isSuccessful && res.body() != null) {
                    auditResult = res.body()!!
                } else {
                    errorMessage = "Re-audit failed (${res.code()}). Please try again."
                }
            } catch (e: Exception) {
                e.printStackTrace()
                errorMessage = "Audit error: ${e.localizedMessage}"
            } finally {
                isAuditing = false
            }
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Ground Re-Audit: $trackingId", fontWeight = FontWeight.Bold, fontSize = 17.sp) },
                navigationIcon = {
                    IconButton(onClick = onDone) {
                        Icon(Icons.Default.ArrowBack, contentDescription = "Back")
                    }
                },
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
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            if (auditResult != null) {
                // VERDICT DISPLAY
                val res = auditResult!!
                val isResolved = res.aiVerdict == "RESOLVED_CLEARED"

                Card(
                    colors = CardDefaults.cardColors(containerColor = if (isResolved) Color(0xFFE8F5E9) else Color(0xFFFFEBEE)),
                    shape = RoundedCornerShape(12.dp),
                    border = BorderStroke(1.5.dp, if (isResolved) ForestGreenPrimary else Color(0xFFE53935)),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Icon(
                                imageVector = if (isResolved) Icons.Default.CheckCircle else Icons.Default.Warning,
                                contentDescription = null,
                                tint = if (isResolved) ForestGreenPrimary else Color(0xFFD32F2F),
                                modifier = Modifier.size(28.dp)
                            )
                            Spacer(modifier = Modifier.width(10.dp))
                            Column {
                                Text(
                                    text = if (isResolved) "✓ ISSUE RESOLVED & CLEARED" else "⚠️ ISSUE STILL UNRESOLVED",
                                    fontWeight = FontWeight.Bold,
                                    fontSize = 15.sp,
                                    color = if (isResolved) ForestGreenDark else Color(0xFFB71C1C)
                                )
                                Text(
                                    text = "AI Confidence: ${(res.aiConfidence * 100).toInt()}%",
                                    fontSize = 11.sp,
                                    color = Color.Gray
                                )
                            }
                        }

                        Text(
                            text = res.aiNotesEn,
                            fontSize = 13.sp,
                            color = Color(0xFF333333),
                            lineHeight = 17.sp
                        )

                        if (!res.aiNotesMr.isNullOrEmpty()) {
                            Surface(
                                color = Color.White.copy(alpha = 0.8f),
                                shape = RoundedCornerShape(8.dp),
                                modifier = Modifier.fillMaxWidth()
                            ) {
                                Text(
                                    text = res.aiNotesMr,
                                    fontSize = 12.sp,
                                    color = Color(0xFF4E342E),
                                    modifier = Modifier.padding(10.dp)
                                )
                            }
                        }
                    }
                }

                Button(
                    onClick = onDone,
                    colors = ButtonDefaults.buttonColors(containerColor = ForestGreenPrimary),
                    shape = RoundedCornerShape(10.dp),
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(50.dp)
                ) {
                    Text("Return to Tracker", fontWeight = FontWeight.Bold)
                }
            } else if (isAuditing) {
                // LOADING SPINNER
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(300.dp),
                    contentAlignment = Alignment.Center
                ) {
                    Column(
                        horizontalAlignment = Alignment.CenterHorizontally,
                        verticalArrangement = Arrangement.spacedBy(14.dp)
                    ) {
                        CircularProgressIndicator(color = ForestGreenPrimary, strokeWidth = 4.dp, modifier = Modifier.size(52.dp))
                        Text("Comparing Before & After Photos with AI...", fontWeight = FontWeight.Bold, fontSize = 15.sp, color = ForestGreenDark)
                        Text("Executing vision differential inspection...", fontSize = 12.sp, color = Color.Gray)
                    }
                }
            } else {
                // INSTRUCTION & CAPTURE
                Card(
                    colors = CardDefaults.cardColors(containerColor = Color(0xFFE8F5E9)),
                    shape = RoundedCornerShape(10.dp),
                    border = BorderStroke(1.dp, Color(0xFFA5D6A7)),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Column(modifier = Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                        Text("On-Site Verification Instructions", fontWeight = FontWeight.Bold, fontSize = 14.sp, color = ForestGreenDark)
                        Text(
                            text = "Please stand in approximately the same position and snap a new photo of the tree. The AI will compare both images to determine if PMC resolved the hazard.",
                            fontSize = 12.sp,
                            color = Color(0xFF2E7D32),
                            lineHeight = 16.sp
                        )
                    }
                }

                // SIDE BY SIDE / STACKED PREVIEW
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    // Original Photo
                    Column(modifier = Modifier.weight(1f)) {
                        Text("1️⃣ Original Report", fontWeight = FontWeight.Bold, fontSize = 12.sp, color = ForestGreenDark)
                        Spacer(modifier = Modifier.height(4.dp))
                        if (origBitmap != null) {
                            Image(
                                bitmap = origBitmap!!.asImageBitmap(),
                                contentDescription = "Original",
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .height(160.dp)
                                    .clip(RoundedCornerShape(8.dp)),
                                contentScale = ContentScale.Crop
                            )
                        } else {
                            Box(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .height(160.dp)
                                    .background(Color(0xFFEEEEEE), RoundedCornerShape(8.dp)),
                                contentAlignment = Alignment.Center
                            ) {
                                Text("No original image", fontSize = 11.sp, color = Color.Gray)
                            }
                        }
                    }

                    // New Audit Photo
                    Column(modifier = Modifier.weight(1f)) {
                        Text("2️⃣ Today's Photo", fontWeight = FontWeight.Bold, fontSize = 12.sp, color = ForestGreenDark)
                        Spacer(modifier = Modifier.height(4.dp))
                        if (auditBitmap != null) {
                            Image(
                                bitmap = auditBitmap!!.asImageBitmap(),
                                contentDescription = "Today",
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .height(160.dp)
                                    .clip(RoundedCornerShape(8.dp))
                                    .clickable { launchNativeCamera() },
                                contentScale = ContentScale.Crop
                            )
                        } else {
                            Box(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .height(160.dp)
                                    .background(Color(0xFFF1F8E9), RoundedCornerShape(8.dp))
                                    .border(1.dp, ForestGreenPrimary, RoundedCornerShape(8.dp))
                                    .clickable { launchNativeCamera() },
                                contentAlignment = Alignment.Center
                            ) {
                                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                                    Icon(Icons.Default.CameraAlt, contentDescription = null, tint = ForestGreenPrimary)
                                    Spacer(modifier = Modifier.height(4.dp))
                                    Text("Tap to Snap Photo", fontSize = 11.sp, color = ForestGreenPrimary, fontWeight = FontWeight.Bold)
                                }
                            }
                        }
                    }
                }

                // Snap Photo Button
                OutlinedButton(
                    onClick = { launchNativeCamera() },
                    shape = RoundedCornerShape(8.dp),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Icon(Icons.Default.CameraAlt, contentDescription = null, tint = ForestGreenPrimary)
                    Spacer(modifier = Modifier.width(8.dp))
                    Text(
                        text = if (auditBitmap != null) "📸 Retake Today's Photo" else "📸 Snap Verification Photo (Native Camera)",
                        color = ForestGreenPrimary,
                        fontWeight = FontWeight.Bold
                    )
                }

                // Optional Citizen Notes
                OutlinedTextField(
                    value = citizenNotes,
                    onValueChange = { citizenNotes = it },
                    label = { Text("Citizen Verification Note (Optional)") },
                    placeholder = { Text("e.g. Branch still hanging / Danger cleared...") },
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(8.dp)
                )

                if (errorMessage != null) {
                    Text(errorMessage!!, color = MaterialTheme.colorScheme.error, fontSize = 12.sp)
                }

                // Launch AI Audit CTA
                Button(
                    onClick = { executeAudit() },
                    enabled = auditBitmap != null,
                    colors = ButtonDefaults.buttonColors(containerColor = ForestGreenPrimary),
                    shape = RoundedCornerShape(10.dp),
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(52.dp)
                ) {
                    Icon(Icons.Default.CheckCircle, contentDescription = null)
                    Spacer(modifier = Modifier.width(8.dp))
                    Text("🚀 Run AI Comparative Verification", fontWeight = FontWeight.Bold, fontSize = 15.sp)
                }
            }

            Spacer(modifier = Modifier.height(20.dp))
        }
    }
}

private fun processAuditFile(file: File): Pair<Bitmap, String>? {
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
