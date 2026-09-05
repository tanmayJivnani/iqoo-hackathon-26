package org.punetrees.app.core.user

import android.content.Context
import android.content.SharedPreferences

data class UserProfile(
    val name: String = "",
    val phone: String = "",
    val email: String = ""
) {
    val isComplete: Boolean
        get() = name.isNotBlank() && phone.isNotBlank() && email.isNotBlank()
}

class UserProfileManager(context: Context) {
    private val prefs: SharedPreferences = context.getSharedPreferences("pune_tree_user_profile", Context.MODE_PRIVATE)

    fun getProfile(): UserProfile {
        return UserProfile(
            name = prefs.getString("citizen_name", "") ?: "",
            phone = prefs.getString("citizen_phone", "") ?: "",
            email = prefs.getString("citizen_email", "") ?: ""
        )
    }

    fun saveProfile(profile: UserProfile) {
        prefs.edit()
            .putString("citizen_name", profile.name.trim())
            .putString("citizen_phone", profile.phone.trim())
            .putString("citizen_email", profile.email.trim())
            .apply()
    }

    fun clearProfile() {
        prefs.edit().clear().apply()
    }
}
