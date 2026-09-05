import uuid
from datetime import datetime
from sqlalchemy import Column, String, Float, Integer, Boolean, DateTime, Text, JSON, ForeignKey
from sqlalchemy.orm import relationship
from app.db.database import Base

def generate_uuid_str() -> str:
    return str(uuid.uuid4())

class Complaint(Base):
    __tablename__ = "complaints"

    id = Column(String(36), primary_key=True, default=generate_uuid_str)
    tracking_id = Column(String(32), unique=True, index=True, nullable=False)
    
    citizen_name = Column(String(120), nullable=True)
    citizen_phone = Column(String(20), nullable=True)
    citizen_email = Column(String(120), nullable=True)

    perpetrator_name = Column(String(120), nullable=True)
    perpetrator_phone = Column(String(50), nullable=True)
    
    latitude = Column(Float, nullable=False, index=True)
    longitude = Column(Float, nullable=False, index=True)
    sensor_tilt_angle = Column(Float, nullable=True) # Degrees from vertical (e.g. 28.5)
    address_landmark = Column(Text, nullable=False)
    ward_name = Column(String(100), nullable=True)
    
    issue_type = Column(String(60), nullable=False) 
    # DANGEROUS_LEANING_FALL_RISK, ILLEGAL_FELLING, HAZARDOUS_BRANCH, DISEASE_PEST, ROOT_CONCRETIZATION, UNAUTHORIZED_PRUNING
    
    urgency_level = Column(String(30), nullable=False) # CRITICAL_EMERGENCY, HIGH, MEDIUM, ROUTINE
    felling_stage = Column(String(30), default="NOT_APPLICABLE") # IN_PROGRESS, COMPLETED, NOT_APPLICABLE
    land_ownership = Column(String(50), default="UNKNOWN") # PUBLIC_ROAD, PMC_GARDEN, PRIVATE, UNKNOWN
    
    # Deterministic Jurisdiction Output
    routed_authority = Column(String(150), nullable=False)
    routed_authority_role = Column(String(200), nullable=True)
    target_email = Column(String(150), nullable=False)
    target_whatsapp = Column(String(50), nullable=True)
    legal_citations = Column(JSON, default=list) # List of statutory references
    
    # Evidence Photos (Stored URLs or local media paths)
    photo_urls = Column(JSON, default=list)
    
    # AI Generated Bilingual Drafts
    draft_subject_en = Column(Text, nullable=False)
    draft_body_en = Column(Text, nullable=False)
    draft_summary_mr = Column(Text, nullable=False) # Marathi summary
    
    # PDF storage
    pdf_path = Column(String(255), nullable=True)
    
    # Dispatch tracking
    dispatch_status = Column(String(30), default="DRAFT") # DRAFT, DISPATCHED, FAILED
    dispatched_channels = Column(JSON, default=list) # ["EMAIL", "WHATSAPP", "TWITTER"]
    dispatched_at = Column(DateTime, nullable=True)
    
    # Verification lifecycle
    verification_status = Column(String(40), default="PENDING_TIMELOCK") 
    # PENDING_TIMELOCK, AWAITING_CITIZEN_PHOTO, VERIFIED_RESOLVED, VERIFIED_UNRESOLVED_ESCALATED
    reverification_due_at = Column(DateTime, nullable=False)
    witness_count = Column(Integer, default=1)
    reopen_count = Column(Integer, default=0)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    verifications = relationship("ComplaintVerification", back_populates="complaint", cascade="all, delete-orphan")


class ComplaintVerification(Base):
    __tablename__ = "complaint_verifications"

    id = Column(String(36), primary_key=True, default=generate_uuid_str)
    complaint_id = Column(String(36), ForeignKey("complaints.id"), nullable=False, index=True)
    
    photo_url = Column(String(255), nullable=False)
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    distance_from_original_m = Column(Float, nullable=False)
    
    ai_verdict = Column(String(50), nullable=False) # RESOLVED_CLEARED, STILL_DAMAGED, INCONCLUSIVE
    ai_confidence = Column(Float, nullable=True)
    ai_notes_en = Column(Text, nullable=True)
    ai_notes_mr = Column(Text, nullable=True)
    
    citizen_verdict = Column(String(50), nullable=True) # CONFIRMED_RESOLVED, DISPUTED_NOT_RESOLVED
    created_at = Column(DateTime, default=datetime.utcnow)

    complaint = relationship("Complaint", back_populates="verifications")
