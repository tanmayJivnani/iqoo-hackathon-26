package org.punetrees.app.ui.screens.category

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.automirrored.filled.ArrowForward
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import org.punetrees.app.ui.theme.ForestGreenDark
import org.punetrees.app.ui.theme.ForestGreenPrimary

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun CategorySelectionScreen(
    onProceedToGuidance: (category: String) -> Unit,
    onBack: () -> Unit
) {
    var selectedCategory by remember { mutableStateOf("DANGEROUS_LEANING_FALL_RISK") }

    val categories = listOf(
        "DANGEROUS_LEANING_FALL_RISK" to "⚠️ Leaning Tree / Fall Risk",
        "ILLEGAL_FELLING" to "🪓 Illegal Tree Felling",
        "UNAUTHORIZED_PRUNING" to "✂️ Unauthorized Heavy Pruning",
        "HAZARDOUS_BRANCH" to "🌿 Hazardous Broken Branch",
        "ROOT_CONCRETIZATION" to "🧱 Root Concretization",
        "DISEASE_PEST" to "🐛 Disease / Termite Decay"
    )

    val categoryDescriptions = mapOf(
        "DANGEROUS_LEANING_FALL_RISK" to "Trunk with dangerous tilt leaning over road, powerlines, or buildings.",
        "ILLEGAL_FELLING" to "Tree being cut, sawed, or fresh stump left without Tree Authority permit.",
        "UNAUTHORIZED_PRUNING" to "Excessive hacking of large limbs, decapitation of canopy, or unscientific cutting.",
        "HAZARDOUS_BRANCH" to "Fractured, hanging, or cracked heavy limbs threatening pedestrians/traffic.",
        "ROOT_CONCRETIZATION" to "Asphalt, paver blocks, or concrete choking the 1-meter soil basin around roots.",
        "DISEASE_PEST" to "Hollow trunk, fungal conks, severe termite infestation, or rotting bark."
    )

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Step 1: Select Tree Issue", fontWeight = FontWeight.Bold, fontSize = 17.sp) },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back")
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
            Text(
                text = "What is the tree issue you are reporting?",
                fontWeight = FontWeight.Bold,
                fontSize = 15.sp,
                color = ForestGreenDark
            )

            // Category Selection Cards
            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                categories.forEach { (catKey, catLabel) ->
                    val isSelected = selectedCategory == catKey
                    Card(
                        colors = CardDefaults.cardColors(
                            containerColor = if (isSelected) Color(0xFFE8F5E9) else Color(0xFFFAFAFA)
                        ),
                        shape = RoundedCornerShape(10.dp),
                        border = BorderStroke(
                            1.5.dp,
                            if (isSelected) ForestGreenPrimary else Color(0xFFE0E0E0)
                        ),
                        modifier = Modifier
                            .fillMaxWidth()
                            .clickable { selectedCategory = catKey }
                    ) {
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(14.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            RadioButton(
                                selected = isSelected,
                                onClick = { selectedCategory = catKey },
                                colors = RadioButtonDefaults.colors(selectedColor = ForestGreenPrimary)
                            )
                            Spacer(modifier = Modifier.width(8.dp))
                            Column(modifier = Modifier.weight(1f)) {
                                Text(
                                    text = catLabel,
                                    fontWeight = if (isSelected) FontWeight.Bold else FontWeight.SemiBold,
                                    fontSize = 14.sp,
                                    color = if (isSelected) ForestGreenDark else Color(0xFF212121)
                                )
                                Text(
                                    text = categoryDescriptions[catKey] ?: "",
                                    fontSize = 11.sp,
                                    color = Color.Gray,
                                    lineHeight = 15.sp
                                )
                            }
                        }
                    }
                }
            }

            Spacer(modifier = Modifier.height(16.dp))

            // Primary Launch Guidance CTA
            Button(
                onClick = { onProceedToGuidance(selectedCategory) },
                colors = ButtonDefaults.buttonColors(containerColor = ForestGreenPrimary),
                shape = RoundedCornerShape(10.dp),
                modifier = Modifier
                    .fillMaxWidth()
                    .height(52.dp)
            ) {
                Text("Next: View Photo Guidelines", fontWeight = FontWeight.Bold, fontSize = 15.sp)
                Spacer(modifier = Modifier.width(8.dp))
                Icon(Icons.AutoMirrored.Filled.ArrowForward, contentDescription = null)
            }

            Spacer(modifier = Modifier.height(16.dp))
        }
    }
}
