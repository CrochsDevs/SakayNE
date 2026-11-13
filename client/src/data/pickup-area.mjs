// Town centers identify the existing fare area only; they are never the GPS pickup pin.
export function nearestPickupArea(position, towns) {
  if (!position || !Number.isFinite(position.latitude) || Math.abs(position.latitude) > 90
    || !Number.isFinite(position.longitude) || Math.abs(position.longitude) > 180) return null;
  const radians = value => value * Math.PI / 180;
  let nearest = null;
  let distance = Infinity;
  for (const town of towns) {
    const a = Math.sin(radians(town.lat - position.latitude) / 2) ** 2
      + Math.cos(radians(position.latitude)) * Math.cos(radians(town.lat)) * Math.sin(radians(town.lng - position.longitude) / 2) ** 2;
    const meters = 6371000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(Math.max(0, 1 - a)));
    if (meters < distance) { distance = meters; nearest = town; }
  }
  return nearest ? { town: nearest, distanceMeters: distance } : null;
}

export function findPickupArea(position, towns) {
  const nearest = nearestPickupArea(position, towns);
  return nearest && nearest.distanceMeters <= 15000 ? nearest.town : null;
}

export function findRoutePickupArea(position, towns, route) {
  if (!route) return null;
  // Catalog town centers describe fare areas, not exact roads or service boundaries.
  // Match against this route's towns, rather than rejecting a nearby non-route town.
  const nearest = nearestPickupArea(position, towns.filter(town => route.stops.some(stop => stop.townId === town.id)));
  return nearest && nearest.distanceMeters <= 15000 ? nearest.town : null;
}
