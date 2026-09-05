package org.punetrees.app.ui.theme

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable

private val LightColorScheme = lightColorScheme(
    primary = ForestGreenPrimary,
    onPrimary = CardBackground,
    primaryContainer = ForestGreenContainer,
    onPrimaryContainer = ForestGreenDark,
    secondary = BarkBrownPrimary,
    onSecondary = CardBackground,
    secondaryContainer = BarkBrownContainer,
    onSecondaryContainer = BarkBrownDark,
    tertiary = ForestGreenLight,
    background = WoodParchment,
    surface = CardBackground,
    surfaceVariant = BarkBrownContainer,
    onSurface = TextPrimary,
    outline = WoodBorder
)

@Composable
fun PuneTreeComplaintTheme(
    darkTheme: Boolean = isSystemInDarkTheme(),
    content: @Composable () -> Unit
) {
    MaterialTheme(
        colorScheme = LightColorScheme,
        typography = Typography,
        content = content
    )
}
