package org.punetrees.app.ui.screens.dispatch

import android.content.Intent
import android.net.Uri
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.foundation.selection.toggleable
import androidx.compose.ui.semantics.Role
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Email
import androidx.compose.material.icons.filled.Share
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.launch
import org.punetrees.app.data.remote.ApiClient
import org.punetrees.app.data.remote.model.AnalyzeAndDraftResponse
import org.punetrees.app.data.remote.model.DispatchRequest
import org.punetrees.app.data.remote.model.DispatchResponse
import org.punetrees.app.ui.theme.TextPrimary
import org.punetrees.app.ui.theme.ForestGreenDark
import org.punetrees.app.ui.theme.ForestGreenPrimary

import android.graphics.BitmapFactory
import android.util.Base64
import android.widget.Toast
import androidx.compose.foundation.Image
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.layout.ContentScale
import androidx.core.content.FileProvider
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.OkHttpClient
import okhttp3.Request
import java.io.File

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun DispatchScreen(
    draft: AnalyzeAndDraftResponse,
    photoBase64: String = "",
    onDone: () -> Unit
) {
    val context = LocalContext.current
    val coroutineScope = rememberCoroutineScope()
    val api = remember { ApiClient.getService() }

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

    var hasOpenedEmail by remember { mutableStateOf(false) }
    var hasOpenedWhatsapp by remember { mutableStateOf(false) }
    var isConfirmedSent by remember { mutableStateOf(false) }

    var isDispatching by remember { mutableStateOf(false) }
    var dispatchResult by remember { mutableStateOf<DispatchResponse?>(null) }

    fun launchEmailIntent() {
        try {
            val pdfFile = File(context.cacheDir, "${draft.trackingId}_Notice.pdf")
            val emailIntent = Intent(Intent.ACTION_SEND).apply {
                type = "application/pdf"
                putExtra(Intent.EXTRA_EMAIL, arrayOf(draft.routedAuthority.email))
                putExtra(Intent.EXTRA_SUBJECT, "[${draft.trackingId}] ${draft.draftSubjectEn}")
                val emailBodyText = "${draft.draftBodyEn}\n\n---\nतक्रार गोषवारा (Marathi Summary):\n${draft.draftSummaryMr}\n\nStatus Tracker: https://punetrees.org/track/${draft.trackingId}"
                putExtra(Intent.EXTRA_TEXT, emailBodyText)

                if (pdfFile.exists()) {
                    val pdfUri = FileProvider.getUriForFile(
                        context,
                        "${context.packageName}.fileprovider",
                        pdfFile
                    )
                    putExtra(Intent.EXTRA_STREAM, pdfUri)
                    addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                }
            }
            context.startActivity(Intent.createChooser(emailIntent, "Send Official Grievance Email via..."))
            hasOpenedEmail = true
            isConfirmedSent = true
        } catch (e: Exception) {
            e.printStackTrace()
            Toast.makeText(context, "Could not open email client: ${e.localizedMessage}", Toast.LENGTH_SHORT).show()
        }
    }

    fun launchWhatsappIntent() {
        try {
            val summaryText = "🚨 [${draft.trackingId}] वृक्ष तक्रार / Tree Grievance Alert\n\nस्थान / Location: ${draft.addressLandmark}\nप्रकार / Category: ${draft.issueType.replace('_', ' ')}\n\n${draft.draftSummaryMr}\n\nTracking Link: https://punetrees.org/track/${draft.trackingId}"
            val encoded = Uri.encode(summaryText)
            val waUrl = "https://wa.me/919689900002?text=$encoded"
            val intent = Intent(Intent.ACTION_VIEW, Uri.parse(waUrl))
            context.startActivity(intent)
            hasOpenedWhatsapp = true
            isConfirmedSent = true
        } catch (e: Exception) {
            e.printStackTrace()
            Toast.makeText(context, "Could not open WhatsApp: ${e.localizedMessage}", Toast.LENGTH_SHORT).show()
        }
    }

    fun launchTwitterEscalation() {
        try {
            val tweetText = "🚨 Citizen Grievance #[${draft.trackingId}] officially lodged with @PMCPune @PuneCityPolice regarding ${draft.issueType.replace('_', ' ')} at ${draft.addressLandmark}.\n\nStatutory notice filed under Maharashtra Tree Act 1975.\n\nTrack: https://punetrees.org/track/${draft.trackingId}"
            val encoded = Uri.encode(tweetText)
            val tweetUrl = "https://twitter.com/intent/tweet?text=$encoded"
            val intent = Intent(Intent.ACTION_VIEW, Uri.parse(tweetUrl))
            context.startActivity(intent)
        } catch (e: Exception) {
            e.printStackTrace()
            Toast.makeText(context, "Could not open Twitter: ${e.localizedMessage}", Toast.LENGTH_SHORT).show()
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Citizen Dispatch Gate", fontWeight = FontWeight.Bold, fontSize = 18.sp) },
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
            // Photo Evidence Card Preview
            if (photoBitmap != null) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .background(Color.White, RoundedCornerShape(10.dp))
                        .border(1.dp, Color(0xFFE0E0E0), RoundedCornerShape(10.dp))
                        .padding(10.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Image(
                        bitmap = photoBitmap.asImageBitmap(),
                        contentDescription = "Evidence Photo",
                        contentScale = ContentScale.Crop,
                        modifier = Modifier
                            .size(68.dp)
                            .clip(RoundedCornerShape(8.dp))
                    )
                    Spacer(modifier = Modifier.width(12.dp))
                    Column {
                        Text(
                            text = "Tree Evidence Attached",
                            fontWeight = FontWeight.Bold,
                            fontSize = 13.sp
                        )
                        Text(
                            text = "Ref: ${draft.trackingId}",
                            fontSize = 11.sp,
                            fontWeight = FontWeight.SemiBold,
                            color = ForestGreenDark
                        )
                        Text(
                            text = draft.addressLandmark,
                            fontSize = 11.sp,
                            color = Color.Gray,
                            maxLines = 1
                        )
                    }
                }
            }

            if (dispatchResult == null) {
                // Section: Step 1 - Mandatory Email Dispatch
                Text(
                    text = "Step 1: Send Official Legal Grievance",
                    fontWeight = FontWeight.Bold,
                    fontSize = 16.sp
                )
                Text(
                    text = "The formal grievance notice and attached A4 PDF must be submitted to the competent authority via official email.",
                    fontSize = 12.sp,
                    color = Color.Gray
                )

                // Mandatory Action 1: Official Email Notice with PDF
                Card(
                    colors = CardDefaults.cardColors(containerColor = if (hasOpenedEmail) ForestGreenPrimary.copy(alpha = 0.08f) else Color.White),
                    shape = RoundedCornerShape(10.dp),
                    border = androidx.compose.foundation.BorderStroke(1.dp, if (hasOpenedEmail) ForestGreenPrimary else Color(0xFFE0E0E0)),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Column(modifier = Modifier.padding(14.dp)) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Icon(Icons.Default.Email, contentDescription = null, tint = ForestGreenPrimary)
                            Spacer(modifier = Modifier.width(8.dp))
                            Text(
                                text = "Official Email Notice (Mandatory First Step)",
                                fontWeight = FontWeight.Bold,
                                fontSize = 13.sp
                            )
                        }
                        Spacer(modifier = Modifier.height(4.dp))
                        Text(
                            text = "Recipient: ${draft.routedAuthority.email} (attaches legal A4 PDF with evidence photos)",
                            fontSize = 11.sp,
                            color = Color.Gray
                        )
                        Spacer(modifier = Modifier.height(10.dp))
                        Button(
                            onClick = { launchEmailIntent() },
                            colors = ButtonDefaults.buttonColors(containerColor = if (hasOpenedEmail) ForestGreenDark else ForestGreenPrimary),
                            shape = RoundedCornerShape(8.dp),
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            Text(
                                text = if (hasOpenedEmail) "✓ 1. Email App Opened (Tap to Reopen)" else "✉️ 1. Open in Gmail / Email App",
                                fontWeight = FontWeight.Bold,
                                fontSize = 13.sp
                            )
                        }
                    }
                }

                // Conditional Action 2: WhatsApp Field Alert (For Fall Risk, Hazardous Branches, Illegal Felling, Emergency)
                val isFallRiskOrEmergency = draft.issueType == "DANGEROUS_LEANING_FALL_RISK" || 
                                           draft.issueType == "HAZARDOUS_BRANCH" || 
                                           draft.issueType == "ILLEGAL_FELLING" || 
                                           draft.urgencyLevel == "CRITICAL_EMERGENCY" ||
                                           draft.urgencyLevel == "HIGH"

                if (isFallRiskOrEmergency) {
                    Card(
                        colors = CardDefaults.cardColors(containerColor = if (hasOpenedWhatsapp) ForestGreenPrimary.copy(alpha = 0.08f) else Color.White),
                        shape = RoundedCornerShape(10.dp),
                        border = androidx.compose.foundation.BorderStroke(1.dp, if (hasOpenedWhatsapp) ForestGreenPrimary else Color(0xFFE0E0E0)),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Column(modifier = Modifier.padding(14.dp)) {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Icon(Icons.Default.Share, contentDescription = null, tint = ForestGreenPrimary)
                                Spacer(modifier = Modifier.width(8.dp))
                                Text(
                                    text = "WhatsApp Field Alert (Immediate Ground Action)",
                                    fontWeight = FontWeight.Bold,
                                    fontSize = 13.sp,
                                    color = ForestGreenDark
                                )
                            }
                            Spacer(modifier = Modifier.height(4.dp))
                            Text(
                                text = "Also send this alert to PMC Disaster Helpline (9689900002) on WhatsApp for fast ground dispatch.",
                                fontSize = 11.sp,
                                color = Color.Gray
                            )
                            Spacer(modifier = Modifier.height(10.dp))
                            OutlinedButton(
                                onClick = { launchWhatsappIntent() },
                                shape = RoundedCornerShape(8.dp),
                                modifier = Modifier.fillMaxWidth()
                            ) {
                                Text(
                                    text = if (hasOpenedWhatsapp) "✓ 2. WhatsApp Alert Sent (Tap to Reopen)" else "💬 2. Send WhatsApp Field Alert",
                                    fontWeight = FontWeight.Bold,
                                    fontSize = 13.sp,
                                    color = ForestGreenPrimary
                                )
                            }
                        }
                    }
                }

                Spacer(modifier = Modifier.height(8.dp))

                // Section: Step 2 - Confirmation Gate
                Text(
                    text = "Step 2: Confirm & Finalize Lodging",
                    fontWeight = FontWeight.Bold,
                    fontSize = 16.sp
                )

                // Citizen Confirmation Checkbox
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    modifier = Modifier
                        .fillMaxWidth()
                        .toggleable(
                            value = isConfirmedSent,
                            onValueChange = { isConfirmedSent = it },
                            role = Role.Checkbox
                        )
                        .padding(vertical = 4.dp)
                ) {
                    Checkbox(checked = isConfirmedSent, onCheckedChange = null)
                    Spacer(modifier = Modifier.width(8.dp))
                    Text(
                        text = "I confirm that I have sent the official email notice to ${draft.routedAuthority.email}.",
                        fontSize = 12.sp,
                        color = TextPrimary
                    )
                }

                // Finalize Lodging CTA Button
                Button(
                    onClick = {
                        isDispatching = true
                        coroutineScope.launch {
                            val channels = mutableListOf<String>()
                            if (hasOpenedEmail) channels.add("EMAIL")
                            if (hasOpenedWhatsapp) channels.add("WHATSAPP")
                            if (channels.isEmpty()) channels.add("EMAIL")

                            try {
                                val res = api.dispatchComplaint(
                                    DispatchRequest(
                                        complaintId = draft.complaintId,
                                        confirmedByCitizen = true,
                                        channels = channels
                                    )
                                )
                                if (res.isSuccessful) {
                                    dispatchResult = res.body()
                                } else {
                                    Toast.makeText(context, "Failed to record dispatch on server: ${res.code()}", Toast.LENGTH_SHORT).show()
                                }
                            } catch (e: Exception) {
                                e.printStackTrace()
                                Toast.makeText(context, "Server error: ${e.localizedMessage}", Toast.LENGTH_SHORT).show()
                            } finally {
                                isDispatching = false
                            }
                        }
                    },
                    enabled = hasOpenedEmail && isConfirmedSent && !isDispatching,
                    colors = ButtonDefaults.buttonColors(containerColor = ForestGreenPrimary),
                    shape = RoundedCornerShape(10.dp),
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(50.dp)
                ) {
                    if (isDispatching) {
                        CircularProgressIndicator(color = Color.White, modifier = Modifier.size(22.dp))
                    } else {
                        Text("✓ Mark as Officially Lodged & Track", fontWeight = FontWeight.Bold, fontSize = 15.sp)
                    }
                }
            } else {
                // Success Receipt Card (Step 3: Post-Filing Success + Public Escalation)
                Card(
                    colors = CardDefaults.cardColors(containerColor = Color(0xFFE8F5E9)),
                    shape = RoundedCornerShape(12.dp),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Column(modifier = Modifier.padding(16.dp)) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Icon(Icons.Default.CheckCircle, contentDescription = null, tint = ForestGreenPrimary)
                            Spacer(modifier = Modifier.width(8.dp))
                            Text("Grievance Successfully Lodged!", fontWeight = FontWeight.Bold, fontSize = 16.sp, color = ForestGreenDark)
                        }
                        Spacer(modifier = Modifier.height(10.dp))
                        Text("Official Tracking ID: ${dispatchResult?.trackingId ?: draft.trackingId}", fontWeight = FontWeight.Bold, fontSize = 14.sp)
                        Text("Statutory Routed Authority: ${draft.routedAuthority.name}", fontSize = 12.sp)
                        Text("Primary Recipient: ${draft.routedAuthority.email}", fontSize = 12.sp, color = Color.Gray)

                        Spacer(modifier = Modifier.height(16.dp))

                        // Public Escalation on Twitter/X (Secondary Channel)
                        Button(
                            onClick = { launchTwitterEscalation() },
                            colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF1DA1F2)),
                            shape = RoundedCornerShape(8.dp),
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            Text("📢 Escalate on X / Twitter (Tags @PMCPune)", fontWeight = FontWeight.Bold, color = Color.White)
                        }

                        Spacer(modifier = Modifier.height(10.dp))

                        // Done CTA
                        Button(
                            onClick = onDone,
                            colors = ButtonDefaults.buttonColors(containerColor = ForestGreenPrimary),
                            shape = RoundedCornerShape(8.dp),
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            Text("View in Tracker & Status Timeline")
                        }
                    }
                }
            }

            Spacer(modifier = Modifier.height(16.dp))
        }
    }
}
