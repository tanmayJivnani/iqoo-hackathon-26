import os
from typing import List

try:
    from pydantic_settings import BaseSettings
except ImportError:
    from pydantic import BaseSettings

class Settings(BaseSettings):
    PROJECT_NAME: str = "Pune Automated Tree Complaint System"
    VERSION: str = "1.0.0"
    API_V1_STR: str = "/api/v1"
    
    # Gemini AI Studio Primary Key for 2s fast inference
    GEMINI_API_KEY: str = os.getenv("GEMINI_API_KEY", "AQ.Ab8RN6J0Y0TrpxbMaUt0hyh-8DfC2wGXBXsLHX9bOmQ8Zu6q6g")
    
    # OpenRouter API Key and Fallback Model
    OPENROUTER_API_KEY: str = os.getenv("OPENROUTER_API_KEY", "")
    OPENROUTER_BASE_URL: str = "https://openrouter.ai/api/v1"
    OPENROUTER_MODEL: str = os.getenv("OPENROUTER_MODEL", "qwen/qwen3-vl-32b-instruct")
    
    # Database URL (Defaults to SQLite for instant plug-and-play, supports PostgreSQL/Supabase)
    DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite+aiosqlite:///./pune_trees.db")
    
    # Spatial Duplicate Radius in Meters
    DUPLICATE_RADIUS_METERS: float = 30.0
    
    # SMTP Server Settings for Official Grievance Email Dispatch
    SMTP_HOST: str = os.getenv("SMTP_HOST", "smtp.gmail.com")
    SMTP_PORT: int = int(os.getenv("SMTP_PORT", "587"))
    SMTP_USER: str = os.getenv("SMTP_USER", "")
    SMTP_PASSWORD: str = os.getenv("SMTP_PASSWORD", "")
    SMTP_FROM_EMAIL: str = os.getenv("SMTP_FROM_EMAIL", "complaints@punetrees.org")
    
    # Verified PMC Official Authority Contacts
    PMC_TREE_AUTHORITY_EMAIL: str = os.getenv("PMC_TREE_AUTHORITY_EMAIL", "ashok.ghorpade@punecorporation.org")
    PMC_DISASTER_CELL_EMAIL: str = os.getenv("PMC_DISASTER_CELL_EMAIL", "ganesh.sonune@punecorporation.org")
    PMC_GENERAL_FEEDBACK_EMAIL: str = os.getenv("PMC_GENERAL_FEEDBACK_EMAIL", "info@punecorporation.org")
    PMC_WHATSAPP_HELPLINE: str = os.getenv("PMC_WHATSAPP_HELPLINE", "919689900002")
    PUNE_POLICE_CONTROL_EMAIL: str = os.getenv("PUNE_POLICE_CONTROL_EMAIL", "cp.pune@mahapolice.gov.in")
    PUNE_POLICE_EMERGENCY_PHONE: str = "112"
    
    # Storage directory for photos & generated PDFs
    MEDIA_DIR: str = os.getenv("MEDIA_DIR", "./media")
    
    class Config:
        case_sensitive = True
        env_file = ".env"

settings = Settings()
