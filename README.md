# 🌳 Pune Automated Tree Grievance & Civic Verification System
> **iQOO Hackathon 2026 — Pune City Battle (Open Innovation / Productivity Track)**

A phone-first civic redressal platform empowering Pune citizens to report, legally ground, dispatch, and independently verify tree emergencies (dangerous leaning trees, illegal felling, hazardous branches, concretized roots).

---

## 🌟 Key Innovations & Technical Highlights

1. **Hardware-Integrated Leaning Tree Measurement**:
   * Uses the phone's **Gyroscope / Accelerometer** sensor to quantitatively calculate trunk tilt angle (e.g. `28.5° from vertical`) and injects measured physical evidence into the complaint.
2. **On-Device Fast Triage + Multimodal Backend AI**:
   * **Step 1 (On-Device)**: Ultra-fast TFLite tree sanity & lighting validator (<50ms).
   * **Step 2 (Backend)**: Multimodal AI (**Qwen2.5-VL via OpenRouter**) for fine-grained visual damage analysis and bilingual (English + Marathi) grievance drafting.
3. **Deterministic Jurisdiction Engine (No LLM Hallucinations)**:
   * Fixed statutory lookup grounded strictly in the **Maharashtra (Urban Areas) Protection & Preservation of Trees Act, 1975** (Sections 7, 8, and 21) routing directly to PMC Disaster Cell, Pune City Police (112), Tree Authority, or Ward Horticulture Officers.
4. **Smart Proximity Duplicate Detection**:
   * Scans a 30-meter spatial radius to prevent municipal spam while allowing citizens to **"Add Photo & Upvote"** as corroborating witnesses, dynamically elevating complaint priority.
5. **Citizen-Controlled Multi-Channel Dispatch**:
   * **Official Email**: Sends formal WeasyPrint A4 PDF notice via SMTP.
   * **WhatsApp**: Deep link (`wa.me`) with pre-filled Marathi/English alert and live status tracker URL.
   * **X / Twitter**: Generates public escalation post tagging `@PMCPune`, `@PuneCityPolice`, `@CollectorPune`.
6. **Photo-Based Re-verification with Ghost Camera Overlay**:
   * Overlays the original complaint photo as a semi-transparent guide so citizens can re-photograph the exact same angle. Backend AI performs visual differential comparison to verify whether the hazard was actually resolved or requires escalation.

---

## 🏗️ Architecture

```
[Phone Camera + Gyroscope Tilt Sensor]
          │
          ▼ (Step 1: Local Sanity Check)
  [TFLite Tree Classifier (<50ms)]
          │
          ▼ (Step 2: Proximity Duplicate Search)
  [Spatial 30m Duplicate Scanner]
          │
          ▼ (Step 3: Vision + Bilingual Drafting)
  [FastAPI Backend + Qwen2.5-VL (OpenRouter)]
          │
          ▼ (Step 4: Deterministic Jurisdiction Matrix)
  [Maharashtra Tree Act 1975 Statutory Routing]
          │
          ▼ (Step 5: Official PDF Compilation)
  [WeasyPrint A4 Grievance Document]
          │
          ▼ (Step 6: Citizen Gate Confirmation)
  [Dispatch: Email (PDF) | WhatsApp (wa.me) | Twitter Tagging]
          │
          ▼ (Step 7: Resolution Audit)
  [Ghost Camera Re-Verification & Visual Diff]
```

---

## 🚀 Getting Started

### 1. Backend Service (FastAPI)

```bash
cd backend

# Create virtual environment & install dependencies
pip install -r requirements.txt

# Configure environment
cp .env.example .env
# Add your OPENROUTER_API_KEY in .env

# Run unit tests
python -m tests.test_backend

# Start backend server
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

* Swagger API Documentation: `http://localhost:8000/docs`

### 2. Android App (Kotlin + Jetpack Compose)

```bash
cd android
# Open in Android Studio or build via Gradle
./gradlew assembleDebug
```

* **Demo Presets Mode**: Built-in Pune coordinate simulation (FC Road Goodluck Chowk, Baner High St, Kothrud, Shaniwar Wada) for indoor hackathon demo environments.

---

## ⚖️ Statutory Legal Grounding
* **Section 7(b)**: Emergency preservation of public safety against hazardous / leaning trees.
* **Section 8(1)**: Absolute prohibition against unauthorized tree felling.
* **Section 8(3)**: Mandatory public notification and objection window.
* **Section 21**: Cognizable penal offences and police seizure powers for illegal felling.
* **NGT Principal Bench Directives**: Mandatory 1-meter de-concretized soil basin around urban tree roots.
