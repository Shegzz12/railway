// Unified file parser for spatial data

import type { SpatialDataset, GeoJSON, DEMData } from '@/lib/types/spatial-types'
import { calculateBounds } from '@/lib/spatial/coordinate-utils'
import Papa from 'papaparse'
import * as GeoTIFF from 'geotiff'
import shp from 'shpjs'

// Color palette for datasets
const DATASET_COLORS = [
  '#3b82f6', // blue
  '#22c55e', // green
  '#f59e0b', // amber
  '#8b5cf6', // violet
  '#ec4899', // pink
  '#14b8a6', // teal
  '#f97316', // orange
  '#06b6d4', // cyan
]

let colorIndex = 0

function getNextColor(): string {
  const color = DATASET_COLORS[colorIndex % DATASET_COLORS.length]
  colorIndex++
  return color
}

/**
 * Parse a file and return a SpatialDataset
 */
export async function parseFile(file: File): Promise<SpatialDataset> {
  const extension = file.name.split('.').pop()?.toLowerCase()

  switch (extension) {
    case 'json':
    case 'geojson':
      return parseGeoJSON(file)

    case 'csv':
      return parseCSV(file)

    case 'tif':
    case 'tiff':
      return parseGeoTIFF(file)

    case 'zip':
      return parseShapefile(file)

    case 'shp':
      throw new Error(
        'Please upload a ZIP file containing the complete shapefile (.shp, .shx, .dbf, .prj)'
      )

    default:
      throw new Error(`Unsupported file format: ${extension}`)
  }
}

/**
 * Parse GeoJSON file
 */
async function parseGeoJSON(file: File): Promise<SpatialDataset> {
  const text = await file.text()
  const data = JSON.parse(text)

  let featureCollection: GeoJSON.FeatureCollection

  if (data.type === 'FeatureCollection') {
    featureCollection = data as GeoJSON.FeatureCollection
  } else if (data.type === 'Feature') {
    featureCollection = {
      type: 'FeatureCollection',
      features: [data as GeoJSON.Feature],
    }
  } else if (data.type) {
    // It's a geometry
    featureCollection = {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          geometry: data as GeoJSON.Geometry,
          properties: {},
        },
      ],
    }
  } else {
    throw new Error('Invalid GeoJSON format')
  }

  const bounds = extractBoundsFromFeatureCollection(featureCollection)

  return {
    id: crypto.randomUUID(),
    name: file.name,
    type: 'geojson',
    data: featureCollection,
    visible: true,
    isObstacle: false,
    color: getNextColor(),
    bounds,
  }
}

/**
 * Parse CSV file with lat/lng columns
 */
async function parseCSV(file: File): Promise<SpatialDataset> {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        try {
          const features: GeoJSON.Feature[] = []
          const possibleLatColumns = ['lat', 'latitude', 'y', 'LAT', 'LATITUDE', 'Y']
          const possibleLngColumns = ['lng', 'lon', 'longitude', 'x', 'LNG', 'LON', 'LONGITUDE', 'X']

          // Find lat/lng column names
          const headers = results.meta.fields || []
          const latColumn = headers.find((h) =>
            possibleLatColumns.includes(h)
          )
          const lngColumn = headers.find((h) =>
            possibleLngColumns.includes(h)
          )

          if (!latColumn || !lngColumn) {
            throw new Error(
              'CSV must contain latitude and longitude columns (lat/lng, latitude/longitude, or y/x)'
            )
          }

          for (const row of results.data as Record<string, string>[]) {
            const lat = parseFloat(row[latColumn])
            const lng = parseFloat(row[lngColumn])

            if (isNaN(lat) || isNaN(lng)) continue

            features.push({
              type: 'Feature',
              geometry: {
                type: 'Point',
                coordinates: [lng, lat],
              },
              properties: { ...row },
            })
          }

          if (features.length === 0) {
            throw new Error('No valid coordinates found in CSV')
          }

          const featureCollection: GeoJSON.FeatureCollection = {
            type: 'FeatureCollection',
            features,
          }

          const bounds = extractBoundsFromFeatureCollection(featureCollection)

          resolve({
            id: crypto.randomUUID(),
            name: file.name,
            type: 'csv',
            data: featureCollection,
            visible: true,
            isObstacle: false,
            color: getNextColor(),
            bounds,
          })
        } catch (error) {
          reject(error)
        }
      },
      error: (error) => {
        reject(new Error(`CSV parsing error: ${error.message}`))
      },
    })
  })
}

/**
 * Parse GeoTIFF/DEM file
 */
async function parseGeoTIFF(file: File): Promise<SpatialDataset> {
  const arrayBuffer = await file.arrayBuffer()
  const tiff = await GeoTIFF.fromArrayBuffer(arrayBuffer)
  const image = await tiff.getImage()

  const width = image.getWidth()
  const height = image.getHeight()
  const rasters = await image.readRasters()
  const elevation = rasters[0] as Float32Array | Int16Array | Uint16Array

  // Get georeferencing info
  const bbox = image.getBoundingBox()
  const [minLng, minLat, maxLng, maxLat] = bbox

  // Get resolution
  const resolution = image.getResolution()
  const pixelResolution = Math.abs(resolution[0])

  // Get no-data value
  const fileDirectory = image.getFileDirectory()
  const noDataValue = fileDirectory.GDAL_NODATA
    ? parseFloat(fileDirectory.GDAL_NODATA)
    : -9999

  // Calculate min/max elevation
  let min = Infinity
  let max = -Infinity
  for (let i = 0; i < elevation.length; i++) {
    const val = elevation[i]
    if (val !== noDataValue && isFinite(val)) {
      min = Math.min(min, val)
      max = Math.max(max, val)
    }
  }

  const demData: DEMData = {
    width,
    height,
    bounds: [minLng, minLat, maxLng, maxLat],
    elevation: new Float32Array(elevation),
    resolution: pixelResolution,
    noDataValue,
    min: min === Infinity ? 0 : min,
    max: max === -Infinity ? 0 : max,
  }

  return {
    id: crypto.randomUUID(),
    name: file.name,
    type: 'dem',
    data: demData,
    visible: true,
    isObstacle: false,
    color: getNextColor(),
    bounds: [
      [minLat, minLng],
      [maxLat, maxLng],
    ],
  }
}

/**
 * Parse Shapefile (ZIP containing .shp, .shx, .dbf, .prj)
 */
async function parseShapefile(file: File): Promise<SpatialDataset> {
  const arrayBuffer = await file.arrayBuffer()
  const geojson = await shp(arrayBuffer)

  let featureCollection: GeoJSON.FeatureCollection

  if (Array.isArray(geojson)) {
    // Multiple layers - combine them
    featureCollection = {
      type: 'FeatureCollection',
      features: geojson.flatMap((layer) => layer.features),
    }
  } else {
    featureCollection = geojson as GeoJSON.FeatureCollection
  }

  const bounds = extractBoundsFromFeatureCollection(featureCollection)

  return {
    id: crypto.randomUUID(),
    name: file.name.replace('.zip', ''),
    type: 'shapefile',
    data: featureCollection,
    visible: true,
    isObstacle: false,
    color: getNextColor(),
    bounds,
  }
}

/**
 * Extract bounds from a feature collection
 */
function extractBoundsFromFeatureCollection(
  fc: GeoJSON.FeatureCollection
): [[number, number], [number, number]] {
  const coords: Array<{ lat: number; lng: number }> = []

  function extractCoords(geometry: GeoJSON.Geometry) {
    switch (geometry.type) {
      case 'Point':
        coords.push({ lng: geometry.coordinates[0], lat: geometry.coordinates[1] })
        break
      case 'MultiPoint':
      case 'LineString':
        for (const coord of geometry.coordinates) {
          coords.push({ lng: coord[0], lat: coord[1] })
        }
        break
      case 'MultiLineString':
      case 'Polygon':
        for (const ring of geometry.coordinates) {
          for (const coord of ring) {
            coords.push({ lng: coord[0], lat: coord[1] })
          }
        }
        break
      case 'MultiPolygon':
        for (const polygon of geometry.coordinates) {
          for (const ring of polygon) {
            for (const coord of ring) {
              coords.push({ lng: coord[0], lat: coord[1] })
            }
          }
        }
        break
      case 'GeometryCollection':
        for (const geom of geometry.geometries) {
          extractCoords(geom)
        }
        break
    }
  }

  for (const feature of fc.features) {
    extractCoords(feature.geometry)
  }

  return calculateBounds(coords)
}

/**
 * Export route as GeoJSON
 */
export function exportRouteAsGeoJSON(
  waypoints: Array<{ lat: number; lng: number; elevation?: number }>,
  name: string,
  properties: Record<string, unknown> = {}
): GeoJSON.FeatureCollection {
  const coordinates: Array<[number, number] | [number, number, number]> = waypoints.map((wp) =>
    wp.elevation !== undefined
      ? [wp.lng, wp.lat, wp.elevation]
      : [wp.lng, wp.lat]
  )

  return {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        geometry: {
          type: 'LineString',
          coordinates,
        },
        properties: {
          name,
          ...properties,
        },
      },
    ],
  }
}
