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
import org.punetrees.app.core.category.TreeCategories
import org.punetrees.app.ui.theme.ForestGreenDark
import org.punetrees.app.ui.theme.ForestGreenPrimary

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun CategorySelectionScreen(
    onProceedToGuidance: (category: String) -> Unit,
    onBack: () -> Unit
) {
    val selectedCategories = remember { mutableStateListOf("DANGEROUS_LEANING_FALL_RISK") }

    fun toggleCategory(key: String) {
        if (selectedCategories.contains(key)) {
            if (selectedCategories.size > 1) {
                selectedCategories.remove(key)
            }
        } else {
            selectedCategories.add(key)
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Step 1: Select Tree Issues", fontWeight = FontWeight.Bold, fontSize = 17.sp) },
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
            verticalArrangement = Arrangement.spacedBy(14.dp)
        ) {
            Column {
                Text(
                    text = "What tree issue(s) are you reporting?",
                    fontWeight = FontWeight.Bold,
                    fontSize = 15.sp,
                    color = ForestGreenDark
                )
                Text(
                    text = "Select one or more. First selected sets the 3-step photo guide. AI will also audit compound defects.",
                    fontSize = 12.sp,
                    color = Color.Gray
                )
            }

            // Category Selection Cards
            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                TreeCategories.ALL.forEach { cat ->
                    val isSelected = selectedCategories.contains(cat.key)
                    val isPrimary = selectedCategories.firstOrNull() == cat.key

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
                            .clickable { toggleCategory(cat.key) }
                    ) {
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(14.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Checkbox(
                                checked = isSelected,
                                onCheckedChange = { toggleCategory(cat.key) },
                                colors = CheckboxDefaults.colors(checkedColor = ForestGreenPrimary)
                            )
                            Spacer(modifier = Modifier.width(8.dp))
                            Column(modifier = Modifier.weight(1f)) {
                                Row(
                                    verticalAlignment = Alignment.CenterVertically,
                                    horizontalArrangement = Arrangement.spacedBy(6.dp)
                                ) {
                                    Text(
                                        text = cat.title,
                                        fontWeight = if (isSelected) FontWeight.Bold else FontWeight.SemiBold,
                                        fontSize = 14.sp,
                                        color = if (isSelected) ForestGreenDark else Color(0xFF212121)
                                    )
                                    if (isPrimary && selectedCategories.size > 1) {
                                        Surface(
                                            color = ForestGreenPrimary,
                                            shape = RoundedCornerShape(4.dp)
                                        ) {
                                            Text(
                                                text = "Primary",
                                                color = Color.White,
                                                fontSize = 9.sp,
                                                fontWeight = FontWeight.Bold,
                                                modifier = Modifier.padding(horizontal = 4.dp, vertical = 1.dp)
                                            )
                                        }
                                    }
                                }
                                Text(
                                    text = cat.description,
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
            val count = selectedCategories.size
            Button(
                onClick = { onProceedToGuidance(selectedCategories.joinToString(",")) },
                colors = ButtonDefaults.buttonColors(containerColor = ForestGreenPrimary),
                shape = RoundedCornerShape(10.dp),
                modifier = Modifier
                    .fillMaxWidth()
                    .height(52.dp)
            ) {
                Text(
                    text = if (count > 1) "Next: Proceed with $count Issues" else "Next: View Photo Guidelines",
                    fontWeight = FontWeight.Bold,
                    fontSize = 15.sp
                )
                Spacer(modifier = Modifier.width(8.dp))
                Icon(Icons.AutoMirrored.Filled.ArrowForward, contentDescription = null)
            }

            Spacer(modifier = Modifier.height(16.dp))
        }
    }
}
