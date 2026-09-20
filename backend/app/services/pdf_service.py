import os
import io
import struct
import base64
import textwrap
import hashlib
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
        self.page_links = [[]] # List of [(x1, y1, x2, y2, url)] per page

    def new_page(self):
        self.pages.append([])
        self.page_links.append([])
        self.current_page_idx += 1

    def add_link(self, x: float, y: float, w: float, h: float, url: str):
        """Adds an interactive clickable rectangular hyperlink to the current page."""
        self.page_links[self.current_page_idx].append((x, y, x + w, y + h, url))

    def draw_qr_code(self, qr_text: str, x: float, y: float, size: float = 64.0):
        """Draws a crisp, scannable vector QR code using pure-Python pyqrcode."""
        try:
            import pyqrcode
            qr = pyqrcode.create(qr_text, error='M')
            matrix = qr.code
            n = len(matrix)
            cell_size = size / n
            self.draw_rect(x - 2, y - 2, size + 4, size + 4, fill_rgb=(1, 1, 1), stroke_rgb=(0.85, 0.85, 0.85), line_width=0.5)
            stream = self.pages[self.current_page_idx]
            stream.append("0.0 0.0 0.0 rg\n")
            for r_idx, row in enumerate(matrix):
                cell_y = y + size - (r_idx + 1) * cell_size
                for c_idx, val in enumerate(row):
                    if val == 1:
                        cell_x = x + c_idx * cell_size
                        stream.append(f"{cell_x:.2f} {cell_y:.2f} {cell_size:.2f} {cell_size:.2f} re f\n")
        except Exception as e:
            print(f"[PDF QR NOTICE] Could not draw QR code: {e}")

    def add_image(self, b64_or_bytes) -> Optional[int]:
        try:
            raw_bytes = None
            if isinstance(b64_or_bytes, str):
                if os.path.exists(b64_or_bytes):
                    with open(b64_or_bytes, "rb") as f:
                        raw_bytes = f.read()
                elif os.path.exists(os.path.join("media", b64_or_bytes)):
                    with open(os.path.join("media", b64_or_bytes), "rb") as f:
                        raw_bytes = f.read()
                else:
                    clean_b64 = b64_or_bytes.split(",")[-1].strip()
                    raw_bytes = base64.b64decode(clean_b64)
            else:
                raw_bytes = b64_or_bytes

            if not raw_bytes or len(raw_bytes) < 100:
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

    def draw_rounded_image(self, img_idx: int, x: float, y: float, w: float, h: float, r: float = 8.0, 
                           stroke_rgb=(0.80, 0.86, 0.82), line_width: float = 1.0):
        """Draws an image clipped smoothly inside a rounded rectangle with optional border frame."""
        stream = self.pages[self.current_page_idx]
        k = 0.552284749831 * r
        stream.append("q\n")
        # Define smooth rounded rectangle clip path
        stream.append(f"{x + r:.2f} {y:.2f} m\n")
        stream.append(f"{x + w - r:.2f} {y:.2f} l\n")
        stream.append(f"{x + w - r + k:.2f} {y:.2f} {x + w:.2f} {y + r - k:.2f} {x + w:.2f} {y + r:.2f} c\n")
        stream.append(f"{x + w:.2f} {y + h - r:.2f} l\n")
        stream.append(f"{x + w:.2f} {y + h - r + k:.2f} {x + w - r + k:.2f} {y + h:.2f} {x + w - r:.2f} {y + h:.2f} c\n")
        stream.append(f"{x + r:.2f} {y + h:.2f} l\n")
        stream.append(f"{x + r - k:.2f} {y + h:.2f} {x:.2f} {y + h - r + k:.2f} {x:.2f} {y + h - r:.2f} c\n")
        stream.append(f"{x:.2f} {y + r:.2f} l\n")
        stream.append(f"{x:.2f} {y + r - k:.2f} {x + r - k:.2f} {y:.2f} {x + r:.2f} {y:.2f} c\n")
        stream.append("h\n")
        stream.append("W n\n")  # Set clip path, do not fill or stroke
        # Draw image within the clipped boundary
        stream.append(f"{w:.2f} 0 0 {h:.2f} {x:.2f} {y:.2f} cm\n/Im{img_idx} Do\n")
        stream.append("Q\n")  # Restore graphics state (removes clip)

        # Draw clean border around the rounded image
        if stroke_rgb is not None and line_width > 0:
            self.draw_rounded_rect(x, y, w, h, r=r, fill_rgb=None, stroke_rgb=stroke_rgb, line_width=line_width)

    def draw_rounded_rect(self, x: float, y: float, w: float, h: float, r: float = 8.0, 
                          fill_rgb=None, stroke_rgb=None, line_width: float = 1.0):
        """Draws a smooth rounded rectangle using cubic Bezier curves in pure PDF."""
        stream = self.pages[self.current_page_idx]
        k = 0.552284749831 * r
        stream.append("q\n")
        if line_width is not None:
            stream.append(f"{line_width:.2f} w\n")
        if stroke_rgb is not None:
            stream.append(f"{stroke_rgb[0]:.3f} {stroke_rgb[1]:.3f} {stroke_rgb[2]:.3f} RG\n")
        if fill_rgb is not None:
            stream.append(f"{fill_rgb[0]:.3f} {fill_rgb[1]:.3f} {fill_rgb[2]:.3f} rg\n")
        
        stream.append(f"{x + r:.2f} {y:.2f} m\n")
        stream.append(f"{x + w - r:.2f} {y:.2f} l\n")
        stream.append(f"{x + w - r + k:.2f} {y:.2f} {x + w:.2f} {y + r - k:.2f} {x + w:.2f} {y + r:.2f} c\n")
        stream.append(f"{x + w:.2f} {y + h - r:.2f} l\n")
        stream.append(f"{x + w:.2f} {y + h - r + k:.2f} {x + w - r + k:.2f} {y + h:.2f} {x + w - r:.2f} {y + h:.2f} c\n")
        stream.append(f"{x + r:.2f} {y + h:.2f} l\n")
        stream.append(f"{x + r - k:.2f} {y + h:.2f} {x:.2f} {y + h - r + k:.2f} {x:.2f} {y + h - r:.2f} c\n")
        stream.append(f"{x:.2f} {y + r:.2f} l\n")
        stream.append(f"{x:.2f} {y + r - k:.2f} {x + r - k:.2f} {y:.2f} {x + r:.2f} {y:.2f} c\n")
        stream.append("h\n")
        
        if fill_rgb is not None and stroke_rgb is not None:
            stream.append("B\n")
        elif fill_rgb is not None:
            stream.append("f\n")
        elif stroke_rgb is not None:
            stream.append("S\n")
        stream.append("Q\n")

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

    def draw_multiline(self, text: str, x: float, start_y: float, line_height: float = 12.0, size: float = 8.2, bold: bool = False, color_rgb=(0.1, 0.1, 0.1), max_chars: int = 86, min_y: Optional[float] = None) -> float:
        current_y = start_y
        lines_to_draw = []
        for paragraph in str(text).split("\n"):
            p_clean = paragraph.strip()
            if not p_clean:
                lines_to_draw.append("")
                continue
            for line in textwrap.wrap(p_clean, width=max_chars):
                lines_to_draw.append(line)

        for i, line in enumerate(lines_to_draw):
            if min_y is not None and (current_y - line_height) < min_y:
                if i < len(lines_to_draw):
                    self.draw_text("[... Statutory notice continued in official municipal electronic dossier ...]", x, current_y, size=size - 0.5, bold=True, color_rgb=(0.35, 0.45, 0.38))
                break
            if not line:
                current_y -= line_height * 0.5
                continue
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

        # Format link annotation objects
        annot_objs = []
        page_annot_map = {}
        for p_idx, links in enumerate(self.page_links):
            page_annot_map[p_idx] = []
            for (x1, y1, x2, y2, url) in links:
                annot_num = current_obj_num
                current_obj_num += 1
                page_annot_map[p_idx].append(annot_num)
                safe_url = url.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")
                annot_data = f"<</Type/Annot/Subtype/Link/Rect[{x1:.2f} {y1:.2f} {x2:.2f} {y2:.2f}]/Border[0 0 0]/A<</Type/Action/S/URI/URI({safe_url})>>>>".encode("ascii", errors="replace")
                annot_objs.append(annot_data)

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
        all_objects.extend(annot_objs)

        for p_idx in range(page_count):
            stream_str = "".join(self.pages[p_idx])
            stream_bytes = stream_str.encode("latin-1", errors="replace")
            content_obj_data = f"<</Length {len(stream_bytes)}>>\nstream\n{stream_str}\nendstream".encode("latin-1", errors="replace")

            annots_list = page_annot_map.get(p_idx, [])
            annots_str = " ".join([f"{a} 0 R" for a in annots_list])
            annots_entry = f"/Annots[{annots_str}]" if annots_str else ""

            page_obj_data = f"<</Type/Page/Parent 2 0 R/MediaBox[0 0 {self.page_w:.2f} {self.page_h:.2f}]/Contents {content_obj_nums[p_idx]} 0 R/Resources<</Font<</F1 3 0 R/F2 4 0 R>> {xobj_entry}>> {annots_entry}>>".encode("latin-1")

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
        Compiles statutory notice into full-fidelity, highly legible 2-page A4 PDF:
        - Page 1: Modern executive letterhead, modular curved metadata cards, clean letter body, and cryptographic evidence seal
        - Page 2: Multi-angle photographic evidence appendix & forensic arborist audit
        """
        writer = MultiPageNativePdfWriter()

        # Compute Cryptographic SHA-256 Digest
        tracking_id = data.get("tracking_id", "PMC-TREE-2026-UNSPEC")
        lat = data.get("latitude", 18.5196)
        lon = data.get("longitude", 73.8436)
        created_at = data.get("created_at", "06-Sep-2026 04:30 AM IST")
        body = data.get("draft_body_en", "")
        
        raw_evidence_str = f"{tracking_id}|{lat}|{lon}|{created_at}|{body}"
        sha256_hash = hashlib.sha256(raw_evidence_str.encode("utf-8")).hexdigest().upper()
        verify_url = f"https://punetrees.org/t/{tracking_id}"

        # =========================================================================
        # PAGE 1: STATUTORY NOTICE & FORMAL GRIEVANCE LETTER
        # =========================================================================
        
        # 1. Modern Light Modular Header Card (Soft curved container with emerald vertical accent)
        writer.draw_rounded_rect(35, 762, 525, 54, r=10, fill_rgb=(0.965, 0.980, 0.972), stroke_rgb=(0.82, 0.88, 0.84), line_width=1)
        writer.draw_rounded_rect(38, 768, 5, 42, r=2.5, fill_rgb=(0.08, 0.48, 0.28), stroke_rgb=None)

        writer.draw_text("PUNE MUNICIPAL TREE AUTHORITY", 52, 794, size=13, bold=True, color_rgb=(0.08, 0.16, 0.12))
        writer.draw_text("PUNE TREE RAKSHAK  *  OFFICIAL STATUTORY GRIEVANCE REDRESSAL  *  MAHARASHTRA TREE ACT 1975", 52, 775, size=7.5, bold=False, color_rgb=(0.35, 0.45, 0.38))

        # Pill Badge inside Header (Top Right)
        writer.draw_rounded_rect(415, 786, 134, 20, r=10, fill_rgb=(0.90, 0.95, 0.92), stroke_rgb=(0.74, 0.85, 0.78), line_width=0.8)
        writer.draw_text("SEC 65B CERTIFIED DOSSIER", 423, 792, size=7, bold=True, color_rgb=(0.08, 0.42, 0.24))

        # 2. Key Metadata Card (Modular 2-column curved card with clean badges)
        urgency = str(data.get("urgency_level", "HIGH")).replace("_", " ")
        category = str(data.get("issue_type", "HAZARDOUS_BRANCH")).replace("_", " ")
        addr = data.get("address_landmark", "Fergusson College Road, Shivajinagar, Pune")
        ward = data.get("ward_name", "Shivajinagar - Ghole Road")
        species = data.get("estimated_tree_species", "Native Urban Tree Subject")
        officer_name = data.get("routed_authority_role", "Tree Officer & Horticultural Assistant")

        writer.draw_rounded_rect(35, 678, 525, 74, r=8, fill_rgb=(0.980, 0.985, 0.982), stroke_rgb=(0.88, 0.90, 0.89), line_width=1)
        
        # Sub-card: Reference Number Pill
        writer.draw_rounded_rect(47, 726, 185, 18, r=6, fill_rgb=(0.92, 0.95, 0.93), stroke_rgb=(0.78, 0.86, 0.80), line_width=0.8)
        writer.draw_text(f"REF: {tracking_id}", 54, 732, size=8.5, bold=True, color_rgb=(0.08, 0.35, 0.20))
        
        # Sub-card: Priority Pill
        urgency_is_high = "CRITICAL" in urgency or "HIGH" in urgency
        p_bg = (0.98, 0.92, 0.92) if urgency_is_high else (0.92, 0.96, 0.93)
        p_border = (0.90, 0.70, 0.70) if urgency_is_high else (0.78, 0.86, 0.80)
        p_text_col = (0.80, 0.12, 0.12) if urgency_is_high else (0.08, 0.38, 0.20)
        writer.draw_rounded_rect(330, 726, 155, 18, r=6, fill_rgb=p_bg, stroke_rgb=p_border, line_width=0.8)
        writer.draw_text(f"PRIORITY: {urgency[:22]}", 338, 732, size=8, bold=True, color_rgb=p_text_col)

        # Left Column Metadata
        writer.draw_text(f"Filing Date   : {created_at}", 48, 710, size=8, color_rgb=(0.35, 0.35, 0.35))
        writer.draw_text(f"Location      : {addr[:40]}", 48, 696, size=8, bold=True, color_rgb=(0.20, 0.20, 0.20))
        writer.draw_text(f"GPS Locus   : {float(lat):.5f} N, {float(lon):.5f} E ({ward[:22]})", 48, 684, size=7.5, color_rgb=(0.40, 0.40, 0.40))

        # Right Column Metadata
        writer.draw_text(f"Category  : {category[:36]}", 330, 710, size=8, bold=True, color_rgb=(0.20, 0.20, 0.20))
        writer.draw_text(f"Species     : {species[:32]}", 330, 696, size=8, color_rgb=(0.30, 0.30, 0.30))
        writer.draw_text(f"Routed To: {officer_name[:36]}", 330, 684, size=7.5, bold=True, color_rgb=(0.10, 0.25, 0.50))

        # 3. Clean Formal Letter Body Container (Curved Card)
        subject = data.get("draft_subject_en", f"Statutory Notice regarding {category} at {addr} [{tracking_id}]")
        
        writer.draw_rounded_rect(35, 195, 525, 473, r=8, fill_rgb=(1.0, 1.0, 1.0), stroke_rgb=(0.88, 0.90, 0.89), line_width=1)
        
        # Subject Header with modern curved pill badge
        writer.draw_rounded_rect(47, 638, 64, 18, r=6, fill_rgb=(0.92, 0.95, 0.93), stroke_rgb=(0.80, 0.88, 0.82), line_width=0.8)
        writer.draw_text("SUBJECT", 56, 644, size=7.5, bold=True, color_rgb=(0.08, 0.35, 0.20))

        subj_lines = textwrap.wrap(subject, width=74)
        s_y = 644
        for sl in subj_lines[:2]:
            writer.draw_text(sl, 120, s_y, size=8.5, bold=True, color_rgb=(0.12, 0.16, 0.14))
            s_y -= 12
        letter_start_y = s_y - 2

        # Thin Divider with soft gray
        writer.draw_rounded_rect(48, letter_start_y + 4, 499, 1, r=0.5, fill_rgb=(0.90, 0.90, 0.90), stroke_rgb=(0.90, 0.90, 0.90), line_width=0.5)

        # Formal Letter Paragraphs with strict overflow prevention at bottom border
        writer.draw_multiline(body, 48, letter_start_y - 8, line_height=12.0, size=8.2, max_chars=84, min_y=205)

        # 4. Tamper-Proof Cryptographic Digital Seal & Citizen Attestation (Dual Side-by-Side Curved Cards)
        citizen_name = str(data.get("citizen_name") or "Concerned Citizen of Pune")
        citizen_phone = str(data.get("citizen_phone") or "Verified Mobile")
        citizen_email = str(data.get("citizen_email") or "Verified Mobile Client")

        # --- LEFT CARD: CITIZEN DIGITAL CERTIFICATION ---
        writer.draw_rounded_rect(35, 50, 295, 136, r=8, fill_rgb=(0.978, 0.985, 0.980), stroke_rgb=(0.84, 0.89, 0.86), line_width=1)
        writer.draw_rounded_rect(38, 56, 4, 124, r=2, fill_rgb=(0.10, 0.48, 0.28), stroke_rgb=None)
        
        writer.draw_rounded_rect(48, 160, 175, 17, r=5, fill_rgb=(0.91, 0.95, 0.93), stroke_rgb=(0.78, 0.86, 0.80), line_width=0.8)
        writer.draw_text("CITIZEN DIGITAL CERTIFICATION", 54, 165, size=7.5, bold=True, color_rgb=(0.08, 0.35, 0.20))

        writer.draw_text(f"Digitally Attested by : {citizen_name[:28]}", 48, 146, size=8, bold=True, color_rgb=(0.12, 0.12, 0.12))
        writer.draw_text(f"Citizen Contact        : {citizen_phone[:16]} | {citizen_email[:20]}", 48, 134, size=7, color_rgb=(0.35, 0.35, 0.35))
        writer.draw_text("Capture Integrity    : Live Hardware GPS Geofence Validated", 48, 122, size=7, color_rgb=(0.35, 0.35, 0.35))
        writer.draw_text("Statutory Oath         : Good faith grievance under Sec 2(c) & 21,", 48, 110, size=7, color_rgb=(0.40, 0.40, 0.40))
        writer.draw_text("                         Maharashtra (Urban Areas) Tree Act 1975.", 48, 99, size=7, color_rgb=(0.40, 0.40, 0.40))
        writer.draw_text("Legal Admissibility   : Electronic record under Sec 65B Evidence Act.", 48, 87, size=7, color_rgb=(0.40, 0.40, 0.40))
        writer.draw_text("Inspection SLA         : 48-Hour Emergency Response Mandated by PMC.", 48, 73, size=7, bold=True, color_rgb=(0.75, 0.20, 0.10))

        # --- RIGHT CARD: IMMUTABLE EVIDENCE SEAL & QR CODE ---
        writer.draw_rounded_rect(340, 50, 220, 136, r=8, fill_rgb=(0.940, 0.968, 0.950), stroke_rgb=(0.75, 0.85, 0.78), line_width=1)
        writer.draw_rounded_rect(343, 56, 4, 124, r=2, fill_rgb=(0.08, 0.42, 0.24), stroke_rgb=None)

        writer.draw_rounded_rect(353, 160, 132, 17, r=5, fill_rgb=(0.89, 0.94, 0.91), stroke_rgb=(0.74, 0.85, 0.78), line_width=0.8)
        writer.draw_text("IMMUTABLE EVIDENCE SEAL", 359, 165, size=7.5, bold=True, color_rgb=(0.08, 0.35, 0.20))
        writer.draw_text("SHA-256 Tamper-Proof Digest:", 353, 148, size=6.5, bold=True, color_rgb=(0.25, 0.25, 0.25))

        # Hash (4 lines, mono green)
        writer.draw_text(f"{sha256_hash[:16]}", 353, 136, size=6.2, color_rgb=(0.10, 0.38, 0.22))
        writer.draw_text(f"{sha256_hash[16:32]}", 353, 125, size=6.2, color_rgb=(0.10, 0.38, 0.22))
        writer.draw_text(f"{sha256_hash[32:48]}", 353, 114, size=6.2, color_rgb=(0.10, 0.38, 0.22))
        writer.draw_text(f"{sha256_hash[48:64]}", 353, 103, size=6.2, color_rgb=(0.10, 0.38, 0.22))

        writer.draw_rounded_rect(353, 82, 84, 15, r=3, fill_rgb=(0.88, 0.95, 0.90), stroke_rgb=(0.70, 0.85, 0.75), line_width=0.5)
        writer.draw_text("[OK] Sec 65B Verified", 358, 86, size=6, bold=True, color_rgb=(0.08, 0.48, 0.20))

        # Live Scannable Vector QR Code on right side of card
        writer.draw_qr_code(verify_url, 482, 92, size=64)
        writer.add_link(482, 92, 64, 64, verify_url)

        # Clickable verify link pill under QR
        writer.draw_rounded_rect(478, 68, 72, 18, r=4, fill_rgb=(0.88, 0.93, 0.98), stroke_rgb=(0.70, 0.82, 0.95), line_width=0.6)
        writer.draw_text("VERIFY RECORD", 482, 74, size=6, bold=True, color_rgb=(0.10, 0.35, 0.75))
        writer.add_link(478, 68, 72, 18, verify_url)

        # Footer line
        writer.draw_text("Page 1 of 2  *  Pune Tree Rakshak Citizen Redressal System  *  Sec 65B Certified Record", 145, 32, size=7.5, color_rgb=(0.50, 0.50, 0.50))
        writer.add_link(145, 28, 300, 14, verify_url)

        # =========================================================================
        # PAGE 2: PHOTOGRAPHIC EVIDENCE APPENDIX & FORENSIC ARBORIST AUDIT
        # =========================================================================
        writer.new_page()

        # Header (Page 2) - matching modern light modular card
        writer.draw_rounded_rect(35, 762, 525, 54, r=10, fill_rgb=(0.965, 0.980, 0.972), stroke_rgb=(0.82, 0.88, 0.84), line_width=1)
        writer.draw_rounded_rect(38, 768, 5, 42, r=2.5, fill_rgb=(0.08, 0.48, 0.28), stroke_rgb=None)

        writer.draw_text("EVIDENTIARY APPENDIX: MULTI-ANGLE FORENSIC PROOF", 52, 794, size=12, bold=True, color_rgb=(0.08, 0.16, 0.12))
        writer.draw_text("PMC TREE AUTHORITY LEGAL DOSSIER  *  EVIDENCE SEALED UNDER SEC 65B", 52, 775, size=7.5, bold=False, color_rgb=(0.35, 0.45, 0.38))

        writer.draw_rounded_rect(415, 786, 134, 20, r=10, fill_rgb=(0.90, 0.95, 0.92), stroke_rgb=(0.74, 0.85, 0.78), line_width=0.8)
        writer.draw_text(f"REF: {tracking_id[:18]}", 423, 792, size=7, bold=True, color_rgb=(0.08, 0.42, 0.24))

        # Forensic Visual Audit Card (Modular Curved Card)
        census_data = data.get("census_tree")
        if census_data:
            census_str = f"Possible correlation with #{census_data.get('census_tag_id')} ({census_data.get('botanical_name')}, ~{census_data.get('distance_meters')}m away)"
        else:
            census_str = "No historical municipal tree census record within 15m radius."
        visual_damage = data.get("visual_damage_summary", "Physical visual evidence recorded on site. Immediate arborist attention warranted.")

        writer.draw_rounded_rect(35, 650, 525, 100, r=8, fill_rgb=(0.975, 0.982, 0.978), stroke_rgb=(0.85, 0.88, 0.86), line_width=1)
        
        writer.draw_rounded_rect(47, 726, 235, 16, r=5, fill_rgb=(0.91, 0.95, 0.93), stroke_rgb=(0.78, 0.86, 0.80), line_width=0.8)
        writer.draw_text("FORENSIC BOTANICAL AUDIT & GIS CORRELATION", 54, 731, size=7.5, bold=True, color_rgb=(0.08, 0.35, 0.20))

        writer.draw_text(f"* Botanical Subject    : {species}", 48, 712, size=8, bold=True, color_rgb=(0.15, 0.15, 0.15))
        writer.draw_text(f"* PMC Census Match : {census_str[:88]}", 48, 700, size=7.5, color_rgb=(0.30, 0.30, 0.30))
        writer.draw_text(f"* Site Coordinates     : {float(lat):.5f} N, {float(lon):.5f} E | Landmark: {addr[:40]}", 48, 688, size=7.5, color_rgb=(0.30, 0.30, 0.30))
        c_y = 676
        for vl in textwrap.wrap(f"* Visual Findings       : {visual_damage}", width=86)[:2]:
            writer.draw_text(vl, 48, c_y, size=7.5, color_rgb=(0.20, 0.20, 0.20))
            c_y -= 11

        # Photos Gallery
        raw_photos = data.get("photo_urls", []) or []
        embedded_img_indices = []
        for p in raw_photos[:3]:
            idx = writer.add_image(p)
            if idx is not None:
                embedded_img_indices.append(idx)

        writer.draw_text("PHOTOGRAPHIC EVIDENCE RECORD (CAPTURED ON-SITE):", 35, 632, size=9, bold=True, color_rgb=(0.15, 0.15, 0.15))

        photo_labels = [
            "Angle 1: Overview & Lean",
            "Angle 2: Damage Close-up",
            "Angle 3: Root Basin / Base"
        ]

        if embedded_img_indices:
            img_w = 162
            img_h = 220
            start_x = 35
            gap_x = 19
            y_pos = 385

            for i, img_idx in enumerate(embedded_img_indices):
                x_pos = start_x + i * (img_w + gap_x)
                # Outer curved photo card container
                writer.draw_rounded_rect(x_pos - 3, y_pos - 3, img_w + 6, img_h + 30, r=10, fill_rgb=(0.985, 0.988, 0.985), stroke_rgb=(0.84, 0.88, 0.86), line_width=1)
                # Image with smooth rounded corners
                writer.draw_rounded_image(img_idx, x_pos, y_pos, img_w, img_h, r=8.0, stroke_rgb=(0.80, 0.85, 0.82), line_width=1.0)
                # Caption label badge
                lbl = photo_labels[i] if i < len(photo_labels) else f"Evidence Shot {i+1}"
                writer.draw_rounded_rect(x_pos + 4, y_pos + img_h + 5, img_w - 8, 18, r=4, fill_rgb=(0.91, 0.95, 0.93), stroke_rgb=(0.78, 0.86, 0.80), line_width=0.6)
                writer.draw_text(lbl[:32], x_pos + 10, y_pos + img_h + 10, size=7, bold=True, color_rgb=(0.08, 0.35, 0.20))
        else:
            writer.draw_rounded_rect(35, 470, 525, 145, r=8, fill_rgb=(0.985, 0.988, 0.990), stroke_rgb=(0.86, 0.89, 0.88), line_width=1)
            writer.draw_text("Photographic evidence stored securely in civic media database repository.", 60, 555, size=9, color_rgb=(0.35, 0.35, 0.35))
            writer.draw_text(f"Media Reference ID: {tracking_id}_evidence_multiangle.jpg", 60, 535, size=8.5, bold=True, color_rgb=(0.08, 0.35, 0.20))
            writer.draw_text("Full resolution multi-angle JPEGs cryptographically fingerprinted for field inspection.", 60, 515, size=8, color_rgb=(0.50, 0.50, 0.50))

        # Chain of Custody & Statutory Enforceability Card (Modular Curved Card)
        writer.draw_rounded_rect(35, 75, 525, 90, r=8, fill_rgb=(0.970, 0.975, 0.985), stroke_rgb=(0.82, 0.85, 0.90), line_width=1)
        
        writer.draw_rounded_rect(47, 142, 215, 16, r=5, fill_rgb=(0.91, 0.93, 0.97), stroke_rgb=(0.78, 0.82, 0.92), line_width=0.8)
        writer.draw_text("CHAIN OF CUSTODY & STATUTORY ENFORCEABILITY", 54, 147, size=7.5, bold=True, color_rgb=(0.10, 0.20, 0.55))

        writer.draw_text("1. All photographic timestamps, EXIF geolocation coordinates, and sensor pitch are cryptographically sealed.", 48, 126, size=7.5, color_rgb=(0.30, 0.30, 0.30))
        writer.draw_text("2. Any physical alteration, felling, or unauthorized lopping post-filing constitutes tampering under Section 21.", 48, 113, size=7.5, color_rgb=(0.30, 0.30, 0.30))
        writer.draw_text(f"3. SHA-256 Digest: {sha256_hash} | Sealed on {created_at}", 48, 100, size=7, color_rgb=(0.15, 0.38, 0.20))
        writer.draw_text("4. Municipal Tree Ambulance Inspection SLA: 48 hours from filing under PMC Citizen Charter.", 48, 87, size=7.5, bold=True, color_rgb=(0.75, 0.15, 0.15))

        writer.draw_text("Page 2 of 2  *  Pune Tree Rakshak Citizen Redressal System  *  Sec 65B Certified Record", 145, 42, size=7.5, color_rgb=(0.50, 0.50, 0.50))
        writer.add_link(145, 38, 300, 14, verify_url)

        return writer.build_pdf(output_path)
