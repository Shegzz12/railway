// Geometry utilities for spatial operations

import type { Coordinates, GeoJSON } from '@/lib/types/spatial-types'

/**
 * Check if a point is inside a polygon using ray casting algorithm
 */
export function pointInPolygon(
  point: Coordinates,
  polygon: Array<[number, number]>
): boolean {
  const x = point.lng
  const y = point.lat
  let inside = false

  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i][0]
    const yi = polygon[i][1]
    const xj = polygon[j][0]
    const yj = polygon[j][1]

    const intersect =
      yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi

    if (intersect) inside = !inside
  }

  return inside
}

/**
 * Check if a point is inside any geometry in a GeoJSON feature
 */
export function pointInFeature(
  point: Coordinates,
  feature: GeoJSON.Feature
): boolean {
  const geometry = feature.geometry

  switch (geometry.type) {
    case 'Polygon':
      return pointInPolygonRings(point, geometry.coordinates)

    case 'MultiPolygon':
      return geometry.coordinates.some((polygon) =>
        pointInPolygonRings(point, polygon)
      )

    case 'Point': {
      const [lng, lat] = geometry.coordinates
      // Check if point is within small radius (for point features)
      const distance = Math.sqrt(
        Math.pow(point.lat - lat, 2) + Math.pow(point.lng - lng, 2)
      )
      return distance < 0.0001 // ~10 meters
    }

    case 'LineString':
      return isPointNearLine(point, geometry.coordinates, 0.0001)

    case 'MultiLineString':
      return geometry.coordinates.some((line) =>
        isPointNearLine(point, line, 0.0001)
      )

    default:
      return false
  }
}

/**
 * Check if point is inside polygon with holes (ring structure)
 */
function pointInPolygonRings(
  point: Coordinates,
  rings: Array<Array<[number, number] | [number, number, number]>>
): boolean {
  // First ring is exterior, subsequent rings are holes
  const exteriorRing = rings[0].map(
    (coord) => [coord[0], coord[1]] as [number, number]
  )

  if (!pointInPolygon(point, exteriorRing)) {
    return false
  }

  // Check if point is in any hole
  for (let i = 1; i < rings.length; i++) {
    const holeRing = rings[i].map(
      (coord) => [coord[0], coord[1]] as [number, number]
    )
    if (pointInPolygon(point, holeRing)) {
      return false
    }
  }

  return true
}

/**
 * Check if a point is near a line (within threshold)
 */
function isPointNearLine(
  point: Coordinates,
  line: Array<[number, number] | [number, number, number]>,
  threshold: number
): boolean {
  for (let i = 0; i < line.length - 1; i++) {
    const [x1, y1] = line[i]
    const [x2, y2] = line[i + 1]

    const distance = pointToLineDistance(point, { lng: x1, lat: y1 }, { lng: x2, lat: y2 })

    if (distance < threshold) {
      return true
    }
  }

  return false
}

/**
 * Calculate minimum distance from a point to a line segment
 */
function pointToLineDistance(
  point: Coordinates,
  lineStart: Coordinates,
  lineEnd: Coordinates
): number {
  const A = point.lng - lineStart.lng
  const B = point.lat - lineStart.lat
  const C = lineEnd.lng - lineStart.lng
  const D = lineEnd.lat - lineStart.lat

  const dot = A * C + B * D
  const lenSq = C * C + D * D
  let param = -1

  if (lenSq !== 0) {
    param = dot / lenSq
  }

  let xx: number
  let yy: number

  if (param < 0) {
    xx = lineStart.lng
    yy = lineStart.lat
  } else if (param > 1) {
    xx = lineEnd.lng
    yy = lineEnd.lat
  } else {
    xx = lineStart.lng + param * C
    yy = lineStart.lat + param * D
  }

  const dx = point.lng - xx
  const dy = point.lat - yy

  return Math.sqrt(dx * dx + dy * dy)
}

/**
 * Check if point intersects any feature in a feature collection
 */
export function pointInFeatureCollection(
  point: Coordinates,
  collection: GeoJSON.FeatureCollection
): boolean {
  return collection.features.some((feature) => pointInFeature(point, feature))
}

/**
 * Buffer a point by a certain distance (create a circle polygon)
 */
export function bufferPoint(
  point: Coordinates,
  radiusDegrees: number,
  numPoints: number = 32
): Array<[number, number]> {
  const points: Array<[number, number]> = []

  for (let i = 0; i < numPoints; i++) {
    const angle = (i / numPoints) * 2 * Math.PI
    const lng = point.lng + radiusDegrees * Math.cos(angle)
    const lat = point.lat + radiusDegrees * Math.sin(angle)
    points.push([lng, lat])
  }

  // Close the ring
  points.push(points[0])

  return points
}

/**
 * Calculate the area of a polygon in square degrees
 */
export function polygonArea(polygon: Array<[number, number]>): number {
  let area = 0
  const n = polygon.length

  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n
    area += polygon[i][0] * polygon[j][1]
    area -= polygon[j][0] * polygon[i][1]
  }

  return Math.abs(area) / 2
}

/**
 * Simplify a line using Ramer-Douglas-Peucker algorithm
 */
export function simplifyLine(
  points: Coordinates[],
  tolerance: number
): Coordinates[] {
  if (points.length <= 2) {
    return points
  }

  // Find the point with the maximum distance from the line
  let maxDistance = 0
  let maxIndex = 0

  const start = points[0]
  const end = points[points.length - 1]

  for (let i = 1; i < points.length - 1; i++) {
    const distance = perpendicularDistance(points[i], start, end)
    if (distance > maxDistance) {
      maxDistance = distance
      maxIndex = i
    }
  }

  // If max distance is greater than tolerance, recursively simplify
  if (maxDistance > tolerance) {
    const leftPoints = simplifyLine(points.slice(0, maxIndex + 1), tolerance)
    const rightPoints = simplifyLine(points.slice(maxIndex), tolerance)

    // Concatenate results (removing duplicate middle point)
    return leftPoints.slice(0, -1).concat(rightPoints)
  }

  // Return just start and end points
  return [start, end]
}

/**
 * Calculate perpendicular distance from point to line
 */
function perpendicularDistance(
  point: Coordinates,
  lineStart: Coordinates,
  lineEnd: Coordinates
): number {
  const dx = lineEnd.lng - lineStart.lng
  const dy = lineEnd.lat - lineStart.lat

  const lengthSq = dx * dx + dy * dy

  if (lengthSq === 0) {
    // Line start and end are the same point
    return Math.sqrt(
      Math.pow(point.lng - lineStart.lng, 2) +
        Math.pow(point.lat - lineStart.lat, 2)
    )
  }

  // Calculate perpendicular distance using cross product
  const cross = Math.abs(
    dx * (lineStart.lat - point.lat) - dy * (lineStart.lng - point.lng)
  )

  return cross / Math.sqrt(lengthSq)
}

/**
 * Smooth a line using Chaikin's algorithm
 */
export function smoothLine(
  points: Coordinates[],
  iterations: number = 2
): Coordinates[] {
  if (points.length < 3) {
    return points
  }

  let result = [...points]

  for (let iter = 0; iter < iterations; iter++) {
    const smoothed: Coordinates[] = [result[0]]

    for (let i = 0; i < result.length - 1; i++) {
      const p0 = result[i]
      const p1 = result[i + 1]

      // Create two new points at 25% and 75% of the segment
      smoothed.push({
        lat: p0.lat * 0.75 + p1.lat * 0.25,
        lng: p0.lng * 0.75 + p1.lng * 0.25,
      })
      smoothed.push({
        lat: p0.lat * 0.25 + p1.lat * 0.75,
        lng: p0.lng * 0.25 + p1.lng * 0.75,
      })
    }

    smoothed.push(result[result.length - 1])
    result = smoothed
  }

  return result
}
