# Railway Route Planner - Complete System Guide

## Overview
This is a professional-grade railway route generation system that uses real geospatial raster data (DEM, slope, drainage, LULC) to generate optimal railway routes while avoiding obstacles. The system works globally with any coordinate system.

## Key Features

### 1. **Raster Data Integration**
- **DEM (Digital Elevation Model)**: Used for elevation sampling and gradient calculation
- **Slope Data**: Penalizes steep terrain (railways need gentler grades)
- **Drainage Density**: Avoids water-prone areas
- **LULC (Land Use/Land Cover)**: Considers land use costs
- All raster datasets use bilinear interpolation for smooth sampling

### 2. **Intelligent Route Generation**
- **A* Pathfinding Algorithm**: Finds optimal path considering multiple cost factors
- **Gradient Constraints**: Respects maximum railway gradient (default 4%)
- **Cost Surface**: Combines elevation, slope, drainage, and LULC into unified cost layer
- **Real-time Calculation**: Uses uploaded raster data to make routing decisions instantly

### 3. **Coordinate-Based Input & Output**
- **Direct Coordinate Input**: Enter start/end points as latitude/longitude
- **Interval Waypoints**: Generate coordinates at specified intervals (e.g., every 20km)
- **Real-time Updates**: Interval coordinates update immediately when you drag waypoints
- **Multiple Export Formats**:
  - GeoJSON (complete route with properties)
  - CSV (coordinates table)
  - GeoTIFF (raster area around route)
  - Elevation Profile (CSV)

### 4. **Interactive Map Visualization**
- **Leaflet-based Map**: Full OpenStreetMap support
- **Interval Markers**: Cyan circles show waypoints at your specified interval
- **Green Endpoints**: Start/end points clearly marked
- **Editable Route**: Drag waypoints to refine the path
- **Layer Visibility**: Toggle visibility of datasets on map

### 5. **Obstacle Management**
- **Mark as Obstacles**: Toggle any dataset as an obstacle to avoid
- **Vector Obstacles**: GeoJSON/Shapefile features treated as barriers
- **Raster Obstacles**: Slope/drainage/LULC increase traversal cost
- **Buffer Zones**: Configurable buffer around obstacles

## Workflow

### Step 1: Upload Spatial Data
1. Click the upload area or drag files
2. Supported formats: GeoTIFF (.tif), GeoJSON (.geojson), CSV (.csv), Shapefile (.zip)
3. Files appear in the "Data Upload" panel

### Step 2: Configure as Routing Layers
In the "Layers & Obstacles" panel:
- For each raster file, toggle "Mark as obstacle" if needed
- **DEM**: Always use as base elevation data
- **Slope/Drainage/LULC**: Toggle as obstacles to use them in routing cost calculation
- Toggle visibility eye icon to show/hide on map

### Step 3: Set Route Endpoints
**Option A - Map Click:**
1. Click "Set Start" button
2. Click on map to place start point
3. Click "Set End" button
4. Click on map to place end point

**Option B - Direct Coordinates:**
1. Enter latitude/longitude in input fields
2. Click "Apply" button
3. Repeat for end point

### Step 4: Configure Routing Settings
Click "Route Settings" to expand:
- **Max Gradient**: Maximum allowed slope (default 4% for railways)
- **Grid Resolution**: Cell size for pathfinding (smaller = more accurate but slower)
- **Smoothing**: Route smoothness factor
- **Obstacle Buffer**: Distance around obstacles to avoid
- **Coordinate Interval**: Distance between output waypoints (e.g., 20km)

### Step 5: Generate Route
1. Click "Generate Route" button
2. System processes raster data and calculates optimal path
3. Route appears on map with blue line
4. Cyan circles show interval coordinates
5. Statistics panel shows distance, gradient, waypoint count

### Step 6: Edit Route (Optional)
1. Click "Edit Route" button
2. Drag blue waypoint markers to modify path
3. **Interval coordinates update in real-time**
4. Statistics update automatically
5. Click "Exit Edit Mode" when done

### Step 7: Export Results
From the "Route Statistics" panel:
- **GeoJSON**: Complete route with metadata
- **Coords CSV**: Interval coordinates in spreadsheet format
- **GeoTIFF**: Raster data for 2km area around route
- **Elevation**: Elevation profile along route

## Advanced Features

### Raster Data Processing
- **Bilinear Interpolation**: Smooth value sampling between pixels
- **Cost Grid Generation**: Multi-layer cost surface combining all datasets
- **Gradient Calculation**: Accurate slope computation using geographic coordinates
- **NoData Handling**: Graceful handling of missing/invalid raster values

### Route Optimization
- **Multi-factor Cost**: Elevation + slope + drainage + LULC
- **Railway Constraints**: Respects gradient limits
- **Global Support**: Works with any coordinate system and location
- **Efficiency**: Optimized grid-based pathfinding with heuristics

### Data Export
- **GeoJSON with Properties**: Route stored as LineString with metadata
- **CSV Coordinates**: Human-readable format for spreadsheets
- **GeoTIFF Area Export**: Extracts surrounding raster data with proper georeferencing
- **Elevation Profile**: Distance vs. elevation graph data

## Technical Details

### Supported Raster Data Types
- **GeoTIFF (.tif)**: Industry standard geospatial raster format
- **Elevation Models**: Any height/elevation dataset
- **Cost Rasters**: Slope, drainage density, land use costs
- **Obstacle Rasters**: Any binary or continuous obstacle layer

### Coordinate Systems
- Uses WGS84 (EPSG:4326) globally
- Supports any geographic input
- Exports maintain georeferencing

### Performance Optimization
- Grid-based A* pathfinding
- Configurable resolution trade-off
- Efficient raster sampling with interpolation
- Caching of cost calculations

## Tips & Best Practices

1. **DEM First**: Always upload and use a DEM as base elevation data
2. **Mark Obstacles**: Toggle datasets as obstacles only if they should block/penalize the route
3. **Start Simple**: Begin with basic setup, add complexity gradually
4. **Test Intervals**: Different interval values (e.g., 5km, 20km, 50km) for different applications
5. **Check Gradients**: Monitor max gradient to ensure railway compliance
6. **Validate Results**: Always review generated route before use
7. **Edit When Needed**: Use drag-and-edit to incorporate local knowledge

## Common Use Cases

- **Railway Planning**: Optimal rail line routing avoiding obstacles
- **Pipeline Routes**: Gas/oil pipeline placement with terrain consideration
- **Road Design**: Infrastructure routes considering terrain and obstacles
- **Infrastructure Analysis**: Studying feasible corridors for development
- **Environmental Impact**: Comparing routes with different environmental data

## Troubleshooting

**Route not generating:**
- Ensure start and end points are set
- Check that raster data is loaded
- Verify obstacles aren't blocking entire area

**Coordinates not updating:**
- Confirm interval value is set
- Try regenerating route after changing interval

**Map not showing data:**
- Check visibility toggles in Layers & Obstacles panel
- Verify raster bounds match your coordinates

**Export not working:**
- Ensure route has been generated
- Check browser console for errors
- Try different export format

---

**Version**: 1.0 - Global Railway Route Planner
**Last Updated**: March 2026
