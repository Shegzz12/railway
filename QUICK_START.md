# Quick Start Guide - Testing the Railway Planner

## Test Scenario

To test the complete system end-to-end, you'll need sample raster data. Here's what to prepare:

### Sample Data Structure

1. **DEM (Elevation Model)**
   - File: `dem.tif`
   - Format: GeoTIFF with single-band elevation values
   - Resolution: Any (e.g., 30m, 90m)
   - Units: Meters above sea level
   - Example: SRTM DEM data from USGS

2. **Slope Data**
   - File: `slope.tif`
   - Format: GeoTIFF with slope values
   - Values: 0-90 degrees
   - Source: Derived from DEM using GDAL or ArcGIS

3. **Drainage Density**
   - File: `drainage.tif`
   - Format: GeoTIFF
   - Values: Normalized (0-1) or actual density
   - Purpose: Avoid water-logged areas

4. **LULC (Land Use/Land Cover)**
   - File: `lulc.tif`
   - Format: GeoTIFF with classification codes
   - Classes: Forest, urban, water, agriculture, etc.
   - Source: Sentinel-2, Landsat, or local classification

### Getting Sample Data

**Free Sources:**
- **SRTM DEM**: https://earthexplorer.usgs.gov/
- **GEBCO Bathymetry**: https://www.gebco.net/
- **Sentinel-2 Imagery**: ESA Copernicus hub
- **Natural Earth Data**: https://www.naturalearthdata.com/

### Step-by-Step Test

#### 1. Start the Application
```bash
npm run dev
# Navigate to http://localhost:3000
```

#### 2. Upload Test Data
- Drag and drop all 4 GeoTIFF files into the upload panel
- Confirm files appear in "Data Upload" panel
- Verify they show correct types (DEM, GeoTIFF, etc.)

#### 3. Configure Obstacles
- In "Layers & Obstacles" panel:
  - Keep DEM unchecked (it's the base elevation)
  - Toggle "Mark as obstacle" for slope, drainage, LULC
  - These become cost multipliers in routing
  - Click eye icons to show/hide on map

#### 4. Set Route Endpoints

**Option A - Coordinates:**
```
Start: 37.7749, -122.4194  (San Francisco)
End: 34.0522, -118.2437    (Los Angeles)

Or your own coordinates
```

**Option B - Map Click:**
1. Click "Set Start"
2. Click on map
3. Click "Set End"
4. Click on map

#### 5. Configure Route Settings
```
Route Settings:
├── Max Gradient: 4% (railway standard)
├── Grid Resolution: 500m (fine detail)
├── Smoothing: 2 (smooth curves)
├── Obstacle Buffer: 100m (safe distance)
└── Coordinate Interval: 20km (output every 20km)
```

#### 6. Generate Route
- Click "Generate Route" button
- Wait for calculation (2-5 seconds typical)
- Route appears on map in blue
- Cyan circles show interval waypoints (every 20km)
- Statistics update with distance and gradient info

#### 7. Verify Interval Coordinates
- Expand "Route Coordinates" in statistics panel
- Verify table shows coordinates at 20km intervals
- Each row should show:
  - Index: Waypoint number
  - Latitude/Longitude: Precise coordinates
  - Distance from Start: 0, 20, 40, 60, etc.
  - Elevation: Height at that point

#### 8. Edit Route (Optional)
1. Click "Edit Route" button
2. Try dragging one of the waypoint markers
3. **Verify**: Statistics update instantly
4. **Check**: Interval coordinates change in real-time
5. Click "Exit Edit Mode" when done

#### 9. Test Exports

**Export GeoJSON:**
- Contains complete route with properties
- Ready for ArcGIS, QGIS, or other GIS software

**Export CSV:**
- Spreadsheet-friendly coordinate table
- Useful for surveying teams

**Export GeoTIFF:**
- Raster area around generated route (with 2km padding)
- Shows actual elevation/slope data used

**Export Elevation Profile:**
- CSV with distance vs. elevation
- Good for civil engineering analysis

#### 10. Verify on Map
- Start point: Green circle at first interval coordinate
- End point: Green circle at last interval coordinate
- Waypoints: Cyan circles at specified intervals
- Blue line: The generated route connecting them

### Testing Checklist

- [ ] Files upload successfully
- [ ] Datasets appear in upload panel with correct types
- [ ] Map displays uploaded data when visibility toggled
- [ ] Route generates in <10 seconds
- [ ] Start/end points placed correctly
- [ ] Route respects max gradient setting
- [ ] Interval coordinates display at correct spacing
- [ ] Dragging waypoints updates coordinates immediately
- [ ] All exports generate files without errors
- [ ] GeoJSON can be opened in QGIS/ArcGIS
- [ ] Elevation profile shows realistic terrain

### Expected Results

**Good Route:**
- Avoids steep slopes (visible on map)
- Goes around obstacles (if marked)
- Follows reasonable terrain
- Max gradient stays under configured limit
- Interval coordinates evenly spaced

**Route Refinement:**
- Dragging waypoints produces smooth curves
- No jerky movements or reversals
- Coordinates update smoothly

### Troubleshooting

**Route not generating:**
```
✗ Start/end not set
  → Set both start and end points

✗ No raster data loaded
  → Upload at least a DEM file

✗ Area too large
  → Try closer start/end points
```

**Map not showing data:**
```
✗ Datasets hidden
  → Click eye icon in Layers panel

✗ Zoom too far out
  → Zoom in to see raster data detail
```

**Coordinates not showing:**
```
✗ Interval too large
  → Try smaller interval (10km vs 100km)

✗ Route too short
  → Route must be longer than interval distance
```

**Export fails:**
```
✗ DEM not loaded for GeoTIFF export
  → Upload a DEM file first

✗ No route generated
  → Generate route before exporting
```

### Performance Testing

**Typical Performance:**
- Upload: <1 second per file
- Route generation: 2-5 seconds
- Waypoint editing: Instant (real-time)
- Export: <1 second

**Bottlenecks:**
- Large raster files (>500MB) may load slowly
- Very fine grid resolution (100m) increases generation time
- Complex obstacles slow pathfinding

### Data Validation

Check your test data:
```bash
# Check GeoTIFF info with GDAL
gdalinfo dem.tif

# Should show:
# - Driver: GTiff
# - Size: [width] x [height] pixels
# - Coordinate System: WGS 84
# - Band statistics: min, max, mean values
```

### Advanced Testing

1. **Multiple Obstacles**: Upload 3+ obstacle datasets, toggle different combinations
2. **Edge Cases**: Test routes at dateline (-180/+180 longitude)
3. **Large Routes**: Try distances >500km
4. **Multiple Intervals**: Compare 5km, 20km, 50km intervals
5. **Gradient Constraints**: Test with max gradient 2%, 4%, 6%

### Real-World Applications

- **Railway Feasibility Study**: Run corridor analysis
- **Pipeline Route Planning**: Compare alternative routes
- **Power Line Siting**: Consider terrain and obstacles
- **Road Design**: Infrastructure alignment studies

---

**Test Duration**: 15-30 minutes for complete workflow
**Recommended**: Test with real data from your project area

Ready to test? Upload your GeoTIFF files and generate your first route! 🚂
