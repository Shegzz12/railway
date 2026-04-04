// Coordinate utilities for geospatial calculations

import type { Coordinates, DEMData } from '@/lib/types/spatial-types'

// Earth radius in kilometers
const EARTH_RADIUS_KM = 6371

/**
 * Calculate the Haversine distance between two coordinates in kilometers
 */
export function haversineDistance(point1: Coordinates, point2: Coordinates): number {
  const lat1Rad = toRadians(point1.lat)
  const lat2Rad = toRadians(point2.lat)
  const deltaLat = toRadians(point2.lat - point1.lat)
  const deltaLng = toRadians(point2.lng - point1.lng)

  const a =
    Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
    Math.cos(lat1Rad) * Math.cos(lat2Rad) * Math.sin(deltaLng / 2) * Math.sin(deltaLng / 2)

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))

  return EARTH_RADIUS_KM * c
}

/**
 * Convert degrees to radians
 */
export function toRadians(degrees: number): number {
  return degrees * (Math.PI / 180)
}

/**
 * Convert radians to degrees
 */
export function toDegrees(radians: number): number {
  return radians * (180 / Math.PI)
}

/**
 * Calculate the bearing from point1 to point2 in degrees
 */
export function calculateBearing(point1: Coordinates, point2: Coordinates): number {
  const lat1Rad = toRadians(point1.lat)
  const lat2Rad = toRadians(point2.lat)
  const deltaLngRad = toRadians(point2.lng - point1.lng)

  const y = Math.sin(deltaLngRad) * Math.cos(lat2Rad)
  const x =
    Math.cos(lat1Rad) * Math.sin(lat2Rad) -
    Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(deltaLngRad)

  const bearingRad = Math.atan2(y, x)
  const bearingDeg = toDegrees(bearingRad)

  return (bearingDeg + 360) % 360
}

/**
 * Calculate a destination point given start, bearing, and distance
 */
export function destinationPoint(
  start: Coordinates,
  bearingDeg: number,
  distanceKm: number
): Coordinates {
  const lat1Rad = toRadians(start.lat)
  const lng1Rad = toRadians(start.lng)
  const bearingRad = toRadians(bearingDeg)
  const angularDistance = distanceKm / EARTH_RADIUS_KM

  const lat2Rad = Math.asin(
    Math.sin(lat1Rad) * Math.cos(angularDistance) +
      Math.cos(lat1Rad) * Math.sin(angularDistance) * Math.cos(bearingRad)
  )

  const lng2Rad =
    lng1Rad +
    Math.atan2(
      Math.sin(bearingRad) * Math.sin(angularDistance) * Math.cos(lat1Rad),
      Math.cos(angularDistance) - Math.sin(lat1Rad) * Math.sin(lat2Rad)
    )

  return {
    lat: toDegrees(lat2Rad),
    lng: toDegrees(lng2Rad),
  }
}

/**
 * Calculate gradient percentage between two points
 */
export function calculateGradient(
  point1: Coordinates & { elevation?: number },
  point2: Coordinates & { elevation?: number }
): number {
  if (point1.elevation === undefined || point2.elevation === undefined) {
    return 0
  }

  const horizontalDistance = haversineDistance(point1, point2) * 1000 // Convert to meters
  if (horizontalDistance === 0) return 0

  const elevationChange = Math.abs(point2.elevation - point1.elevation)
  return (elevationChange / horizontalDistance) * 100
}

/**
 * Get elevation from DEM at a specific coordinate
 */
export function getElevationFromDEM(
  coord: Coordinates,
  dem: DEMData
): number | null {
  const [minLng, minLat, maxLng, maxLat] = dem.bounds

  // Check if coordinate is within DEM bounds
  if (
    coord.lng < minLng ||
    coord.lng > maxLng ||
    coord.lat < minLat ||
    coord.lat > maxLat
  ) {
    return null
  }

  // Calculate pixel position
  const xRatio = (coord.lng - minLng) / (maxLng - minLng)
  const yRatio = (maxLat - coord.lat) / (maxLat - minLat) // Y is inverted

  const col = Math.floor(xRatio * (dem.width - 1))
  const row = Math.floor(yRatio * (dem.height - 1))

  const index = row * dem.width + col

  if (index < 0 || index >= dem.elevation.length) {
    return null
  }

  const elevation = dem.elevation[index]

  // Check for no-data value
  if (elevation === dem.noDataValue) {
    return null
  }

  return elevation
}

/**
 * Interpolate coordinates along a line at regular intervals
 */
export function interpolateCoordinates(
  start: Coordinates,
  end: Coordinates,
  intervalKm: number
): Coordinates[] {
  const totalDistance = haversineDistance(start, end)
  const numPoints = Math.max(2, Math.ceil(totalDistance / intervalKm))
  const points: Coordinates[] = []

  for (let i = 0; i <= numPoints; i++) {
    const fraction = i / numPoints
    points.push({
      lat: start.lat + (end.lat - start.lat) * fraction,
      lng: start.lng + (end.lng - start.lng) * fraction,
    })
  }

  return points
}

/**
 * Calculate bounding box for an array of coordinates
 */
export function calculateBounds(
  coords: Coordinates[]
): [[number, number], [number, number]] {
  if (coords.length === 0) {
    return [
      [0, 0],
      [0, 0],
    ]
  }

  let minLat = coords[0].lat
  let maxLat = coords[0].lat
  let minLng = coords[0].lng
  let maxLng = coords[0].lng

  for (const coord of coords) {
    minLat = Math.min(minLat, coord.lat)
    maxLat = Math.max(maxLat, coord.lat)
    minLng = Math.min(minLng, coord.lng)
    maxLng = Math.max(maxLng, coord.lng)
  }

  return [
    [minLat, minLng],
    [maxLat, maxLng],
  ]
}

/**
 * Convert meters to degrees at a given latitude (approximate)
 */
export function metersToDegreesLat(meters: number): number {
  return meters / 111320
}

export function metersToDegreesLng(meters: number, latitude: number): number {
  return meters / (111320 * Math.cos(toRadians(latitude)))
}
