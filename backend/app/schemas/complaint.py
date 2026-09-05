from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime

# 1. Duplicate check schemas
class DuplicateCheckRequest(BaseModel):
    latitude: float
    longitude: float
    radius_meters: Optional[float] = 30.0

class ExistingComplaintSummary(BaseModel):
    id: str
    tracking_id: str
    issue_type: str
    urgency_level: str
    address_landmark: str
    distance_meters: float
    witness_count: int
    photo_urls: List[str]
    created_at: datetime
    verification_status: str

class DuplicateCheckResponse(BaseModel):
    has_duplicates: bool
    duplicate_count: int
    nearby_complaints: List[ExistingComplaintSummary]

class UpvoteWitnessRequest(BaseModel):
    complaint_id: str
    witness_name: Optional[str] = None
    witness_phone: Optional[str] = None
    corroborating_photo_base64: Optional[str] = None

# 2. Analysis & Drafting schemas
class AnalyzeAndDraftRequest(BaseModel):
    photo_base64: str # Primary Base64 data or data URI
    photos_base64: Optional[List[str]] = None # Multiple photos of the TREE (Wide, Damage, Root Base)
    perpetrator_photos_base64: Optional[List[str]] = None # Photos of contractor/equipment for legal record
    citizen_selected_category: Optional[str] = None # User's preliminary selection
    latitude: float
    longitude: float
    sensor_tilt_angle: Optional[float] = None # In degrees (e.g., 28.5)
    citizen_notes: Optional[str] = None
    citizen_name: Optional[str] = "Concerned Pune Citizen"
    citizen_phone: Optional[str] = None
    citizen_email: Optional[str] = None
    perpetrator_name: Optional[str] = None
    perpetrator_phone: Optional[str] = None
    address_landmark: Optional[str] = None

class RoutingAuthorityDetail(BaseModel):
    name: str
    role: str
    email: str
    whatsapp: Optional[str] = None
    emergency_phone: Optional[str] = None

class CensusTreeRecord(BaseModel):
    has_census_match: bool = True
    census_tag_id: str
    botanical_name: str
    common_name: str
    local_name_mr: Optional[str] = None
    girth_cm: float
    height_m: float
    ownership: str
    ward_name: str
    road_name: Optional[str] = None
    is_heritage_tree: bool = False
    estimated_age_years: int
    distance_meters: float
    legal_status: str

class AnalyzeAndDraftResponse(BaseModel):
    complaint_id: str
    tracking_id: str
    issue_type: str
    urgency_level: str
    felling_stage: str
    land_ownership: str
    is_cognizable_offence: bool
    sensor_tilt_angle: Optional[float] = None
    
    # PMC Tree Census GIS Ground Truth Match
    census_tree: Optional[CensusTreeRecord] = None
    
    # Human-in-the-Loop Mismatch & Additional Defect detection
    citizen_selected_category: Optional[str] = None
    is_category_mismatch: bool = False
    ai_suggested_category: Optional[str] = None
    mismatch_reason_en: Optional[str] = None
    mismatch_reason_mr: Optional[str] = None
    ai_additional_category: Optional[str] = None
    ai_additional_reason_en: Optional[str] = None
    estimated_tree_species: Optional[str] = None
    visual_damage_summary: Optional[str] = None
    perpetrator_observed: Optional[bool] = False
    perpetrator_description: Optional[str] = None
    perpetrator_name: Optional[str] = None
    perpetrator_phone: Optional[str] = None
    
    # Transparency & AI Fallback status
    is_fallback: bool = False
    ai_provider: Optional[str] = None
    fallback_reason: Optional[str] = None
    
    # Geolocation & Reverse Geocode
    latitude: float
    longitude: float
    address_landmark: str
    ward_name: str
    
    # Spam & Tree Validation Gate
    tree_detected: bool = True
    rejection_reason: Optional[str] = None

    # Routing & Legal
    routed_authority: Optional[RoutingAuthorityDetail] = None
    legal_citations: List[str] = []
    
    # Drafts (Bilingual)
    draft_subject_en: Optional[str] = None
    draft_body_en: Optional[str] = None
    draft_summary_mr: Optional[str] = None
    
    # Verification timeline
    reverification_due_hours: int = 48
    reverification_due_date: Optional[datetime] = None

# 3. PDF Generation schemas
class RenderPdfRequest(BaseModel):
    complaint_id: str

class RenderPdfResponse(BaseModel):
    complaint_id: str
    tracking_id: str
    pdf_url: str
    file_size_bytes: int

# 4. Dispatch schemas
class DispatchRequest(BaseModel):
    complaint_id: str
    confirmed_by_citizen: bool = True
    channels: List[str] = Field(default_factory=lambda: ["EMAIL", "WHATSAPP"]) # EMAIL, WHATSAPP, TWITTER

class EmailDispatchResult(BaseModel):
    sent: bool
    recipient: str
    cc: Optional[str] = None
    subject: str
    pdf_attached: bool
    error: Optional[str] = None

class WhatsAppDispatchResult(BaseModel):
    ready: bool
    phone_number: str
    deep_link_url: str
    message_text: str

class TwitterDispatchResult(BaseModel):
    ready: bool
    share_url: str
    tweet_text: str

class DispatchResponse(BaseModel):
    complaint_id: str
    tracking_id: str
    status: str
    dispatched_at: datetime
    email: Optional[EmailDispatchResult] = None
    whatsapp: Optional[WhatsAppDispatchResult] = None
    twitter: Optional[TwitterDispatchResult] = None

# 5. Verification schemas
class ReverifyRequest(BaseModel):
    complaint_id: str
    photo_base64: str
    latitude: float
    longitude: float
    citizen_verdict: Optional[str] = None # CONFIRMED_RESOLVED, DISPUTED_NOT_RESOLVED
    citizen_notes: Optional[str] = None

class ReverifyResponse(BaseModel):
    verification_id: str
    complaint_id: str
    tracking_id: str
    gps_valid: bool
    distance_from_original_m: float
    
    ai_verdict: str # RESOLVED_CLEARED, STILL_DAMAGED, INCONCLUSIVE
    ai_confidence: float
    ai_notes_en: str
    ai_notes_mr: str
    
    final_status: str # VERIFIED_RESOLVED, VERIFIED_UNRESOLVED_ESCALATED
    reopen_count: int
    escalation_draft: Optional[Dict[str, str]] = None
