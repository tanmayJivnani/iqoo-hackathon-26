import math
from typing import List, Tuple, Optional

# Pune Ward Coordinates & Major Hubs for Offline / Resilient Geocoding
PUNE_WARD_HUBS = [
    {"ward": "Shivajinagar - Ghole Road", "lat": 18.5284, "lon": 73.8430, "landmarks": ["Fergusson College Road", "JM Road", "Ghole Road", "Model Colony"]},
    {"ward": "Kothrud - Bavdhan", "lat": 18.5074, "lon": 73.8077, "landmarks": ["Paud Road", "Karve Statue", "Chandani Chowk", "MIT College Area"]},
    {"ward": "Aundh - Baner", "lat": 18.5590, "lon": 73.7997, "landmarks": ["Baner Road", "Aundh DP Road", "Parihar Chowk", "Balewadi High St"]},
    {"ward": "Kasba - Vishrambaug Wada", "lat": 18.5158, "lon": 73.8553, "landmarks": ["Shaniwar Wada", "Laxmi Road", "Appa Balwant Chowk", "Bajirao Road"]},
    {"ward": "Viman Nagar - Nagar Road", "lat": 18.5679, "lon": 73.9143, "landmarks": ["Symbiosis Campus", "Phoenix Mall Road", "Datta Mandir Chowk", "Kalyani Nagar Bridge"]},
    {"ward": "Hadapsar - Mundhwa", "lat": 18.5089, "lon": 73.9259, "landmarks": ["Magarpatta City", "Pune-Solapur Highway", "Mundhwa Flyover", "Gadital"]},
    {"ward": "Sinhagad Road", "lat": 18.4735, "lon": 73.8242, "landmarks": ["Pu La Deshpande Garden", "Manik Baug", "Dhayari Phata", "Vadgaon Bridge"]},
    {"ward": "Bibwewadi - Dhankawadi", "lat": 18.4682, "lon": 73.8569, "landmarks": ["Padmavati Temple", "Katheeb Karkhana", "Sahakar Nagar", "KK Market"]}
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
    Provides human-readable Pune address and ward based on nearest cluster.
    """
    closest_hub = None
    min_dist = float('inf')
    
    for hub in PUNE_WARD_HUBS:
        dist = calculate_haversine_distance_meters(lat, lon, hub["lat"], hub["lon"])
        if dist < min_dist:
            min_dist = dist
            closest_hub = hub
            
    if closest_hub and min_dist < 6000: # Within 6km of a known ward center
        landmark = closest_hub["landmarks"][0]
        ward = closest_hub["ward"]
        address = f"Near {landmark}, {ward}, Pune, Maharashtra (Coordinates: {lat:.5f}° N, {lon:.5f}° E)"
        return address, ward
    
    return f"Pune Municipal Area (Coordinates: {lat:.5f}° N, {lon:.5f}° E)", "Pune Urban Ward"
