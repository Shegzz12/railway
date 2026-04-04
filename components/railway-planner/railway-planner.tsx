'use client'

import { useState, useCallback, useEffect, useMemo, useRef } from 'react'
import dynamic from 'next/dynamic'
import { Train, Route, RotateCcw, LogOut } from 'lucide-react'
import { DataUploadPanel } from './data-upload-panel'
import { ObstacleSelector } from './obstacle-selector'
import { RouteControls } from './route-controls'
import { RouteStatistics } from './route-statistics'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import type {
  SpatialDataset,
  Coordinates,
  RoutePoint,
  MapMode,
  GeneratedRoute,
  RouteGenerationConfig,
  DEMData,
} from '@/lib/types/spatial-types'
import {
  generateRoute,
  calculateRouteDistance,
  calculateRouteGradients,
  recalculateRouteSegment,
  generateIntervalCoordinates,
  DEFAULT_CONFIG,
} from '@/lib/routing/astar-pathfinder'

/** Remove legacy pink helper nodes; route editing uses main waypoints only. */
function stripHelperWaypoints(waypoints: RoutePoint[]): RoutePoint[] {
  return waypoints
    .filter((wp) => !wp.isHelperNode)
    .map((wp, i) => ({ ...wp, index: i, isHelperNode: undefined }))
}

// Dynamically import MapView to avoid SSR issues with Leaflet
const MapView = dynamic(
  () => import('./map-view').then((mod) => ({ default: mod.MapView })),
  {
    ssr: false,
    loading: () => (
      <div className="flex min-h-[400px] w-full items-center justify-center rounded-xl bg-muted/30 ring-1 ring-border/40">
        <div className="text-center">
          <div className="mx-auto mb-3 h-9 w-9 animate-spin rounded-full border-2 border-primary/30 border-t-primary" />
          <p className="text-sm font-medium text-muted-foreground">Loading map…</p>
        </div>
      </div>
    ),
  }
)

export function RailwayPlanner() {
  // References
  const mapRef = useRef<HTMLDivElement>(null)

  // State management
  const [datasets, setDatasets] = useState<SpatialDataset[]>([])
  const [startPoint, setStartPoint] = useState<Coordinates | null>(null)
  const [endPoint, setEndPoint] = useState<Coordinates | null>(null)
  const [mapMode, setMapMode] = useState<MapMode>('view')
  const [routeWaypoints, setRouteWaypoints] = useState<RoutePoint[]>([])
  const [selectedWaypointIndex, setSelectedWaypointIndex] = useState<number | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [config, setConfig] = useState<RouteGenerationConfig>(DEFAULT_CONFIG)
  const [generatedRoute, setGeneratedRoute] = useState<GeneratedRoute | null>(null)
  const [showExitDialog, setShowExitDialog] = useState(false)

  // Drop helper nodes when entering edit mode (no pink nodes anymore)
  useEffect(() => {
    if (mapMode !== 'edit-route') return
    setRouteWaypoints((prev) => {
      if (!prev.some((w) => w.isHelperNode)) return prev
      return stripHelperWaypoints(prev)
    })
    setGeneratedRoute((gr) => {
      if (!gr || !gr.waypoints.some((w) => w.isHelperNode)) return gr
      const waypoints = stripHelperWaypoints(gr.waypoints)
      const intervalCoordinates = generateIntervalCoordinates(waypoints, config.coordinateInterval)
      const totalDistance = calculateRouteDistance(waypoints)
      const { max, avg } = calculateRouteGradients(waypoints)
      return {
        ...gr,
        waypoints,
        intervalCoordinates,
        totalDistance,
        maxGradient: max,
        avgGradient: avg,
      }
    })
  }, [mapMode, config.coordinateInterval])

  // Get DEM data from datasets
  const demData = useMemo(() => {
    const demDataset = datasets.find((d) => d.type === 'dem' && d.data)
    return demDataset?.data as DEMData | null
  }, [datasets])

  // Get obstacle datasets
  const obstacles = useMemo(() => {
    return datasets.filter((d) => d.isObstacle)
  }, [datasets])

  // Dataset management
  const handleDatasetAdd = useCallback((dataset: SpatialDataset) => {
    setDatasets((prev) => [...prev, dataset])
  }, [])

  const handleDatasetRemove = useCallback((id: string) => {
    setDatasets((prev) => prev.filter((d) => d.id !== id))
  }, [])

  const handleToggleObstacle = useCallback((id: string, isObstacle: boolean) => {
    setDatasets((prev) =>
      prev.map((d) => (d.id === id ? { ...d, isObstacle } : d))
    )
  }, [])

  const handleToggleVisibility = useCallback((id: string, visible: boolean) => {
    setDatasets((prev) =>
      prev.map((d) => (d.id === id ? { ...d, visible } : d))
    )
  }, [])

  // Reset project - clear all data
  const handleReset = useCallback(() => {
    setDatasets([])
    setStartPoint(null)
    setEndPoint(null)
    setRouteWaypoints([])
    setGeneratedRoute(null)
    setMapMode('view')
    setConfig(DEFAULT_CONFIG)
  }, [])

  // Exit project with confirmation
  const handleExit = useCallback(() => {
    setShowExitDialog(true)
  }, [])

  const handleConfirmExit = useCallback(() => {
    handleReset()
    setShowExitDialog(false)
    // Page will reload or reset to fresh state
    window.location.reload()
  }, [handleReset])

  // Map click handler
  const handleMapClick = useCallback(
    (coords: Coordinates) => {
      switch (mapMode) {
        case 'set-start':
          setStartPoint(coords)
          setMapMode('view')
          break
        case 'set-end':
          setEndPoint(coords)
          setMapMode('view')
          break
        default:
          break
      }
    },
    [mapMode]
  )

  // Route generation
  const handleGenerateRoute = useCallback(async () => {
    if (!startPoint || !endPoint) return

    setIsGenerating(true)
    setGeneratedRoute(null)

    // Use setTimeout to allow UI to update
    setTimeout(() => {
      try {
        const waypoints = generateRoute(
          startPoint,
          endPoint,
          obstacles,
          demData,
          config
        )

        const distance = calculateRouteDistance(waypoints)
        const { max, avg } = calculateRouteGradients(waypoints)

        // Generate interval coordinates
        const intervalCoordinates = generateIntervalCoordinates(
          waypoints,
          config.coordinateInterval
        )

        setRouteWaypoints(waypoints)

        const route: GeneratedRoute = {
          id: crypto.randomUUID(),
          name: `Route ${new Date().toLocaleTimeString()}`,
          waypoints,
          intervalCoordinates,
          totalDistance: distance,
          maxGradient: max,
          avgGradient: avg,
          isModified: false,
          createdAt: new Date(),
          obstacles: obstacles.map((o) => o.id),
        }

        setGeneratedRoute(route)
        setMapMode('view')
      } catch (error) {
        console.error('Route generation failed:', error)
      } finally {
        setIsGenerating(false)
      }
    }, 100)
  }, [startPoint, endPoint, obstacles, demData, config])

  // Waypoint editing
  const handleWaypointDrag = useCallback(
    (index: number, newPosition: Coordinates) => {
      const updated = recalculateRouteSegment(
        routeWaypoints,
        index,
        newPosition,
        obstacles,
        demData,
        config
      )
      const next = stripHelperWaypoints(updated)

      setRouteWaypoints(next)

      if (generatedRoute) {
        const intervalCoordinates = generateIntervalCoordinates(
          next,
          config.coordinateInterval
        )
        const distance = calculateRouteDistance(next)
        const { max, avg } = calculateRouteGradients(next)

        setGeneratedRoute({
          ...generatedRoute,
          waypoints: next,
          intervalCoordinates,
          totalDistance: distance,
          maxGradient: max,
          avgGradient: avg,
          isModified: true,
        })
      }
    },
    [routeWaypoints, obstacles, demData, config, generatedRoute]
  )

  const handleWaypointSelect = useCallback((index: number | null) => {
    setSelectedWaypointIndex(index)
  }, [])

  const handleExport = useCallback((format: 'geojson') => {
    // Export handled in RouteStatistics component
  }, [])

  return (
    <div className="relative flex h-screen flex-col bg-background">
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_120%_80%_at_50%_-20%,oklch(0.65_0.18_160/0.12),transparent_50%)]"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_100%_50%,oklch(0.55_0.12_260/0.06),transparent_45%)]"
        aria-hidden
      />

      <header className="relative z-10 flex h-[4.25rem] shrink-0 items-center justify-between border-b border-border/50 bg-card/30 px-6 backdrop-blur-xl">
        <div className="flex items-center gap-4">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/15 ring-1 ring-primary/25 shadow-inner">
            <Train className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-[15px] font-semibold tracking-tight text-foreground">
              Railway Route Planner
            </h1>
            <p className="text-[11px] text-muted-foreground">
              Spatial routing, DEM-aware paths & exports
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="flex items-center rounded-lg border border-border/50 bg-secondary/40 px-2 py-1 text-[10px] font-medium tabular-nums text-muted-foreground shadow-sm sm:hidden">
            {datasets.length}d · {obstacles.length}o
          </div>
          <div className="hidden items-center gap-2 rounded-full border border-border/50 bg-secondary/40 px-3 py-1.5 text-[11px] font-medium text-muted-foreground shadow-sm sm:flex">
            <span className="tabular-nums text-foreground/90">{datasets.length}</span>
            <span className="text-border">/</span>
            <span className="text-muted-foreground">datasets</span>
            <span className="mx-1 h-3 w-px bg-border/60" aria-hidden />
            <span className="tabular-nums text-foreground/90">{obstacles.length}</span>
            <span className="text-muted-foreground">obstacles</span>
          </div>
          <button
            type="button"
            onClick={handleReset}
            className="rounded-xl p-2.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            title="Reset project"
          >
            <RotateCcw className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={handleExit}
            className="rounded-xl p-2.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            title="Exit project"
          >
            <LogOut className="h-5 w-5" />
          </button>
        </div>
      </header>

      <div className="relative z-10 flex flex-1 gap-5 overflow-hidden p-5">
        <aside className="flex w-[22.5rem] min-w-0 max-w-[22.5rem] shrink-0 flex-col overflow-x-hidden overflow-y-auto rounded-2xl border border-border/40 bg-card/35 shadow-lg shadow-black/20 backdrop-blur-md">
          <div className="flex min-w-0 w-full max-w-full flex-col gap-5 p-5">
            <DataUploadPanel
              datasets={datasets}
              onDatasetAdd={handleDatasetAdd}
              onDatasetRemove={handleDatasetRemove}
            />

            <ObstacleSelector
              datasets={datasets}
              onToggleObstacle={handleToggleObstacle}
              onToggleVisibility={handleToggleVisibility}
            />

            <RouteControls
              startPoint={startPoint}
              endPoint={endPoint}
              mapMode={mapMode}
              isGenerating={isGenerating}
              hasRoute={routeWaypoints.length > 0}
              config={config}
              onSetMode={setMapMode}
              onGenerateRoute={handleGenerateRoute}
              onConfigChange={setConfig}
              onSetStartPoint={setStartPoint}
              onSetEndPoint={setEndPoint}
            />
          </div>
        </aside>

        <main className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-2xl border border-border/40 bg-card/20 shadow-xl shadow-black/25 ring-1 ring-white/[0.04] backdrop-blur-sm">
          {generatedRoute ? (
            <>
              <div className="min-h-0 flex-1 overflow-hidden rounded-t-2xl" ref={mapRef}>
                <MapView
                  datasets={datasets}
                  startPoint={startPoint}
                  endPoint={endPoint}
                  routeWaypoints={routeWaypoints}
                  intervalCoordinates={generatedRoute?.intervalCoordinates}
                  coordinateIntervalKm={config.coordinateInterval}
                  mapMode={mapMode}
                  selectedWaypointIndex={selectedWaypointIndex}
                  onMapClick={handleMapClick}
                  onWaypointDrag={handleWaypointDrag}
                  onWaypointSelect={handleWaypointSelect}
                />
              </div>

              {/* Route statistics footer with improved styling */}
              <div className="shrink-0 border-t border-border/40 bg-card/40 px-5 py-4 backdrop-blur-md">
                <RouteStatistics route={generatedRoute} dem={demData} mapRef={mapRef} onExport={handleExport} />
              </div>
            </>
          ) : (
            <div className="flex flex-1 items-center justify-center p-10">
              <div className="max-w-md space-y-6 text-center">
                <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-3xl bg-primary/10 ring-1 ring-primary/20">
                  <Route className="h-11 w-11 text-primary/80" strokeWidth={1.25} />
                </div>
                <div className="space-y-2">
                  <h3 className="text-lg font-semibold tracking-tight text-foreground">
                    No route yet
                  </h3>
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    Set start and end in the workspace, add layers if needed, then generate to preview
                    the path on the map.
                  </p>
                </div>
                <div className="rounded-xl border border-border/50 bg-secondary/25 px-4 py-3 text-left text-xs leading-relaxed text-muted-foreground">
                  <p className="mb-2 font-semibold text-foreground/90">Quick start</p>
                  <ol className="list-inside list-decimal space-y-1.5 marker:text-primary/80">
                    <li>Upload GeoJSON, CSV, GeoTIFF, or shapefile (ZIP)</li>
                    <li>Enter start and end coordinates</li>
                    <li>Mark obstacles on layers as needed</li>
                    <li>Generate route</li>
                  </ol>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Exit confirmation dialog */}
      <AlertDialog open={showExitDialog} onOpenChange={setShowExitDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Exit Railway Planner?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to exit? All project data will be cleared and the application will return to its initial state.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex gap-3">
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmExit} className="bg-destructive hover:bg-destructive/90">
              Exit
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
