// Spatial data types for Railway Route Generation System

export interface Coordinates {
  lat: number
  lng: number
}

export interface RoutePoint extends Coordinates {
  elevation?: number
  index: number
  isHelperNode?: boolean // Helper nodes for manual curve smoothing
}

export interface SpatialDataset {
  id: string
  name: string
  type: 'geojson' | 'dem' | 'shapefile' | 'csv'
  data: GeoJSON.FeatureCollection | DEMData | null
  visible: boolean
  isObstacle: boolean
  color: string
  bounds?: [[number, number], [number, number]] // [[south, west], [north, east]]
}

export interface DEMData {
  width: number
  height: number
  bounds: [number, number, number, number] // [minLng, minLat, maxLng, maxLat]
  elevation: Float32Array
  resolution: number
  noDataValue: number
  min: number
  max: number
}

export interface GeneratedRoute {
  id: string
  name: string
  waypoints: RoutePoint[]
  intervalCoordinates: IntervalCoordinate[] // Coordinates at specified intervals
  totalDistance: number // in kilometers
  maxGradient: number // as percentage
  avgGradient: number
  isModified: boolean
  createdAt: Date
  obstacles: string[] // IDs of obstacle datasets used
}

export interface RouteGenerationConfig {
  maxGradient: number // Maximum allowed gradient (e.g., 4 for 4%)
  gridResolution: number // Grid cell size in meters
  smoothingFactor: number // Route smoothing strength
  obstacleBuffer: number // Buffer distance around obstacles in meters
  coordinateInterval: number // Interval in kilometers for output coordinates
}

export interface IntervalCoordinate extends Coordinates {
  distanceFromStart: number // Distance in km from start point
  index: number
  elevation?: number
}

export interface GridCell {
  row: number
  col: number
  lat: number
  lng: number
  elevation: number
  isObstacle: boolean
  cost: number
}

export interface PathNode {
  row: number
  col: number
  g: number // Cost from start
  h: number // Heuristic to goal
  f: number // Total cost (g + h)
  parent: PathNode | null
}

// GeoJSON type extensions
export namespace GeoJSON {
  export interface Feature {
    type: 'Feature'
    geometry: Geometry
    properties: Record<string, unknown>
  }

  export interface FeatureCollection {
    type: 'FeatureCollection'
    features: Feature[]
  }

  export type Geometry =
    | Point
    | MultiPoint
    | LineString
    | MultiLineString
    | Polygon
    | MultiPolygon
    | GeometryCollection

  export interface Point {
    type: 'Point'
    coordinates: [number, number] | [number, number, number]
  }

  export interface MultiPoint {
    type: 'MultiPoint'
    coordinates: Array<[number, number] | [number, number, number]>
  }

  export interface LineString {
    type: 'LineString'
    coordinates: Array<[number, number] | [number, number, number]>
  }

  export interface MultiLineString {
    type: 'MultiLineString'
    coordinates: Array<Array<[number, number] | [number, number, number]>>
  }

  export interface Polygon {
    type: 'Polygon'
    coordinates: Array<Array<[number, number] | [number, number, number]>>
  }

  export interface MultiPolygon {
    type: 'MultiPolygon'
    coordinates: Array<Array<Array<[number, number] | [number, number, number]>>>
  }

  export interface GeometryCollection {
    type: 'GeometryCollection'
    geometries: Geometry[]
  }
}

// Route editor state
export interface RouteEditorState {
  isEditing: boolean
  selectedWaypointIndex: number | null
  isDragging: boolean
}

// Map interaction mode
export type MapMode = 'view' | 'set-start' | 'set-end' | 'draw-obstacle' | 'edit-route'

// File upload state
export interface UploadState {
  isUploading: boolean
  progress: number
  error: string | null
}
