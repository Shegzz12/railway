# Technical Architecture - Railway Route Planner

## System Overview

```
User Interface (React Components)
    ↓
Spatial Type System (Type Safety)
    ↓
Geospatial Utilities (Coordinate, Raster, Geometry)
    ↓
A* Pathfinding Engine (Routing Logic)
    ↓
Export/Analysis Tools (Output Generation)
```

## Core Modules

### 1. Type System (`lib/types/spatial-types.ts`)
- **Coordinates**: Lat/Lng pairs
- **RoutePoint**: Extended coordinates with elevation and index
- **DEMData**: Raster data structure with georeferencing
- **SpatialDataset**: Wrapper for various data formats
- **RouteGenerationConfig**: Algorithm configuration
- **IntervalCoordinate**: Waypoint at specified distance interval
- **GeneratedRoute**: Complete route with metadata

### 2. Coordinate Utilities (`lib/spatial/coordinate-utils.ts`)
- **haversineDistance()**: Great-circle distance calculation
- **toRadians()/toDegrees()**: Angle conversions
- **calculateBearing()**: Direction between points
- **metersToDegreesLat/Lng()**: Unit conversions for grid cells
- **getElevationFromDEM()**: Elevation sampling at specific coordinate

### 3. Raster Processing (`lib/spatial/raster-utils.ts`)
**Key Functions:**
- **sampleRasterValue()**: Bilinear interpolation at any coordinate
- **calculateGradient()**: Slope between two points using DEM
- **generateCostGrid()**: Multi-layer cost surface creation
- **getElevationProfile()**: Distance vs elevation along route
- **getRouteBounds()**: Extract area bounds with padding

**Algorithm: Bilinear Interpolation**
```
For coordinate within raster:
1. Calculate pixel coordinates (xPixel, yPixel)
2. Get 4 surrounding pixel values
3. Interpolate in X direction (2 values)
4. Interpolate in Y direction (final value)
```

### 4. Geometry Utilities (`lib/spatial/geometry-utils.ts`)
- **pointInFeatureCollection()**: Check if point is in any geometry
- **pointInPolygon()**: Ray-casting algorithm
- **coordinateToBounds()**: Extract bounds from features

### 5. A* Pathfinding (`lib/routing/astar-pathfinder.ts`)

**Algorithm Steps:**
1. **Grid Creation**: Divide area into cells
2. **Cost Calculation**: For each cell:
   - Get elevation from DEM
   - Calculate gradient penalty
   - Sample obstacle rasters
   - Combine into total cost
3. **Pathfinding**: A* with heuristics
   - Open set (priority queue)
   - Closed set (visited nodes)
   - Evaluate 8 directions per cell
   - Use Haversine distance as heuristic

**Cost Components:**
```
Total Cost = Base Cost
           + Elevation Factor (0-0.5x)
           + Slope Penalty (if > maxGradient = ∞)
           + Raster Penalties (0-2x per layer)
```

**Functions:**
- **generateRoute()**: Main entry point
- **createGrid()**: Initialize pathfinding grid
- **astar()**: Core A* algorithm
- **calculateRouteDistance()**: Total route length
- **calculateRouteGradients()**: Min/max/avg gradients
- **generateIntervalCoordinates()**: Waypoints at intervals
- **recalculateRouteSegment()**: Re-route segment after edit

### 6. File Parsing (`lib/parsers/index.ts`)
- **parseFile()**: Dispatch to appropriate parser
- **parseGeoJSON()**: Handle GeoJSON features
- **parseCSV()**: Extract lat/lng from CSV
- **parseGeoTIFF()**: Extract raster data using geotiff.js
- **parseShapefile()**: Unzip and parse .shp files
- **exportRouteAsGeoJSON()**: Format route for export

### 7. Export Tools (`lib/export/geotiff-export.ts`)
- **extractAreaAroundRoute()**: Extract raster subset
- **demToGeoTIFFBuffer()**: Convert DEMData to TIFF
- **downloadRouteAreaAsGeoTIFF()**: Trigger download
- **exportElevationProfileAsCSV()**: Create profile CSV

## React Components

### Layout Hierarchy
```
RailwayPlanner (Main Container)
├── Header (Title, Info)
├── Main Content Flex
│   ├── Sidebar (Panels)
│   │   ├── DataUploadPanel
│   │   ├── ObstacleSelector
│   │   ├── RouteControls
│   │   └── RouteStatistics
│   └── MapView (Leaflet Instance)
└── Footer (Status)
```

### Component Details

**RailwayPlanner**
- State: datasets, route, config, mapMode, coordinates
- Effects: Initialize Leaflet, handle cleanup
- Handlers: Route generation, waypoint editing, exports

**MapView**
- Dynamic import for SSR compatibility
- Leaflet layers: BaseTile, Datasets, Route, Markers
- Drag-and-drop waypoint editing
- Interval coordinate visualization

**DataUploadPanel**
- File input with drag-and-drop
- Progress tracking
- Dataset list with color indicators

**ObstacleSelector**
- Toggle obstacle status per dataset
- Visibility toggles
- Info about how rasters are used in routing

**RouteControls**
- Coordinate input fields (manual or map-based)
- Config sliders (gradient, resolution, interval)
- Generate/Edit mode buttons

**RouteStatistics**
- Route metrics display
- Interval coordinates table
- Export buttons (GeoJSON, CSV, GeoTIFF, Elevation)

## Data Flow

### Route Generation
```
User Input (coordinates, config)
    ↓
createGrid() - Convert to spatial grid with costs
    ↓
astar() - Find optimal path
    ↓
generateIntervalCoordinates() - Create waypoints at intervals
    ↓
Display on map + show statistics
```

### Waypoint Editing
```
User drags marker
    ↓
recalculateRouteSegment() - Re-route modified segment
    ↓
generateIntervalCoordinates() - Update intervals in real-time
    ↓
Update display
```

### Export
```
User clicks export
    ↓
Select format
    ↓
Format data (GeoJSON/CSV/TIFF)
    ↓
Create blob
    ↓
Trigger browser download
```

## Performance Considerations

### Optimization Strategies
1. **Grid Resolution Trade-off**: Smaller cells = more accurate but slower
2. **Lazy Evaluation**: Only sample rasters for active cells
3. **Caching**: Pre-computed cost grids where possible
4. **Web Workers**: Heavy computations offloaded (future)

### Limits
- **Max Grid Size**: 200×200 cells (40,000 nodes for A*)
- **Max Route Points**: 5,000 waypoints for editing
- **Raster Size**: No limit (handled via sampling)

## Geospatial Specifics

### Coordinate System
- **WGS84 (EPSG:4326)** globally
- Latitude [-90, 90], Longitude [-180, 180]

### Distance Calculations
- **Haversine**: Great-circle distance on sphere
- **Error**: ~0.5% for typical railway routes

### Gradient Calculation
```
Gradient (%) = |ΔElevation| / HorizontalDistance × 100
Where HorizontalDistance uses:
  - Latitude: 111 km/degree
  - Longitude: 111 × cos(latitude) km/degree
```

### Raster Georeferencing
```
Bounds: [minLng, minLat, maxLng, maxLat]
Pixel to Coordinate:
  lng = minLng + (pixelX / width) × (maxLng - minLng)
  lat = maxLat - (pixelY / height) × (maxLat - minLat)
```

## Browser Compatibility

- **Modern browsers** with Web APIs
- **Leaflet 1.9+**
- **Geotiff.js** for raster parsing
- **Shpjs** for shapefile parsing

## Future Enhancements

1. **Web Workers**: Offload A* to background thread
2. **GPU Acceleration**: GPGPU pathfinding for large grids
3. **Multi-objective Routing**: Cost vs. distance trade-offs
4. **Terrain Constraints**: Cut/fill calculations
5. **Environmental Impact**: Carbon footprint scoring
6. **Real-time Updates**: Live data integration

---

**Architecture Version**: 1.0
**Last Updated**: March 2026
