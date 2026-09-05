import os
import aiosmtplib
from email.message import EmailMessage
from typing import Optional, Dict, Any
from app.core.config import settings

class EmailService:
    """
    Asynchronously sends formal tree complaint notices to municipal authorities with PDF attachment.
    """

    @staticmethod
    async def send_complaint_email(
        to_email: str,
        subject: str,
        body_text: str,
        pdf_path: Optional[str] = None,
        cc_email: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Sends an email with the PDF attached via SMTP.
        """
        msg = EmailMessage()
        msg["From"] = settings.SMTP_FROM_EMAIL
        msg["To"] = to_email
        if cc_email:
            msg["Cc"] = cc_email
        msg["Subject"] = subject
        msg.set_content(body_text)

        # Attach PDF if available
        if pdf_path and os.path.exists(pdf_path):
            with open(pdf_path, "rb") as f:
                pdf_data = f.read()
            msg.add_attachment(
                pdf_data,
                maintype="application",
                subtype="pdf",
                filename=os.path.basename(pdf_path)
            )

        if not settings.SMTP_USER or not settings.SMTP_PASSWORD:
            print(f"[EmailService Simulated] In development mode without credentials. Would dispatch to {to_email}: {subject}")
            return {
                "sent": True,
                "simulated": True,
                "recipient": to_email,
                "subject": subject,
                "pdf_attached": bool(pdf_path and os.path.exists(pdf_path))
            }

        try:
            await aiosmtplib.send(
                msg,
                hostname=settings.SMTP_HOST,
                port=settings.SMTP_PORT,
                username=settings.SMTP_USER,
                password=settings.SMTP_PASSWORD,
                start_tls=True
            )
            return {
                "sent": True,
                "simulated": False,
                "recipient": to_email,
                "subject": subject,
                "pdf_attached": bool(pdf_path and os.path.exists(pdf_path))
            }
        except Exception as e:
            print(f"[EmailService Error] Failed to send email: {e}")
            return {
                "sent": False,
                "error": str(e),
                "recipient": to_email
            }
