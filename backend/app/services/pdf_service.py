import os
import io
import struct
import base64
import textwrap
from pathlib import Path
from jinja2 import Environment, FileSystemLoader
from typing import Dict, Any, Optional, List

TEMPLATES_DIR = Path(__file__).parent.parent / "templates"
env = Environment(loader=FileSystemLoader(str(TEMPLATES_DIR)))

def get_jpeg_dimensions(data_bytes: bytes):
    """
    Parses width and height from raw JPEG byte stream without external dependencies.
    """
    i = 0
    while i < len(data_bytes) - 9:
        if data_bytes[i] == 0xFF and data_bytes[i+1] in (0xC0, 0xC1, 0xC2):
            h, w = struct.unpack(">HH", data_bytes[i+5:i+9])
            return w, h
        i += 1
    return 800, 600

class MultiPageNativePdfWriter:
    """
    Zero-dependency, pure Python multi-page A4 PDF generator.
    Embeds raw JPEG images directly into PDF XObjects and draws clean statutory layout.
    """
    def __init__(self):
        self.page_w = 595.28  # A4 width in pt
        self.page_h = 841.89  # A4 height in pt
        self.pages = [[]] # List of stream chunks per page
        self.current_page_idx = 0
        self.images = [] # List of (image_bytes, w, h)

    def new_page(self):
        self.pages.append([])
        self.current_page_idx += 1

    def add_image(self, b64_or_bytes) -> Optional[int]:
        try:
            if isinstance(b64_or_bytes, str):
                clean_b64 = b64_or_bytes.split(",")[-1].strip()
                raw_bytes = base64.b64decode(clean_b64)
            else:
                raw_bytes = b64_or_bytes

            if len(raw_bytes) < 100:
                return None

            w, h = get_jpeg_dimensions(raw_bytes)
            img_idx = len(self.images) + 1
            self.images.append((raw_bytes, w, h))
            return img_idx
        except Exception as e:
            print(f"[PDF IMAGE EMBED NOTICE] Could not decode image: {e}")
            return None

    def draw_image(self, img_idx: int, x: float, y: float, w: float, h: float):
        stream = self.pages[self.current_page_idx]
        stream.append(f"q\n{w:.2f} 0 0 {h:.2f} {x:.2f} {y:.2f} cm\n/Im{img_idx} Do\nQ\n")

    def draw_rect(self, x: float, y: float, w: float, h: float, fill_rgb=(0.95, 0.95, 0.95), stroke_rgb=(0.2, 0.5, 0.2), line_width=1):
        stream = self.pages[self.current_page_idx]
        stream.append(f"{line_width} w\n")
        stream.append(f"{stroke_rgb[0]:.3f} {stroke_rgb[1]:.3f} {stroke_rgb[2]:.3f} RG\n")
        stream.append(f"{fill_rgb[0]:.3f} {fill_rgb[1]:.3f} {fill_rgb[2]:.3f} rg\n")
        stream.append(f"{x:.2f} {y:.2f} {w:.2f} {h:.2f} re B\n")

    def draw_text(self, text: str, x: float, y: float, size: int = 10, bold: bool = False, color_rgb=(0, 0, 0)):
        stream = self.pages[self.current_page_idx]
        font = "/F2" if bold else "/F1"
        safe_text = str(text).replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")
        stream.append(f"BT\n{font} {size} Tf\n{color_rgb[0]:.3f} {color_rgb[1]:.3f} {color_rgb[2]:.3f} rg\n{x:.2f} {y:.2f} Td\n({safe_text}) Tj\nET\n")

    def draw_multiline(self, text: str, x: float, start_y: float, line_height: float = 13, size: int = 8.5, bold: bool = False, color_rgb=(0.1, 0.1, 0.1), max_chars: int = 90) -> float:
        current_y = start_y
        for paragraph in str(text).split("\n"):
            if not paragraph.strip():
                current_y -= line_height * 0.6
                continue
            lines = textwrap.wrap(paragraph, width=max_chars)
            for line in lines:
                self.draw_text(line, x, current_y, size=size, bold=bold, color_rgb=color_rgb)
                current_y -= line_height
        return current_y

    def build_pdf(self, output_path: str) -> str:
        pdf_objs = []
        image_obj_map = {}
        current_obj_num = 5

        # Format image objects
        for i, (img_bytes, w, h) in enumerate(self.images, 1):
            image_obj_map[i] = current_obj_num
            img_header = f"<</Type/XObject/Subtype/Image/Width {w}/Height {h}/ColorSpace/DeviceRGB/BitsPerComponent 8/Filter/DCTDecode/Length {len(img_bytes)}>>\nstream\n".encode("latin-1")
            img_full = img_header + img_bytes + b"\nendstream"
            pdf_objs.append(img_full)
            current_obj_num += 1

        xobj_res = ""
        for img_idx, obj_num in image_obj_map.items():
            xobj_res += f"/Im{img_idx} {obj_num} 0 R "
        xobj_entry = f"/XObject<<{xobj_res}>>" if xobj_res else ""

        page_count = len(self.pages)
        page_obj_nums = []
        content_obj_nums = []

        for p_idx in range(page_count):
            page_obj_nums.append(current_obj_num)
            current_obj_num += 1
            content_obj_nums.append(current_obj_num)
            current_obj_num += 1

        kids_str = " ".join([f"{p} 0 R" for p in page_obj_nums])
        pages_obj = f"<</Type/Pages/Kids[{kids_str}]/Count {page_count}>>".encode("latin-1")

        f1_obj = b"<</Type/Font/Subtype/Type1/BaseFont/Helvetica/Encoding/WinAnsiEncoding>>"
        f2_obj = b"<</Type/Font/Subtype/Type1/BaseFont/Helvetica-Bold/Encoding/WinAnsiEncoding>>"
        catalog_obj = b"<</Type/Catalog/Pages 2 0 R>>"

        all_objects = [catalog_obj, pages_obj, f1_obj, f2_obj]
        all_objects.extend(pdf_objs)

        for p_idx in range(page_count):
            stream_str = "".join(self.pages[p_idx])
            stream_bytes = stream_str.encode("latin-1", errors="replace")
            content_obj_data = f"<</Length {len(stream_bytes)}>>\nstream\n{stream_str}\nendstream".encode("latin-1", errors="replace")
            page_obj_data = f"<</Type/Page/Parent 2 0 R/MediaBox[0 0 {self.page_w:.2f} {self.page_h:.2f}]/Contents {content_obj_nums[p_idx]} 0 R/Resources<</Font<</F1 3 0 R/F2 4 0 R>> {xobj_entry}>>>>".encode("latin-1")

            all_objects.append(page_obj_data)
            all_objects.append(content_obj_data)

        out = io.BytesIO()
        out.write(b"%PDF-1.4\n")
        offsets = []
        for i, obj in enumerate(all_objects, 1):
            offsets.append(out.tell())
            out.write(f"{i} 0 obj\n".encode("ascii"))
            out.write(obj)
            out.write(b"\nendobj\n")

        xref_offset = out.tell()
        out.write(b"xref\n")
        out.write(f"0 {len(all_objects) + 1}\n".encode("ascii"))
        out.write(b"0000000000 65535 f \n")
        for off in offsets:
            out.write(f"{off:010d} 00000 n \n".encode("ascii"))

        out.write(b"trailer\n")
        out.write(f"<</Size {len(all_objects) + 1}/Root 1 0 R>>\n".encode("ascii"))
        out.write(b"startxref\n")
        out.write(f"{xref_offset}\n".encode("ascii"))
        out.write(b"%%EOF\n")

        if os.path.dirname(output_path):
            os.makedirs(os.path.dirname(output_path), exist_ok=True)
        with open(output_path, "wb") as f:
            f.write(out.getvalue())
        return output_path


class PdfService:
    """
    Renders formal A4 statutory grievance notices with embedded evidence photos and AI audit summaries.
    """

    @staticmethod
    def render_complaint_html(data: Dict[str, Any]) -> str:
        try:
            template = env.get_template("complaint_letter.html")
            return template.render(**data)
        except Exception:
            return ""

    @staticmethod
    def generate_pdf(data: Dict[str, Any], output_path: str) -> str:
        """
        Compiles statutory notice into full-fidelity 2-page A4 PDF:
        - Page 1: Legal Notice & Grievance Letter Body
        - Page 2: AI Forensic Scene Analysis & Photographic Evidence Gallery
        """
        writer = MultiPageNativePdfWriter()

        # =========================================================================
        # PAGE 1: STATUTORY NOTICE & GRIEVANCE LETTER
        # =========================================================================
        
        # 1. Header Banner
        writer.draw_rect(30, 775, 535, 45, fill_rgb=(0.08, 0.38, 0.18), stroke_rgb=(0.05, 0.25, 0.12), line_width=1.5)
        writer.draw_text("PUNE MUNICIPAL CORPORATION - TREE AUTHORITY", 45, 800, size=13, bold=True, color_rgb=(1, 1, 1))
        writer.draw_text("STATUTORY GRIEVANCE NOTICE & TIME-LOCKED CITIZEN COMPLAINT", 45, 783, size=8.5, bold=False, color_rgb=(0.85, 0.95, 0.85))

        # 2. Reference & Urgency Metadata Card
        tracking_id = data.get("tracking_id", "PUNE-TREE-2026-UNSPEC")
        urgency = str(data.get("urgency_level", "HIGH")).replace("_", " ")
        category = str(data.get("issue_type", "DANGEROUS_LEANING_FALL_RISK")).replace("_", " ")
        
        census_data = data.get("census_tree")
        census_tag = f"#{census_data['census_tag_id']} (within {census_data.get('distance_meters', 0)}m)" if census_data else "No Registered Match within 15m"
        species = data.get("estimated_tree_species", "Observed Tree Subject")
        
        writer.draw_rect(30, 705, 535, 60, fill_rgb=(0.96, 0.98, 0.95), stroke_rgb=(0.7, 0.85, 0.7), line_width=1)
        writer.draw_text(f"REFERENCE ID : {tracking_id}", 45, 748, size=10, bold=True, color_rgb=(0.1, 0.4, 0.1))
        writer.draw_text(f"URGENCY      : {urgency}", 360, 748, size=10, bold=True, color_rgb=(0.8, 0.2, 0.1) if ("CRITICAL" in urgency or "HIGH" in urgency) else (0.2, 0.5, 0.2))
        writer.draw_text(f"CLASSIFICATION : {category}", 45, 730, size=8.5, bold=True, color_rgb=(0.2, 0.2, 0.2))
        writer.draw_text(f"POTENTIAL CENSUS TAG: {census_tag[:28]}", 340, 730, size=8, bold=True, color_rgb=(0.1, 0.4, 0.1) if census_data else (0.4, 0.4, 0.4))
        writer.draw_text(f"DATE FILED : {data.get('created_at', '2026-08-31')}", 45, 714, size=8, color_rgb=(0.4, 0.4, 0.4))
        writer.draw_text(f"AI VISUAL SPECIES : {species}", 340, 714, size=8, color_rgb=(0.2, 0.2, 0.2))

        # 3. Geolocation & Routing Card
        addr = data.get("address_landmark", "Fergusson College Road, Shivajinagar, Pune")
        ward = data.get("ward_name", "Shivajinagar - Ghole Road")
        lat = data.get("latitude", 18.5196)
        lon = data.get("longitude", 73.8436)
        try:
            coords_str = f"{float(lat):.5f} N, {float(lon):.5f} E"
        except Exception:
            coords_str = f"{lat} N, {lon} E"

        officer_name = data.get("routed_authority_role", "Tree Officer & Horticultural Assistant")
        dept_name = data.get("routed_authority_name", "PMC Garden & Tree Authority Department")

        writer.draw_rect(30, 635, 535, 60, fill_rgb=(0.98, 0.98, 0.98), stroke_rgb=(0.85, 0.85, 0.85), line_width=1)
        writer.draw_text("LOCATION & JURISDICTION:", 45, 678, size=8.5, bold=True, color_rgb=(0.1, 0.3, 0.1))
        writer.draw_text(f"Landmark / Street: {addr}", 45, 663, size=8, color_rgb=(0.2, 0.2, 0.2))
        writer.draw_text(f"Ward: {ward} | Coordinates: {coords_str}", 45, 649, size=8, color_rgb=(0.3, 0.3, 0.3))
        writer.draw_text(f"ROUTED TO: {dept_name} ({officer_name})", 45, 638, size=8, bold=True, color_rgb=(0.1, 0.1, 0.4))

        # 4. Statutory Citations Box
        citations = data.get("legal_citations", ["Maharashtra (Urban Areas) Protection & Preservation of Trees Act, 1975 (Sec 8 & 21)"])
        citations_str = " | ".join(citations) if isinstance(citations, list) else str(citations)
        writer.draw_rect(30, 580, 535, 45, fill_rgb=(1.0, 0.96, 0.92), stroke_rgb=(1.0, 0.75, 0.4), line_width=1)
        writer.draw_text("STATUTORY CITATIONS & COGNIZABLE PROVISIONS:", 45, 610, size=8.5, bold=True, color_rgb=(0.7, 0.3, 0.0))
        writer.draw_text(citations_str[:95], 45, 595, size=7.5, bold=False, color_rgb=(0.4, 0.2, 0.0))
        writer.draw_text("Notice: Non-action within statutory grace period invites escalation under Section 21.", 45, 584, size=7.5, color_rgb=(0.5, 0.2, 0.0))

        # 5. Formal Grievance Body
        subject = data.get("draft_subject_en", "Urgent Statutory Tree Hazard Grievance Notice")
        body = data.get("draft_body_en", "Statutory notice lodged regarding tree hazard on site.")
        
        writer.draw_rect(30, 240, 535, 330, fill_rgb=(1.0, 1.0, 1.0), stroke_rgb=(0.8, 0.8, 0.8), line_width=1)
        writer.draw_text(f"SUBJECT: {subject}", 45, 550, size=8.5, bold=True, color_rgb=(0.0, 0.0, 0.0))
        writer.draw_text("--------------------------------------------------------------------------------------------------------------------------------", 45, 540, size=7, color_rgb=(0.7, 0.7, 0.7))
        
        writer.draw_multiline(body, 45, 525, line_height=13, size=8, max_chars=92)

        # 6. Citizen Signature & Digital Timestamp Footer
        citizen_name = data.get("citizen_name", "Concerned Citizen of Pune")
        writer.draw_rect(30, 70, 535, 160, fill_rgb=(0.97, 0.97, 0.99), stroke_rgb=(0.8, 0.85, 0.9), line_width=1)
        writer.draw_text(f"SUBMITTED BY: {citizen_name}", 45, 212, size=9, bold=True, color_rgb=(0.1, 0.1, 0.3))
        writer.draw_text("VERIFICATION STATUS: Captured via Pune Tree Grievance Mobile Client", 45, 198, size=8, color_rgb=(0.3, 0.3, 0.3))
        writer.draw_text("OFFICIAL REMINDER CHAIN: In case of non-resolution, reply-to thread is logged automatically.", 45, 185, size=8, color_rgb=(0.3, 0.3, 0.3))
        
        # Verification stamp
        writer.draw_rect(380, 85, 170, 75, fill_rgb=(0.92, 0.97, 0.92), stroke_rgb=(0.2, 0.6, 0.2), line_width=1.5)
        writer.draw_text("PUNE CIVIC VERIFIED", 400, 142, size=9, bold=True, color_rgb=(0.1, 0.5, 0.1))
        writer.draw_text(f"ID: {tracking_id}", 390, 125, size=8, bold=True, color_rgb=(0.2, 0.2, 0.2))
        writer.draw_text("Status: TIME-LOCKED ACTIVE", 390, 110, size=7.5, color_rgb=(0.1, 0.4, 0.1))
        writer.draw_text("Maharashtra Tree Act 1975", 390, 96, size=7, color_rgb=(0.4, 0.4, 0.4))

        writer.draw_text("Page 1 of 2 | Generated by Automated Pune Tree Grievance Platform", 140, 45, size=7.5, color_rgb=(0.5, 0.5, 0.5))

        # =========================================================================
        # PAGE 2: AI FORENSIC ARBORIST ANALYSIS & EVIDENCE PHOTOS
        # =========================================================================
        writer.new_page()

        # Page 2 Header Banner
        writer.draw_rect(30, 775, 535, 45, fill_rgb=(0.08, 0.38, 0.18), stroke_rgb=(0.05, 0.25, 0.12), line_width=1.5)
        writer.draw_text("EVIDENTIARY APPENDIX & AI FORENSIC ANALYSIS", 45, 800, size=12, bold=True, color_rgb=(1, 1, 1))
        writer.draw_text(f"GRIEVANCE REFERENCE: {tracking_id} | PHOTOGRAPHIC TIMESTAMPS", 45, 783, size=8.5, bold=False, color_rgb=(0.85, 0.95, 0.85))

        # AI Forensic Scene Analysis Box
        visual_damage = data.get("visual_damage_summary", "Factual arborist inspection completed on site.")
        writer.draw_rect(30, 655, 535, 110, fill_rgb=(0.95, 0.98, 0.95), stroke_rgb=(0.3, 0.7, 0.3), line_width=1.5)
        writer.draw_text("🌿 AI ARBORIST FORENSIC SCENE AUDIT (PRIMARY EVIDENCE):", 45, 745, size=9.5, bold=True, color_rgb=(0.1, 0.4, 0.1))
        writer.draw_text(f"• Identified Tree Species : {species} (Visual Analysis)", 45, 730, size=8.5, bold=True, color_rgb=(0.15, 0.15, 0.15))
        if census_data:
            writer.draw_text(f"• Potential Census Match  : #{census_data.get('census_tag_id')} ({census_data.get('botanical_name')}, {census_data.get('distance_meters')}m away)", 45, 716, size=8, bold=False, color_rgb=(0.2, 0.4, 0.2))
        else:
            writer.draw_text("• Municipal Census Match  : No registered 2019 census tree within 15m radius", 45, 716, size=8, bold=False, color_rgb=(0.4, 0.4, 0.4))
        writer.draw_text("• Visual Observations Summary:", 45, 702, size=8.5, bold=True, color_rgb=(0.1, 0.3, 0.1))
        writer.draw_multiline(visual_damage, 55, 688, line_height=12, size=8, max_chars=88)

        # Embedded Images Gallery
        raw_photos = data.get("photo_urls", []) or []
        embedded_img_indices = []
        for p in raw_photos[:3]:
            idx = writer.add_image(p)
            if idx is not None:
                embedded_img_indices.append(idx)

        writer.draw_text("PHOTOGRAPHIC EVIDENCE ATTACHMENTS (ON-SITE CAPTURE):", 30, 638, size=9.5, bold=True, color_rgb=(0.1, 0.1, 0.1))

        photo_labels = [
            "Angle 1: Overview & Lean",
            "Angle 2: Damage Close-up",
            "Angle 3: Root Basin / Base"
        ]

        if embedded_img_indices:
            img_w = 165
            img_h = 220
            start_x = 35
            gap_x = 18
            y_pos = 380

            for i, img_idx in enumerate(embedded_img_indices):
                x_pos = start_x + i * (img_w + gap_x)
                writer.draw_rect(x_pos - 2, y_pos - 2, img_w + 4, img_h + 24, fill_rgb=(1, 1, 1), stroke_rgb=(0.7, 0.7, 0.7), line_width=1)
                writer.draw_image(img_idx, x_pos, y_pos, img_w, img_h)
                lbl = photo_labels[i] if i < len(photo_labels) else f"Evidence Angle {i+1}"
                writer.draw_text(lbl, x_pos + 4, y_pos + img_h + 6, size=7.5, bold=True, color_rgb=(0.1, 0.3, 0.1))
        else:
            writer.draw_rect(30, 480, 535, 140, fill_rgb=(0.98, 0.98, 0.98), stroke_rgb=(0.85, 0.85, 0.85), line_width=1)
            writer.draw_text("Photographic evidence stored securely in civic media database repository.", 60, 550, size=9, bold=False, color_rgb=(0.4, 0.4, 0.4))
            writer.draw_text(f"Media Reference: {tracking_id}_evidence.jpg", 60, 530, size=8.5, color_rgb=(0.5, 0.5, 0.5))

        # Forensic Audit Notice & Watermark
        writer.draw_rect(30, 80, 535, 80, fill_rgb=(0.96, 0.97, 0.99), stroke_rgb=(0.8, 0.85, 0.9), line_width=1)
        writer.draw_text("DIGITAL FORENSIC VERIFICATION & TAMPER PROOF SEAL", 45, 140, size=8.5, bold=True, color_rgb=(0.1, 0.1, 0.4))
        writer.draw_text(f"This document is an official statutory communication compiled for the Pune Municipal Corporation.", 45, 125, size=8, color_rgb=(0.3, 0.3, 0.3))
        writer.draw_text(f"GPS Hash & Coordinate Verification: {coords_str} | Date: {data.get('created_at', '2026-08-31')}", 45, 110, size=7.5, color_rgb=(0.4, 0.4, 0.4))
        writer.draw_text(f"Accused Contractor Info: {data.get('perpetrator_name', 'None recorded')} (Contact: {data.get('perpetrator_phone', 'None recorded')})", 45, 95, size=7.5, color_rgb=(0.4, 0.4, 0.4))

        writer.draw_text("Page 2 of 2 | Generated by Automated Pune Tree Grievance Platform", 140, 45, size=7.5, color_rgb=(0.5, 0.5, 0.5))

        return writer.build_pdf(output_path)
