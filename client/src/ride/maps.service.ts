import { apiRequest } from '@/src/config/api';

export interface RoadRoute { coordinates: [number, number][]; durationMin: number; distanceKm: number; source: 'OSRM'; trafficAware: false; }
export interface MapPlace { id: string; label: string; latitude: number; longitude: number; stopId: string | null; stopName: string | null; }
type Coord = { latitude: number; longitude: number };
const routes = new Map<string, { expires: number; value: Promise<RoadRoute> }>();
export function getRoadRoute(points: Coord[]): Promise<RoadRoute> {
  const coordinates = points.map(point => `${point.longitude.toFixed(5)},${point.latitude.toFixed(5)}`).join(';');
  const cached = routes.get(coordinates);
  if (cached && cached.expires > Date.now()) return cached.value;
  const value = apiRequest<{ route: RoadRoute }>('/maps/route?' + new URLSearchParams({ coordinates })).then(result => {
    if (!result.route || !Array.isArray(result.route.coordinates)) throw new Error('Road route unavailable');
    return result.route;
  }).catch(error => { routes.delete(coordinates); throw error; });
  if (routes.size >= 64) routes.delete(routes.keys().next().value!);
  routes.set(coordinates, { value, expires: Date.now() + 3600000 });
  return value;
}
export const searchPlaces = async (q: string) => (await apiRequest<{ places: MapPlace[] }>('/maps/search?' + new URLSearchParams({ q }))).places || [];
export const reversePlace = async (point: Coord) => (await apiRequest<{ place: MapPlace | null }>('/maps/reverse?' + new URLSearchParams({ lat: String(point.latitude), lon: String(point.longitude) }))).place;
