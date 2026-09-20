import math
from typing import List, Tuple, Optional

# Pune Ward Coordinates for Municipal Boundary Geocoding
PUNE_WARD_HUBS = [
    {"ward": "Shivajinagar - Ghole Road", "lat": 18.5284, "lon": 73.8430},
    {"ward": "Kothrud - Bavdhan", "lat": 18.5074, "lon": 73.8077},
    {"ward": "Aundh - Baner", "lat": 18.5590, "lon": 73.7997},
    {"ward": "Kasba - Vishrambaug Wada", "lat": 18.5158, "lon": 73.8553},
    {"ward": "Nagar Road - Vadgaon Sheri", "lat": 18.5679, "lon": 73.9143},
    {"ward": "Hadapsar - Mundhwa", "lat": 18.5089, "lon": 73.9259},
    {"ward": "Sinhagad Road", "lat": 18.4735, "lon": 73.8242},
    {"ward": "Bibwewadi - Dhankawadi", "lat": 18.4682, "lon": 73.8569}
]

def calculate_haversine_distance_meters(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """
    Calculates the great-circle distance between two coordinates in meters.
    """
    R = 6371000.0  # Earth's radius in meters
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)

    a = math.sin(delta_phi / 2.0) ** 2 + \
        math.cos(phi1) * math.cos(phi2) * \
        math.sin(delta_lambda / 2.0) ** 2
    
    c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))
    return R * c

def reverse_geocode_pune(lat: float, lon: float) -> Tuple[str, str]:
    """
    Determines municipal ward from coordinates without fabricating fake landmarks.
    """
    closest_hub = None
    min_dist = float('inf')
    
    for hub in PUNE_WARD_HUBS:
        dist = calculate_haversine_distance_meters(lat, lon, hub["lat"], hub["lon"])
        if dist < min_dist:
            min_dist = dist
            closest_hub = hub
            
    if closest_hub and min_dist < 5000:
        ward = closest_hub["ward"]
        address = f"Pune Municipal Corporation ({ward} Ward)"
        return address, ward
    
    return "Pune Municipal Corporation Area", "PMC Tree Authority Jurisdiction"
