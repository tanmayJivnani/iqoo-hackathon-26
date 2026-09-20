package org.punetrees.app.data.remote.model

import com.google.gson.annotations.SerializedName

// 1. Duplicate Check DTOs
data class DuplicateCheckRequest(
    val latitude: Double,
    val longitude: Double,
    @SerializedName("radius_meters") val radiusMeters: Double = 30.0
)

data class ExistingComplaintSummary(
    val id: String,
    @SerializedName("tracking_id") val trackingId: String,
    @SerializedName("issue_type") val issueType: String,
    @SerializedName("urgency_level") val urgencyLevel: String,
    @SerializedName("address_landmark") val addressLandmark: String,
    @SerializedName("distance_meters") val distanceMeters: Double,
    @SerializedName("witness_count") val witnessCount: Int,
    @SerializedName("verification_status") val verificationStatus: String
)

data class DuplicateCheckResponse(
    @SerializedName("has_duplicates") val hasDuplicates: Boolean,
    @SerializedName("duplicate_count") val duplicateCount: Int,
    @SerializedName("nearby_complaints") val nearbyComplaints: List<ExistingComplaintSummary>
)

data class UpvoteWitnessRequest(
    @SerializedName("complaint_id") val complaintId: String,
    @SerializedName("witness_name") val witnessName: String? = null,
    @SerializedName("witness_phone") val witnessPhone: String? = null
)

// 2. Analysis & Draft DTOs
data class AnalyzeAndDraftRequest(
    @SerializedName("photo_base64") val photoBase64: String,
    @SerializedName("photos_base64") val photosBase64: List<String>? = null,
    @SerializedName("perpetrator_photos_base64") val perpetratorPhotosBase64: List<String>? = null,
    @SerializedName("citizen_selected_category") val citizenSelectedCategory: String? = null,
    val latitude: Double,
    val longitude: Double,
    @SerializedName("sensor_tilt_angle") val sensorTiltAngle: Float? = null,
    @SerializedName("citizen_notes") val citizenNotes: String? = null,
    @SerializedName("citizen_name") val citizenName: String? = "Pune Citizen",
    @SerializedName("citizen_phone") val citizenPhone: String? = null,
    @SerializedName("citizen_email") val citizenEmail: String? = null,
    @SerializedName("perpetrator_name") val perpetratorName: String? = null,
    @SerializedName("perpetrator_phone") val perpetratorPhone: String? = null,
    @SerializedName("address_landmark") val addressLandmark: String? = null
)

data class RoutingAuthorityDetail(
    val name: String,
    val role: String,
    val email: String,
    val whatsapp: String?,
    @SerializedName("emergency_phone") val emergencyPhone: String?
)

data class CensusTreeRecord(
    @SerializedName("has_census_match") val hasCensusMatch: Boolean = true,
    @SerializedName("census_tag_id") val censusTagId: String,
    @SerializedName("botanical_name") val botanicalName: String,
    @SerializedName("common_name") val commonName: String,
    @SerializedName("local_name_mr") val localNameMr: String? = null,
    @SerializedName("girth_cm") val girthCm: Float,
    @SerializedName("height_m") val heightM: Float,
    val ownership: String,
    @SerializedName("ward_name") val wardName: String,
    @SerializedName("road_name") val roadName: String? = null,
    @SerializedName("is_heritage_tree") val isHeritageTree: Boolean = false,
    @SerializedName("estimated_age_years") val estimatedAgeYears: Int,
    @SerializedName("distance_meters") val distanceMeters: Double,
    @SerializedName("legal_status") val legalStatus: String
)

data class AnalyzeAndDraftResponse(
    @SerializedName("complaint_id") val complaintId: String,
    @SerializedName("tracking_id") val trackingId: String,
    @SerializedName("issue_type") val issueType: String,
    @SerializedName("urgency_level") val urgencyLevel: String,
    @SerializedName("felling_stage") val fellingStage: String,
    @SerializedName("is_cognizable_offence") val isCognizableOffence: Boolean,
    @SerializedName("sensor_tilt_angle") val sensorTiltAngle: Float?,
    @SerializedName("census_tree") val censusTree: CensusTreeRecord? = null,
    @SerializedName("citizen_selected_category") val citizenSelectedCategory: String? = null,
    @SerializedName("is_category_mismatch") val isCategoryMismatch: Boolean = false,
    @SerializedName("ai_suggested_category") val aiSuggestedCategory: String? = null,
    @SerializedName("mismatch_reason_en") val mismatchReasonEn: String? = null,
    @SerializedName("mismatch_reason_mr") val mismatchReasonMr: String? = null,
    @SerializedName("ai_additional_category") val aiAdditionalCategory: String? = null,
    @SerializedName("ai_additional_reason_en") val aiAdditionalReasonEn: String? = null,
    @SerializedName("estimated_tree_species") val estimatedTreeSpecies: String? = null,
    @SerializedName("visual_damage_summary") val visualDamageSummary: String? = null,
    @SerializedName("perpetrator_observed") val perpetratorObserved: Boolean = false,
    @SerializedName("perpetrator_description") val perpetratorDescription: String? = null,
    @SerializedName("perpetrator_name") val perpetratorName: String? = null,
    @SerializedName("perpetrator_phone") val perpetratorPhone: String? = null,
    @SerializedName("citizen_name") val citizenName: String? = null,
    @SerializedName("citizen_phone") val citizenPhone: String? = null,
    @SerializedName("citizen_email") val citizenEmail: String? = null,
    @SerializedName("is_fallback") val isFallback: Boolean = false,
    @SerializedName("ai_provider") val aiProvider: String? = null,
    @SerializedName("tree_detected") val treeDetected: Boolean = true,
    @SerializedName("rejection_reason") val rejectionReason: String? = null,
    val latitude: Double = 0.0,
    val longitude: Double = 0.0,
    @SerializedName("address_landmark") val addressLandmark: String = "",
    @SerializedName("ward_name") val wardName: String = "",
    @SerializedName("routed_authority") val routedAuthority: RoutingAuthorityDetail = RoutingAuthorityDetail(
        name = "PMC Tree Authority",
        role = "Tree Officer & Assistant Superintendent",
        email = "ashok.ghorpade@punecorporation.org",
        whatsapp = "919689900002",
        emergencyPhone = "112"
    ),
    @SerializedName("legal_citations") val legalCitations: List<String> = emptyList(),
    @SerializedName("draft_subject_en") val draftSubjectEn: String = "",
    @SerializedName("draft_body_en") val draftBodyEn: String = "",
    @SerializedName("draft_summary_mr") val draftSummaryMr: String = "",
    @SerializedName("reverification_due_hours") val reverificationDueHours: Int = 48,
    @SerializedName("reverification_due_date") val reverificationDueDate: String? = null
)

// 3. PDF DTOs
data class RenderPdfRequest(
    @SerializedName("complaint_id") val complaintId: String,
    @SerializedName("draft_subject_en") val draftSubjectEn: String? = null,
    @SerializedName("draft_body_en") val draftBodyEn: String? = null,
    @SerializedName("tracking_id") val trackingId: String? = null,
    @SerializedName("issue_type") val issueType: String? = null,
    @SerializedName("urgency_level") val urgencyLevel: String? = null,
    @SerializedName("felling_stage") val fellingStage: String? = null,
    @SerializedName("latitude") val latitude: Double? = null,
    @SerializedName("longitude") val longitude: Double? = null,
    @SerializedName("sensor_tilt_angle") val sensorTiltAngle: Float? = null,
    @SerializedName("address_landmark") val addressLandmark: String? = null,
    @SerializedName("ward_name") val wardName: String? = null,
    @SerializedName("citizen_name") val citizenName: String? = null,
    @SerializedName("citizen_phone") val citizenPhone: String? = null,
    @SerializedName("citizen_email") val citizenEmail: String? = null,
    @SerializedName("perpetrator_name") val perpetratorName: String? = null,
    @SerializedName("perpetrator_phone") val perpetratorPhone: String? = null,
    @SerializedName("legal_citations") val legalCitations: List<String>? = null,
    @SerializedName("draft_summary_mr") val draftSummaryMr: String? = null,
    @SerializedName("photo_base64") val photoBase64: String? = null,
    @SerializedName("estimated_tree_species") val estimatedTreeSpecies: String? = null,
    @SerializedName("visual_damage_summary") val visualDamageSummary: String? = null
)

data class RenderPdfResponse(
    @SerializedName("complaint_id") val complaintId: String,
    @SerializedName("tracking_id") val trackingId: String,
    @SerializedName("pdf_url") val pdfUrl: String,
    @SerializedName("file_size_bytes") val fileSizeBytes: Int
)

// 4. Dispatch DTOs
data class DispatchRequest(
    @SerializedName("complaint_id") val complaintId: String,
    @SerializedName("confirmed_by_citizen") val confirmedByCitizen: Boolean = true,
    val channels: List<String>,
    @SerializedName("tracking_id") val trackingId: String? = null,
    @SerializedName("issue_type") val issueType: String? = null,
    @SerializedName("urgency_level") val urgencyLevel: String? = null,
    @SerializedName("latitude") val latitude: Double? = null,
    @SerializedName("longitude") val longitude: Double? = null,
    @SerializedName("address_landmark") val addressLandmark: String? = null,
    @SerializedName("ward_name") val wardName: String? = null,
    @SerializedName("citizen_name") val citizenName: String? = null,
    @SerializedName("citizen_phone") val citizenPhone: String? = null,
    @SerializedName("citizen_email") val citizenEmail: String? = null,
    @SerializedName("legal_citations") val legalCitations: List<String>? = null,
    @SerializedName("draft_subject_en") val draftSubjectEn: String? = null,
    @SerializedName("draft_body_en") val draftBodyEn: String? = null,
    @SerializedName("draft_summary_mr") val draftSummaryMr: String? = null
)

data class EmailDispatchResult(
    val sent: Boolean,
    val recipient: String,
    val subject: String,
    @SerializedName("pdf_attached") val pdfAttached: Boolean
)

data class WhatsAppDispatchResult(
    val ready: Boolean,
    @SerializedName("phone_number") val phoneNumber: String,
    @SerializedName("deep_link_url") val deepLinkUrl: String,
    @SerializedName("message_text") val messageText: String
)

data class TwitterDispatchResult(
    val ready: Boolean,
    @SerializedName("share_url") val shareUrl: String,
    @SerializedName("tweet_text") val tweetText: String
)

data class DispatchResponse(
    @SerializedName("complaint_id") val complaintId: String,
    @SerializedName("tracking_id") val trackingId: String,
    val status: String,
    val email: EmailDispatchResult?,
    val whatsapp: WhatsAppDispatchResult?,
    val twitter: TwitterDispatchResult?
)

// 5. Verification DTOs
data class ReverifyRequest(
    @SerializedName("complaint_id") val complaintId: String,
    @SerializedName("photo_base64") val photoBase64: String,
    val latitude: Double,
    val longitude: Double,
    @SerializedName("citizen_verdict") val citizenVerdict: String? = null,
    @SerializedName("citizen_notes") val citizenNotes: String? = null
)

data class ReverifyResponse(
    @SerializedName("verification_id") val verificationId: String,
    @SerializedName("complaint_id") val complaintId: String,
    @SerializedName("tracking_id") val trackingId: String,
    @SerializedName("gps_valid") val gpsValid: Boolean,
    @SerializedName("distance_from_original_m") val distanceFromOriginalM: Double,
    @SerializedName("ai_verdict") val aiVerdict: String,
    @SerializedName("ai_confidence") val aiConfidence: Float,
    @SerializedName("ai_notes_en") val aiNotesEn: String,
    @SerializedName("ai_notes_mr") val aiNotesMr: String,
    @SerializedName("final_status") val finalStatus: String,
    @SerializedName("reopen_count") val reopenCount: Int
)

data class ComplaintListItem(
    val id: String,
    @SerializedName("tracking_id") val trackingId: String,
    @SerializedName("issue_type") val issueType: String,
    @SerializedName("urgency_level") val urgencyLevel: String,
    @SerializedName("address_landmark") val addressLandmark: String,
    @SerializedName("verification_status") val verificationStatus: String,
    @SerializedName("reverification_due_at") val reverificationDueAt: String? = null,
    @SerializedName("created_at") val createdAt: String
)

data class ComplaintDetailResponse(
    val id: String,
    @SerializedName("tracking_id") val trackingId: String,
    @SerializedName("issue_type") val issueType: String,
    @SerializedName("urgency_level") val urgencyLevel: String,
    @SerializedName("address_landmark") val addressLandmark: String,
    @SerializedName("ward_name") val wardName: String?,
    val latitude: Double,
    val longitude: Double,
    @SerializedName("sensor_tilt_angle") val sensorTiltAngle: Float?,
    @SerializedName("routed_authority") val routedAuthority: String,
    @SerializedName("routed_authority_role") val routedAuthorityRole: String?,
    @SerializedName("target_email") val targetEmail: String,
    @SerializedName("target_whatsapp") val targetWhatsapp: String?,
    @SerializedName("legal_citations") val legalCitations: List<String>?,
    @SerializedName("photo_urls") val photoUrls: List<String>?,
    @SerializedName("draft_subject_en") val draftSubjectEn: String,
    @SerializedName("draft_body_en") val draftBodyEn: String,
    @SerializedName("draft_summary_mr") val draftSummaryMr: String,
    @SerializedName("pdf_path") val pdfPath: String?,
    @SerializedName("dispatch_status") val dispatchStatus: String,
    @SerializedName("verification_status") val verificationStatus: String,
    @SerializedName("reverification_due_at") val reverificationDueAt: String,
    @SerializedName("created_at") val createdAt: String
)
