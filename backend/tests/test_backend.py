import asyncio
from app.services.spatial_service import calculate_haversine_distance_meters, reverse_geocode_pune
from app.services.jurisdiction_engine import JurisdictionRulesEngine
from app.services.llm_service import LlmService

def test_haversine_distance():
    # FC Road Goodluck (18.5196, 73.8436) vs Fergusson College Gate (18.5205, 73.8428) ~ 130 meters
    dist = calculate_haversine_distance_meters(18.5196, 73.8436, 18.5205, 73.8428)
    assert 100.0 < dist < 160.0
    print(f"Haversine distance verified: {dist:.2f} meters")

def test_reverse_geocoding_pune():
    address, ward = reverse_geocode_pune(18.5196, 73.8436)
    assert "Shivajinagar" in ward or "Fergusson" in address
    print(f"Reverse geocode verified: {address} -> Ward: {ward}")

def test_deterministic_rules_leaning_tree():
    result = JurisdictionRulesEngine.evaluate(
        issue_type="DANGEROUS_LEANING_FALL_RISK",
        sensor_tilt_angle=27.5
    )
    assert result["urgency_level"] == "CRITICAL_EMERGENCY"
    assert "Disaster Management" in result["routed_authority"]["name"]
    assert any("Section 7(b)" in citation for citation in result["legal_citations"])
    assert result["reverification_due_hours"] == 24
    print("Leaning tree deterministic rules verified!")

def test_deterministic_rules_felling_in_progress():
    result = JurisdictionRulesEngine.evaluate(
        issue_type="ILLEGAL_FELLING",
        felling_stage="IN_PROGRESS"
    )
    assert result["urgency_level"] == "CRITICAL_EMERGENCY"
    assert result["is_cognizable_offence"] is True
    assert "Police" in result["routed_authority"]["name"]
    assert any("Section 21" in citation for citation in result["legal_citations"])
    print("Illegal felling (in-progress) rules verified!")

def test_deterministic_rules_hazardous_branch():
    result = JurisdictionRulesEngine.evaluate(
        issue_type="HAZARDOUS_BRANCH"
    )
    assert result["urgency_level"] == "HIGH"
    assert "Garden" in result["routed_authority"]["name"] or "Horticulture" in result["routed_authority"]["name"]
    print("Hazardous branch rules verified!")

def test_llm_service_fallback_draft():
    draft = LlmService._get_default_draft(
        latitude=18.5196,
        longitude=73.8436,
        citizen_notes="Tree tilting sharply towards road (28.0° lean angle)",
        citizen_name="Tanmay Jivnani",
        address_landmark="FC Road Goodluck Chowk",
        ward_name="Shivajinagar - Ghole Road"
    )
    assert "FC Road Goodluck Chowk" in draft["draft_subject_en"]
    assert "Tanmay Jivnani" in draft["draft_body_en"]
    assert "धोकादायक" in draft["draft_summary_mr"] or "पुणे महानगरपालिका" in draft["draft_summary_mr"]
    print("Bilingual fallback drafting verified!")

if __name__ == "__main__":
    test_haversine_distance()
    test_reverse_geocoding_pune()
    test_deterministic_rules_leaning_tree()
    test_deterministic_rules_felling_in_progress()
    test_deterministic_rules_hazardous_branch()
    test_llm_service_fallback_draft()
    print("\nALL BACKEND CORE TESTS PASSED SUCCESSFULLY!")
