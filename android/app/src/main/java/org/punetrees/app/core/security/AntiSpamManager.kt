package org.punetrees.app.core.security

import android.content.Context
import android.content.SharedPreferences

class AntiSpamManager(context: Context) {
    private val prefs: SharedPreferences = context.getSharedPreferences("pune_tree_anti_spam", Context.MODE_PRIVATE)

    companion object {
        const val MAX_INVALID_ATTEMPTS = 3
        const val COOLDOWN_DURATION_MS = 3 * 60 * 60 * 1000L // 3 Hours
    }

    fun isUnderCooldown(): Pair<Boolean, Long> {
        val cooldownUntil = prefs.getLong("cooldown_until", 0L)
        val now = System.currentTimeMillis()
        return if (cooldownUntil > now) {
            val remainingMs = cooldownUntil - now
            val remainingMinutes = (remainingMs / (60 * 1000L)) + 1
            Pair(true, remainingMinutes)
        } else {
            Pair(false, 0L)
        }
    }

    fun getFailedAttempts(): Int {
        val (isBlocked, _) = isUnderCooldown()
        if (!isBlocked && prefs.getLong("cooldown_until", 0L) > 0L) {
            // Cooldown expired, reset
            reset()
        }
        return prefs.getInt("failed_tree_attempts", 0)
    }

    fun recordInvalidAttempt(): Pair<Int, Boolean> {
        val current = getFailedAttempts() + 1
        return if (current >= MAX_INVALID_ATTEMPTS) {
            val now = System.currentTimeMillis()
            prefs.edit()
                .putInt("failed_tree_attempts", current)
                .putLong("cooldown_until", now + COOLDOWN_DURATION_MS)
                .apply()
            Pair(current, true) // Blocked now
        } else {
            prefs.edit()
                .putInt("failed_tree_attempts", current)
                .apply()
            Pair(current, false) // 1 attempt remaining
        }
    }

    fun reset() {
        prefs.edit().clear().apply()
    }
}
