const pptxgen = require('pptxgenjs');
const path = require('path');
const fs = require('fs');

const pres = new pptxgen();
// Set modern widescreen layout (13.333" x 7.5")
pres.layout = 'LAYOUT_WIDE';
pres.author = 'Pune Tree Rakshak Team';
pres.title = 'Pune Tree Rakshak - iQOO Hackathon 2026 Final Pitch';

// =========================================================================
// MINIMAL ECO-GREEN COLOR PALETTE (Clean White Standard)
// =========================================================================
const BG_WHITE = 'FFFFFF';         // Crisp White Slide Background
const BG_CARD_LIGHT = 'F8FAF8';    // Very soft mint/sage card fill
const BG_CARD_ALT = 'F0F7F2';      // Subtle mint accent card fill
const BORDER_CARD = 'D1E7DD';      // Fine light-green border
const BORDER_ACCENT = '86EFAC';    // Vibrant light green border
const TEXT_DARK_GREEN = '0D472B';  // Deep Forest Green for primary titles
const TEXT_FOREST = '14532D';      // Forest Green for card headers
const TEXT_EMERALD = '15803D';     // Leaf Green for highlights/badges
const TEXT_CHARCOAL = '334155';    // Clean slate-charcoal for high readability
const TEXT_MUTED = '64748B';       // Muted slate-gray for subtitles/captions
const BADGE_BG = 'DCFCE7';         // Soft green badge background
const BADGE_BORDER = '86EFAC';     // Soft green badge outline
const BADGE_TEXT = '14532D';       // Dark green badge text
const ALERT_RED_BG = 'FEF2F2';     // Clean light red card
const ALERT_RED_BORDER = 'FECACA'; // Light red border
const ALERT_RED_TEXT = '991B1B';   // Dark red text
const WARN_AMBER_BG = 'FFFBEB';    // Clean amber card
const WARN_AMBER_BORDER = 'FDE68A';// Light amber border
const WARN_AMBER_TEXT = '92400E';  // Dark amber text

const FONT_FAMILY = 'Segoe UI';

function addCleanHeader(slide, stepTag, title, subtitle) {
  // Top Badge / Step Tag
  slide.addShape(pres.ShapeType.roundRect, {
    x: 0.85, y: 0.45, w: 2.2, h: 0.32,
    rectRadius: 0.08,
    fill: { color: BADGE_BG },
    line: { color: BADGE_BORDER, width: 1 }
  });
  slide.addText(stepTag, {
    x: 0.85, y: 0.45, w: 2.2, h: 0.32,
    fontSize: 9.5, bold: true, color: BADGE_TEXT,
    align: 'center', valign: 'middle', fontFace: FONT_FAMILY
  });

  // Slide Title (Deep Forest Green)
  slide.addText(title, {
    x: 0.85, y: 0.85, w: 11.6, h: 0.48,
    fontSize: 22, bold: true, color: TEXT_DARK_GREEN,
    valign: 'middle', fontFace: FONT_FAMILY
  });

  // Slide Subtitle (Muted Slate)
  if (subtitle) {
    slide.addText(subtitle, {
      x: 0.85, y: 1.35, w: 11.6, h: 0.28,
      fontSize: 11, color: TEXT_MUTED,
      valign: 'top', fontFace: FONT_FAMILY
    });
  }

  // Subtle top hairline accent
  slide.addShape(pres.ShapeType.line, {
    x: 0.85, y: 1.72, w: 11.6, h: 0,
    line: { color: 'E2E8F0', width: 1 }
  });
}

function addCleanFooter(slide, currentSlide, totalSlides, demoSyncText) {
  // Demo Sync Bar (strictly placed at y=6.42, h=0.36)
  if (demoSyncText) {
    slide.addShape(pres.ShapeType.roundRect, {
      x: 0.85, y: 6.42, w: 11.6, h: 0.36,
      rectRadius: 0.06,
      fill: { color: 'F0FDF4' },
      line: { color: 'BBF7D0', width: 1 }
    });
    slide.addText(`📱 LIVE DEMO: ${demoSyncText}`, {
      x: 1.05, y: 6.42, w: 11.2, h: 0.36,
      fontSize: 9.5, bold: true, color: TEXT_FOREST,
      valign: 'middle', fontFace: FONT_FAMILY
    });
  }

  // Bottom Footer (y=6.92, h=0.22)
  slide.addText('iQOO Hackathon 2026 • Pune City Battle | Pune Tree Rakshak', {
    x: 0.85, y: 6.92, w: 8.0, h: 0.22,
    fontSize: 8.5, color: '94A3B8', fontFace: FONT_FAMILY
  });
  slide.addText(`Slide ${currentSlide} of ${totalSlides}`, {
    x: 10.45, y: 6.92, w: 2.0, h: 0.22,
    fontSize: 8.5, color: '94A3B8', align: 'right', fontFace: FONT_FAMILY
  });
}

// =========================================================================
// SLIDE 1: TITLE & PROBLEM HOOK (Clean Eco White)
// =========================================================================
const slide1 = pres.addSlide();
slide1.background = { color: BG_WHITE };

// Top Hackathon Pill
slide1.addShape(pres.ShapeType.roundRect, {
  x: 0.85, y: 0.55, w: 4.6, h: 0.34,
  rectRadius: 0.08,
  fill: { color: BADGE_BG },
  line: { color: BADGE_BORDER, width: 1 }
});
slide1.addText('🏆 iQOO HACKATHON 2026 • OPEN INNOVATION TRACK', {
  x: 0.85, y: 0.55, w: 4.6, h: 0.34,
  fontSize: 9.5, bold: true, color: TEXT_EMERALD,
  align: 'center', valign: 'middle', fontFace: FONT_FAMILY
});

// App Main Title & Subtitle
slide1.addText('Pune Tree Rakshak', {
  x: 0.85, y: 1.05, w: 11.6, h: 0.75,
  fontSize: 36, bold: true, color: TEXT_DARK_GREEN,
  fontFace: FONT_FAMILY
});
slide1.addText('Phone-First Civic Accountability & Urban Forest Preservation Platform', {
  x: 0.85, y: 1.82, w: 11.6, h: 0.35,
  fontSize: 13.5, color: TEXT_FOREST, fontFace: FONT_FAMILY
});

// Two Clean Minimal Cards: Problem vs Solution
// Left: Problem
slide1.addShape(pres.ShapeType.roundRect, {
  x: 0.85, y: 2.45, w: 5.65, h: 3.75,
  rectRadius: 0.1,
  fill: { color: ALERT_RED_BG },
  line: { color: ALERT_RED_BORDER, width: 1 }
});
slide1.addText('⚠️ The Problem: Broken Evidence & Ghost Closures', {
  x: 1.1, y: 2.65, w: 5.15, h: 0.32,
  fontSize: 12.5, bold: true, color: ALERT_RED_TEXT, fontFace: FONT_FAMILY
});
slide1.addText([
  { text: '• 4.09M+ Pune Trees: ', options: { bold: true, color: '7F1D1D' } },
  { text: 'Facing rampant illegal felling, concrete choking & decay.\n', options: { color: TEXT_CHARCOAL, breakLine: true } },
  { text: '• Vague Complaints: ', options: { bold: true, color: '7F1D1D' } },
  { text: 'Citizens submit un-timestamped photos with no statutory basis.\n', options: { color: TEXT_CHARCOAL, breakLine: true } },
  { text: '• "Paper Closures": ', options: { bold: true, color: '7F1D1D' } },
  { text: 'Municipal portals close tickets without physical ground action.\n', options: { color: TEXT_CHARCOAL, breakLine: true } },
  { text: '• Queue Flooding: ', options: { bold: true, color: '7F1D1D' } },
  { text: 'Non-tree spam and indoor photos clog municipal response teams.', options: { color: TEXT_CHARCOAL } }
], { x: 1.1, y: 3.05, w: 5.15, h: 2.9, fontSize: 10, valign: 'top', paraSpaceBefore: 6, fontFace: FONT_FAMILY });

// Right: Solution
slide1.addShape(pres.ShapeType.roundRect, {
  x: 6.8, y: 2.45, w: 5.65, h: 3.75,
  rectRadius: 0.1,
  fill: { color: BG_CARD_LIGHT },
  line: { color: BORDER_CARD, width: 1.5 }
});
slide1.addText('🌿 The Solution: Closed-Loop Statutory Platform', {
  x: 7.05, y: 2.65, w: 5.15, h: 0.32,
  fontSize: 12.5, bold: true, color: TEXT_FOREST, fontFace: FONT_FAMILY
});
slide1.addText([
  { text: '• 7 Statutory Categories: ', options: { bold: true, color: TEXT_DARK_GREEN } },
  { text: 'Grounded in Maharashtra Tree Act 1975.\n', options: { color: TEXT_CHARCOAL, breakLine: true } },
  { text: '• Hardware Sensor Telemetry: ', options: { bold: true, color: TEXT_DARK_GREEN } },
  { text: 'Measures tree tilt angle with device accelerometer.\n', options: { color: TEXT_CHARCOAL, breakLine: true } },
  { text: '• 3-Layer Forensic Standard: ', options: { bold: true, color: TEXT_DARK_GREEN } },
  { text: 'Multi-angle capture with AI Anti-Spam Gate.\n', options: { color: TEXT_CHARCOAL, breakLine: true } },
  { text: '• PMC 4.09M Tree Census GIS: ', options: { bold: true, color: TEXT_DARK_GREEN } },
  { text: 'Attaches official municipal tree records.\n', options: { color: TEXT_CHARCOAL, breakLine: true } },
  { text: '• Zero-Trust Re-Audit: ', options: { bold: true, color: TEXT_DARK_GREEN } },
  { text: 'Timelock verification + Municipal Commissioner escalation.', options: { color: TEXT_CHARCOAL } }
], { x: 7.05, y: 3.05, w: 5.15, h: 2.9, fontSize: 10, valign: 'top', paraSpaceBefore: 6, fontFace: FONT_FAMILY });

addCleanFooter(slide1, 1, 7, 'Show App Launch / Grievance Tracker on your phone. Introduce problem & vision in 30s.');

// =========================================================================
// SLIDE 2: DEMO STEP 1 - CATEGORY & SENSOR TELEMETRY
// =========================================================================
const slide2 = pres.addSlide();
slide2.background = { color: BG_WHITE };
addCleanHeader(slide2, 'LIVE DEMO • STEP 1', 'Intelligent Civic Triage & Sensor Telemetry', 'App Screen: Category Selection & Real-Time Accelerometer Grounding');

// 3 Clean Columns (width 3.65 each, spacing 0.32)
// Col 1: 7 Statutory Categories
slide2.addShape(pres.ShapeType.roundRect, {
  x: 0.85, y: 1.95, w: 3.65, h: 4.25,
  rectRadius: 0.08, fill: { color: BG_CARD_LIGHT }, line: { color: BORDER_CARD, width: 1 }
});
slide2.addText('🌳 7 Statutory Categories', {
  x: 1.05, y: 2.12, w: 3.25, h: 0.3,
  fontSize: 12, bold: true, color: TEXT_FOREST, fontFace: FONT_FAMILY
});
slide2.addText([
  { text: '1. Hazardous Leaning Tree (Fall Risk)\n', options: { bold: true, color: TEXT_DARK_GREEN, breakLine: true } },
  { text: '2. Illegal Felling (Active / Fresh Stump)\n', options: { bold: true, color: TEXT_DARK_GREEN, breakLine: true } },
  { text: '3. Heavy Unauthorized Pruning\n', options: { bold: true, color: TEXT_DARK_GREEN, breakLine: true } },
  { text: '4. Snapped / Hanging Broken Limbs\n', options: { bold: true, color: TEXT_DARK_GREEN, breakLine: true } },
  { text: '5. Root Concretization (NGT Basin)\n', options: { bold: true, color: TEXT_DARK_GREEN, breakLine: true } },
  { text: '6. Disease, Rot & Pest Infestation\n', options: { bold: true, color: TEXT_DARK_GREEN, breakLine: true } },
  { text: '7. Tree Vandalism (Nails, Boards, Wires)', options: { bold: true, color: TEXT_DARK_GREEN } }
], { x: 1.05, y: 2.5, w: 3.25, h: 3.5, fontSize: 9.2, valign: 'top', paraSpaceBefore: 4, fontFace: FONT_FAMILY });

// Col 2: Hardware Sensor Telemetry
slide2.addShape(pres.ShapeType.roundRect, {
  x: 4.82, y: 1.95, w: 3.65, h: 4.25,
  rectRadius: 0.08, fill: { color: BG_CARD_ALT }, line: { color: BORDER_ACCENT, width: 1.5 }
});
slide2.addText('📐 Hardware Sensor Telemetry', {
  x: 5.02, y: 2.12, w: 3.25, h: 0.3,
  fontSize: 12, bold: true, color: TEXT_DARK_GREEN, fontFace: FONT_FAMILY
});
slide2.addText([
  { text: 'Physics Over Guesswork:\n', options: { bold: true, color: TEXT_FOREST, breakLine: true } },
  { text: '• Device accelerometer samples physical tilt angle relative to true gravity vector.\n', options: { color: TEXT_CHARCOAL, breakLine: true } },
  { text: '• Embeds mathematically verified tilt degrees (e.g., 23.4° tilt) directly into legal prayer.\n', options: { color: TEXT_CHARCOAL, breakLine: true } },
  { text: '• Section 7(b) Trigger: Proves imminent structural collapse threat.\n\n', options: { color: TEXT_CHARCOAL, breakLine: true } },
  { text: '⚖️ Gives officers hard physical sensor evidence.', options: { italic: true, bold: true, color: TEXT_EMERALD } }
], { x: 5.02, y: 2.5, w: 3.25, h: 3.5, fontSize: 9.2, valign: 'top', paraSpaceBefore: 4, fontFace: FONT_FAMILY });

// Col 3: Automated Ward Routing
slide2.addShape(pres.ShapeType.roundRect, {
  x: 8.8, y: 1.95, w: 3.65, h: 4.25,
  rectRadius: 0.08, fill: { color: BG_CARD_LIGHT }, line: { color: BORDER_CARD, width: 1 }
});
slide2.addText('📍 Automated Ward Routing', {
  x: 9.0, y: 2.12, w: 3.25, h: 0.3,
  fontSize: 12, bold: true, color: TEXT_FOREST, fontFace: FONT_FAMILY
});
slide2.addText([
  { text: 'Zero Guesswork for Citizens:\n', options: { bold: true, color: TEXT_FOREST, breakLine: true } },
  { text: '• Android Geocoder resolves exact landmark, street name, and postal PIN code.\n', options: { color: TEXT_CHARCOAL, breakLine: true } },
  { text: '• Backend spatial engine maps GPS coords to PMC 15 Administrative Wards.\n', options: { color: TEXT_CHARCOAL, breakLine: true } },
  { text: '• Kharadi / Viman Nagar coordinates automatically target Nagar Road - Vadgaon Sheri Ward Office.\n\n', options: { color: TEXT_CHARCOAL, breakLine: true } },
  { text: '🏛️ Targets the exact responsible Tree Officer.', options: { italic: true, bold: true, color: TEXT_EMERALD } }
], { x: 9.0, y: 2.5, w: 3.25, h: 3.5, fontSize: 9.2, valign: 'top', paraSpaceBefore: 4, fontFace: FONT_FAMILY });

addCleanFooter(slide2, 2, 7, 'Tap "New Grievance" -> Select "Dangerous Leaning Tree" -> Physically tilt phone to show live sensor readout.');

// =========================================================================
// SLIDE 3: DEMO STEP 2 - 3-LAYER FORENSIC EVIDENCE & ANTI-SPAM
// =========================================================================
const slide3 = pres.addSlide();
slide3.background = { color: BG_WHITE };
addCleanHeader(slide3, 'LIVE DEMO • STEP 2', '3-Layer Forensic Evidence Standard & AI Anti-Spam', 'App Screen: CameraX Multi-Angle Guidance & Pre-Submission Quality Gate');

// Top Quality Banner: Anti-Spam Gate (y=1.95, h=0.85)
slide3.addShape(pres.ShapeType.roundRect, {
  x: 0.85, y: 1.95, w: 11.6, h: 0.85,
  rectRadius: 0.08,
  fill: { color: WARN_AMBER_BG },
  line: { color: WARN_AMBER_BORDER, width: 1 }
});
slide3.addText('🛡️ AI Anti-Spam Quality Gate & Municipal Quota Protection', {
  x: 1.05, y: 2.05, w: 11.1, h: 0.25,
  fontSize: 11, bold: true, color: WARN_AMBER_TEXT, fontFace: FONT_FAMILY
});
slide3.addText('Computer vision inspects photo before submission. Non-tree content (screens, keyboards, desks, selfies) is rejected instantly with a 3-hour cooldown — shielding municipal officers and LLM compute from civic junk.', {
  x: 1.05, y: 2.32, w: 11.1, h: 0.42,
  fontSize: 9.2, color: TEXT_CHARCOAL, fontFace: FONT_FAMILY
});

// 3 Layer Cards (y=2.95, h=3.25)
const layerCards = [
  {
    tag: 'Layer 1 (Locus Context)',
    title: 'Wide Street Perspective',
    badgeColor: BADGE_BG,
    badgeText: BADGE_TEXT,
    desc: 'Captures the tree in its overall streetscape: footpath, roadway, adjacent building, and landmark.\n\n🛡️ Eliminates the #1 municipal dismissal: "Not on municipal land / wrong jurisdiction."'
  },
  {
    tag: 'Layer 2 (Structural Frame)',
    title: 'Tree Architecture & Lean',
    badgeColor: 'E0F2FE',
    badgeText: '0369A1',
    desc: 'Mid-range shot showing trunk-to-crown architecture, lean trajectory relative to vertical reference, and pedestrian strike danger zone.\n\n🛡️ Establishes structural severity & collapse hazard.'
  },
  {
    tag: 'Layer 3 (Forensic Macro)',
    title: 'Microscopic Damage Proof',
    badgeColor: 'FEF3C7',
    badgeText: '92400E',
    desc: 'Close-up macro of exact damage: fresh chainsaw tooth marks, iron nails in cambium bark, root concrete choke, or decay.\n\n🛡️ Incontrovertible forensic proof for legal prosecution.'
  }
];

layerCards.forEach((c, idx) => {
  const xPos = 0.85 + idx * 3.98;
  slide3.addShape(pres.ShapeType.roundRect, {
    x: xPos, y: 2.95, w: 3.65, h: 3.25,
    rectRadius: 0.08,
    fill: { color: BG_CARD_LIGHT },
    line: { color: BORDER_CARD, width: 1 }
  });

  // Layer Pill
  slide3.addShape(pres.ShapeType.roundRect, {
    x: xPos + 0.2, y: 3.12, w: 2.4, h: 0.26,
    rectRadius: 0.06,
    fill: { color: c.badgeColor },
    line: { color: BORDER_CARD, width: 0.5 }
  });
  slide3.addText(c.tag, {
    x: xPos + 0.2, y: 3.12, w: 2.4, h: 0.26,
    fontSize: 8.5, bold: true, color: c.badgeText,
    align: 'center', valign: 'middle', fontFace: FONT_FAMILY
  });

  slide3.addText(c.title, {
    x: xPos + 0.2, y: 3.45, w: 3.25, h: 0.3,
    fontSize: 11.5, bold: true, color: TEXT_FOREST, fontFace: FONT_FAMILY
  });
  slide3.addText(c.desc, {
    x: xPos + 0.2, y: 3.82, w: 3.25, h: 2.2,
    fontSize: 9.2, color: TEXT_CHARCOAL, valign: 'top', fontFace: FONT_FAMILY
  });
});

addCleanFooter(slide3, 3, 7, 'Show the 3-Layer CameraX overlay and take the 3 required photos.');

// =========================================================================
// SLIDE 4: DEMO STEP 3 - HYBRID DUAL-ENGINE AI & CENSUS GIS
// =========================================================================
const slide4 = pres.addSlide();
slide4.background = { color: BG_WHITE };
addCleanHeader(slide4, 'LIVE DEMO • STEP 3', 'Hybrid Dual-Engine AI + PMC 4.09M Tree Census GIS', 'App Screen: Photo Preview & Dual Triage Options (On-Device Edge vs Cloud)');

// Left Column: Dual AI (y=1.95, h=4.25)
slide4.addShape(pres.ShapeType.roundRect, {
  x: 0.85, y: 1.95, w: 5.65, h: 4.25,
  rectRadius: 0.08, fill: { color: BG_CARD_LIGHT }, line: { color: BORDER_CARD, width: 1.5 }
});
slide4.addText('⚡ Hybrid Edge-to-Cloud AI Architecture', {
  x: 1.1, y: 2.15, w: 5.15, h: 0.3,
  fontSize: 12.5, bold: true, color: TEXT_FOREST, fontFace: FONT_FAMILY
});
slide4.addText([
  { text: '1. On-Device Edge AI (Flagship Hardware / iQOO 15):\n', options: { bold: true, color: TEXT_DARK_GREEN, breakLine: true } },
  { text: '   • Local Gemma 3n execution via MediaPipe / LiteRT\n', options: { color: TEXT_CHARCOAL, breakLine: true } },
  { text: '   • 100% Offline: Zero latency in low-connectivity zones\n', options: { color: TEXT_CHARCOAL, breakLine: true } },
  { text: '   • Edge Privacy: Photos remain on-device; zero cloud API cost\n\n', options: { color: TEXT_CHARCOAL, breakLine: true } },
  { text: '2. Cloud Multimodal AI (High-Precision Vision):\n', options: { bold: true, color: TEXT_DARK_GREEN, breakLine: true } },
  { text: '   • Google Gemini 3.6 Flash / Qwen 3 Multimodal via OpenRouter\n', options: { color: TEXT_CHARCOAL, breakLine: true } },
  { text: '   • Deep arboricultural morphology, rot assessment & statutory drafting\n', options: { color: TEXT_CHARCOAL, breakLine: true } },
  { text: '   • Deterministic fallback guarantees response within 5 seconds', options: { color: TEXT_CHARCOAL } }
], { x: 1.1, y: 2.52, w: 5.15, h: 3.5, fontSize: 9.5, valign: 'top', paraSpaceBefore: 4, fontFace: FONT_FAMILY });

// Right Column: Census GIS (y=1.95, h=4.25)
slide4.addShape(pres.ShapeType.roundRect, {
  x: 6.8, y: 1.95, w: 5.65, h: 4.25,
  rectRadius: 0.08, fill: { color: BG_CARD_ALT }, line: { color: BORDER_ACCENT, width: 1.5 }
});
slide4.addText('🗺️ Government GIS Tree Census Match (4.09M Trees)', {
  x: 7.05, y: 2.15, w: 5.15, h: 0.3,
  fontSize: 12.5, bold: true, color: TEXT_DARK_GREEN, fontFace: FONT_FAMILY
});
slide4.addText([
  { text: 'Real Municipal Record Verification:\n', options: { bold: true, color: TEXT_FOREST, breakLine: true } },
  { text: '• Live spatial query against PMC official 4.09 Million Tree Census dataset within 10 meters.\n', options: { color: TEXT_CHARCOAL, breakLine: true } },
  { text: '• Automatically extracts & binds official municipal data:\n', options: { color: TEXT_CHARCOAL, breakLine: true } },
  { text: '   - Government Census Tree Tag ID (e.g. #140285)\n', options: { bold: true, color: TEXT_DARK_GREEN, breakLine: true } },
  { text: '   - Botanical species (Azadirachta indica / Samanea saman)\n', options: { color: TEXT_CHARCOAL, breakLine: true } },
  { text: '   - Registered trunk girth & historic condition\n\n', options: { color: TEXT_CHARCOAL, breakLine: true } },
  { text: '⚖️ Municipal officers cannot claim the tree is private or unregistered.', options: { italic: true, bold: true, color: TEXT_EMERALD } }
], { x: 7.05, y: 2.52, w: 5.15, h: 3.5, fontSize: 9.5, valign: 'top', paraSpaceBefore: 4, fontFace: FONT_FAMILY });

addCleanFooter(slide4, 4, 7, 'Show Preview Screen -> Point out "On-Device AI" vs "Cloud AI" buttons -> Tap "Cloud AI" to run live analysis.');

// =========================================================================
// SLIDE 5: DEMO STEP 4 - DETERMINISTIC LEGAL MATRIX & SEALED PDF
// =========================================================================
const slide5 = pres.addSlide();
slide5.background = { color: BG_WHITE };
addCleanHeader(slide5, 'LIVE DEMO • STEP 4', 'Deterministic Statutory Matrix & Sealed PDF Notice', 'App Screen: Legal Notice Review, Court-Grade Sealed PDF & Multi-Channel Dispatch');

// Left Column: Legal Matrix (y=1.95, w=6.8, h=4.25)
slide5.addShape(pres.ShapeType.roundRect, {
  x: 0.85, y: 1.95, w: 6.8, h: 4.25,
  rectRadius: 0.08, fill: { color: BG_CARD_LIGHT }, line: { color: BORDER_CARD, width: 1 }
});
slide5.addText('⚖️ Zero-Hallucination Statutory Routing Matrix', {
  x: 1.05, y: 2.15, w: 6.35, h: 0.3,
  fontSize: 12.5, bold: true, color: TEXT_FOREST, fontFace: FONT_FAMILY
});
slide5.addText([
  { text: 'Hardcoded statutory citations under Maharashtra Tree Act 1975 & NGT orders:\n\n', options: { color: TEXT_MUTED, breakLine: true } },
  { text: '• Active Illegal Felling: ', options: { bold: true, color: 'B91C1C' } },
  { text: 'Section 21 cognizable offence → Routed to Pune Police (112) + Tree Authority.\n\n', options: { color: TEXT_CHARCOAL, breakLine: true } },
  { text: '• Dangerous Leaning Tree: ', options: { bold: true, color: 'B45309' } },
  { text: 'Section 7(b) public safety mandate → Routed to PMC Disaster Cell (24h SLA).\n\n', options: { color: TEXT_CHARCOAL, breakLine: true } },
  { text: '• Root Concretization: ', options: { bold: true, color: TEXT_DARK_GREEN } },
  { text: 'NGT Directives for mandatory 1-meter unpaved green basin → PMC Road Dept.\n\n', options: { color: TEXT_CHARCOAL, breakLine: true } },
  { text: '• Tree Vandalism (Nails/Wires): ', options: { bold: true, color: TEXT_FOREST } },
  { text: 'High Court anti-nail orders → PMC Garden Dept (Tree Ambulance).', options: { color: TEXT_CHARCOAL } }
], { x: 1.05, y: 2.5, w: 6.35, h: 3.5, fontSize: 9.2, valign: 'top', fontFace: FONT_FAMILY });

// Right Column: Actual Sealed PDF Image Preview! (y=1.95, w=4.5, h=4.25)
const pdfImgPath = path.resolve(__dirname, 'assets/sealed_pdf_preview.png');
slide5.addShape(pres.ShapeType.roundRect, {
  x: 7.95, y: 1.95, w: 4.5, h: 4.25,
  rectRadius: 0.08, fill: { color: BG_CARD_ALT }, line: { color: BORDER_ACCENT, width: 1.5 }
});
slide5.addText('📄 Court-Grade Sealed PDF Notice', {
  x: 8.15, y: 2.1, w: 4.1, h: 0.25,
  fontSize: 11, bold: true, color: TEXT_DARK_GREEN, align: 'center', fontFace: FONT_FAMILY
});

// Embed the PDF image! (aspect ratio 0.71, width 2.45, height 3.45, centered at x=8.97)
slide5.addImage({
  path: pdfImgPath,
  x: 8.97, y: 2.45, w: 2.45, h: 3.45
});

addCleanFooter(slide5, 5, 7, 'Show the generated statutory draft on phone -> Tap to preview the court-grade sealed PDF notice.');

// =========================================================================
// SLIDE 6: DEMO STEP 5 - ZERO-TRUST RE-AUDIT & ESCALATION
// =========================================================================
const slide6 = pres.addSlide();
slide6.background = { color: BG_WHITE };
addCleanHeader(slide6, 'LIVE DEMO • STEP 5', 'Zero-Trust Ground Re-Audit & Escalation', 'App Screen: Reverification Screen, Timelock Status & One-Tap Escalation');

// Left Box: Ending Ghost Closures (y=1.95, h=4.25)
slide6.addShape(pres.ShapeType.roundRect, {
  x: 0.85, y: 1.95, w: 5.65, h: 4.25,
  rectRadius: 0.08, fill: { color: BG_CARD_LIGHT }, line: { color: BORDER_CARD, width: 1.5 }
});
slide6.addText('⏱️ Ending "Closed on Paper" Resolutions', {
  x: 1.1, y: 2.15, w: 5.15, h: 0.3,
  fontSize: 12.5, bold: true, color: TEXT_FOREST, fontFace: FONT_FAMILY
});
slide6.addText([
  { text: 'The Core Civic Flaw Solved:\n', options: { bold: true, color: TEXT_DARK_GREEN, breakLine: true } },
  { text: 'Municipal contractors routinely close tickets without touching a shovel.\n\n', options: { color: TEXT_CHARCOAL, breakLine: true } },
  { text: 'Our Zero-Trust Re-Audit Architecture:\n', options: { bold: true, color: TEXT_DARK_GREEN, breakLine: true } },
  { text: '• Statutory Timelock: Starts 24h, 48h, or 72h countdown based on statutory urgency.\n', options: { color: TEXT_CHARCOAL, breakLine: true } },
  { text: '• Mandatory Ground Re-Photography: Ticket cannot be closed without citizen after-action photos.\n', options: { color: TEXT_CHARCOAL, breakLine: true } },
  { text: '• Vision AI Re-Audit: Compares before-and-after photos to verify whether the concrete was excavated or if the tree was illegally chopped.', options: { color: TEXT_CHARCOAL } }
], { x: 1.1, y: 2.52, w: 5.15, h: 3.5, fontSize: 9.5, valign: 'top', paraSpaceBefore: 4, fontFace: FONT_FAMILY });

// Right Box: Commissioner Escalation (y=1.95, h=4.25)
slide6.addShape(pres.ShapeType.roundRect, {
  x: 6.8, y: 1.95, w: 5.65, h: 4.25,
  rectRadius: 0.08, fill: { color: ALERT_RED_BG }, line: { color: ALERT_RED_BORDER, width: 1.5 }
});
slide6.addText('🚨 One-Tap Commissioner Escalation', {
  x: 7.05, y: 2.15, w: 5.15, h: 0.3,
  fontSize: 12.5, bold: true, color: ALERT_RED_TEXT, fontFace: FONT_FAMILY
});
slide6.addText([
  { text: 'Hierarchical Municipal Accountability:\n', options: { bold: true, color: '7F1D1D', breakLine: true } },
  { text: '• If the statutory timelock expires without ground remediation:\n', options: { color: TEXT_CHARCOAL, breakLine: true } },
  { text: '  App unlocks the RED Escalation Action.\n\n', options: { bold: true, color: ALERT_RED_TEXT, breakLine: true } },
  { text: '• Dispatched Directly To:\n', options: { bold: true, color: '7F1D1D', breakLine: true } },
  { text: '  - Municipal Commissioner, PMC\n', options: { bold: true, color: TEXT_DARK_GREEN, breakLine: true } },
  { text: '  - Additional Municipal Commissioner (Gardens)\n', options: { bold: true, color: TEXT_DARK_GREEN, breakLine: true } },
  { text: '  - Superintendent of Gardens & Tree Officer\n\n', options: { bold: true, color: TEXT_DARK_GREEN, breakLine: true } },
  { text: '💥 Cites administrative dereliction of statutory duty under Section 7 of Maharashtra Tree Act.', options: { italic: true, bold: true, color: 'B45309' } }
], { x: 7.05, y: 2.52, w: 5.15, h: 3.5, fontSize: 9.5, valign: 'top', paraSpaceBefore: 4, fontFace: FONT_FAMILY });

addCleanFooter(slide6, 6, 7, 'Show Reverification Screen on phone -> Highlight active timelock countdown and the Red Escalation button.');

// =========================================================================
// SLIDE 7: SUMMARY & IMPACT (Eco-Green Standard)
// =========================================================================
const slide7 = pres.addSlide();
slide7.background = { color: BG_WHITE };
addCleanHeader(slide7, 'PITCH SUMMARY', 'Production-Ready Civic Impact for Pune City', 'Why Pune Tree Rakshak Wins the Open Innovation Track');

// 4 Metric / Impact Cards (2x2 grid)
const impactTiles = [
  { icon: '📱', title: 'Flagship Mobile Tech', desc: 'Native Kotlin + Jetpack Compose with CameraX and on-device MediaPipe/LiteRT inference — optimized for iQOO 15 hardware.', color: TEXT_FOREST },
  { icon: '⚖️', title: '100% Statutorily Grounded', desc: 'Deterministic legal matrix encoding the Maharashtra Tree Act 1975, NGT 1m breathing basin mandates, and High Court orders.', color: TEXT_DARK_GREEN },
  { icon: '🗺️', title: '4.09M Tree Census GIS', desc: 'Real-time spatial correlation against PMC 4.09M tree dataset, connecting citizen photos to official municipal tree IDs.', color: TEXT_EMERALD },
  { icon: '🔄', title: 'Zero-Trust Re-Audit', desc: 'Guarantees physical follow-through. Ends ghost ticket closures via timelocks, AI re-audit vision, and direct Commissioner escalation.', color: 'B91C1C' }
];

impactTiles.forEach((tile, idx) => {
  const col = idx % 2;
  const row = Math.floor(idx / 2);
  const xPos = 0.85 + col * 5.95;
  const yPos = 1.95 + row * 1.92;

  slide7.addShape(pres.ShapeType.roundRect, {
    x: xPos, y: yPos, w: 5.65, h: 1.78,
    rectRadius: 0.08, fill: { color: BG_CARD_LIGHT }, line: { color: BORDER_CARD, width: 1 }
  });
  slide7.addText(`${tile.icon}  ${tile.title}`, {
    x: xPos + 0.2, y: yPos + 0.15, w: 5.25, h: 0.28,
    fontSize: 12, bold: true, color: tile.color, fontFace: FONT_FAMILY
  });
  slide7.addText(tile.desc, {
    x: xPos + 0.2, y: yPos + 0.48, w: 5.25, h: 1.15,
    fontSize: 9.5, color: TEXT_CHARCOAL, valign: 'top', fontFace: FONT_FAMILY
  });
});

// Bottom Deployment Pill (y=5.88, h=0.38)
slide7.addShape(pres.ShapeType.roundRect, {
  x: 0.85, y: 5.88, w: 11.6, h: 0.38,
  rectRadius: 0.06, fill: { color: BADGE_BG }, line: { color: BADGE_BORDER, width: 1 }
});
slide7.addText('🌿 Production-grade & ready for immediate ward rollout across all 15 PMC Administrative Wards in Pune.', {
  x: 0.85, y: 5.88, w: 11.6, h: 0.38,
  fontSize: 10, bold: true, color: TEXT_DARK_GREEN, align: 'center', valign: 'middle', fontFace: FONT_FAMILY
});

addCleanFooter(slide7, 7, 7, 'Show Home Screen with completed audit trail. Conclude with vision for Pune’s green canopy.');

// =========================================================================
// OUTPUT GENERATION
// =========================================================================
const outputPath = path.resolve(__dirname, '../Pune_Tree_Rakshak_EcoGreen_Pitch.pptx');
pres.writeFile({ fileName: outputPath })
  .then(fileName => {
    console.log(`SUCCESS: Created clean eco-green presentation at ${fileName}`);
    try {
      const dest = path.resolve(__dirname, '../Pune_Tree_Rakshak_Pitch.pptx');
      fs.copyFileSync(outputPath, dest);
      console.log(`SUCCESS: Also updated ${dest}`);
    } catch (lockErr) {
      console.log(`NOTE: Pune_Tree_Rakshak_Pitch.pptx is locked by PowerPoint. Clean version saved as Pune_Tree_Rakshak_EcoGreen_Pitch.pptx`);
    }
  })
  .catch(err => {
    console.error('ERROR creating presentation:', err);
    process.exit(1);
  });
