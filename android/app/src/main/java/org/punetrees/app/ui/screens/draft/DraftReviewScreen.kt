package org.punetrees.app.ui.screens.draft

import android.graphics.BitmapFactory
import android.util.Base64
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.automirrored.filled.ArrowForward
import androidx.compose.material.icons.filled.PictureAsPdf
import androidx.compose.material.icons.filled.Warning
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.launch
import org.punetrees.app.data.remote.ApiClient
import org.punetrees.app.data.remote.model.AnalyzeAndDraftResponse
import org.punetrees.app.data.remote.model.RenderPdfRequest
import org.punetrees.app.ui.components.LegalCitationCard
import org.punetrees.app.ui.components.MarathiSummaryBox
import org.punetrees.app.ui.components.UrgencyBadge
import org.punetrees.app.ui.theme.ForestGreenDark
import org.punetrees.app.ui.theme.ForestGreenPrimary

import android.content.Intent
import android.net.Uri
import android.widget.Toast
import androidx.compose.ui.platform.LocalContext
import androidx.core.content.FileProvider
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.OkHttpClient
import okhttp3.Request
import java.io.File

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun DraftReviewScreen(
    draft: AnalyzeAndDraftResponse,
    photoBase64: String = "",
    onProceedToDispatch: (AnalyzeAndDraftResponse) -> Unit,
    onBack: () -> Unit = {}
) {
    val context = LocalContext.current
    val coroutineScope = rememberCoroutineScope()
    val api = remember { ApiClient.getService() }
    var localPdfFile by remember { mutableStateOf<File?>(null) }

    val photoBitmap = remember(photoBase64) {
        try {
            if (photoBase64.isNotEmpty()) {
                val clean = if (photoBase64.contains(",")) photoBase64.substringAfter(",") else photoBase64
                val bytes = Base64.decode(clean, Base64.DEFAULT)
                BitmapFactory.decodeByteArray(bytes, 0, bytes.size)
            } else null
        } catch (e: Exception) {
            null
        }
    }

    var pdfUrl by remember { mutableStateOf<String?>(null) }
    var isGeneratingPdf by remember { mutableStateOf(false) }
    var isZoomModalOpen by remember { mutableStateOf(false) }

    var editableSubject by remember { mutableStateOf(draft.draftSubjectEn) }
    var editableBody by remember { mutableStateOf(draft.draftBodyEn) }
    var isEditing by remember { mutableStateOf(false) }

    // Full-Screen Pinch-to-Zoom Dialog
    if (isZoomModalOpen && photoBitmap != null) {
        org.punetrees.app.ui.components.ZoomableImageDialog(
            bitmap = photoBitmap,
            onDismiss = { isZoomModalOpen = false }
        )
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Review Formal Grievance", fontWeight = FontWeight.Bold, fontSize = 18.sp) },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back")
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = MaterialTheme.colorScheme.surface,
                    titleContentColor = ForestGreenDark,
                    navigationIconContentColor = ForestGreenDark
                )
            )
        }
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .padding(horizontal = 16.dp)
                .verticalScroll(rememberScrollState()),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            // Header Info & Urgency
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Column {
                    Text(
                        text = "Ref: ${draft.trackingId}",
                        fontWeight = FontWeight.Bold,
                        fontSize = 15.sp,
                        color = ForestGreenDark
                    )
                    Text(
                        text = draft.addressLandmark,
                        fontSize = 12.sp,
                        color = Color.Gray
                    )
                }
                UrgencyBadge(urgency = draft.urgencyLevel)
            }

            // AI Source Engine Transparency Banner
            val isLocal = draft.aiProvider?.contains("LOCAL", ignoreCase = true) == true || draft.aiProvider?.contains("ON-DEVICE", ignoreCase = true) == true || draft.isFallback
            Surface(
                color = if (isLocal) Color(0xFFE8F5E9) else Color(0xFFE3F2FD),
                shape = RoundedCornerShape(8.dp),
                border = androidx.compose.foundation.BorderStroke(1.dp, if (isLocal) Color(0xFFA5D6A7) else Color(0xFF90CAF9)),
                modifier = Modifier.fillMaxWidth()
            ) {
                Row(
                    modifier = Modifier.padding(horizontal = 10.dp, vertical = 6.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = "🤖 Engine: ${draft.aiProvider ?: "OpenRouter Multimodal Vision"}",
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Bold,
                        color = if (isLocal) ForestGreenDark else Color(0xFF1565C0)
                    )
                }
            }

            // Photo Evidence Preview Card (Vertical Portrait Aspect Ratio with Tap-to-Zoom)
            if (photoBitmap != null) {
                Card(
                    shape = RoundedCornerShape(12.dp),
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(280.dp)
                        .clickable { isZoomModalOpen = true }
                ) {
                    Box(
                        modifier = Modifier
                            .fillMaxSize()
                            .background(Color(0xFF1E1E1E))
                    ) {
                        Image(
                            bitmap = photoBitmap.asImageBitmap(),
                            contentDescription = "Captured Tree Photo",
                            contentScale = ContentScale.Fit,
                            modifier = Modifier.fillMaxSize()
                        )
                        
                        // Species & Caption Badge
                        Surface(
                            color = Color.Black.copy(alpha = 0.65f),
                            shape = RoundedCornerShape(4.dp),
                            modifier = Modifier
                                .align(Alignment.BottomStart)
                                .padding(8.dp)
                        ) {
                            Text(
                                text = if (draft.estimatedTreeSpecies != null) "📸 ${draft.estimatedTreeSpecies}" else "📸 Photographic Evidence Attached",
                                color = Color.White,
                                fontSize = 11.sp,
                                fontWeight = FontWeight.Medium,
                                modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp)
                            )
                        }

                        // Tap-to-Zoom Badge
                        Surface(
                            color = Color.Black.copy(alpha = 0.65f),
                            shape = RoundedCornerShape(4.dp),
                            modifier = Modifier
                                .align(Alignment.BottomEnd)
                                .padding(8.dp)
                        ) {
                            Text(
                                text = "🔍 Tap to Zoom",
                                color = Color.White,
                                fontSize = 10.sp,
                                fontWeight = FontWeight.Bold,
                                modifier = Modifier.padding(horizontal = 6.dp, vertical = 4.dp)
                            )
                        }
                    }
                }
            }

            // Perpetrator / Cutting Equipment Alert Card if detected
            if (draft.perpetratorObserved) {
                Card(
                    colors = CardDefaults.cardColors(containerColor = Color(0xFFFFEBEE)),
                    shape = RoundedCornerShape(8.dp),
                    border = androidx.compose.foundation.BorderStroke(1.dp, Color(0xFFEF9A9A)),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Column(modifier = Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Icon(Icons.Default.Warning, contentDescription = null, tint = Color(0xFFC62828), modifier = Modifier.size(16.dp))
                            Spacer(modifier = Modifier.width(6.dp))
                            Text("👤 Accused Contractor / Illegal Cutting Evidence", fontWeight = FontWeight.Bold, fontSize = 12.sp, color = Color(0xFFC62828))
                        }
                        if (!draft.perpetratorName.isNullOrBlank()) {
                            Text("• Accused Party: ${draft.perpetratorName} (Phone/Reg: ${draft.perpetratorPhone ?: "N/A"})", fontWeight = FontWeight.SemiBold, fontSize = 11.sp, color = Color(0xFFB71C1C))
                        }
                        if (draft.perpetratorDescription != null && draft.perpetratorName.isNullOrBlank()) {
                            Text(draft.perpetratorDescription, fontSize = 11.sp, color = Color(0xFFB71C1C), lineHeight = 15.sp)
                        }
                    }
                }
            }

            // Forensic Visual Damage / Healthy Tree Card
            if (draft.visualDamageSummary != null) {
                val isHealthy = draft.visualDamageSummary.contains("healthy", ignoreCase = true) || draft.visualDamageSummary.contains("no immediate hazard", ignoreCase = true)
                Card(
                    colors = CardDefaults.cardColors(containerColor = if (isHealthy) Color(0xFFF1F8E9) else Color(0xFFFAFAFA)),
                    shape = RoundedCornerShape(8.dp),
                    border = androidx.compose.foundation.BorderStroke(1.dp, if (isHealthy) Color(0xFFC5E1A5) else Color(0xFFE0E0E0)),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Column(modifier = Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Text(
                                text = if (isHealthy) "🌿 AI Visual Audit: Structurally Sound" else "🔍 Forensic Visual Observation",
                                fontWeight = FontWeight.Bold,
                                fontSize = 12.sp,
                                color = if (isHealthy) ForestGreenPrimary else Color(0xFF424242)
                            )
                        }
                        Text(
                            text = draft.visualDamageSummary,
                            fontSize = 11.sp,
                            color = if (isHealthy) Color(0xFF33691E) else Color(0xFF616161),
                            lineHeight = 15.sp
                        )
                    }
                }
            }

            // Potential PMC Tree Census GIS Auxiliary Card
            if (draft.censusTree != null) {
                val ct = draft.censusTree
                Card(
                    colors = CardDefaults.cardColors(containerColor = if (ct.isHeritageTree) Color(0xFFFFF8E1) else Color(0xFFE8F5E9)),
                    shape = RoundedCornerShape(10.dp),
                    border = androidx.compose.foundation.BorderStroke(1.dp, if (ct.isHeritageTree) Color(0xFFFFB300) else Color(0xFFA5D6A7)),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Column(modifier = Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Text("🌳", fontSize = 16.sp)
                                Spacer(modifier = Modifier.width(6.dp))
                                Column {
                                    Text(
                                        text = "Potential PMC Census Match",
                                        fontWeight = FontWeight.Bold,
                                        fontSize = 12.sp,
                                        color = if (ct.isHeritageTree) Color(0xFFE65100) else ForestGreenDark
                                    )
                                    Text(
                                        text = "Auxiliary baseline (${ct.distanceMeters}m away) • Live photo is primary",
                                        fontSize = 10.sp,
                                        color = Color.Gray
                                    )
                                }
                            }
                            Surface(
                                color = if (ct.isHeritageTree) Color(0xFFE65100) else ForestGreenPrimary,
                                shape = RoundedCornerShape(12.dp)
                            ) {
                                Text(
                                    text = "#${ct.censusTagId}",
                                    color = Color.White,
                                    fontSize = 11.sp,
                                    fontWeight = FontWeight.Bold,
                                    modifier = Modifier.padding(horizontal = 8.dp, vertical = 2.dp)
                                )
                            }
                        }
                        Text(
                            text = "• 2019 Census Species: ${ct.botanicalName} (${ct.commonName})",
                            fontSize = 12.sp,
                            fontWeight = FontWeight.SemiBold,
                            color = Color(0xFF2E7D32)
                        )
                        Text(
                            text = "• Recorded Girth: ${ct.girthCm.toInt()} cm | Height: ${ct.heightM.toInt()}m (Est. Age: ~${ct.estimatedAgeYears} yrs)",
                            fontSize = 11.sp,
                            color = Color.DarkGray
                        )
                        Text(
                            text = "• Status: ${ct.legalStatus}",
                            fontSize = 11.sp,
                            fontWeight = FontWeight.Bold,
                            color = if (ct.isHeritageTree) Color(0xFFBF360C) else ForestGreenPrimary
                        )
                    }
                }
            } else {
                Card(
                    colors = CardDefaults.cardColors(containerColor = Color(0xFFF5F5F5)),
                    shape = RoundedCornerShape(10.dp),
                    border = androidx.compose.foundation.BorderStroke(1.dp, Color(0xFFE0E0E0)),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Row(
                        modifier = Modifier.padding(12.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text("ℹ️", fontSize = 18.sp)
                        Spacer(modifier = Modifier.width(10.dp))
                        Column {
                            Text(
                                text = "PMC Tree Census: Not Found within 15m",
                                fontWeight = FontWeight.Bold,
                                fontSize = 12.sp,
                                color = Color.DarkGray
                            )
                            Text(
                                text = "No registered 2019 census record at these exact coordinates. Tree may be unrecorded, newly planted, or on private property.",
                                fontSize = 11.sp,
                                color = Color.Gray,
                                lineHeight = 15.sp
                            )
                        }
                    }
                }
            }

            // Routed Authority Banner (Clean structured card)
            Card(
                colors = CardDefaults.cardColors(containerColor = Color(0xFFE8F5E9)),
                shape = RoundedCornerShape(10.dp),
                border = androidx.compose.foundation.BorderStroke(1.dp, Color(0xFFA5D6A7)),
                modifier = Modifier.fillMaxWidth()
            ) {
                Row(
                    modifier = Modifier.padding(12.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text("🏛️", fontSize = 22.sp)
                    Spacer(modifier = Modifier.width(10.dp))
                    Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
                        Text(
                            text = "ROUTED COMPETENT AUTHORITY",
                            fontSize = 10.sp,
                            fontWeight = FontWeight.Bold,
                            color = ForestGreenPrimary
                        )
                        Text(
                            text = draft.routedAuthority.name,
                            fontSize = 13.sp,
                            fontWeight = FontWeight.Bold,
                            color = ForestGreenDark,
                            lineHeight = 17.sp
                        )
                    }
                }
            }

            // Header with Edit Draft Action
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Text(
                    text = "Grievance Legal Notice",
                    fontWeight = FontWeight.Bold,
                    fontSize = 14.sp,
                    color = ForestGreenPrimary
                )
                TextButton(
                    onClick = { isEditing = !isEditing }
                ) {
                    Text(
                        text = if (isEditing) "💾 Done Editing" else "✏️ Customize / Edit Draft",
                        fontWeight = FontWeight.Bold,
                        fontSize = 12.sp,
                        color = ForestGreenPrimary
                    )
                }
            }

            if (isEditing) {
                Card(
                    colors = CardDefaults.cardColors(containerColor = Color(0xFFFFFDE7)),
                    shape = RoundedCornerShape(8.dp),
                    border = androidx.compose.foundation.BorderStroke(1.dp, Color(0xFFFFF59D)),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Text(
                        text = "💡 Tip: You can fill in the placeholders [Your Name, Phone, Society/Building, Ground Observations] directly in the text below.",
                        fontSize = 11.sp,
                        color = Color(0xFFF57F17),
                        modifier = Modifier.padding(10.dp)
                    )
                }

                // Editable Subject
                OutlinedTextField(
                    value = editableSubject,
                    onValueChange = { editableSubject = it },
                    label = { Text("Subject Line") },
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(8.dp)
                )

                // Editable Letter Body
                OutlinedTextField(
                    value = editableBody,
                    onValueChange = { editableBody = it },
                    label = { Text("Formal Letter Draft (English)") },
                    modifier = Modifier.fillMaxWidth(),
                    minLines = 10,
                    shape = RoundedCornerShape(8.dp)
                )
            } else {
                // Subject Line
                Card(
                    colors = CardDefaults.cardColors(containerColor = Color.White),
                    shape = RoundedCornerShape(8.dp),
                    border = androidx.compose.foundation.BorderStroke(1.dp, Color(0xFFE0E0E0)),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Column(modifier = Modifier.padding(12.dp)) {
                        Text("Subject:", fontSize = 11.sp, color = Color.Gray, fontWeight = FontWeight.Bold)
                        Spacer(modifier = Modifier.height(2.dp))
                        Text(editableSubject, fontSize = 13.sp, fontWeight = FontWeight.SemiBold)
                    }
                }

                // Formal Letter Body (English)
                Card(
                    colors = CardDefaults.cardColors(containerColor = Color.White),
                    shape = RoundedCornerShape(8.dp),
                    border = androidx.compose.foundation.BorderStroke(1.dp, Color(0xFFE0E0E0)),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Column(modifier = Modifier.padding(12.dp)) {
                        Text("Formal Letter Draft (English):", fontSize = 11.sp, color = Color.Gray, fontWeight = FontWeight.Bold)
                        Spacer(modifier = Modifier.height(6.dp))
                        Text(
                            text = editableBody,
                            fontSize = 12.sp,
                            lineHeight = 18.sp,
                            color = Color(0xFF212121)
                        )
                    }
                }
            }

            // Marathi Summary Card (for field workers / WhatsApp)
            MarathiSummaryBox(summaryText = draft.draftSummaryMr)

            // Helper to launch PDF viewer intent
            fun launchPdfViewer(file: File) {
                try {
                    val uri = FileProvider.getUriForFile(
                        context,
                        "${context.packageName}.fileprovider",
                        file
                    )
                    val intent = Intent(Intent.ACTION_VIEW).apply {
                        setDataAndType(uri, "application/pdf")
                        addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                    }
                    context.startActivity(Intent.createChooser(intent, "Open Tree Grievance PDF"))
                } catch (e: Exception) {
                    Toast.makeText(context, "Cannot open PDF viewer: ${e.localizedMessage}", Toast.LENGTH_SHORT).show()
                }
            }

            // Generate & Preview PDF Button
            if (localPdfFile != null) {
                Button(
                    onClick = { launchPdfViewer(localPdfFile!!) },
                    colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF2E7D32)),
                    shape = RoundedCornerShape(8.dp),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Icon(Icons.Default.PictureAsPdf, contentDescription = null, tint = Color.White)
                    Spacer(modifier = Modifier.width(8.dp))
                    Text(
                        text = "👁️ View Generated Official PDF (${draft.trackingId}.pdf)",
                        color = Color.White,
                        fontWeight = FontWeight.Bold
                    )
                }
            } else {
                OutlinedButton(
                    onClick = {
                        isGeneratingPdf = true
                        coroutineScope.launch {
                            try {
                                val res = api.renderPdf(RenderPdfRequest(draft.complaintId))
                                if (res.isSuccessful && res.body() != null) {
                                    val returnedPdfUrl = res.body()!!.pdfUrl
                                    pdfUrl = returnedPdfUrl

                                    // Download and save locally on IO thread
                                    val cleanBase = ApiClient.baseUrl.trimEnd('/')
                                    val cleanEndpoint = returnedPdfUrl.trimStart('/')
                                    val fullDownloadUrl = if (returnedPdfUrl.startsWith("http")) returnedPdfUrl else "$cleanBase/$cleanEndpoint"

                                    val savedFile = withContext(Dispatchers.IO) {
                                        try {
                                            val okHttp = OkHttpClient()
                                            val downloadReq = Request.Builder().url(fullDownloadUrl).build()
                                            val resp = okHttp.newCall(downloadReq).execute()
                                            if (resp.isSuccessful) {
                                                val bytes = resp.body?.bytes()
                                                if (bytes != null) {
                                                    val file = File(context.cacheDir, "${draft.trackingId}_Notice.pdf")
                                                    file.writeBytes(bytes)
                                                    file
                                                } else null
                                            } else null
                                        } catch (e: Exception) {
                                            e.printStackTrace()
                                            null
                                        }
                                    }

                                    if (savedFile != null) {
                                        localPdfFile = savedFile
                                        Toast.makeText(context, "PDF generated & saved locally!", Toast.LENGTH_SHORT).show()
                                        launchPdfViewer(savedFile)
                                    } else {
                                        Toast.makeText(context, "Could not download PDF from server", Toast.LENGTH_SHORT).show()
                                    }
                                } else {
                                    Toast.makeText(context, "Failed to compile PDF: ${res.code()}", Toast.LENGTH_SHORT).show()
                                }
                            } catch (e: Exception) {
                                e.printStackTrace()
                                Toast.makeText(context, "PDF error: ${e.localizedMessage}", Toast.LENGTH_SHORT).show()
                            } finally {
                                isGeneratingPdf = false
                            }
                        }
                    },
                    shape = RoundedCornerShape(8.dp),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Icon(Icons.Default.PictureAsPdf, contentDescription = null, tint = ForestGreenPrimary)
                    Spacer(modifier = Modifier.width(8.dp))
                    Text(
                        text = if (isGeneratingPdf) "Compiling Official PDF..." else "Compile & View Official PDF (A4 Notice)",
                        color = ForestGreenPrimary,
                        fontWeight = FontWeight.SemiBold
                    )
                }
            }

            // Proceed to Dispatch CTA
            Button(
                onClick = { onProceedToDispatch(draft.copy(draftSubjectEn = editableSubject, draftBodyEn = editableBody)) },
                colors = ButtonDefaults.buttonColors(containerColor = ForestGreenPrimary),
                shape = RoundedCornerShape(10.dp),
                modifier = Modifier
                    .fillMaxWidth()
                    .height(50.dp)
            ) {
                Text("Select Dispatch Channels & Confirm", fontWeight = FontWeight.Bold, fontSize = 15.sp)
                Spacer(modifier = Modifier.width(8.dp))
                Icon(Icons.AutoMirrored.Filled.ArrowForward, contentDescription = null)
            }

            Spacer(modifier = Modifier.height(16.dp))
        }
    }
}
