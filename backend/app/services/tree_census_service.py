import os
import math
import sqlite3
from pathlib import Path
from typing import Dict, Any, Optional

BASE_DIR = Path(__file__).resolve().parent.parent.parent
CENSUS_DB_PATH = BASE_DIR / "pune_tree_census.db"

class TreeCensusService:
    """
    Pune Municipal Corporation (PMC) Tree Census GIS Spatial Matcher.
    Queries the 3.76-Million Geotagged PMC Tree Census SQLite database
    using SQLite R*Tree Spatial Index.

    NOTE: The GIS Census data is strictly a potential/auxiliary historical baseline.
    The primary legal evidence is always the citizen's live photos, AI vision analysis,
    and device GPS coordinates.
    """

    @staticmethod
    def _haversine_distance_m(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
        """
        Calculates great-circle distance between two GPS coordinates in meters.
        """
        r = 6371000.0  # Earth radius in meters
        phi1 = math.radians(lat1)
        phi2 = math.radians(lat2)
        dphi = math.radians(lat2 - lat1)
        dlambda = math.radians(lon2 - lon1)

        a = math.sin(dphi / 2.0) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2.0) ** 2
        c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))
        return r * c

    @classmethod
    def match_nearest_tree(cls, latitude: float, longitude: float, max_radius_meters: float = 15.0) -> Optional[Dict[str, Any]]:
        """
        Queries PMC Tree Census spatial database for the nearest geotagged municipal tree within 15 meters.
        If no tree exists within 15m, returns None (no forced/fake matches).
        """
        if not CENSUS_DB_PATH.exists():
            return None

        try:
            conn = sqlite3.connect(f"file:{str(CENSUS_DB_PATH)}?mode=ro", uri=True)
            cursor = conn.cursor()

            # Calculate tight bounding box in degrees (1 deg lat ~ 111,139 m)
            lat_delta = max_radius_meters / 111139.0
            lon_delta = max_radius_meters / (111139.0 * math.cos(math.radians(latitude)))

            min_lat = latitude - lat_delta
            max_lat = latitude + lat_delta
            min_lon = longitude - lon_delta
            max_lon = longitude + lon_delta

            query = """
            SELECT
                c.id, c.saar_uid, c.latitude, c.longitude,
                c.botanical_name, c.common_name, c.local_name_mr,
                c.girth_cm, c.height_m, c.canopy_dia_m,
                c.condition, c.ownership, c.ward_name, c.road_name,
                c.society_name, c.is_rare, c.is_heritage, c.estimated_age_years
            FROM tree_census c
            JOIN tree_census_spatial_idx idx ON c.id = idx.id
            WHERE idx.min_lat >= ? AND idx.max_lat <= ?
              AND idx.min_lon >= ? AND idx.max_lon <= ?
            LIMIT 50;
            """
            cursor.execute(query, (min_lat, max_lat, min_lon, max_lon))
            rows = cursor.fetchall()
            conn.close()

            if not rows:
                return None

            closest_row = None
            min_dist = float("inf")

            for r in rows:
                tree_lat = r[2]
                tree_lon = r[3]
                dist = cls._haversine_distance_m(latitude, longitude, tree_lat, tree_lon)
                if dist < min_dist and dist <= max_radius_meters:
                    min_dist = dist
                    closest_row = r

            if not closest_row:
                return None

            saar_uid = str(closest_row[1])
            census_tag = f"PMC-TC-{saar_uid}" if not saar_uid.startswith("PMC") else saar_uid
            girth_cm = closest_row[7] or 120.0
            height_m = closest_row[8] or 10.0
            est_age = closest_row[17] or int(girth_cm / 5.5)
            is_heritage = bool(closest_row[16] or girth_cm >= 200 or est_age >= 50)
            botanical = closest_row[4] or "Indigenous Species"
            common_name = closest_row[5] or botanical
            local_name = closest_row[6] or common_name
            ownership = closest_row[11] or "Public Footpath / Roadside"
            ward_name = closest_row[12] or "Pune Municipal Jurisdiction"
            road_name = closest_row[13] or closest_row[14] or "Municipal Avenue"

            return {
                "has_census_match": True,
                "is_potential_match": True,
                "census_tag_id": census_tag,
                "botanical_name": botanical,
                "common_name": common_name,
                "local_name_mr": local_name,
                "girth_cm": round(girth_cm, 1),
                "height_m": round(height_m, 1),
                "ownership": ownership,
                "ward_name": ward_name,
                "road_name": road_name,
                "is_heritage_tree": is_heritage,
                "estimated_age_years": est_age,
                "distance_meters": round(min_dist, 1),
                "match_disclaimer": f"Potential historical PMC 2019 Census record within {round(min_dist, 1)}m (Auxiliary Reference Only)",
                "legal_status": "HERITAGE TREE (Historical Sec 8 Baseline)" if is_heritage else "STANDARD PROTECTED TREE (Maharashtra Tree Act, 1975)"
            }
        except Exception as e:
            print(f"[TreeCensusService] Warning: SQLite spatial query error: {e}", flush=True)
            return None
