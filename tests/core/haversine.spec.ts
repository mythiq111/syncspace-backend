// tests/core/haversine.spec.ts

import { calculateHaversineDistance, isWithinGeofence } from '../../shared/utils/haversine';

describe('Haversine Distance & Geofence Validation', () => {
  const officeLat = 17.6868;
  const officeLng = 83.2185;
  const radiusMeters = 200;

  it('should return 0 meters for identical coordinates', () => {
    const dist = calculateHaversineDistance(officeLat, officeLng, officeLat, officeLng);
    expect(dist).toBeCloseTo(0, 1);
  });

  it('should correctly evaluate device within 200m radius', () => {
    // Offset by roughly ~50 meters
    const nearbyLat = 17.6871;
    const nearbyLng = 83.2187;

    const result = isWithinGeofence(nearbyLat, nearbyLng, officeLat, officeLng, radiusMeters);
    expect(result.isInside).toBe(true);
    expect(result.distanceMeters).toBeLessThan(radiusMeters);
  });

  it('should correctly reject device outside 200m radius', () => {
    // Offset by ~2 km
    const farLat = 17.7000;
    const farLng = 83.2300;

    const result = isWithinGeofence(farLat, farLng, officeLat, officeLng, radiusMeters);
    expect(result.isInside).toBe(false);
    expect(result.distanceMeters).toBeGreaterThan(radiusMeters);
  });
});
