// A* Pathfinding Algorithm for Railway Route Generation

import type {
  Coordinates,
  RoutePoint,
  SpatialDataset,
  DEMData,
  RouteGenerationConfig,
  GridCell,
  PathNode,
  GeoJSON,
} from '@/lib/types/spatial-types'
import {
  haversineDistance,
  getElevationFromDEM,
  metersToDegreesLat,
  metersToDegreesLng,
} from '@/lib/spatial/coordinate-utils'
import { pointInFeatureCollection } from '@/lib/spatial/geometry-utils'
import { sampleRasterValue, calculateGradient, getElevationProfile } from '@/lib/spatial/raster-utils'

// Default configuration for railway routes
export const DEFAULT_CONFIG: RouteGenerationConfig = {
  maxGradient: 4, // 4% maximum gradient for railways
  gridResolution: 500, // 500 meters per cell
  smoothingFactor: 2,
  obstacleBuffer: 100, // 100 meter buffer around obstacles
  coordinateInterval: 20, // Generate coordinates every 20km
}

// Direction vectors for 8-connected grid (including diagonals)
const DIRECTIONS = [
  [-1, -1], [-1, 0], [-1, 1],
  [0, -1],          [0, 1],
  [1, -1],  [1, 0], [1, 1],
]

// Cost multipliers
const DIAGONAL_COST = Math.SQRT2
const STRAIGHT_COST = 1
const GRADIENT_PENALTY_MULTIPLIER = 10
const CURVE_PENALTY = 1.5

interface Grid {
  cells: GridCell[][]
  rows: number
  cols: number
  bounds: {
    minLat: number
    maxLat: number
    minLng: number
    maxLng: number
  }
  cellSizeLat: number
  cellSizeLng: number
}

/**
 * Generate a route using A* pathfinding algorithm
 */
export function generateRoute(
  start: Coordinates,
  end: Coordinates,
  obstacles: SpatialDataset[],
  demData: DEMData | null,
  config: RouteGenerationConfig = DEFAULT_CONFIG
): RoutePoint[] {
  console.log('[v0] generateRoute called with:', {
    start,
    end,
    obstacleCount: obstacles.length,
    hasDEM: !!demData,
    config
  })

  // Create the grid
  const grid = createGrid(start, end, obstacles, demData, config)
  console.log('[v0] Grid created:', { rows: grid.rows, cols: grid.cols })

  // Find start and end cells
  const startCell = coordToCell(start, grid)
  const endCell = coordToCell(end, grid)

  console.log('[v0] Start/End cells:', { startCell, endCell })

  if (!startCell || !endCell) {
    console.log('[v0] Grid creation failed - returning direct line')
    return [
      { ...start, elevation: 0, index: 0 },
      { ...end, elevation: 0, index: 1 },
    ]
  }

  // Run A* algorithm
  const path = astar(grid, startCell, endCell, config)
  console.log('[v0] A* path found:', path?.length || 0, 'nodes')

  if (!path || path.length === 0) {
    console.log('[v0] No path found - returning direct line')
    return [
      { ...start, elevation: getElevation(start, demData), index: 0 },
      { ...end, elevation: getElevation(end, demData), index: 1 },
    ]
  }

  // Convert path to route points
  const waypoints: RoutePoint[] = path.map((node, index) => {
    const cell = grid.cells[node.row][node.col]
    return {
      lat: cell.lat,
      lng: cell.lng,
      elevation: cell.elevation,
      index,
    }
  })

  // Ensure start and end points are exact
  waypoints[0] = {
    ...start,
    elevation: getElevation(start, demData),
    index: 0,
  }
  waypoints[waypoints.length - 1] = {
    ...end,
    elevation: getElevation(end, demData),
    index: waypoints.length - 1,
  }

  return waypoints
}

/**
 * Create a grid for pathfinding
 */
function createGrid(
  start: Coordinates,
  end: Coordinates,
  obstacles: SpatialDataset[],
  demData: DEMData | null,
  config: RouteGenerationConfig
): Grid {
  // Calculate distance between start and end
  const distanceKm = haversineDistance(start, end)
  
  // Dynamically adjust grid resolution based on distance
  // For short distances, use finer resolution to get more waypoints
  let effectiveResolution = config.gridResolution
  if (distanceKm < 50) {
    effectiveResolution = Math.max(50, distanceKm * 10) // Minimum 50m cells for short routes
  } else if (distanceKm < 200) {
    effectiveResolution = Math.max(100, distanceKm * 5)
  }
  
  // Calculate bounds with padding (minimum 20% of distance or 5km)
  const paddingMeters = Math.max(distanceKm * 200, 5000)

  const minLat = Math.min(start.lat, end.lat) - metersToDegreesLat(paddingMeters)
  const maxLat = Math.max(start.lat, end.lat) + metersToDegreesLat(paddingMeters)
  const centerLat = (minLat + maxLat) / 2
  const minLng = Math.min(start.lng, end.lng) - metersToDegreesLng(paddingMeters, centerLat)
  const maxLng = Math.max(start.lng, end.lng) + metersToDegreesLng(paddingMeters, centerLat)

  // Calculate cell size in degrees
  const cellSizeLat = metersToDegreesLat(effectiveResolution)
  const cellSizeLng = metersToDegreesLng(effectiveResolution, centerLat)

  // Calculate grid dimensions - ensure minimum 50 cells in each direction
  const rawRows = Math.ceil((maxLat - minLat) / cellSizeLat)
  const rawCols = Math.ceil((maxLng - minLng) / cellSizeLng)
  
  // Ensure minimum grid size for meaningful pathfinding
  const minGridSize = 50
  const maxGridSize = 200
  const actualRows = Math.max(minGridSize, Math.min(rawRows, maxGridSize))
  const actualCols = Math.max(minGridSize, Math.min(rawCols, maxGridSize))

  const adjustedCellSizeLat = (maxLat - minLat) / actualRows
  const adjustedCellSizeLng = (maxLng - minLng) / actualCols
  
  console.log('[v0] Grid config:', { distanceKm, effectiveResolution, actualRows, actualCols })

  // Get obstacle feature collections and raster datasets
  const obstacleCollections = obstacles
    .filter((d) => d.isObstacle && d.data && d.type !== 'dem')
    .map((d) => d.data as GeoJSON.FeatureCollection)

  // Get obstacle raster datasets (slope, drainage, LULC, etc.)
  const obstacleRasters = obstacles
    .filter((d) => d.isObstacle && d.data && d.type === 'dem')
    .map((d) => d.data as DEMData)

  console.log('[v0] createGrid obstacles:', {
    vectorObstacles: obstacleCollections.length,
    rasterObstacles: obstacleRasters.length,
    allDatasets: obstacles.map(d => ({ id: d.id, name: d.name, type: d.type, isObstacle: d.isObstacle }))
  })

  // Create grid cells
  const cells: GridCell[][] = []

  for (let row = 0; row < actualRows; row++) {
    cells[row] = []
    for (let col = 0; col < actualCols; col++) {
      const lat = minLat + (row + 0.5) * adjustedCellSizeLat
      const lng = minLng + (col + 0.5) * adjustedCellSizeLng
      const coord: Coordinates = { lat, lng }

      // Get elevation
      const elevation = getElevation(coord, demData)

      // Check if cell is in a vector obstacle
      const isObstacle = obstacleCollections.some((fc) =>
        pointInFeatureCollection(coord, fc)
      )

      // Calculate cost based on raster data
      let cost = isObstacle ? Infinity : 1

      if (!isObstacle && (demData || obstacleRasters.length > 0)) {
        // Use elevation gradient as cost factor
        if (demData && row > 0) {
          const prevLat = minLat + (row - 0.5) * adjustedCellSizeLat
          const prevCoord: Coordinates = { lat: prevLat, lng }
          const gradient = calculateGradient(prevCoord, coord, demData)

          // Penalize steep slopes (railways need gentle grades)
          if (gradient > config.maxGradient) {
            cost = Infinity // Impossible to traverse
          } else {
            cost += gradient / config.maxGradient // 0-1 penalty based on gradient
          }
        }

        // Use obstacle rasters as cost multipliers
        obstacleRasters.forEach((raster) => {
          const value = sampleRasterValue(raster, coord)
          if (value !== raster.noDataValue) {
            // Normalize value and add to cost
            const normValue = Math.max(0, Math.min(1, (value - raster.min) / (raster.max - raster.min + 0.0001)))
            cost += normValue * 2 // Up to 2x cost multiplier
          }
        })
      }

      cells[row][col] = {
        row,
        col,
        lat,
        lng,
        elevation,
        isObstacle,
        cost,
      }
    }
  }

  return {
    cells,
    rows: actualRows,
    cols: actualCols,
    bounds: { minLat, maxLat, minLng, maxLng },
    cellSizeLat: adjustedCellSizeLat,
    cellSizeLng: adjustedCellSizeLng,
  }
}

/**
 * Convert a coordinate to a grid cell
 */
function coordToCell(
  coord: Coordinates,
  grid: Grid
): { row: number; col: number } | null {
  const { minLat, minLng } = grid.bounds

  const row = Math.floor((coord.lat - minLat) / grid.cellSizeLat)
  const col = Math.floor((coord.lng - minLng) / grid.cellSizeLng)

  if (row < 0 || row >= grid.rows || col < 0 || col >= grid.cols) {
    return null
  }

  return { row, col }
}

/**
 * A* pathfinding algorithm
 */
function astar(
  grid: Grid,
  start: { row: number; col: number },
  end: { row: number; col: number },
  config: RouteGenerationConfig
): PathNode[] | null {
  const openSet: PathNode[] = []
  const closedSet = new Set<string>()

  const startNode: PathNode = {
    row: start.row,
    col: start.col,
    g: 0,
    h: heuristic(start, end, grid),
    f: 0,
    parent: null,
  }
  startNode.f = startNode.g + startNode.h

  openSet.push(startNode)

  let iterations = 0
  const maxIterations = grid.rows * grid.cols * 2

  while (openSet.length > 0 && iterations < maxIterations) {
    iterations++

    // Find node with lowest f score
    openSet.sort((a, b) => a.f - b.f)
    const current = openSet.shift()!

    // Check if we reached the goal
    if (current.row === end.row && current.col === end.col) {
      return reconstructPath(current)
    }

    const currentKey = `${current.row},${current.col}`
    closedSet.add(currentKey)

    // Explore neighbors
    for (const [dr, dc] of DIRECTIONS) {
      const newRow = current.row + dr
      const newCol = current.col + dc

      // Check bounds
      if (newRow < 0 || newRow >= grid.rows || newCol < 0 || newCol >= grid.cols) {
        continue
      }

      const neighborKey = `${newRow},${newCol}`
      if (closedSet.has(neighborKey)) {
        continue
      }

      const neighborCell = grid.cells[newRow][newCol]

      // Skip obstacles
      if (neighborCell.isObstacle) {
        closedSet.add(neighborKey)
        continue
      }

      // Calculate movement cost
      const isDiagonal = dr !== 0 && dc !== 0
      let movementCost = isDiagonal ? DIAGONAL_COST : STRAIGHT_COST

      // Add gradient penalty for railways
      const currentCell = grid.cells[current.row][current.col]
      const gradient = calculateGradientBetweenCells(
        currentCell,
        neighborCell,
        config.gridResolution
      )

      if (gradient > config.maxGradient) {
        // Too steep - add very high cost but don't completely block
        movementCost += gradient * GRADIENT_PENALTY_MULTIPLIER * 10
      } else {
        movementCost += gradient * GRADIENT_PENALTY_MULTIPLIER
      }

      // Add curve penalty
      if (current.parent) {
        const prevDr = current.row - current.parent.row
        const prevDc = current.col - current.parent.col
        if (dr !== prevDr || dc !== prevDc) {
          movementCost *= CURVE_PENALTY
        }
      }

      const g = current.g + movementCost
      const h = heuristic({ row: newRow, col: newCol }, end, grid)
      const f = g + h

      // Check if this path is better
      const existingIndex = openSet.findIndex(
        (n) => n.row === newRow && n.col === newCol
      )

      if (existingIndex !== -1) {
        if (g < openSet[existingIndex].g) {
          openSet[existingIndex].g = g
          openSet[existingIndex].f = f
          openSet[existingIndex].parent = current
        }
      } else {
        openSet.push({
          row: newRow,
          col: newCol,
          g,
          h,
          f,
          parent: current,
        })
      }
    }
  }

  // No path found
  return null
}

/**
 * Heuristic function (Euclidean distance)
 */
function heuristic(
  current: { row: number; col: number },
  goal: { row: number; col: number },
  grid: Grid
): number {
  const currentCell = grid.cells[current.row][current.col]
  const goalCell = grid.cells[goal.row][goal.col]

  return haversineDistance(
    { lat: currentCell.lat, lng: currentCell.lng },
    { lat: goalCell.lat, lng: goalCell.lng }
  )
}

/**
 * Reconstruct path from goal to start
 */
function reconstructPath(node: PathNode): PathNode[] {
  const path: PathNode[] = []
  let current: PathNode | null = node

  while (current !== null) {
    path.unshift(current)
    current = current.parent
  }

  return path
}

/**
 * Calculate gradient between two cells
 */
function calculateGradientBetweenCells(
  cell1: GridCell,
  cell2: GridCell,
  cellSizeMeters: number
): number {
  const distance = haversineDistance(
    { lat: cell1.lat, lng: cell1.lng },
    { lat: cell2.lat, lng: cell2.lng }
  ) * 1000 // Convert to meters

  if (distance === 0) return 0

  const elevationChange = Math.abs(cell2.elevation - cell1.elevation)
  return (elevationChange / distance) * 100
}

/**
 * Get elevation at a coordinate from DEM or return 0
 */
function getElevation(coord: Coordinates, demData: DEMData | null): number {
  if (!demData) return 0
  return getElevationFromDEM(coord, demData) ?? 0
}

/**
 * Calculate total route distance in kilometers
 */
export function calculateRouteDistance(waypoints: RoutePoint[]): number {
  let total = 0
  for (let i = 0; i < waypoints.length - 1; i++) {
    total += haversineDistance(waypoints[i], waypoints[i + 1])
  }
  return total
}

/**
 * Calculate maximum and average gradient along route
 */
export function calculateRouteGradients(
  waypoints: RoutePoint[]
): { max: number; avg: number } {
  if (waypoints.length < 2) return { max: 0, avg: 0 }

  let maxGradient = 0
  let totalGradient = 0

  for (let i = 0; i < waypoints.length - 1; i++) {
    const p1 = waypoints[i]
    const p2 = waypoints[i + 1]

    const distance = haversineDistance(p1, p2) * 1000 // meters
    if (distance === 0) continue

    const elevationChange = Math.abs((p2.elevation ?? 0) - (p1.elevation ?? 0))
    const gradient = (elevationChange / distance) * 100

    maxGradient = Math.max(maxGradient, gradient)
    totalGradient += gradient
  }

  return {
    max: maxGradient,
    avg: totalGradient / (waypoints.length - 1),
  }
}

/**
 * Generate coordinates at specified intervals along the route
 */
export function generateIntervalCoordinates(
  waypoints: RoutePoint[],
  intervalKm: number
): import('@/lib/types/spatial-types').IntervalCoordinate[] {
  if (waypoints.length < 2 || intervalKm <= 0) {
    return waypoints.map((wp, index) => ({
      lat: wp.lat,
      lng: wp.lng,
      elevation: wp.elevation,
      distanceFromStart: 0,
      index,
    }))
  }

  const intervalCoords: import('@/lib/types/spatial-types').IntervalCoordinate[] = []
  let cumulativeDistance = 0
  let nextIntervalDistance = 0
  let intervalIndex = 0

  // Always add start point
  intervalCoords.push({
    lat: waypoints[0].lat,
    lng: waypoints[0].lng,
    elevation: waypoints[0].elevation,
    distanceFromStart: 0,
    index: intervalIndex++,
  })
  nextIntervalDistance = intervalKm

  for (let i = 0; i < waypoints.length - 1; i++) {
    const p1 = waypoints[i]
    const p2 = waypoints[i + 1]
    const segmentDistance = haversineDistance(p1, p2) // km

    const segmentStartDistance = cumulativeDistance
    const segmentEndDistance = cumulativeDistance + segmentDistance

    // Check if any interval points fall within this segment
    while (nextIntervalDistance <= segmentEndDistance) {
      // Calculate position along segment
      const distanceAlongSegment = nextIntervalDistance - segmentStartDistance
      const ratio = segmentDistance > 0 ? distanceAlongSegment / segmentDistance : 0

      // Interpolate position
      const lat = p1.lat + ratio * (p2.lat - p1.lat)
      const lng = p1.lng + ratio * (p2.lng - p1.lng)

      // Interpolate elevation if available
      const elev1 = p1.elevation ?? 0
      const elev2 = p2.elevation ?? 0
      const elevation = elev1 + ratio * (elev2 - elev1)

      intervalCoords.push({
        lat,
        lng,
        elevation,
        distanceFromStart: nextIntervalDistance,
        index: intervalIndex++,
      })

      nextIntervalDistance += intervalKm
    }

    cumulativeDistance += segmentDistance
  }

  // Always add end point
  const lastWp = waypoints[waypoints.length - 1]
  intervalCoords.push({
    lat: lastWp.lat,
    lng: lastWp.lng,
    elevation: lastWp.elevation,
    distanceFromStart: cumulativeDistance,
    index: intervalIndex,
  })

  return intervalCoords
}

/**
 * Recalculate route segment after waypoint modification
 */
/**
 * Recalculate route segment after waypoint modification
 * Simple version: just update the waypoint position
 */
export function recalculateRouteSegment(
  waypoints: RoutePoint[],
  modifiedIndex: number,
  newPosition: Coordinates,
  obstacles: SpatialDataset[],
  demData: DEMData | null,
  config: RouteGenerationConfig = DEFAULT_CONFIG
): RoutePoint[] {
  if (modifiedIndex < 0 || modifiedIndex >= waypoints.length) return waypoints

  // Create new array with updated waypoint
  const updated = waypoints.map((wp, idx) => {
    if (idx === modifiedIndex) {
      return {
        ...wp,
        ...newPosition,
        elevation: getElevation(newPosition, demData),
        index: idx,
        isHelperNode: wp.isHelperNode,
      }
    }
    return wp
  })

  return updated
}

/**
 * Generate a smooth curve that passes exactly through three waypoints
 * This creates a continuous flowing curve: start → dragged → end
 */
function generateSmoothCurveThrough3Points(
  startNode: RoutePoint,
  middleNode: RoutePoint,
  endNode: RoutePoint
): RoutePoint[] {
  const path: RoutePoint[] = []

  // Calculate total distance for the curve
  const dist1 = haversineDistance(startNode, middleNode)
  const dist2 = haversineDistance(middleNode, endNode)
  const totalDist = dist1 + dist2

  if (totalDist < 0.001) {
    console.log('[v0] Curve distance too small:', totalDist)
    return path
  }

  // Calculate number of interpolation points (roughly one per 100m)
  const totalSteps = Math.max(4, Math.floor(totalDist / 0.1))

  console.log('[v0] generateSmoothCurveThrough3Points:', {
    dist1,
    dist2,
    totalDist,
    totalSteps
  })

  // Generate points along the entire smooth curve
  for (let i = 1; i < totalSteps; i++) {
    const t = i / totalSteps // Parameter from 0 to 1 for entire curve

    let lat: number
    let lng: number
    let elevation: number

    if (t <= 0.5) {
      // First half: smooth curve from startNode to middleNode
      const t1 = t * 2 // Map to 0-1 for first segment
      
      // Use ease-in-out cubic for smooth acceleration/deceleration through middle
      const eased = easeInOutCubic(t1)

      lat = startNode.lat + (middleNode.lat - startNode.lat) * eased
      lng = startNode.lng + (middleNode.lng - startNode.lng) * eased
      elevation = startNode.elevation + (middleNode.elevation - startNode.elevation) * eased
    } else {
      // Second half: smooth curve from middleNode to endNode
      const t2 = (t - 0.5) * 2 // Map to 0-1 for second segment
      
      // Use ease-in-out cubic for smooth acceleration/deceleration away from middle
      const eased = easeInOutCubic(t2)

      lat = middleNode.lat + (endNode.lat - middleNode.lat) * eased
      lng = middleNode.lng + (endNode.lng - middleNode.lng) * eased
      elevation = middleNode.elevation + (endNode.elevation - middleNode.elevation) * eased
    }

    path.push({
      lat,
      lng,
      elevation,
      index: i,
    })
  }

  console.log('[v0] Generated smooth curve with', path.length, 'intermediate points')
  return path
}

/**
 * Ease-in-out cubic function for smooth curves
 * Creates smooth acceleration and deceleration
 */
function easeInOutCubic(t: number): number {
  return t < 0.5 
    ? 4 * t * t * t 
    : 1 - Math.pow(-2 * t + 2, 3) / 2
}
