package org.punetrees.app.ui.screens.guidance

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.CameraAlt
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Info
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
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
fun PhotoGuidanceScreen(
    category: String,
    onStartCapture: () -> Unit,
    onBack: () -> Unit
) {
    val categoryLabel = when (category) {
        "DANGEROUS_LEANING_FALL_RISK" -> "⚠️ Leaning Tree / Fall Risk"
        "ILLEGAL_FELLING" -> "🪓 Illegal Tree Felling"
        "UNAUTHORIZED_PRUNING" -> "✂️ Unauthorized Heavy Pruning"
        "HAZARDOUS_BRANCH" -> "🌿 Hazardous Broken Branch"
        "ROOT_CONCRETIZATION" -> "🧱 Root Concretization"
        "DISEASE_PEST" -> "🐛 Disease / Termite Decay"
        "HEALTHY_TREE" -> "🌱 Routine Inspection / Healthy Tree"
        else -> category.replace('_', ' ')
    }

    val guidanceItems = when (category) {
        "DANGEROUS_LEANING_FALL_RISK" -> listOf(
            Triple("1️⃣ Wide Full Tree View", "Step back 5–10 meters. Capture the full trunk from ground to canopy aligned against a vertical pole or building so AI measures tilt.", "Wide Overview"),
            Triple("2️⃣ Trunk & Lean Pivot Close-up", "Capture close-up of trunk curvature, bark stress fractures, or soil uplift at the base.", "Trunk Damage"),
            Triple("3️⃣ Root Plate & Road Surroundings", "Capture the ground root basin showing vehicle traffic, pedestrians, or property under the fall trajectory.", "Surroundings")
        )
        "ILLEGAL_FELLING" -> listOf(
            Triple("1️⃣ Wide Angle of Felling Site", "Capture the tree stump, fallen timber logs, and the surrounding clearing.", "Site Overview"),
            Triple("2️⃣ Close-up of Fresh Cut & Saw Marks", "Close-up showing fresh timber wood, chain-saw cuts, and freshly severed trunk diameter.", "Saw Cuts"),
            Triple("3️⃣ Base & Root Plate", "Capture the base of the trunk showing bark condition and cut height from the ground.", "Stump Base")
        )
        "UNAUTHORIZED_PRUNING" -> listOf(
            Triple("1️⃣ Canopy Wide View", "Capture the whole tree showing hacked canopy and loss of foliage crown.", "Canopy Overview"),
            Triple("2️⃣ Close-up of Lopped Stubs", "Close-up of severed thick branches, flat decapitated cuts, and lack of healing paint.", "Severed Stubs"),
            Triple("3️⃣ Fallen Debris & Surroundings", "Capture fallen branches piled below on road, footpath, or wires.", "Pruned Debris")
        )
        "HAZARDOUS_BRANCH" -> listOf(
            Triple("1️⃣ Wide View with Overhead Clearance", "Capture the whole tree showing where the broken branch hangs above the street or powerline.", "Tree & Clearance"),
            Triple("2️⃣ Close-up of Fracture / Split", "Close-up of the cracked branch joint, dangling limb, or splintered wood.", "Branch Fracture"),
            Triple("3️⃣ Ground Area Below Hazard", "Capture the road traffic, pavement, or parked vehicles directly underneath.", "Drop Zone")
        )
        "ROOT_CONCRETIZATION" -> listOf(
            Triple("1️⃣ Tree & Footpath Overview", "Capture tree trunk along the footpath/road showing lack of soil breathing basin.", "Street View"),
            Triple("2️⃣ Close-up of Concrete Basin Choke", "Close-up showing concrete, cement, paver blocks, or asphalt directly touching the trunk base.", "Concrete Choke"),
            Triple("3️⃣ Surrounding Pavement", "Capture the 1-meter radius around the tree base to show total concreted area.", "1m Basin")
        )
        "DISEASE_PEST" -> listOf(
            Triple("1️⃣ Full Tree & Crown Health", "Capture full tree showing leaf defoliation, dry canopy, or dead top branches.", "Crown Health"),
            Triple("2️⃣ Close-up of Trunk Decay / Conks", "Close-up of fungal bracket conks, termite mud tubes, weeping sap, or hollow cavities.", "Fungal / Rot"),
            Triple("3️⃣ Base / Soil Infection", "Capture tree collar at soil level showing root decay or borers.", "Base Collar")
        )
        else -> listOf(
            Triple("1️⃣ Full Tree Overview", "Capture full tree in daylight from ground to top crown.", "Full Overview"),
            Triple("2️⃣ Trunk & Foliage Close-up", "Capture healthy bark texture and foliage leaves.", "Trunk & Leaves"),
            Triple("3️⃣ Soil Basin & Surroundings", "Capture the base perimeter and surrounding landmark.", "Base Basin")
        )
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Step 2: Photographic Guidelines", fontWeight = FontWeight.Bold, fontSize = 17.sp) },
                navigationIcon = {
                    IconButton(onClick = onBack) {
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
            // Category Badge Header
            Card(
                colors = CardDefaults.cardColors(containerColor = Color(0xFFE8F5E9)),
                shape = RoundedCornerShape(12.dp),
                border = BorderStroke(1.dp, Color(0xFFA5D6A7)),
                modifier = Modifier.fillMaxWidth()
            ) {
                Row(
                    modifier = Modifier.padding(14.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Icon(Icons.Default.CheckCircle, contentDescription = null, tint = ForestGreenPrimary, modifier = Modifier.size(24.dp))
                    Spacer(modifier = Modifier.width(10.dp))
                    Column {
                        Text("Selected Issue Category", fontSize = 11.sp, color = Color.Gray, fontWeight = FontWeight.Medium)
                        Text(categoryLabel, fontSize = 15.sp, fontWeight = FontWeight.Bold, color = ForestGreenDark)
                    }
                }
            }

            // Mandatory 3 Photos Requirement Card
            Card(
                colors = CardDefaults.cardColors(containerColor = Color(0xFFE3F2FD)),
                shape = RoundedCornerShape(12.dp),
                border = BorderStroke(1.dp, Color(0xFF90CAF9)),
                modifier = Modifier.fillMaxWidth()
            ) {
                Column(modifier = Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(Icons.Default.Info, contentDescription = null, tint = Color(0xFF1565C0), modifier = Modifier.size(18.dp))
                        Spacer(modifier = Modifier.width(6.dp))
                        Text(
                            text = "Mandatory 3 Photos Required for High-Proof Evidence",
                            fontWeight = FontWeight.Bold,
                            fontSize = 13.sp,
                            color = Color(0xFF0D47A1)
                        )
                    }
                    Text(
                        text = "To ensure legal validity under Maharashtra Tree Act, please capture the 3 specific angles detailed below. The camera will prompt you for each shot sequentially.",
                        fontSize = 12.sp,
                        color = Color(0xFF1565C0),
                        lineHeight = 16.sp
                    )
                }
            }

            Text(
                text = "Required 3 Photo Angles:",
                fontWeight = FontWeight.Bold,
                fontSize = 15.sp,
                color = ForestGreenDark
            )

            // Step items
            guidanceItems.forEachIndexed { idx, item ->
                Card(
                    colors = CardDefaults.cardColors(containerColor = Color.White),
                    shape = RoundedCornerShape(10.dp),
                    border = BorderStroke(1.dp, Color(0xFFE0E0E0)),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(12.dp),
                        verticalAlignment = Alignment.Top
                    ) {
                        Box(
                            modifier = Modifier
                                .size(28.dp)
                                .background(ForestGreenPrimary, CircleShape),
                            contentAlignment = Alignment.Center
                        ) {
                            Text("${idx + 1}", color = Color.White, fontWeight = FontWeight.Bold, fontSize = 13.sp)
                        }
                        Spacer(modifier = Modifier.width(12.dp))
                        Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
                            Text(text = item.first, fontWeight = FontWeight.Bold, fontSize = 14.sp, color = ForestGreenDark)
                            Text(text = item.second, fontSize = 12.sp, color = Color.DarkGray, lineHeight = 16.sp)
                        }
                    }
                }
            }

            Spacer(modifier = Modifier.height(8.dp))

            // CTA to start capturing 3 photos
            Button(
                onClick = onStartCapture,
                colors = ButtonDefaults.buttonColors(containerColor = ForestGreenPrimary),
                shape = RoundedCornerShape(10.dp),
                modifier = Modifier
                    .fillMaxWidth()
                    .height(52.dp)
            ) {
                Icon(Icons.Default.CameraAlt, contentDescription = null)
                Spacer(modifier = Modifier.width(8.dp))
                Text("📸 Start Camera Capture (Photo 1 of 3)", fontWeight = FontWeight.Bold, fontSize = 15.sp)
            }

            Spacer(modifier = Modifier.height(16.dp))
        }
    }
}
