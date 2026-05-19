from __future__ import annotations

from datetime import datetime, timezone
from base64 import b64decode
import hashlib
import json
from uuid import UUID

from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import ec, ed25519, padding, rsa


class SignatureService:
    @staticmethod
    def build_payload(*, entry_id: UUID, action: str, timestamp: datetime) -> str:
        payload = {
            "entry_id": str(entry_id),
            "action": action,
            "timestamp": timestamp.astimezone(timezone.utc).isoformat(),
        }
        return json.dumps(payload, sort_keys=True, separators=(",", ":"))

    @staticmethod
    def verify_signature(*, payload: str, signature: str, public_key: str, algorithm: str) -> bool:
        try:
            signature_bytes = b64decode(signature)
            key = serialization.load_pem_public_key(public_key.encode("utf-8"))
            payload_bytes = payload.encode("utf-8")
        except Exception:
            return False

        normalized = algorithm.strip().upper()
        try:
            if normalized == "RSA_SHA256" and isinstance(key, rsa.RSAPublicKey):
                key.verify(signature_bytes, payload_bytes, padding.PKCS1v15(), hashes.SHA256())
                return True

            if normalized == "ECDSA_SHA256" and isinstance(key, ec.EllipticCurvePublicKey):
                key.verify(signature_bytes, payload_bytes, ec.ECDSA(hashes.SHA256()))
                return True

            if normalized == "ED25519" and isinstance(key, ed25519.Ed25519PublicKey):
                key.verify(signature_bytes, payload_bytes)
                return True
        except Exception:
            return False

        return False


class AuditChainHasher:
    GENESIS_HASH = "0" * 64

    @staticmethod
    def serialize_event(
        *,
        entity_type: str,
        entity_id: UUID,
        action: str,
        performed_by: UUID,
        timestamp: datetime,
    ) -> str:
        payload = {
            "entity_type": entity_type,
            "entity_id": str(entity_id),
            "action": action,
            "performed_by": str(performed_by),
            "timestamp": timestamp.astimezone(timezone.utc).isoformat(),
        }
        return json.dumps(payload, sort_keys=True, separators=(",", ":"))

    @classmethod
    def compute_hash(cls, *, previous_hash: str, serialized_event: str) -> str:
        return hashlib.sha256((previous_hash + serialized_event).encode("utf-8")).hexdigest()
