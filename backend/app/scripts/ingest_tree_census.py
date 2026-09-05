import os
import io
import csv
import sys
import time
import sqlite3
import httpx
from pathlib import Path
from typing import List, Dict, Any

# Database file location
BASE_DIR = Path(__file__).resolve().parent.parent.parent
DB_PATH = BASE_DIR / "pune_tree_census.db"
CKAN_PACKAGE_URL = "https://data.opencity.in/api/3/action/package_show?id=pune-tree-census-2019"

# Bounding box for Pune Municipal Jurisdiction
MIN_LAT, MAX_LAT = 18.30, 18.75
MIN_LON, MAX_LON = 73.65, 74.15

def init_census_db(db_path: Path):
    """
    Initializes the SQLite schema with standard tables, R*Tree index, and sync trigger.
    """
    print(f"Initializing Tree Census Spatial Database at: {db_path}")
    if db_path.exists():
        try:
            os.remove(db_path)
        except Exception:
            pass

    conn = sqlite3.connect(str(db_path))
    cursor = conn.cursor()

    cursor.execute("PRAGMA journal_mode = WAL;")
    cursor.execute("PRAGMA synchronous = NORMAL;")

    # 1. Main Census Table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS tree_census (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        saar_uid VARCHAR(50) NOT NULL,
        latitude REAL NOT NULL,
        longitude REAL NOT NULL,
        botanical_name VARCHAR(150),
        common_name VARCHAR(100),
        local_name_mr VARCHAR(100),
        girth_cm REAL,
        height_m REAL,
        canopy_dia_m REAL,
        condition VARCHAR(50),
        ownership VARCHAR(100),
        ward_name VARCHAR(100),
        road_name VARCHAR(150),
        society_name VARCHAR(150),
        is_rare INTEGER DEFAULT 0,
        is_heritage INTEGER DEFAULT 0,
        estimated_age_years INTEGER
    );
    """)

    # 2. SQLite R*Tree Spatial Virtual Table
    cursor.execute("""
    CREATE VIRTUAL TABLE IF NOT EXISTS tree_census_spatial_idx USING rtree(
        id,
        min_lat, max_lat,
        min_lon, max_lon
    );
    """)

    # 3. Synchronized Spatial Trigger
    cursor.execute("""
    CREATE TRIGGER IF NOT EXISTS trg_tree_census_spatial_insert
    AFTER INSERT ON tree_census
    BEGIN
        INSERT INTO tree_census_spatial_idx (id, min_lat, max_lat, min_lon, max_lon)
        VALUES (new.id, new.latitude, new.latitude, new.longitude, new.longitude);
    END;
    """)

    # 4. Fast lookup indexes
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_census_tag ON tree_census(saar_uid);")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_census_coords ON tree_census(latitude, longitude);")

    conn.commit()
    conn.close()
    print("Database schema and spatial trigger initialized successfully.")

def get_opencity_resource_urls() -> List[Dict[str, str]]:
    """
    Fetches the 17 CSV resource URLs from OpenCity CKAN API.
    """
    print("Fetching OpenCity dataset resources metadata...")
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    }
    client = httpx.Client(headers=headers, timeout=40.0)
    try:
        r = client.get(CKAN_PACKAGE_URL)
        if r.status_code == 200:
            data = r.json()
            resources = data.get("result", {}).get("resources", [])
            csv_resources = [res for res in resources if res.get("format", "").upper() == "CSV" or res.get("url", "").endswith(".csv")]
            if csv_resources:
                print(f"Discovered {len(csv_resources)} CSV resource partitions from OpenCity.")
                return csv_resources
    except Exception as e:
        print(f"Error fetching OpenCity API metadata: {e}")
    
    # Fallback hardcoded direct URLs if CKAN API is unreachable
    return [
        {"name": "Tree Census - Part 1", "url": "https://data.opencity.in/dataset/f00d83b8-c70f-4fff-9ac7-9a6ab4255edf/resource/ca2a3fcf-0e9e-4c50-862a-1290155c0fb9/download/db5b5bcb-20f4-42df-89ee-85dee72446da.csv"},
        {"name": "Tree Census - Part 2", "url": "https://data.opencity.in/dataset/f00d83b8-c70f-4fff-9ac7-9a6ab4255edf/resource/f69ee0fb-001d-459d-a87c-c8abee4bd884/download/0a20a244-1731-4f44-addc-56cd4a10d3bf.csv"},
        {"name": "Tree Census - Part 3", "url": "https://data.opencity.in/dataset/f00d83b8-c70f-4fff-9ac7-9a6ab4255edf/resource/11266195-2ef0-413d-b953-c9a4c771aef5/download/9d4847bb-7779-4edd-95bb-127a9c90e3b6.csv"},
        {"name": "Tree Census - Part 4", "url": "https://data.opencity.in/dataset/f00d83b8-c70f-4fff-9ac7-9a6ab4255edf/resource/c6de6d80-f319-466e-a488-aa6ed5b6fd85/download/5490ebe1-a81b-4abb-a712-3da3992754bf.csv"},
        {"name": "Tree Census - Part 5", "url": "https://data.opencity.in/dataset/f00d83b8-c70f-4fff-9ac7-9a6ab4255edf/resource/10d84905-28a4-4dec-8e96-0bbdb543379e/download/f80bd708-7746-4e09-8f91-62dc55d31d34.csv"},
        {"name": "Tree Census - Part 6", "url": "https://data.opencity.in/dataset/f00d83b8-c70f-4fff-9ac7-9a6ab4255edf/resource/0c574dfb-a5a7-4fe0-94bf-007eb67d16dc/download/28abdbf7-726c-475e-ad1d-b25819fbf74a.csv"},
        {"name": "Tree Census - Part 7", "url": "https://data.opencity.in/dataset/f00d83b8-c70f-4fff-9ac7-9a6ab4255edf/resource/d3c00099-7201-464a-8f72-d5df426f9dce/download/a804de00-6e6f-41ae-aeef-769ef2db1f83.csv"},
        {"name": "Tree Census - Part 8", "url": "https://data.opencity.in/dataset/f00d83b8-c70f-4fff-9ac7-9a6ab4255edf/resource/160e6d28-7a7f-439f-aa80-434ca02fc038/download/8052c6c0-c1a3-455e-a8d1-e7e2c5938472.csv"},
        {"name": "Tree Census - Part 9", "url": "https://data.opencity.in/dataset/f00d83b8-c70f-4fff-9ac7-9a6ab4255edf/resource/f5902b14-6822-4c76-8cc3-40d9113bb21b/download/bf2cf429-a2cc-432d-8877-c1bd8a81ea43.csv"},
        {"name": "Tree Census - Part 10", "url": "https://data.opencity.in/dataset/f00d83b8-c70f-4fff-9ac7-9a6ab4255edf/resource/c195db9a-d656-489c-acf7-dabf09f9460e/download/be079045-316a-4778-9bb8-3574120978c6.csv"},
        {"name": "Tree Census - Part 11", "url": "https://data.opencity.in/dataset/f00d83b8-c70f-4fff-9ac7-9a6ab4255edf/resource/3b03de92-b7e3-4869-b9a4-224e755481c7/download/cc44fea1-9b26-434d-845b-bae31e4b3c3b.csv"},
        {"name": "Tree Census - Part 12", "url": "https://data.opencity.in/dataset/f00d83b8-c70f-4fff-9ac7-9a6ab4255edf/resource/22c2fd96-ad3a-4f34-af89-690ad0274dda/download/3733b659-d5a0-4cba-9591-9c72dcd297c6.csv"},
        {"name": "Tree Census - Part 13", "url": "https://data.opencity.in/dataset/f00d83b8-c70f-4fff-9ac7-9a6ab4255edf/resource/e70bd736-ccc7-4162-8e58-a38de7248aab/download/8c560da7-be95-4fc3-8ed6-a1b1d0b87512.csv"},
        {"name": "Tree Census - Part 14", "url": "https://data.opencity.in/dataset/f00d83b8-c70f-4fff-9ac7-9a6ab4255edf/resource/fb0e135a-5ee5-4e26-b850-11901b77063d/download/d33ee2b8-b206-422c-8006-b1d99b3fe494.csv"},
        {"name": "Tree Census - Part 15", "url": "https://data.opencity.in/dataset/f00d83b8-c70f-4fff-9ac7-9a6ab4255edf/resource/4e6c520b-0a3c-40a1-bee2-bbb2f443ea87/download/ca24d160-8b76-4215-bd66-61082476acd9.csv"},
        {"name": "Tree Census - Part 16", "url": "https://data.opencity.in/dataset/f00d83b8-c70f-4fff-9ac7-9a6ab4255edf/resource/c32a8fb8-32c2-4899-84f6-00c29428eb0b/download/d3ab6046-986a-4aaa-8595-722089f99784.csv"},
        {"name": "Tree Census - Part 17", "url": "https://data.opencity.in/dataset/f00d83b8-c70f-4fff-9ac7-9a6ab4255edf/resource/d1fc279c-7905-4fe0-9a55-9a797bd8710a/download/58e49c60-4e2b-4238-9a3e-173d4abccbca.csv"}
    ]

def parse_and_insert_csv_stream(client: httpx.Client, res_name: str, csv_url: str, conn: sqlite3.Connection) -> int:
    """
    Streams and ingests a single CSV partition into SQLite with batch inserts.
    """
    cursor = conn.cursor()
    print(f"\n>> Processing [{res_name}] from {csv_url} ...")

    inserted_count = 0
    
    try:
        with client.stream("GET", csv_url, timeout=120.0) as response:
            if response.status_code != 200:
                print(f" [ERROR] Failed to fetch {res_name}: HTTP {response.status_code}")
                return 0

            lines_iter = response.iter_lines()
            header_line = next(lines_iter, None)
            if not header_line:
                return 0

            fieldnames = [f.strip() for f in header_line.split(",")]

            line_buffer = []
            for line in lines_iter:
                if not line.strip():
                    continue
                line_buffer.append(line)
                
                if len(line_buffer) >= 10000:
                    inserted_count += process_batch(cursor, line_buffer)
                    line_buffer.clear()
                    conn.commit()
                    print(f"   * [{res_name}] Ingested {inserted_count:,} trees...", end="\r")

            if line_buffer:
                inserted_count += process_batch(cursor, line_buffer)
                conn.commit()

        print(f" [OK] [{res_name}] Finished: {inserted_count:,} valid geotagged trees ingested.")
        return inserted_count
    except Exception as e:
        print(f" [ERROR] Error processing {res_name}: {e}")
        conn.commit()
        return inserted_count

def process_batch(cursor: sqlite3.Cursor, lines: List[str]) -> int:
    """
    Parses and sanitizes a batch of CSV rows, then inserts into main and R*Tree tables.
    """
    batch_data = []
    reader = csv.reader(lines)
    
    for row in reader:
        if len(row) < 15:
            continue
        try:
            # Northing = Latitude, Easting = Longitude
            lat_str = row[13].strip() if len(row) > 13 else ""
            lon_str = row[14].strip() if len(row) > 14 else ""
            
            if not lat_str or not lon_str:
                continue

            lat = float(lat_str)
            lon = float(lon_str)

            # Validate Pune bounds
            if not (MIN_LAT <= lat <= MAX_LAT and MIN_LON <= lon <= MAX_LON):
                continue

            girth_str = row[5].strip() if len(row) > 5 else "0"
            height_str = row[6].strip() if len(row) > 6 else "0"
            canopy_str = row[7].strip() if len(row) > 7 else "0"
            
            girth_cm = float(girth_str) if girth_str.replace(".", "", 1).isdigit() else 0.0
            height_m = float(height_str) if height_str.replace(".", "", 1).isdigit() else 0.0
            canopy_m = float(canopy_str) if canopy_str.replace(".", "", 1).isdigit() else 0.0

            condition = row[8].strip() if len(row) > 8 else "Healthy"
            ownership = row[10].strip() if len(row) > 10 else "Public"
            society_name = row[11].strip() if len(row) > 11 else ""
            road_name = row[12].strip() if len(row) > 12 else ""
            ward_name = row[18].strip() if len(row) > 18 else (row[26].strip() if len(row) > 26 else "Pune Central")
            botanical = row[19].strip() if len(row) > 19 else "Tree"
            saar_uid = row[20].strip() if len(row) > 20 and row[20].strip() else f"PMC-{row[1]}"
            common_name = row[21].strip() if len(row) > 21 else botanical
            local_name = row[22].strip() if len(row) > 22 else common_name
            is_rare = 1 if len(row) > 27 and "TRUE" in row[27].upper() else 0

            est_age = int(girth_cm / 5.5) if girth_cm > 0 else 15
            is_heritage = 1 if (girth_cm >= 200 or est_age >= 50) else 0

            batch_data.append((
                saar_uid, lat, lon, botanical, common_name, local_name,
                girth_cm, height_m, canopy_m, condition, ownership,
                ward_name, road_name, society_name, is_rare, is_heritage, est_age
            ))
        except (ValueError, IndexError):
            continue

    if not batch_data:
        return 0

    # Insert into main table (trigger automatically updates tree_census_spatial_idx)
    cursor.executemany("""
    INSERT INTO tree_census (
        saar_uid, latitude, longitude, botanical_name, common_name, local_name_mr,
        girth_cm, height_m, canopy_dia_m, condition, ownership,
        ward_name, road_name, society_name, is_rare, is_heritage, estimated_age_years
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
    """, batch_data)

    return len(batch_data)

def run_ingestion():
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    sys.stderr.reconfigure(encoding='utf-8', errors='replace')

    start_time = time.time()
    init_census_db(DB_PATH)

    resources = get_opencity_resource_urls()
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    }

    conn = sqlite3.connect(str(DB_PATH))
    cursor = conn.cursor()

    # Extreme speed SQLite optimization pragmas during bulk insertion
    cursor.execute("PRAGMA synchronous = OFF;")
    cursor.execute("PRAGMA journal_mode = MEMORY;")
    cursor.execute("PRAGMA cache_size = 100000;")

    total_inserted = 0
    with httpx.Client(headers=headers, timeout=120.0) as client:
        for idx, res in enumerate(resources, 1):
            name = res.get("name", f"Part {idx}")
            url = res.get("url")
            if not url:
                continue
            count = parse_and_insert_csv_stream(client, name, url, conn)
            total_inserted += count

    # Switch back to normal WAL mode
    cursor.execute("PRAGMA journal_mode = WAL;")
    cursor.execute("PRAGMA synchronous = NORMAL;")
    conn.commit()
    conn.close()

    elapsed = time.time() - start_time
    print("\n" + "="*80)
    print(f">> INGESTION COMPLETE: {total_inserted:,} PMC Census trees ingested into {DB_PATH.name}")
    print(f">> Total time elapsed: {elapsed:.1f} seconds")
    print(f">> Database size: {os.path.getsize(DB_PATH) / (1024*1024):.1f} MB")
    print("="*80)

if __name__ == "__main__":
    run_ingestion()
