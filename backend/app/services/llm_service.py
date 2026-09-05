import json
import httpx
from typing import Dict, Any, Optional, List
from app.core.config import settings

class LlmService:
    """
    OpenRouter client running multimodal models to perform visual scene analysis
    and draft formal human-grounded bilingual grievance letters.
    """

    @staticmethod
    async def analyze_and_draft(
        photo_base64: str,
        latitude: float,
        longitude: float,
        tracking_id: str = "PMC-TREE-2026-UNSPEC",
        photos_base64: Optional[List[str]] = None,
        citizen_selected_category: Optional[str] = None,
        census_tree: Optional[Dict[str, Any]] = None,
        sensor_tilt_angle: Optional[float] = None,
        citizen_notes: Optional[str] = None,
        citizen_name: Optional[str] = "Concerned Pune Citizen",
        citizen_phone: Optional[str] = None,
        citizen_email: Optional[str] = None,
        perpetrator_name: Optional[str] = None,
        perpetrator_phone: Optional[str] = None,
        address_landmark: Optional[str] = None,
        ward_name: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Calls OpenRouter multimodal models sequentially in priority order with full attempt logging.
        Returns visual classification, species, and drafted human-written first-person letters.
        """
        all_photos = []
        if photos_base64 and len(photos_base64) > 0:
            all_photos = photos_base64
        elif photo_base64:
            all_photos = [photo_base64]

        image_contents = []
        for p in all_photos[:3]: # Send up to 3 tree photos to AI
            payload_str = p if p.startswith("data:image") else f"data:image/jpeg;base64,{p}"
            image_contents.append({
                "type": "image_url",
                "image_url": {"url": payload_str}
            })

        target_category = citizen_selected_category or "HAZARDOUS_BRANCH"
        
        # Natural human contractor context
        if perpetrator_name or perpetrator_phone:
            perp_context = f"The contractor/individual identified on site is '{perpetrator_name or 'Unknown Contractor'}' with contact/vehicle '{perpetrator_phone or 'Not provided'}'. Cite this party explicitly under Section 21 of Maharashtra Tree Act."
        else:
            perp_context = "I do not know the identity or contact details of the contractor or perpetrators involved."

        sensor_pitch_context = ""
        if sensor_tilt_angle is not None:
            sensor_pitch_context = f"\nDEVICE SENSOR CALIBRATION: On-site device pitch sensor measured a trunk tilt/lean of {sensor_tilt_angle:.1f}° from vertical. Integrate this physical measurement into the arborist risk assessment."

        census_context = ""
        if census_tree and census_tree.get("has_census_match"):
            census_context = f"""
POTENTIAL PMC TREE CENSUS GIS RECORD (NEARBY BASELINE WITHIN {census_tree.get('distance_meters')}m):
- Potential Historical Tag : #{census_tree.get('census_tag_id')}
- Recorded Species (2019)  : {census_tree.get('botanical_name')} ({census_tree.get('common_name')})
- Recorded Girth / Ward    : {census_tree.get('girth_cm')} cm | {census_tree.get('ward_name')}

IMPORTANT FORENSIC INSTRUCTION:
- Your visual inspection of the citizen's live submitted photo(s) is the PRIMARY authoritative evidence.
- Identify the tree species and structural state based on what you visually see in the photo.
- Treat this PMC 2019 Census record strictly as an auxiliary potential historical reference. Mention it optionally in the evidence description as: "A potential municipal census record exists within {census_tree.get('distance_meters')}m (# {census_tree.get('census_tag_id')}, {census_tree.get('botanical_name')})".
"""

        system_prompt = f"""
You are an expert Urban Forensic Arborist and Municipal Grievance Drafting Assistant for Pune Municipal Corporation (PMC).
The citizen is lodging a formal grievance under category: '{target_category}' under the Maharashtra (Urban Areas) Protection & Preservation of Trees Act, 1975.
{census_context}{sensor_pitch_context}
Your primary objective is to inspect the submitted photo(s) of the tree, verify tree presence, extract factual visual evidence, and draft a formal statutory notice.

CRITICAL RULES:
0. TREE PRESENCE & ANTI-SPAM QUALITY GATE (STRICTEST PRIORITY):
   - You MUST first verify whether a real tree, branch, trunk, canopy, root basin, or botanical vegetation subject is clearly visible in the submitted photos.
   - If the photos show ANY non-tree or irrelevant subjects (such as keyboards, computer screens, indoor furniture, electronics, walls, vehicles, animals, human selfies, paperwork, or indoor household objects):
     You MUST set "tree_detected": false and "rejection_reason": "No tree or plant subject was detected in the submitted photos. Image contains non-tree content (e.g. indoor objects/screens)."
     Do NOT generate any draft subject, body, or summary when tree_detected is false.
   - If a genuine tree/arboricultural subject is visible:
     Set "tree_detected": true and "rejection_reason": null, and proceed with full analysis and drafting.

1. FIRST-PERSON HUMAN VOICE (MANDATORY):
   - The letter MUST be drafted strictly from the first-person perspective of a resident citizen (e.g. "I am a resident of {ward_name}...", "I am writing to formally bring to your urgent attention...", "I observed that...").
   - NEVER use robotic, passive, or automated third-person phrases such as "no contractor details have been provided" or "sensor measured". If contractor info is missing, write naturally: "I do not know the details of the contractor/party involved" or omit mentioning unobserved parties.
2. PRE-FILLED JURISDICTION (NEVER LEAVE AS PLACEHOLDERS):
   - You MUST insert the actual real-world values for '{address_landmark}', '{ward_name}', and GPS coordinates ({latitude:.5f}° N, {longitude:.5f}° E) directly into the text of the Subject line and Letter body. Do NOT leave '[Street Name]' or '[Ward Name]' in the output.
3. MANDATORY GRIEVANCE TRACKING ID:
   - You MUST include the tracking reference `[Grievance Ref: {tracking_id}]` in the Subject line AND cite `Grievance Reference Number: {tracking_id}` in the opening paragraph of the letter body.
4. STANDARDIZED CITIZEN SIGN-OFF: Every drafted letter MUST conclude with:
If you need any more details, feel free to contact me.

Submitted by:
Name: {citizen_name}
Phone: {citizen_phone or '+91-XXXXXXXXXX'}
Email: {citizen_email or 'citizen@example.com'}
Pune Tree Rakshak (Citizen Complaint Portal)

5. FORENSIC DAMAGE & PLACEHOLDER DRAFTING FOR '{target_category}':
- If tree damage for '{target_category}' is clearly visible (e.g. leaning trunk, cut marks, hanging fractured limb, concretized basin, nails/advertising boards/strangling cables, or termite rot):
  Extract precise factual morphological evidence into 'visual_damage_summary' and draft the formal statutory notice.
- If a genuine tree is present ('tree_detected': true) but specific micro-damage details for '{target_category}' are subtle or obstructed from the camera angle:
  Set 'visual_damage_summary': "Tree present at locus; specific '{target_category}' damage details require on-site verification."
  Draft the formal grievance for '{target_category}' embedding real coordinates, landmark, ward, and tracking ID, and insert this exact editable placeholder inside the letter body:
  "[SPECIFIC DAMAGE OBSERVATION: Please describe the observed damage or hazard here (e.g. extent of lean, branch height, cut marks, nails/cables, etc.)]"

You must output a strictly valid JSON object with the following schema:
{{
  "tree_detected": true | false,
  "rejection_reason": "Explanation if no tree is detected, otherwise null",
  "detected_issue_category": "{target_category}" | "INVALID_IMAGE",
  "ai_additional_category": "Additional violation category if clearly identified in photos, e.g. ROOT_CONCRETIZATION, NAILS_BOARDS_CABLES, UNAUTHORIZED_PRUNING, DANGEROUS_LEANING_FALL_RISK, or null",
  "ai_additional_reason_en": "Clear factual reason for the additional violation identified, or null",
  "estimated_tree_species": "Botanical / Common name or null",
  "perpetrator_observed": false,
  "perpetrator_description": "Description of any observed contractor/cutting party, otherwise null",
  "felling_stage": "IN_PROGRESS" | "COMPLETED" | "NOT_APPLICABLE",
  "visual_damage_summary": "Precise factual morphological description of what is visually observed on the tree",
  "estimated_urgency": "CRITICAL_EMERGENCY" | "HIGH" | "MEDIUM" | "ROUTINE",
  "draft_subject_en": "Formal email subject line embedding {address_landmark}, {ward_name}, and [Grievance Ref: {tracking_id}] (or null if tree_detected is false)",
  "draft_body_en": "Formal concise first-person letter in English addressed to Tree Officer, ending with sign-off block (or null if tree_detected is false)",
  "draft_summary_mr": "A 2-3 sentence concise Marathi message for WhatsApp dispatch (or null if tree_detected is false)"
}}
"""

        tilt_user_str = f"Device Physical Pitch: {sensor_tilt_angle:.1f}° from vertical measured on site.\n" if sensor_tilt_angle is not None else ""

        user_prompt_text = f"""
Please analyze the attached evidence photo(s) for the '{target_category}' report at {address_landmark}, {ward_name} ({latitude:.5f}° N, {longitude:.5f}° E).
Citizen Observation Notes: "{citizen_notes or 'Visual inspection requested on site.'}"
{perp_context}
{tilt_user_str}
Grievance Reference Number: {tracking_id}

INSTRUCTIONS:
1. FIRST: Check if a genuine tree or plant subject is present in the photos. If non-tree (keyboard, screen, indoor object, etc.), set tree_detected=false and do not draft.
2. If tree is present: Identify species and factual condition.
3. Check for any ADDITIONAL tree violations in the photos beyond the citizen's category (e.g. root choking with concrete, nails/posters driven in trunk, unscientific pruning). If found, populate 'ai_additional_category' and 'ai_additional_reason_en'.
4. Draft a concise, first-person formal statutory letter from {citizen_name} to PMC Tree Authority.
5. Conclude with 'If you need any more details, feel free to contact me.' followed by the structured sign-off block.
6. Return strictly a valid JSON object.
"""

        user_content = [{"type": "text", "text": user_prompt_text}] + image_contents

        # -------------------------------------------------------------
        # STEP 1: PRIMARY VISION PROVIDER -> OPENROUTER (OPEN SOURCE: QWEN 2.5 VL 72B)
        # -------------------------------------------------------------
        if settings.OPENROUTER_API_KEY:
            headers = {
                "Authorization": f"Bearer {settings.OPENROUTER_API_KEY}",
                "HTTP-Referer": "https://punetrees.org",
                "X-Title": "Pune Tree Civic Grievance System",
                "Content-Type": "application/json"
            }

            candidate_models = []
            if settings.OPENROUTER_MODEL:
                candidate_models.append(settings.OPENROUTER_MODEL)
            for m in ["qwen/qwen2.5-vl-72b-instruct", "qwen/qwen3-vl-32b-instruct"]:
                if m not in candidate_models:
                    candidate_models.append(m)

            print("\n" + "="*75, flush=True)
            print("[LLM INITIATED] Primary Vision Provider: OpenRouter Open-Source Vision AI", flush=True)
            print(f" - Tracking ID : {tracking_id}", flush=True)
            print(f" - Category    : {target_category}", flush=True)
            print(f" - Photos Sent : {len(all_photos[:3])} tree evidence angles", flush=True)
            print(f" - Open Models : {candidate_models}", flush=True)
            print("="*75, flush=True)

            async with httpx.AsyncClient(timeout=90.0) as client:
                for candidate_model in candidate_models:
                    print(f"\n[OPENROUTER ATTEMPT] Querying model: '{candidate_model}' ...", flush=True)
                    payload = {
                        "model": candidate_model,
                        "messages": [
                            {"role": "system", "content": system_prompt},
                            {"role": "user", "content": user_content}
                        ],
                        "temperature": 0.2,
                        "max_tokens": 2048
                    }

                    try:
                        response = await client.post(
                            f"{settings.OPENROUTER_BASE_URL}/chat/completions",
                            headers=headers,
                            json=payload
                        )
                        
                        if response.status_code == 200:
                            data = response.json()
                            choice = data.get("choices", [{}])[0].get("message", {})
                            content = choice.get("content") or choice.get("text") or choice.get("reasoning") or ""
                            
                            parsed_json = LlmService._parse_lenient(content)

                            if parsed_json.get("tree_detected") is False or str(parsed_json.get("tree_detected")).lower() == "false":
                                parsed_json["tree_detected"] = False
                                parsed_json["rejection_reason"] = parsed_json.get("rejection_reason") or "No tree or vegetation subject detected in the submitted photos. Please provide clear photos of the actual tree."
                                parsed_json["detected_issue_category"] = "INVALID_IMAGE"
                                parsed_json["estimated_tree_species"] = None
                                parsed_json["visual_damage_summary"] = "No tree detected in submitted photos."
                                parsed_json["draft_body_en"] = None
                                parsed_json["draft_subject_en"] = None
                                parsed_json["draft_summary_mr"] = None
                                parsed_json["is_fallback"] = False
                                parsed_json["ai_provider"] = f"OPENROUTER ({candidate_model})"

                                print("\n" + "="*75, flush=True)
                                print(f" 🚫 [OPENROUTER REJECTION] NO TREE DETECTED IN EVIDENCE VIA: '{candidate_model}'", flush=True)
                                print(f"   • Reason : {parsed_json.get('rejection_reason')}", flush=True)
                                print("="*75 + "\n", flush=True)
                                return parsed_json

                            if parsed_json.get("detected_issue_category") or parsed_json.get("tree_detected") is True:
                                parsed_json["tree_detected"] = True
                                species = parsed_json.get("estimated_tree_species")
                                if not parsed_json.get("draft_body_en") or not parsed_json.get("draft_subject_en"):
                                    base_draft = LlmService._get_default_draft(
                                        tracking_id=tracking_id,
                                        latitude=latitude,
                                        longitude=longitude,
                                        citizen_notes=f"{citizen_notes or ''} [Tree Species: {species or 'Observed tree'}]",
                                        citizen_name=citizen_name,
                                        citizen_phone=citizen_phone,
                                        citizen_email=citizen_email,
                                        address_landmark=address_landmark,
                                        ward_name=ward_name
                                    )
                                    for k, v in base_draft.items():
                                        if k not in parsed_json or not parsed_json[k]:
                                            parsed_json[k] = v
                                            
                                additional_cat = parsed_json.get("ai_additional_category")
                                if additional_cat and (additional_cat == target_category or additional_cat == "null" or additional_cat == "None"):
                                    additional_cat = None
                                parsed_json["ai_additional_category"] = additional_cat
                                parsed_json["ai_additional_reason_en"] = parsed_json.get("ai_additional_reason_en") if additional_cat else None
                                parsed_json["detected_issue_category"] = target_category
                                parsed_json["is_category_mismatch"] = False
                                parsed_json["ai_suggested_category"] = None
                                parsed_json["mismatch_reason_en"] = None
                                parsed_json["is_fallback"] = False
                                parsed_json["ai_provider"] = f"OPENROUTER ({candidate_model})"
                                
                                print("\n" + "="*75, flush=True)
                                print(f" ✨ [OPENROUTER SUCCESS] COMPLETED VIA: '{candidate_model}'", flush=True)
                                print(f"   • Tree Detected      : True")
                                print(f"   • Species Identified : {parsed_json.get('estimated_tree_species')}", flush=True)
                                print(f"   • Visual Observation : {parsed_json.get('visual_damage_summary')}", flush=True)
                                print("="*75 + "\n", flush=True)

                                return parsed_json
                        else:
                            print(f" ❌ [OPENROUTER FAILED] '{candidate_model}' HTTP {response.status_code}:\n{response.text}", flush=True)
                            print(f" ➔ Trying next model candidate...", flush=True)
                    except Exception as e:
                        print(f" ❌ [OPENROUTER EXCEPTION] '{candidate_model}' error: {e}", flush=True)

            print(" ➔ OpenRouter candidates unavailable. Cascading to secondary provider...", flush=True)

        # -------------------------------------------------------------
        # STEP 2: SECONDARY FAST VISION PROVIDER -> GOOGLE GEMINI FLASH
        # -------------------------------------------------------------
        if settings.GEMINI_API_KEY:
            gemini_candidates = ["gemini-2.5-flash", "gemini-1.5-flash"]
            
            gemini_parts = [{"text": system_prompt + "\n\n" + user_prompt_text}]
            for p in all_photos[:3]:
                clean_b64 = p.split(",")[1] if "," in p else p
                gemini_parts.append({
                    "inline_data": {
                        "mime_type": "image/jpeg",
                        "data": clean_b64
                    }
                })

            gemini_payload = {
                "contents": [{"parts": gemini_parts}],
                "generationConfig": {
                    "response_mime_type": "application/json",
                    "temperature": 0.2
                }
            }

            async with httpx.AsyncClient(timeout=90.0) as client:
                for g_model in gemini_candidates:
                    gemini_url = f"https://generativelanguage.googleapis.com/v1beta/models/{g_model}:generateContent?key={settings.GEMINI_API_KEY}"
                    try:
                        print(f"[GEMINI ATTEMPT] Querying '{g_model}' endpoint with 3 photos...", flush=True)
                        resp = await client.post(gemini_url, json=gemini_payload)
                        
                        if resp.status_code == 200:
                            gem_data = resp.json()
                            cand = gem_data.get("candidates", [{}])[0]
                            gem_content = cand.get("content", {}).get("parts", [{}])[0].get("text", "")
                            
                            parsed_json = LlmService._parse_lenient(gem_content)
                            if parsed_json.get("tree_detected") is False or str(parsed_json.get("tree_detected")).lower() == "false":
                                parsed_json["tree_detected"] = False
                                parsed_json["rejection_reason"] = parsed_json.get("rejection_reason") or "No tree or vegetation subject detected in the submitted photos. Please provide clear photos of the actual tree."
                                parsed_json["detected_issue_category"] = "INVALID_IMAGE"
                                parsed_json["estimated_tree_species"] = None
                                parsed_json["visual_damage_summary"] = "No tree detected in submitted photos."
                                parsed_json["draft_body_en"] = None
                                parsed_json["draft_subject_en"] = None
                                parsed_json["draft_summary_mr"] = None
                                parsed_json["is_fallback"] = False
                                parsed_json["ai_provider"] = f"GOOGLE_GEMINI ({g_model})"
                                return parsed_json

                            if parsed_json.get("detected_issue_category") or parsed_json.get("tree_detected") is True:
                                parsed_json["tree_detected"] = True
                                species = parsed_json.get("estimated_tree_species")
                                if not parsed_json.get("draft_body_en") or not parsed_json.get("draft_subject_en"):
                                    base_draft = LlmService._get_default_draft(
                                        tracking_id=tracking_id,
                                        latitude=latitude,
                                        longitude=longitude,
                                        citizen_notes=f"{citizen_notes or ''} [Tree Species: {species or 'Observed tree'}]",
                                        citizen_name=citizen_name,
                                        citizen_phone=citizen_phone,
                                        citizen_email=citizen_email,
                                        address_landmark=address_landmark,
                                        ward_name=ward_name
                                    )
                                    for k, v in base_draft.items():
                                        if k not in parsed_json or not parsed_json[k]:
                                            parsed_json[k] = v

                                parsed_json["detected_issue_category"] = target_category
                                parsed_json["is_category_mismatch"] = False
                                parsed_json["ai_suggested_category"] = None
                                parsed_json["mismatch_reason_en"] = None
                                parsed_json["is_fallback"] = False
                                parsed_json["ai_provider"] = f"GOOGLE_GEMINI ({g_model})"
                                return parsed_json
                    except Exception as e:
                        print(f" ❌ [GEMINI EXCEPTION] '{g_model}' error: {e}", flush=True)

        # -------------------------------------------------------------
        # STEP 3: LOCAL DETERMINISTIC STATUTORY GENERATOR
        # -------------------------------------------------------------
        print("\n" + "="*75, flush=True)
        print("[FALLBACK] ENGAGING LOCAL DETERMINISTIC STATUTORY GENERATOR WITH PRE-FILLED DATA.", flush=True)
        print("="*75 + "\n", flush=True)

        fallback_draft = LlmService._get_default_draft(
            tracking_id=tracking_id,
            latitude=latitude,
            longitude=longitude,
            citizen_notes=citizen_notes,
            citizen_name=citizen_name,
            citizen_phone=citizen_phone,
            citizen_email=citizen_email,
            address_landmark=address_landmark,
            ward_name=ward_name,
            citizen_selected_category=citizen_selected_category
        )
        fallback_draft["is_fallback"] = True
        fallback_draft["ai_provider"] = "LOCAL_DETERMINISTIC_FALLBACK"
        fallback_draft["fallback_reason"] = "All 5 candidate OpenRouter models were busy or rate-limited."
        fallback_draft["is_category_mismatch"] = False
        return fallback_draft

    @staticmethod
    def _parse_lenient(raw_text: str) -> Dict[str, Any]:
        """
        Extracts JSON block from markdown code fences or plain text.
        """
        if not raw_text:
            return {}
        text = raw_text.strip()
        if "```json" in text:
            text = text.split("```json", 1)[1].split("```", 1)[0].strip()
        elif "```" in text:
            text = text.split("```", 1)[1].split("```", 1)[0].strip()

        try:
            return json.loads(text)
        except json.JSONDecodeError:
            # Substring extraction
            start = text.find("{")
            end = text.rfind("}")
            if start != -1 and end != -1:
                try:
                    return json.loads(text[start:end+1])
                except Exception:
                    pass
            return {}

    @staticmethod
    def _get_default_draft(
        tracking_id: str = "PMC-TREE-2026-UNSPEC",
        latitude: float = 18.5196,
        longitude: float = 73.8436,
        citizen_notes: Optional[str] = None,
        citizen_name: Optional[str] = "Concerned Pune Citizen",
        citizen_phone: Optional[str] = None,
        citizen_email: Optional[str] = None,
        address_landmark: Optional[str] = "Pune Central",
        ward_name: Optional[str] = "Shivajinagar - Ghole Road",
        citizen_selected_category: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Fallback generator providing a clean, human-written first-person draft.
        """
        cat = citizen_selected_category or "DANGEROUS_LEANING_FALL_RISK"
        landmark_str = address_landmark or f"Pune GPS ({latitude:.5f}° N, {longitude:.5f}° E)"
        ward_str = ward_name or "Pune Municipal Jurisdiction"
        
        sign_off_block = f"""
If you need any more details, feel free to contact me.

Submitted by:
Name: {citizen_name or 'Concerned Pune Citizen'}
Phone: {citizen_phone or '+91-XXXXXXXXXX'}
Email: {citizen_email or 'citizen@example.com'}
Pune Tree Rakshak (Citizen Complaint Portal)"""

        cat_display = cat.replace("_", " ").title()
        subject = f"URGENT: Notice Regarding {cat_display} at {landmark_str}, {ward_str} [Grievance Ref: {tracking_id}]"
        
        detail_text = citizen_notes if citizen_notes else f"[SPECIFIC DAMAGE OBSERVATION: Please describe what you observed on site regarding the {cat_display.lower()} condition (e.g. extent of lean, severed branches, root damage, etc.)]"
        
        body = f"""To,
The Tree Officer / Competent Authority,
PMC Garden & Tree Authority Department, Pune.

Grievance Reference Number: {tracking_id}
Subject: {subject}

Respected Sir/Madam,

I am writing to formally bring to your urgent attention a tree hazard located at {landmark_str} in {ward_str} (GPS: {latitude:.5f}° N, {longitude:.5f}° E).

Upon my personal observation on site, this tree presents an active {cat_display.lower()} condition. {detail_text} I do not know the identity or contact details of any private contractor or party that may have caused or neglected this issue.

In accordance with the statutory provisions of Section 8 and Section 21 of the Maharashtra (Urban Areas) Protection and Preservation of Trees Act, 1975, I respectfully urge your department to conduct an immediate on-site inspection and take necessary remedial action to avert any disaster.
{sign_off_block}"""
        damage_summary = f"Factual evidence of {cat_display.lower()} documented on site."

        return {
            "tree_detected": True,
            "rejection_reason": None,
            "detected_issue_category": cat,
            "estimated_tree_species": "Observed Tree Subject (Pune)",
            "perpetrator_observed": False,
            "perpetrator_description": None,
            "felling_stage": "NOT_APPLICABLE",
            "visual_damage_summary": damage_summary,
            "estimated_urgency": "HIGH" if cat in ("DANGEROUS_LEANING_FALL_RISK", "ILLEGAL_FELLING") else "MEDIUM",
            "draft_subject_en": subject,
            "draft_body_en": body,
            "draft_summary_mr": f"पुणे महानगरपालिका वृक्ष प्राधिकरण: {landmark_str} ({ward_str}) येथे वृक्षाबाबत ({cat_display}) तातडीने पाहणी करून योग्य ती कार्यवाही करावी. संदर्भ क्र: {tracking_id}."
        }
