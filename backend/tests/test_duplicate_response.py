import unittest
import json
from datetime import datetime
from types import SimpleNamespace
from unittest.mock import AsyncMock, Mock

from app.api.v1.endpoints.complaints import check_duplicates
from app.schemas.complaint import DuplicateCheckRequest


class DuplicateResponseTest(unittest.IsolatedAsyncioTestCase):
    async def test_existing_report_serializes_required_summary_fields(self):
        created = datetime(2026, 10, 9, 12, 0)
        complaint = SimpleNamespace(
            id="existing", tracking_id="PUNE-TREE-2026-TEST", latitude=18.52, longitude=73.85,
            issue_type="HAZARDOUS_BRANCH", urgency_level="HIGH", address_landmark="Pune",
            witness_count=1, verification_status="PENDING_TIMELOCK", photo_urls=[], created_at=created,
        )
        result = Mock()
        result.scalars.return_value.all.return_value = [complaint]
        db = SimpleNamespace(execute=AsyncMock(return_value=result))
        response = await check_duplicates(DuplicateCheckRequest(latitude=18.52, longitude=73.85), db)
        payload = json.loads(response.json())
        self.assertTrue(payload["has_duplicates"])
        self.assertEqual(payload["nearby_complaints"][0]["photo_urls"], [])
        self.assertEqual(payload["nearby_complaints"][0]["created_at"], created.isoformat())


if __name__ == "__main__":
    unittest.main()
