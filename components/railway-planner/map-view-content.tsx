'use client'

import { useEffect, useRef, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import 'leaflet/dist/leaflet.css'
import type { RoutePoint, Coordinates, IntervalCoordinate } from '@/lib/types/spatial-types'
import { haversineDistance } from '@/lib/spatial/coordinate-utils'

/** Same as RouteControls coordinate interval slider (km). */
const COORD_INTERVAL_MIN_KM = 0.02 // 20 m
const COORD_INTERVAL_MAX_KM = 20

/**
 * Yellow edit-handle spacing along the route (meters), tied to the coordinate-interval setting:
 * 20 m interval → 5 m spacing; 20 km interval → 500 m spacing (linear in between).
 */
const EDIT_SPACING_AT_MIN_INTERVAL_M = 5
const EDIT_SPACING_AT_MAX_INTERVAL_M = 500

/** If spacing would create more than this many handles, widen spacing (long routes + tight interval). */
const EDIT_MARKER_SAFETY_CAP = 800

function spacingMetersFromCoordinateIntervalKm(coordinateIntervalKm: number): number {
  const c = Math.min(
    COORD_INTERVAL_MAX_KM,
    Math.max(COORD_INTERVAL_MIN_KM, coordinateIntervalKm)
  )
  const t = (c - COORD_INTERVAL_MIN_KM) / (COORD_INTERVAL_MAX_KM - COORD_INTERVAL_MIN_KM)
  return (
    EDIT_SPACING_AT_MIN_INTERVAL_M +
    (EDIT_SPACING_AT_MAX_INTERVAL_M - EDIT_SPACING_AT_MIN_INTERVAL_M) * t
  )
}

function routeLengthMetersMains(mains: RoutePoint[]): number {
  let totalM = 0
  for (let i = 0; i < mains.length - 1; i++) {
    totalM += haversineDistance(mains[i], mains[i + 1]) * 1000
  }
  return totalM
}

function effectiveEditSpacingM(
  routeLengthM: number,
  coordinateIntervalKm: number
): number {
  let spacingM = spacingMetersFromCoordinateIntervalKm(coordinateIntervalKm)
  if (routeLengthM <= 0 || spacingM <= 0) return Math.max(spacingM, 1)
  const estimated = Math.ceil(routeLengthM / spacingM) + 1
  if (estimated > EDIT_MARKER_SAFETY_CAP) {
    spacingM = routeLengthM / Math.max(1, EDIT_MARKER_SAFETY_CAP - 1)
  }
  return Math.max(spacingM, 1)
}

/** Original waypoint indices to show as yellow draggable markers in edit mode. */
function getEditModeMarkerIndices(
  waypoints: RoutePoint[],
  coordinateIntervalKm: number
): number[] {
  const mains: { idx: number; wp: RoutePoint }[] = []
  waypoints.forEach((wp, i) => {
    if (!wp.isHelperNode) mains.push({ idx: i, wp })
  })
  if (mains.length === 0) return []
  if (mains.length === 1) return [mains[0].idx]

  const routeLenM = routeLengthMetersMains(mains.map((m) => m.wp))
  const spacingM = effectiveEditSpacingM(routeLenM, coordinateIntervalKm)

  const pickedJ = new Set<number>([0])
  let acc = 0
  for (let j = 0; j < mains.length - 1; j++) {
    acc += haversineDistance(mains[j].wp, mains[j + 1].wp) * 1000
    if (acc >= spacingM) {
      pickedJ.add(j + 1)
      acc = 0
    }
  }
  pickedJ.add(mains.length - 1)

  return Array.from(pickedJ)
    .sort((a, b) => a - b)
    .map((j) => mains[j].idx)
}

interface MapViewContentProps {
  datasets: any[]
  startPoint: Coordinates | null
  endPoint: Coordinates | null
  routeWaypoints: RoutePoint[]
  intervalCoordinates?: IntervalCoordinate[]
  coordinateIntervalKm: number
  mapMode: string
  selectedWaypointIndex: number | null
  onMapClick: (coords: Coordinates) => void
  onWaypointDrag: (index: number, newPosition: Coordinates) => void
  onWaypointSelect: (index: number | null) => void
}

// Map component for railway route visualization
export default function MapViewContent(props: MapViewContentProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<any>(null)
  const LRef = useRef<any>(null)
  const [mapReady, setMapReady] = useState(false)
  const [legendCollapsed, setLegendCollapsed] = useState(true)

  useEffect(() => {
    if (mapRef.current) return
    if (!containerRef.current) return
    if ((containerRef.current as any)?._leaflet_id) return

    let mounted = true

    const init = async () => {
      try {
        const L = await import('leaflet').then(m => m.default)
        if (!mounted || !containerRef.current) return

        LRef.current = L

        delete (L.Icon.Default.prototype as any)._getIconUrl
        L.Icon.Default.mergeOptions({
          iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
          iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
          shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
        })

        const map = L.map(containerRef.current, { center: [20, 0], zoom: 2 })
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '&copy; OpenStreetMap',
          maxZoom: 19,
          crossOrigin: true,
        }).addTo(map)

        const container = map.getContainer() as HTMLElement & {
          __railwayLeafletMap?: import('leaflet').Map
        }
        container.__railwayLeafletMap = map

        mapRef.current = map
        setMapReady(true)
      } catch (e) {
        console.error('Map init failed:', e)
      }
    }

    init()
    return () => { mounted = false }
  }, [])

  useEffect(() => {
    if (!mapReady || !mapRef.current || !LRef.current) return
    if (props.routeWaypoints.length < 2) return

    const L = LRef.current
    const map = mapRef.current
    const isEditMode = props.mapMode === 'edit-route'

    // Remove existing route layers
    map.eachLayer((layer: any) => {
      if (layer instanceof L.Polyline || layer instanceof L.CircleMarker || layer instanceof L.Marker) {
        map.removeLayer(layer)
      }
    })

    const latLngs = props.routeWaypoints.map((wp: RoutePoint) => [wp.lat, wp.lng])
    
    // Draw route line (dashed in edit mode)
    L.polyline(latLngs, { 
      color: '#3b82f6', 
      weight: 4, 
      opacity: 0.8,
      dashArray: isEditMode ? '10, 5' : undefined
    }).addTo(map)

    if (isEditMode) {
      const editIndices = new Set(
        getEditModeMarkerIndices(props.routeWaypoints, props.coordinateIntervalKm)
      )
      for (let i = 0; i < props.routeWaypoints.length; i++) {
        const wp = props.routeWaypoints[i]
        if (wp.isHelperNode || !editIndices.has(i)) continue

        const marker = L.marker([wp.lat, wp.lng], {
          draggable: true,
          icon: L.divIcon({
            className: 'custom-drag-marker',
            html: `<div style="width:12px;height:12px;background:#f59e0b;border:2px solid white;border-radius:50%;cursor:grab;"></div>`,
            iconSize: [12, 12],
            iconAnchor: [6, 6],
          }),
        })

        marker.on('dragend', (e: any) => {
          const pos = e.target.getLatLng()
          props.onWaypointDrag(i, { lat: pos.lat, lng: pos.lng })
        })

        marker.addTo(map)
      }
    } else if (props.intervalCoordinates?.length) {
      // Normal mode: show interval markers
      props.intervalCoordinates.forEach((coord: IntervalCoordinate) => {
        const isEnd = coord.index === 0 || coord.index === props.intervalCoordinates!.length - 1
        L.circleMarker([coord.lat, coord.lng], {
          radius: isEnd ? 6 : 4,
          fillColor: isEnd ? '#10b981' : '#06b6d4',
          color: '#fff',
          weight: 2,
          fillOpacity: 0.8,
        }).bindPopup(`WP ${coord.index} - ${coord.distanceFromStart.toFixed(1)}km`).addTo(map)
      })
    }

    // Avoid fitBounds while editing — it runs every waypoint update and resets zoom/pan.
    if (latLngs.length > 0 && !isEditMode) {
      map.fitBounds(L.latLngBounds(latLngs), { padding: [50, 50] })
    }
  }, [
    mapReady,
    props.routeWaypoints,
    props.intervalCoordinates,
    props.mapMode,
    props.coordinateIntervalKm,
    props.onWaypointDrag,
  ])

  useEffect(() => {
    if (!mapReady || !mapRef.current || !LRef.current) return
    const L = LRef.current
    const map = mapRef.current

    if (props.startPoint) {
      L.circleMarker([props.startPoint.lat, props.startPoint.lng], {
        radius: 8, fillColor: '#10b981', color: '#fff', weight: 3, fillOpacity: 0.9,
      }).bindPopup('Start').addTo(map)
    }

    if (props.endPoint) {
      L.circleMarker([props.endPoint.lat, props.endPoint.lng], {
        radius: 8, fillColor: '#ef4444', color: '#fff', weight: 3, fillOpacity: 0.9,
      }).bindPopup('End').addTo(map)
    }
  }, [mapReady, props.startPoint, props.endPoint])

  return (
    <div
      className="relative h-full min-h-[400px] w-full overflow-hidden rounded-2xl"
    >
      <div ref={containerRef} className="h-full w-full" />

      {mapReady && (
        <div className="pointer-events-auto absolute bottom-4 right-4 z-[1000] max-w-[240px] text-xs">
          {legendCollapsed ? (
            <button
              type="button"
              onClick={() => setLegendCollapsed(false)}
              className="flex w-full items-center justify-between gap-2 rounded-xl border border-border/50 bg-card/90 px-3 py-2.5 shadow-lg shadow-black/30 backdrop-blur-md transition-colors hover:bg-card"
              title="Show map legend"
            >
              <span className="text-sm font-semibold tracking-tight text-foreground">Legend</span>
              <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
            </button>
          ) : (
            <div className="overflow-hidden rounded-xl border border-border/50 bg-card/90 shadow-xl shadow-black/35 backdrop-blur-md">
              <div className="flex items-center justify-between gap-2 border-b border-border/40 px-3 py-2.5">
                <span className="text-sm font-semibold tracking-tight text-foreground">Legend</span>
                <button
                  type="button"
                  onClick={() => setLegendCollapsed(true)}
                  className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                  title="Hide legend"
                >
                  <ChevronDown className="h-4 w-4 rotate-180" />
                </button>
              </div>
              <div className="max-h-[min(65vh,380px)] space-y-2.5 overflow-y-auto p-3">
                <div className="space-y-1.5">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Route</p>
                  <div className="flex items-center gap-2">
                    <div className="h-1 w-6 shrink-0 rounded bg-blue-500" />
                    <span className="text-foreground/85">Railway line</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="h-2.5 w-2.5 shrink-0 rounded-full border border-background bg-emerald-500" />
                    <span className="text-foreground/85">Start</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="h-2.5 w-2.5 shrink-0 rounded-full border border-background bg-red-500" />
                    <span className="text-foreground/85">End</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="h-2.5 w-2.5 shrink-0 rounded-full border border-background bg-cyan-500" />
                    <span className="text-foreground/85">Interval point</span>
                  </div>
                </div>

                {props.mapMode === 'edit-route' && (
                  <div className="space-y-1.5 border-t border-border/40 pt-2">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Edit mode</p>
                    <div className="flex items-center gap-2">
                      <div className="h-3 w-3 shrink-0 rounded-full border-2 border-background bg-amber-500" />
                      <span className="text-foreground/85">Waypoint (drag)</span>
                    </div>
                  </div>
                )}

                <div className="space-y-1.5 border-t border-border/40 pt-2">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Land & terrain</p>
                  <div className="flex items-center gap-2">
                    <div className="h-4 w-5 shrink-0 rounded-sm border border-amber-700/40 bg-amber-200/40" />
                    <span className="text-foreground/85">Open land / fields</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="h-4 w-5 shrink-0 rounded-sm bg-green-700" />
                    <span className="text-foreground/85">Trees / forest</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="h-4 w-5 shrink-0 rounded-sm bg-sky-400" />
                    <span className="text-foreground/85">River / water</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="h-4 w-5 shrink-0 rounded-sm bg-stone-500" />
                    <span className="text-foreground/85">Mountain / rock</span>
                  </div>
                </div>

                <div className="space-y-1.5 border-t border-border/40 pt-2">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Built-up</p>
                  <div className="flex items-center gap-2">
                    <div className="h-0.5 w-5 shrink-0 bg-foreground/70" />
                    <span className="text-foreground/85">Road</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="h-4 w-4 shrink-0 rounded-sm border border-yellow-800/50 bg-yellow-600/90" />
                    <span className="text-foreground/85">Settlement / urban</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <svg className="h-3.5 w-3.5 shrink-0 text-foreground/70" viewBox="0 0 12 12" fill="none" stroke="currentColor">
                      <circle cx="6" cy="6" r="4" strokeWidth="1" />
                    </svg>
                    <span className="text-foreground/85">Town / city</span>
                  </div>
                </div>

                <p className="border-t border-border/40 pt-2 text-[10px] leading-snug text-muted-foreground">
                  Layer colors align with typical uploads. Basemap © OpenStreetMap.
                </p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
