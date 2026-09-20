package org.punetrees.app.ui.components

import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.gestures.rememberTransformableState
import androidx.compose.foundation.gestures.transformable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Warning
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import org.punetrees.app.ui.theme.*

@Composable
fun UrgencyBadge(urgency: String, modifier: Modifier = Modifier) {
    val bgColor: Color
    val textColor: Color
    val borderColor: Color
    val label: String

    when (urgency.uppercase()) {
        "CRITICAL_EMERGENCY" -> {
            bgColor = Color(0xFFFFEBEE)
            textColor = AlertCriticalRed
            borderColor = Color(0xFFEF5350)
            label = "🚨 CRITICAL EMERGENCY"
        }
        "HIGH" -> {
            bgColor = Color(0xFFFFF3E0)
            textColor = Color(0xFFE65100)
            borderColor = Color(0xFFFF9800)
            label = "⚠️ HIGH HAZARD"
        }
        else -> {
            bgColor = Color(0xFFE8F5E9)
            textColor = ForestGreenDark
            borderColor = Color(0xFFA5D6A7)
            label = "🌿 ROUTINE REDRESSAL"
        }
    }

    Surface(
        color = bgColor,
        shape = RoundedCornerShape(6.dp),
        border = androidx.compose.foundation.BorderStroke(1.5.dp, borderColor),
        modifier = modifier
    ) {
        Text(
            text = label,
            color = textColor,
            fontSize = 11.sp,
            fontWeight = FontWeight.Bold,
            modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp)
        )
    }
}

@Composable
fun LegalCitationCard(citations: List<String>, modifier: Modifier = Modifier) {
    Card(
        colors = CardDefaults.cardColors(containerColor = BarkBrownContainer.copy(alpha = 0.5f)),
        shape = RoundedCornerShape(8.dp),
        border = androidx.compose.foundation.BorderStroke(1.dp, WoodBorder),
        modifier = modifier.fillMaxWidth()
    ) {
        Column(modifier = Modifier.padding(12.dp)) {
            Text(
                text = "Statutory Grounding (Maharashtra Tree Act 1975)",
                fontSize = 12.sp,
                fontWeight = FontWeight.Bold,
                color = BarkBrownDark
            )
            Spacer(modifier = Modifier.height(4.dp))
            citations.forEach { citation ->
                Text(
                    text = "• $citation",
                    fontSize = 11.sp,
                    color = TextPrimary,
                    lineHeight = 15.sp,
                    modifier = Modifier.padding(vertical = 2.dp)
                )
            }
        }
    }
}

@Composable
fun LiveTiltIndicator(
    angleDegrees: Float,
    isTreeDetected: Boolean = true,
    modifier: Modifier = Modifier
) {
    val (dotColor, displayText) = when {
        !isTreeDetected -> Pair(Color(0xFF9E9E9E), "No tree in frame")
        angleDegrees >= 20.0f -> Pair(AlertCriticalRed, "Trunk Tilt: ${"%.1f".format(angleDegrees)}° ⚠️ IMMINENT FALL")
        else -> Pair(EmeraldGreen, "Trunk Tilt: ${"%.1f".format(angleDegrees)}° ✓ Normal")
    }

    Row(
        verticalAlignment = Alignment.CenterVertically,
        modifier = modifier
            .background(Color.Black.copy(alpha = 0.65f), RoundedCornerShape(20.dp))
            .padding(horizontal = 12.dp, vertical = 6.dp)
    ) {
        Box(
            modifier = Modifier
                .size(10.dp)
                .background(dotColor, RoundedCornerShape(5.dp))
        )
        Spacer(modifier = Modifier.width(8.dp))
        Text(
            text = displayText,
            color = Color.White,
            fontSize = 12.sp,
            fontWeight = FontWeight.Bold
        )
    }
}

@Composable
fun DuplicateAlertBanner(
    duplicateCount: Int,
    distanceM: Double,
    onUpvoteClick: () -> Unit,
    onProceedAnywayClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    Card(
        colors = CardDefaults.cardColors(containerColor = Color(0xFFFFF3E0)),
        shape = RoundedCornerShape(10.dp),
        modifier = modifier
            .fillMaxWidth()
            .border(1.5.dp, Color(0xFFFF9800), RoundedCornerShape(10.dp))
    ) {
        Column(modifier = Modifier.padding(14.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(Icons.Default.Warning, contentDescription = null, tint = AlertWarningOrange)
                Spacer(modifier = Modifier.width(8.dp))
                Text(
                    text = "Active Complaint Found Nearby ($duplicateCount report within ${distanceM.toInt()}m)",
                    fontWeight = FontWeight.Bold,
                    fontSize = 13.sp,
                    color = Color(0xFFE65100)
                )
            }
            Spacer(modifier = Modifier.height(6.dp))
            Text(
                text = "Another citizen reported a tree hazard at this exact spot. Adding your photo strengthens priority as a corroborating witness.",
                fontSize = 12.sp,
                color = TextPrimary
            )
            Spacer(modifier = Modifier.height(10.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Button(
                    onClick = onUpvoteClick,
                    colors = ButtonDefaults.buttonColors(containerColor = ForestGreenPrimary),
                    modifier = Modifier.weight(1f)
                ) {
                    Text("+ Add Photo & Upvote", fontSize = 12.sp)
                }
                OutlinedButton(
                    onClick = onProceedAnywayClick,
                    modifier = Modifier.weight(1f)
                ) {
                    Text("File Fresh Issue", fontSize = 12.sp)
                }
            }
        }
    }
}

@Composable
fun MarathiSummaryBox(summaryText: String, modifier: Modifier = Modifier) {
    Card(
        colors = CardDefaults.cardColors(containerColor = Color(0xFFFFFDE7)),
        shape = RoundedCornerShape(8.dp),
        modifier = modifier.fillMaxWidth()
    ) {
        Column(modifier = Modifier.padding(12.dp)) {
            Text(
                text = "तक्रार गोषवारा (Marathi Summary for PMC Field Staff)",
                fontSize = 12.sp,
                fontWeight = FontWeight.Bold,
                color = Color(0xFFF57F17)
            )
            Spacer(modifier = Modifier.height(4.dp))
            Text(
                text = summaryText,
                fontSize = 12.sp,
                color = TextPrimary,
                lineHeight = 16.sp
            )
        }
    }
}

@Composable
fun ZoomableImageDialog(
    bitmap: android.graphics.Bitmap,
    onDismiss: () -> Unit
) {
    var scale by remember { mutableFloatStateOf(1f) }
    var offsetX by remember { mutableFloatStateOf(0f) }
    var offsetY by remember { mutableFloatStateOf(0f) }

    val state = rememberTransformableState { zoomChange, offsetChange, _ ->
        scale = (scale * zoomChange).coerceIn(1f, 5f)
        if (scale > 1f) {
            offsetX += offsetChange.x
            offsetY += offsetChange.y
        } else {
            offsetX = 0f
            offsetY = 0f
        }
    }

    Dialog(
        onDismissRequest = onDismiss,
        properties = DialogProperties(usePlatformDefaultWidth = false)
    ) {
        Box(
            modifier = Modifier
                .fillMaxSize()
                .background(Color.Black.copy(alpha = 0.95f))
        ) {
            Image(
                bitmap = bitmap.asImageBitmap(),
                contentDescription = "Zoomable Evidence Photo",
                contentScale = ContentScale.Fit,
                modifier = Modifier
                    .fillMaxSize()
                    .transformable(state = state)
                    .graphicsLayer(
                        scaleX = scale,
                        scaleY = scale,
                        translationX = offsetX,
                        translationY = offsetY
                    )
            )

            // Header Bar with Close & Reset
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(top = 40.dp, start = 16.dp, end = 16.dp),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Surface(
                    color = Color.Black.copy(alpha = 0.6f),
                    shape = RoundedCornerShape(8.dp)
                ) {
                    Text(
                        text = "🔍 Pinch to Zoom (${"%.1f".format(scale)}x)",
                        color = Color.White,
                        fontSize = 12.sp,
                        fontWeight = FontWeight.Bold,
                        modifier = Modifier.padding(horizontal = 10.dp, vertical = 6.dp)
                    )
                }

                IconButton(
                    onClick = onDismiss,
                    modifier = Modifier.background(Color.Black.copy(alpha = 0.6f), shape = androidx.compose.foundation.shape.CircleShape)
                ) {
                    Text("✕", color = Color.White, fontWeight = FontWeight.Bold, fontSize = 16.sp)
                }
            }
        }
    }
}

@Composable
fun TreeAppLogo(
    modifier: Modifier = Modifier,
    size: androidx.compose.ui.unit.Dp = 28.dp
) {
    Surface(
        shape = CircleShape,
        color = Color(0xFFE8F5E9),
        border = androidx.compose.foundation.BorderStroke(1.dp, Color(0xFFA5D6A7)),
        modifier = modifier.size(size)
    ) {
        Box(contentAlignment = Alignment.Center, modifier = Modifier.fillMaxSize()) {
            Image(
                painter = androidx.compose.ui.res.painterResource(id = org.punetrees.app.R.drawable.ic_tree_logo),
                contentDescription = "Tree Logo",
                modifier = Modifier.size(size * 0.72f)
            )
        }
    }
}

@Composable
fun AppTitleWithLogo(
    title: String = "Pune Trees",
    subtitle: String? = "Citizen Complaint App",
    modifier: Modifier = Modifier
) {
    Row(
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(8.dp),
        modifier = modifier
    ) {
        TreeAppLogo(size = 32.dp)
        Column {
            Text(
                text = title,
                fontWeight = FontWeight.Bold,
                fontSize = 16.sp,
                color = MaterialTheme.colorScheme.onBackground
            )
            if (!subtitle.isNullOrBlank()) {
                Text(
                    text = subtitle,
                    fontSize = 11.sp,
                    color = Color.Gray
                )
            }
        }
    }
}

