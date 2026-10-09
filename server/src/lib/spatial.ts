export function distanceMeters(lat1: number, lon1: number, lat2: number, lon2: number) {
  const radians = (n: number) => n * Math.PI / 180;
  const a = Math.sin(radians(lat2 - lat1) / 2) ** 2 + Math.cos(radians(lat1)) * Math.cos(radians(lat2)) * Math.sin(radians(lon2 - lon1) / 2) ** 2;
  return 6_371_000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(Math.max(0, 1 - a)));
}
const hubs: [string, number, number][] = [
  ['Shivajinagar - Ghole Road', 18.5284, 73.8430], ['Kothrud - Bavdhan', 18.5074, 73.8077],
  ['Aundh - Baner', 18.5590, 73.7997], ['Kasba - Vishrambaug Wada', 18.5158, 73.8553],
  ['Nagar Road - Vadgaon Sheri', 18.5679, 73.9143], ['Hadapsar - Mundhwa', 18.5089, 73.9259],
  ['Sinhagad Road', 18.4735, 73.8242], ['Bibwewadi - Dhankawadi', 18.4682, 73.8569],
];
export function locate(lat: number, lon: number) {
  const nearest = hubs.map(([ward, x, y]) => ({ ward, distance: distanceMeters(lat, lon, x, y) })).sort((a, b) => a.distance - b.distance)[0];
  return nearest.distance < 5000
    ? { address_landmark: `Pune Municipal Corporation (${nearest.ward} Ward)`, ward_name: nearest.ward }
    : { address_landmark: `GPS ${lat.toFixed(5)}, ${lon.toFixed(5)}`, ward_name: 'Ward requires on-site confirmation' };
}
