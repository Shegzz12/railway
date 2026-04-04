// Raster data utilities for processing GeoTIFF datasets

import type { DEMData, Coordinates } from '@/lib/types/spatial-types'

/**
 * Sample raster value at specific geographic coordinates
 * Uses bilinear interpolation for smooth value estimation
 */
export function sampleRasterValue(
  rasterData: DEMData,
  coords: Coordinates
): number {
  const { bounds, width, height, elevation, noDataValue } = rasterData

  const [minLng, minLat, maxLng, maxLat] = bounds

  // Check if coordinate is within bounds
  if (coords.lng < minLng || coords.lng > maxLng || coords.lat < minLat || coords.lat > maxLat) {
    return noDataValue
  }

  // Calculate pixel coordinates
  const xRatio = (coords.lng - minLng) / (maxLng - minLng)
  const yRatio = (maxLat - coords.lat) / (maxLat - minLat)

  const xPixel = xRatio * (width - 1)
  const yPixel = yRatio * (height - 1)

  const x0 = Math.floor(xPixel)
  const x1 = Math.ceil(xPixel)
  const y0 = Math.floor(yPixel)
  const y1 = Math.ceil(yPixel)

  // Bilinear interpolation
  const fx = xPixel - x0
  const fy = yPixel - y0

  const getPixelValue = (px: number, py: number): number => {
    if (px < 0 || px >= width || py < 0 || py >= height) {
      return noDataValue
    }
    const idx = py * width + px
    return elevation[idx]
  }

  const v00 = getPixelValue(x0, y0)
  const v10 = getPixelValue(x1, y0)
  const v01 = getPixelValue(x0, y1)
  const v11 = getPixelValue(x1, y1)

  if (v00 === noDataValue || v10 === noDataValue || v01 === noDataValue || v11 === noDataValue) {
    return noDataValue
  }

  const v0 = v00 * (1 - fx) + v10 * fx
  const v1 = v01 * (1 - fx) + v11 * fx
  const value = v0 * (1 - fy) + v1 * fy

  return value
}

/**
 * Calculate gradient (slope) between two points using elevation data
 */
export function calculateGradient(
  point1: Coordinates,
  point2: Coordinates,
  dem: DEMData | null
): number {
  if (!dem) return 0

  const elev1 = sampleRasterValue(dem, point1)
  const elev2 = sampleRasterValue(dem, point2)

  if (elev1 === dem.noDataValue || elev2 === dem.noDataValue) {
    return 0
  }

  // Distance in meters
  const latDiff = point2.lat - point1.lat
  const lngDiff = point2.lng - point1.lng

  // Approximate meters per degree at equator (adjust for latitude)
  const metersPerDegreeLat = 111000
  const metersPerDegreeLng = 111000 * Math.cos((point1.lat * Math.PI) / 180)

  const distY = latDiff * metersPerDegreeLat
  const distX = lngDiff * metersPerDegreeLng
  const horizontalDistance = Math.sqrt(distX * distX + distY * distY)

  if (horizontalDistance === 0) return 0

  const elevDiff = elev2 - elev1
  const gradient = (elevDiff / horizontalDistance) * 100 // As percentage

  return Math.abs(gradient)
}

/**
 * Generate cost grid from multiple raster datasets
 * Combines DEM, drainage, LULC, slope into a unified cost surface
 */
export function generateCostGrid(
  bounds: [number, number, number, number],
  resolution: number,
  dem: DEMData | null,
  rasters: DEMData[] | null
): Map<string, number> {
  const costGrid = new Map<string, number>()

  const [minLng, minLat, maxLng, maxLat] = bounds

  // Calculate grid size based on resolution
  const metersPerDegreeLat = 111000
  const latSteps = Math.ceil(((maxLat - minLat) * metersPerDegreeLat) / resolution)
  const lngSteps = Math.ceil(((maxLng - minLng) * metersPerDegreeLat * Math.cos((minLat * Math.PI) / 180)) / resolution)

  for (let row = 0; row < latSteps; row++) {
    for (let col = 0; col < lngSteps; col++) {
      const lat = minLat + (row / latSteps) * (maxLat - minLat)
      const lng = minLng + (col / lngSteps) * (maxLng - minLng)

      const key = `${row},${col}`
      let cost = 1 // Base cost

      // Add elevation/gradient cost from DEM
      if (dem) {
        const elevation = sampleRasterValue(dem, { lat, lng })
        if (elevation !== dem.noDataValue) {
          // Normalize elevation (0-1) and add to cost
          const normElev = (elevation - dem.min) / (dem.max - dem.min)
          cost += normElev * 0.5 // Up to 50% cost increase based on elevation
        }
      }

      // Add costs from other rasters (slope, drainage, LULC)
      if (rasters && rasters.length > 0) {
        rasters.forEach((raster) => {
          const value = sampleRasterValue(raster, { lat, lng })
          if (value !== raster.noDataValue) {
            // Normalize and add cost
            const normValue = (value - raster.min) / (raster.max - raster.min + 0.0001)
            cost += normValue * 0.3 // Up to 30% cost per raster
          }
        })
      }

      costGrid.set(key, cost)
    }
  }

  return costGrid
}

/**
 * Get elevation profile along a route
 */
export function getElevationProfile(
  waypoints: Array<Coordinates>,
  dem: DEMData | null
): Array<{ distance: number; elevation: number }> {
  const profile: Array<{ distance: number; elevation: number }> = []

  if (!dem) {
    return waypoints.map((wp, i) => ({ distance: i, elevation: 0 }))
  }

  let cumulativeDistance = 0

  waypoints.forEach((wp, i) => {
    const elevation = sampleRasterValue(dem, wp)

    profile.push({
      distance: cumulativeDistance,
      elevation: elevation === dem.noDataValue ? 0 : elevation,
    })

    if (i < waypoints.length - 1) {
      const nextWp = waypoints[i + 1]
      const latDiff = nextWp.lat - wp.lat
      const lngDiff = nextWp.lng - wp.lng

      const metersPerDegreeLat = 111000
      const metersPerDegreeLng = 111000 * Math.cos((wp.lat * Math.PI) / 180)

      const distY = latDiff * metersPerDegreeLat
      const distX = lngDiff * metersPerDegreeLng
      const segmentDistance = Math.sqrt(distX * distX + distY * distY) / 1000 // Convert to km

      cumulativeDistance += segmentDistance
    }
  })

  return profile
}

/**
 * Extract area around route as bounds with padding
 */
export function getRouteBounds(
  waypoints: Array<Coordinates>,
  paddingKm: number = 2
): [number, number, number, number] {
  let minLat = waypoints[0].lat
  let maxLat = waypoints[0].lat
  let minLng = waypoints[0].lng
  let maxLng = waypoints[0].lng

  waypoints.forEach((wp) => {
    minLat = Math.min(minLat, wp.lat)
    maxLat = Math.max(maxLat, wp.lat)
    minLng = Math.min(minLng, wp.lng)
    maxLng = Math.max(maxLng, wp.lng)
  })

  // Add padding (rough approximation)
  const paddingDegrees = paddingKm / 111

  return [minLng - paddingDegrees, minLat - paddingDegrees, maxLng + paddingDegrees, maxLat + paddingDegrees]
}
