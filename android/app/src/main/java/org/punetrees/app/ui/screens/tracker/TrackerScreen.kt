package org.punetrees.app.ui.screens.tracker

import android.content.Intent
import android.graphics.BitmapFactory
import android.net.Uri
import android.util.Base64
import android.widget.Toast
import androidx.compose.animation.core.*
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
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
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
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
import okhttp3.OkHttpClient
import okhttp3.Request
import org.punetrees.app.data.remote.ApiClient
import org.punetrees.app.data.remote.model.ComplaintDetailResponse
import org.punetrees.app.data.remote.model.ComplaintListItem
import org.punetrees.app.ui.components.UrgencyBadge
import org.punetrees.app.ui.theme.ForestGreenDark
import org.punetrees.app.ui.theme.ForestGreenPrimary
import java.io.File
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.TimeZone

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun TrackerScreen(
    onNewComplaintClick: () -> Unit,
    onVerifyClick: (complaintId: String, trackingId: String) -> Unit
) {
    val context = LocalContext.current
    val coroutineScope = rememberCoroutineScope()
    val api = remember { ApiClient.getService() }

    val userProfileManager = remember { org.punetrees.app.core.user.UserProfileManager(context) }
    var profile by remember { mutableStateOf(userProfileManager.getProfile()) }
    var showProfileDialog by remember { mutableStateOf(false) }

    var complaints by remember { mutableStateOf<List<ComplaintListItem>>(emptyList()) }
    var isLoading by remember { mutableStateOf(true) }

    var selectedDetail by remember { mutableStateOf<ComplaintDetailResponse?>(null) }
    var isDetailLoading by remember { mutableStateOf(false) }
    var showDetailSheet by remember { mutableStateOf(false) }

    fun loadComplaints() {
        isLoading = true
        coroutineScope.launch {
            try {
                val res = withContext(Dispatchers.IO) {
                    api.listComplaints()
                }
                if (res.isSuccessful && res.body() != null) {
                    complaints = res.body()!!
                } else {
                    complaints = emptyList()
                }
            } catch (e: Exception) {
                e.printStackTrace()
                complaints = emptyList()
            } finally {
                isLoading = false
            }
        }
    }

    fun openComplaintDetail(complaintId: String) {
        isDetailLoading = true
        showDetailSheet = true
        selectedDetail = null
        coroutineScope.launch {
            try {
                val res = withContext(Dispatchers.IO) {
                    api.getComplaintDetail(complaintId)
                }
                if (res.isSuccessful && res.body() != null) {
                    selectedDetail = res.body()
                } else {
                    Toast.makeText(context, "Failed to load complaint details", Toast.LENGTH_SHORT).show()
                    showDetailSheet = false
                }
            } catch (e: Exception) {
                e.printStackTrace()
                Toast.makeText(context, "Error: ${e.localizedMessage}", Toast.LENGTH_SHORT).show()
                showDetailSheet = false
            } finally {
                isDetailLoading = false
            }
        }
    }

    LaunchedEffect(Unit) {
        loadComplaints()
    }

    // Shimmer gradient animation for skeleton loading
    val shimmerColors = listOf(
        Color(0xFFE5E9E2),
        Color(0xFFF3F6F1),
        Color(0xFFE5E9E2)
    )
    val transition = rememberInfiniteTransition(label = "skeletonShimmer")
    val translateAnim by transition.animateFloat(
        initialValue = 0f,
        targetValue = 1200f,
        animationSpec = infiniteRepeatable(
            animation = tween(durationMillis = 900, easing = LinearEasing),
            repeatMode = RepeatMode.Restart
        ),
        label = "shimmerTranslate"
    )
    val shimmerBrush = Brush.linearGradient(
        colors = shimmerColors,
        start = Offset(translateAnim - 400f, translateAnim - 400f),
        end = Offset(translateAnim, translateAnim)
    )

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    org.punetrees.app.ui.components.AppTitleWithLogo(
                        title = "Pune Tree Rakshak",
                        subtitle = "Citizen Complaint App"
                    )
                },
                actions = {
                    IconButton(onClick = { showProfileDialog = true }) {
                        Icon(
                            Icons.Default.AccountCircle,
                            contentDescription = "Citizen Profile",
                            tint = ForestGreenPrimary
                        )
                    }
                    IconButton(onClick = { loadComplaints() }) {
                        Icon(Icons.Default.Refresh, contentDescription = "Refresh")
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = MaterialTheme.colorScheme.background)
            )
        },
        floatingActionButton = {
            FloatingActionButton(
                onClick = {
                    if (!profile.isComplete) {
                        showProfileDialog = true
                    } else {
                        onNewComplaintClick()
                    }
                },
                containerColor = ForestGreenPrimary,
                contentColor = Color.White
            ) {
                Icon(Icons.Default.Add, contentDescription = "Report Tree Hazard")
            }
        }
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
        ) {
            // Section Header
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp, vertical = 10.dp),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = "My Complaints",
                    fontWeight = FontWeight.Bold,
                    fontSize = 17.sp,
                    color = ForestGreenDark
                )
                if (!isLoading && complaints.isNotEmpty()) {
                    Surface(
                        color = Color(0xFFE8F5E9),
                        shape = RoundedCornerShape(12.dp)
                    ) {
                        Text(
                            text = "${complaints.size} Filed",
                            color = ForestGreenPrimary,
                            fontSize = 11.sp,
                            fontWeight = FontWeight.Bold,
                            modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp)
                        )
                    }
                }
            }

            if (isLoading) {
                LazyColumn(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(horizontal = 16.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    items(4) {
                        ComplaintCardSkeleton(brush = shimmerBrush)
                    }
                }
            } else if (complaints.isEmpty()) {
                Box(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(24.dp),
                    contentAlignment = Alignment.Center
                ) {
                    Column(
                        horizontalAlignment = Alignment.CenterHorizontally,
                        verticalArrangement = Arrangement.spacedBy(6.dp)
                    ) {
                        Icon(
                            Icons.Default.Eco,
                            contentDescription = null,
                            tint = Color(0xFFA5D6A7),
                            modifier = Modifier.size(48.dp)
                        )
                        Text(
                            text = "No Complaints Filed Yet",
                            fontWeight = FontWeight.Bold,
                            fontSize = 16.sp,
                            color = ForestGreenDark
                        )
                        Text(
                            text = "Tap + to photograph and report an illegal felling, hazardous branch, or tree issue in Pune",
                            fontSize = 13.sp,
                            color = Color.Gray,
                            textAlign = androidx.compose.ui.text.style.TextAlign.Center,
                            lineHeight = 17.sp
                        )
                    }
                }
            } else {
                LazyColumn(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(horizontal = 16.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    items(complaints) { item ->
                        ComplaintCard(
                            item = item,
                            onClick = { openComplaintDetail(item.id) },
                            onVerifyClick = { onVerifyClick(item.id, item.trackingId) }
                        )
                    }
                }
            }
        }
    }

    // Detail Bottom Sheet
    if (showDetailSheet) {
        ModalBottomSheet(
            onDismissRequest = { showDetailSheet = false },
            sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true),
            containerColor = Color(0xFFF9FBF8)
        ) {
            if (isDetailLoading || selectedDetail == null) {
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(300.dp),
                    contentAlignment = Alignment.Center
                ) {
                    CircularProgressIndicator(color = ForestGreenPrimary)
                }
            } else {
                ComplaintDetailSheetContent(
                    detail = selectedDetail!!,
                    onVerifyClick = {
                        showDetailSheet = false
                        onVerifyClick(selectedDetail!!.id, selectedDetail!!.trackingId)
                    },
                    onDismiss = { showDetailSheet = false }
                )
            }
        }
    }

    if (showProfileDialog) {
        org.punetrees.app.ui.components.CitizenProfileDialog(
            currentProfile = profile,
            onSave = { updated ->
                userProfileManager.saveProfile(updated)
                profile = updated
                showProfileDialog = false
                Toast.makeText(context, "Profile saved! Welcome ${updated.name}", Toast.LENGTH_SHORT).show()
                onNewComplaintClick()
            },
            onDismiss = { showProfileDialog = false },
            canDismiss = true
        )
    }
}

@Composable
fun ComplaintCardSkeleton(
    brush: Brush,
    modifier: Modifier = Modifier
) {
    Card(
        colors = CardDefaults.cardColors(containerColor = Color.White),
        shape = RoundedCornerShape(12.dp),
        border = androidx.compose.foundation.BorderStroke(1.dp, Color(0xFFE2E8DE)),
        modifier = modifier.fillMaxWidth()
    ) {
        Column(modifier = Modifier.padding(14.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Box(
                    modifier = Modifier
                        .width(150.dp)
                        .height(16.dp)
                        .clip(RoundedCornerShape(4.dp))
                        .background(brush)
                )
                Box(
                    modifier = Modifier
                        .width(88.dp)
                        .height(20.dp)
                        .clip(RoundedCornerShape(6.dp))
                        .background(brush)
                )
            }

            Spacer(modifier = Modifier.height(10.dp))
            Box(
                modifier = Modifier
                    .fillMaxWidth(0.55f)
                    .height(16.dp)
                    .clip(RoundedCornerShape(4.dp))
                    .background(brush)
            )

            Spacer(modifier = Modifier.height(6.dp))
            Box(
                modifier = Modifier
                    .fillMaxWidth(0.85f)
                    .height(14.dp)
                    .clip(RoundedCornerShape(4.dp))
                    .background(brush)
            )

            Spacer(modifier = Modifier.height(14.dp))
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Box(
                    modifier = Modifier
                        .width(130.dp)
                        .height(14.dp)
                        .clip(RoundedCornerShape(4.dp))
                        .background(brush)
                )
                Box(
                    modifier = Modifier
                        .width(125.dp)
                        .height(28.dp)
                        .clip(RoundedCornerShape(6.dp))
                        .background(brush)
                )
            }
        }
    }
}

@Composable
fun ComplaintCard(
    item: ComplaintListItem,
    onClick: () -> Unit,
    onVerifyClick: () -> Unit
) {
    val timelockRemainingHours = calculateTimelockHoursRemaining(item.reverificationDueAt)
    val isTimelockActive = timelockRemainingHours > 0 && item.verificationStatus == "PENDING_TIMELOCK"

    Card(
        colors = CardDefaults.cardColors(containerColor = Color.White),
        shape = RoundedCornerShape(12.dp),
        border = androidx.compose.foundation.BorderStroke(1.dp, Color(0xFFE0E0E0)),
        modifier = Modifier
            .fillMaxWidth()
            .clickable { onClick() }
    ) {
        Column(modifier = Modifier.padding(14.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = item.trackingId,
                    fontWeight = FontWeight.Bold,
                    fontSize = 14.sp,
                    color = ForestGreenDark
                )
                UrgencyBadge(urgency = item.urgencyLevel)
            }

            Spacer(modifier = Modifier.height(4.dp))
            Text(
                text = item.issueType.replace("_", " "),
                fontWeight = FontWeight.SemiBold,
                fontSize = 13.sp
            )
            Text(
                text = item.addressLandmark,
                fontSize = 12.sp,
                color = Color.Gray
            )

            Spacer(modifier = Modifier.height(8.dp))

            // Timelock Status Info Banner
            if (isTimelockActive) {
                Surface(
                    color = Color(0xFFFFF8E1),
                    shape = RoundedCornerShape(6.dp),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Row(
                        modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Icon(Icons.Default.Lock, contentDescription = null, tint = Color(0xFFE65100), modifier = Modifier.size(13.dp))
                        Spacer(modifier = Modifier.width(6.dp))
                        Text(
                            text = "Timelock Active: ${timelockRemainingHours}h remaining for field staff",
                            fontSize = 11.sp,
                            fontWeight = FontWeight.Medium,
                            color = Color(0xFFBF360C)
                        )
                    }
                }
            }

            Spacer(modifier = Modifier.height(8.dp))
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = if (item.verificationStatus == "VERIFIED_RESOLVED") "✓ Resolved" else if (item.verificationStatus == "VERIFIED_UNRESOLVED_ESCALATED") "⚠️ Escalated" else "Status: ${item.verificationStatus.replace('_', ' ')}",
                    fontSize = 11.sp,
                    fontWeight = FontWeight.Bold,
                    color = if (item.verificationStatus == "VERIFIED_RESOLVED") Color(0xFF2E7D32) else Color(0xFFE65100)
                )

                if (isTimelockActive) {
                    // Locked Re-verification Button
                    OutlinedButton(
                        onClick = onVerifyClick,
                        shape = RoundedCornerShape(6.dp),
                        contentPadding = PaddingValues(horizontal = 8.dp, vertical = 2.dp)
                    ) {
                        Icon(Icons.Default.Lock, contentDescription = null, modifier = Modifier.size(12.dp), tint = Color.Gray)
                        Spacer(modifier = Modifier.width(4.dp))
                        Text("Locked (${timelockRemainingHours}h)", fontSize = 11.sp, color = Color.Gray)
                    }
                } else {
                    // Active Re-Verification CTA
                    Button(
                        onClick = onVerifyClick,
                        colors = ButtonDefaults.buttonColors(containerColor = if (item.verificationStatus == "VERIFIED_RESOLVED") ForestGreenPrimary else Color(0xFFE65100)),
                        shape = RoundedCornerShape(6.dp),
                        contentPadding = PaddingValues(horizontal = 10.dp, vertical = 4.dp)
                    ) {
                        Icon(Icons.Default.CameraAlt, contentDescription = null, modifier = Modifier.size(14.dp))
                        Spacer(modifier = Modifier.width(4.dp))
                        Text(if (item.verificationStatus == "VERIFIED_RESOLVED") "Re-Check" else "Verify with Photo", fontSize = 11.sp)
                    }
                }
            }
        }
    }
}

@Composable
fun ComplaintDetailSheetContent(
    detail: ComplaintDetailResponse,
    onVerifyClick: () -> Unit,
    onDismiss: () -> Unit
) {
    val context = LocalContext.current
    val coroutineScope = rememberCoroutineScope()
    var isOpeningPdf by remember { mutableStateOf(false) }

    val photoBitmap = remember(detail.photoUrls) {
        try {
            val base64Str = detail.photoUrls?.firstOrNull() ?: ""
            if (base64Str.isNotEmpty()) {
                val clean = if (base64Str.contains(",")) base64Str.substringAfter(",") else base64Str
                val bytes = Base64.decode(clean, Base64.DEFAULT)
                BitmapFactory.decodeByteArray(bytes, 0, bytes.size)
            } else null
        } catch (e: Exception) {
            null
        }
    }

    val timelockHours = calculateTimelockHoursRemaining(detail.reverificationDueAt)
    val isTimelockActive = timelockHours > 0 && detail.verificationStatus == "PENDING_TIMELOCK"

    fun openPdfNotice() {
        isOpeningPdf = true
        coroutineScope.launch {
            try {
                val pdfFilename = "${detail.trackingId}_Notice.pdf"
                val cleanBase = ApiClient.baseUrl.trimEnd('/')
                val fullUrl = "$cleanBase/api/v1/complaints/${detail.id}/download-pdf"

                val savedFile = withContext(Dispatchers.IO) {
                    val client = OkHttpClient()
                    val req = Request.Builder().url(fullUrl).build()
                    val resp = client.newCall(req).execute()
                    if (resp.isSuccessful) {
                        val bytes = resp.body?.bytes()
                        if (bytes != null) {
                            val f = File(context.cacheDir, pdfFilename)
                            f.writeBytes(bytes)
                            f
                        } else null
                    } else null
                }

                if (savedFile != null) {
                    val uri = FileProvider.getUriForFile(context, "${context.packageName}.fileprovider", savedFile)
                    val intent = Intent(Intent.ACTION_VIEW).apply {
                        setDataAndType(uri, "application/pdf")
                        addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                    }
                    context.startActivity(Intent.createChooser(intent, "Open Official Notice PDF"))
                } else {
                    Toast.makeText(context, "Could not load PDF document", Toast.LENGTH_SHORT).show()
                }
            } catch (e: Exception) {
                e.printStackTrace()
                Toast.makeText(context, "PDF error: ${e.localizedMessage}", Toast.LENGTH_SHORT).show()
            } finally {
                isOpeningPdf = false
            }
        }
    }

    Column(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 20.dp)
            .padding(bottom = 30.dp)
            .verticalScroll(rememberScrollState()),
        verticalArrangement = Arrangement.spacedBy(14.dp)
    ) {
        // Top Header
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Column {
                Text(
                    text = detail.trackingId,
                    fontWeight = FontWeight.Bold,
                    fontSize = 18.sp,
                    color = ForestGreenDark
                )
                Text(
                    text = "Filed on: ${detail.createdAt.take(19).replace('T', ' ')}",
                    fontSize = 11.sp,
                    color = Color.Gray
                )
            }
            UrgencyBadge(urgency = detail.urgencyLevel)
        }
        var isZoomModalOpen by remember { mutableStateOf(false) }

        if (isZoomModalOpen && photoBitmap != null) {
            org.punetrees.app.ui.components.ZoomableImageDialog(
                bitmap = photoBitmap,
                onDismiss = { isZoomModalOpen = false }
            )
        }

        // Evidence Photo Thumbnail (Full aspect, Square container, Tap-to-Zoom)
        if (photoBitmap != null) {
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(240.dp)
                    .clip(RoundedCornerShape(10.dp))
                    .background(Color(0xFF1E1E1E))
                    .border(1.dp, Color(0xFFE0E0E0), RoundedCornerShape(10.dp))
                    .clickable { isZoomModalOpen = true },
                contentAlignment = Alignment.Center
            ) {
                Image(
                    bitmap = photoBitmap.asImageBitmap(),
                    contentDescription = "Original Tree Evidence (Tap to Zoom)",
                    contentScale = ContentScale.Fit,
                    modifier = Modifier.fillMaxSize()
                )
                Surface(
                    color = Color.Black.copy(alpha = 0.65f),
                    shape = RoundedCornerShape(6.dp),
                    modifier = Modifier
                        .align(Alignment.BottomEnd)
                        .padding(8.dp)
                ) {
                    Row(
                        modifier = Modifier.padding(horizontal = 6.dp, vertical = 3.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Icon(Icons.Default.ZoomIn, contentDescription = null, tint = Color.White, modifier = Modifier.size(13.dp))
                        Spacer(modifier = Modifier.width(4.dp))
                        Text("Tap to Zoom", color = Color.White, fontSize = 10.sp, fontWeight = FontWeight.Bold)
                    }
                }
            }
        }

        // Location Card
        Card(
            colors = CardDefaults.cardColors(containerColor = Color.White),
            shape = RoundedCornerShape(10.dp),
            border = androidx.compose.foundation.BorderStroke(1.dp, Color(0xFFE0E0E0)),
            modifier = Modifier.fillMaxWidth()
        ) {
            Column(modifier = Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                Text("📍 Location & Geometry", fontWeight = FontWeight.Bold, fontSize = 13.sp, color = ForestGreenPrimary)
                Text("Landmark: ${detail.addressLandmark}", fontSize = 12.sp)
                Text("Coordinates: ${detail.latitude.format(5)}° N, ${detail.longitude.format(5)}° E", fontSize = 11.sp, color = Color.Gray)
            }
        }

        // Routed Authority & Dispatch Details
        Card(
            colors = CardDefaults.cardColors(containerColor = Color(0xFFE8F5E9)),
            shape = RoundedCornerShape(10.dp),
            modifier = Modifier.fillMaxWidth()
        ) {
            Column(modifier = Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                Text("🏛️ Routed Statutory Department", fontWeight = FontWeight.Bold, fontSize = 13.sp, color = ForestGreenDark)
                Text(detail.routedAuthority, fontWeight = FontWeight.Bold, fontSize = 13.sp)
                Text("Official Recipient: ${detail.targetEmail}", fontSize = 12.sp, color = Color(0xFF2E7D32))
            }
        }

        // Legal Letter Subject & Body
        Card(
            colors = CardDefaults.cardColors(containerColor = Color.White),
            shape = RoundedCornerShape(10.dp),
            border = androidx.compose.foundation.BorderStroke(1.dp, Color(0xFFE0E0E0)),
            modifier = Modifier.fillMaxWidth()
        ) {
            Column(modifier = Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                Text("📄 Formal Grievance Letter", fontWeight = FontWeight.Bold, fontSize = 13.sp, color = ForestGreenPrimary)
                Text("Subject: ${detail.draftSubjectEn}", fontWeight = FontWeight.SemiBold, fontSize = 12.sp)
                HorizontalDivider(color = Color(0xFFF0F0F0))
                Text(detail.draftBodyEn, fontSize = 12.sp, lineHeight = 17.sp, color = Color(0xFF333333))
            }
        }

        // Marathi Field Summary
        Surface(
            color = Color(0xFFFFFDE7),
            shape = RoundedCornerShape(8.dp),
            border = androidx.compose.foundation.BorderStroke(1.dp, Color(0xFFFFF59D)),
            modifier = Modifier.fillMaxWidth()
        ) {
            Column(modifier = Modifier.padding(12.dp)) {
                Text("तक्रार गोषवारा (Marathi)", fontWeight = FontWeight.Bold, fontSize = 12.sp, color = Color(0xFF795548))
                Spacer(modifier = Modifier.height(4.dp))
                Text(detail.draftSummaryMr, fontSize = 12.sp, color = Color(0xFF3E2723))
            }
        }

        // Verification & Timelock Status Card
        Card(
            colors = CardDefaults.cardColors(
                containerColor = if (isTimelockActive) Color(0xFFFFF8E1) else Color(0xFFE8F5E9)
            ),
            shape = RoundedCornerShape(10.dp),
            border = androidx.compose.foundation.BorderStroke(
                1.dp,
                if (isTimelockActive) Color(0xFFFFB300) else Color(0xFFA5D6A7)
            ),
            modifier = Modifier.fillMaxWidth()
        ) {
            Column(modifier = Modifier.padding(12.dp)) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = "Status: ${detail.verificationStatus.replace('_', ' ')}",
                        fontWeight = FontWeight.Bold,
                        fontSize = 13.sp,
                        color = if (isTimelockActive) Color(0xFFE65100) else ForestGreenDark
                    )
                    if (isTimelockActive) {
                        Text(
                            text = "⏳ ${timelockHours}h Left",
                            fontWeight = FontWeight.Bold,
                            fontSize = 12.sp,
                            color = Color(0xFFBF360C)
                        )
                    }
                }
                Spacer(modifier = Modifier.height(2.dp))
                Text(
                    text = if (isTimelockActive)
                        "Under municipal procedure, field crews are given a fixed window (${timelockHours}h remaining) to inspect and resolve before citizen reverification unlocks."
                    else
                        "The statutory grace period has lapsed. You may now return on-site and verify whether the issue was cleared or remains broken.",
                    fontSize = 11.sp,
                    color = Color(0xFF424242)
                )
            }
        }

        // Action 1: View PDF Document
        OutlinedButton(
            onClick = { openPdfNotice() },
            shape = RoundedCornerShape(8.dp),
            modifier = Modifier.fillMaxWidth()
        ) {
            Icon(Icons.Default.PictureAsPdf, contentDescription = null, tint = ForestGreenPrimary)
            Spacer(modifier = Modifier.width(8.dp))
            Text(
                text = if (isOpeningPdf) "Opening PDF..." else "👁️ Open Compiled A4 PDF Notice",
                color = ForestGreenPrimary,
                fontWeight = FontWeight.SemiBold
            )
        }

        // Action 2: Re-Verification CTA (Strictly Timelock Gated)
        Button(
            onClick = {
                if (isTimelockActive) {
                    Toast.makeText(context, "Timelock Active: ${timelockHours}h remaining for PMC field staff before citizen re-audit.", Toast.LENGTH_SHORT).show()
                } else {
                    onVerifyClick()
                }
            },
            enabled = !isTimelockActive,
            colors = ButtonDefaults.buttonColors(
                containerColor = ForestGreenPrimary,
                disabledContainerColor = Color(0xFFEEEEEE),
                disabledContentColor = Color.Gray
            ),
            shape = RoundedCornerShape(8.dp),
            modifier = Modifier.fillMaxWidth()
        ) {
            Icon(if (isTimelockActive) Icons.Default.Lock else Icons.Default.CameraAlt, contentDescription = null)
            Spacer(modifier = Modifier.width(8.dp))
            Text(
                text = if (isTimelockActive) "Re-Verification Locked (${timelockHours}h left)" else "📸 On-Site Re-Verification Audit",
                fontWeight = FontWeight.Bold
            )
        }
    }
}

fun calculateTimelockHoursRemaining(dueAtStr: String?): Int {
    if (dueAtStr == null) return 0
    return try {
        val clean = dueAtStr.take(19).replace('T', ' ')
        val format = SimpleDateFormat("yyyy-MM-dd HH:mm:ss", Locale.US)
        format.timeZone = TimeZone.getTimeZone("UTC")
        val dueDate = format.parse(clean) ?: return 0
        val diffMs = dueDate.time - System.currentTimeMillis()
        val hours = (diffMs / (1000 * 60 * 60)).toInt()
        if (hours > 0) hours else 0
    } catch (e: Exception) {
        0
    }
}

private fun Double.format(digits: Int): String = "%.${digits}f".format(Locale.US, this)
