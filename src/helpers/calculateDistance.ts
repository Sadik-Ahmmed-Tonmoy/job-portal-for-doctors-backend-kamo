function toRadians(degrees: number): number {
  if (degrees === undefined || isNaN(degrees)) {
    throw new Error("Invalid degree value");
  }
  return degrees * (Math.PI / 180);
}

export function calculateDistance(
  eventLatitude: number,
  eventLongitude: number,
  userLatitude: number,
  userLongitude: number
): number {
  const R = 3959;
  const φ1 = toRadians(eventLatitude);
  const φ2 = toRadians(userLatitude);

  const Δφ = toRadians(userLatitude - eventLatitude);
  const Δλ = toRadians(userLongitude - eventLongitude);
  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  const distance = R * c;
  return distance;
}
