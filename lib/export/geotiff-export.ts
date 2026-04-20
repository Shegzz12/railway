// GeoTIFF export utilities for routes and surrounding areas

import type { DEMData, RoutePoint, Coordinates } from '@/lib/types/spatial-types'
import { getRouteBounds } from '@/lib/spatial/raster-utils'

/**
 * Extract raster data for a specific area bounded by route
 */
export function extractAreaAroundRoute(
  dem: DEMData,
  waypoints: RoutePoint[],
  paddingKm: number = 2
): DEMData {
  const bounds = getRouteBounds(waypoints, paddingKm)
  const [minLng, minLat, maxLng, maxLat] = bounds

  const [originalMinLng, originalMinLat, originalMaxLng, originalMaxLat] = dem.bounds

  // Calculate pixel coordinates in original raster
  const xMinRatio = (minLng - originalMinLng) / (originalMaxLng - originalMinLng)
  const xMaxRatio = (maxLng - originalMinLng) / (originalMaxLng - originalMinLng)
  const yMinRatio = (originalMaxLat - maxLat) / (originalMaxLat - originalMinLat)
  const yMaxRatio = (originalMaxLat - minLat) / (originalMaxLat - originalMinLat)

  const xMin = Math.max(0, Math.floor(xMinRatio * dem.width))
  const xMax = Math.min(dem.width - 1, Math.ceil(xMaxRatio * dem.width))
  const yMin = Math.max(0, Math.floor(yMinRatio * dem.height))
  const yMax = Math.min(dem.height - 1, Math.ceil(yMaxRatio * dem.height))

  const newWidth = xMax - xMin
  const newHeight = yMax - yMin

  // Extract elevation data
  const newElevation = new Float32Array(newWidth * newHeight)

  let min = Infinity
  let max = -Infinity

  for (let y = 0; y < newHeight; y++) {
    for (let x = 0; x < newWidth; x++) {
      const srcIdx = (y + yMin) * dem.width + (x + xMin)
      const dstIdx = y * newWidth + x
      const value = dem.elevation[srcIdx]
      newElevation[dstIdx] = value

      if (value !== dem.noDataValue) {
        min = Math.min(min, value)
        max = Math.max(max, value)
      }
    }
  }

  return {
    width: newWidth,
    height: newHeight,
    bounds: bounds,
    elevation: newElevation,
    resolution: dem.resolution,
    noDataValue: dem.noDataValue,
    min: min === Infinity ? dem.min : min,
    max: max === -Infinity ? dem.max : max,
  }
}

/**
 * Convert DEMData to GeoTIFF format (simplified)
 * For production, use a GeoTIFF library like geotiff.js
 */
export function demToGeoTIFFBuffer(dem: DEMData, filename: string = 'route_area.tif'): Blob {
  // Create a simple TIFF header and data
  // This is a minimal implementation - for production use proper GeoTIFF library

  const buffer = new ArrayBuffer(4 + dem.width * dem.height * 4 + 256) // Header + data + metadata

  // Write header
  const view = new Uint8Array(buffer)

  // TIFF magic number (little-endian)
  view[0] = 0x49
  view[1] = 0x49
  view[2] = 0x2a
  view[3] = 0x00

  // Write width and height at offset 4
  const widthView = new Uint32Array(buffer, 4, 1)
  widthView[0] = dem.width

  const heightView = new Uint32Array(buffer, 8, 1)
  heightView[0] = dem.height

  // Write bounds (geo-reference) at offset 12
  const boundsView = new Float64Array(buffer, 12, 4)
  boundsView[0] = dem.bounds[0] // minLng
  boundsView[1] = dem.bounds[1] // minLat
  boundsView[2] = dem.bounds[2] // maxLng
  boundsView[3] = dem.bounds[3] // maxLat

  // Write elevation data (starting at offset 44)
  const elevationView = new Float32Array(buffer, 44)
  for (let i = 0; i < dem.elevation.length; i++) {
    elevationView[i] = dem.elevation[i]
  }

  // Create blob with proper MIME type
  return new Blob([view], { type: 'image/tiff' })
}

/**
 * Generate downloadable GeoTIFF file for route area
 */
export function downloadRouteAreaAsGeoTIFF(dem: DEMData, filename: string = 'route_area.tif'): void {
  const blob = demToGeoTIFFBuffer(dem, filename)
  const url = URL.createObjectURL(blob)

  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)

  URL.revokeObjectURL(url)
}

/**
 * Export elevation profile as CSV
 */
export function exportElevationProfileAsCSV(
  profile: Array<{ distance: number; elevation: number }>,
  filename: string = 'elevation_profile.csv'
): void {
  let csv = 'Distance (km),Elevation (m)\n'
  profile.forEach((point) => {
    csv += `${point.distance.toFixed(3)},${point.elevation.toFixed(1)}\n`
  })

  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)

  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)

  URL.revokeObjectURL(url)
}
