from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path


@dataclass
class InvoiceExtractionResult:
    raw_text: str
    status: str
    errors: list[str]


class InvoiceExtractionService:
    def extract_text(self, *, file_path: Path, content_type: str) -> InvoiceExtractionResult:
        errors: list[str] = []
        raw_text = ""
        status = "EXTRACTED"

        try:
            is_pdf = content_type == "application/pdf" or file_path.suffix.lower() == ".pdf"
            if is_pdf:
                raw_text = self._extract_pdf(file_path)
            else:
                raw_text = self._extract_image(file_path)
        except RuntimeError as exc:
            status = "FAILED"
            errors.append(str(exc))
        except Exception as exc:
            status = "FAILED"
            errors.append(f"Extraction failed: {exc}")

        if not raw_text.strip():
            if status != "FAILED":
                status = "NEEDS_REVIEW"
                errors.append("No extractable text detected")
        return InvoiceExtractionResult(raw_text=raw_text, status=status, errors=errors)

    def _extract_pdf(self, file_path: Path) -> str:
        try:
            import pdfplumber
        except ImportError as exc:
            raise RuntimeError("pdfplumber is required for PDF extraction") from exc

        text_parts: list[str] = []
        with pdfplumber.open(file_path) as pdf:
            for page in pdf.pages:
                page_text = page.extract_text() or ""
                if page_text:
                    text_parts.append(page_text)
        return "\n".join(text_parts)

    def _extract_image(self, file_path: Path) -> str:
        try:
            from PIL import Image
        except ImportError as exc:
            raise RuntimeError("Pillow is required for OCR image processing") from exc

        try:
            import pytesseract
        except ImportError as exc:
            raise RuntimeError("pytesseract is required for OCR image extraction") from exc

        with Image.open(file_path) as image:
            return pytesseract.image_to_string(image)
