'use client'

import { useState, useCallback, useEffect } from 'react'
import {
  Route,
  Loader2,
  Settings2,
  Play,
  LocateFixed,
  CheckCircle,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import type { Coordinates, MapMode, RouteGenerationConfig } from '@/lib/types/spatial-types'
import { DEFAULT_CONFIG } from '@/lib/routing/astar-pathfinder'

interface RouteControlsProps {
  startPoint: Coordinates | null
  endPoint: Coordinates | null
  mapMode: MapMode
  isGenerating: boolean
  hasRoute: boolean
  config: RouteGenerationConfig
  onSetMode: (mode: MapMode) => void
  onGenerateRoute: () => void
  onConfigChange: (config: RouteGenerationConfig) => void
  onSetStartPoint: (coords: Coordinates) => void
  onSetEndPoint: (coords: Coordinates) => void
}

export function RouteControls({
  startPoint,
  endPoint,
  mapMode,
  isGenerating,
  hasRoute,
  config,
  onSetMode,
  onConfigChange,
  onGenerateRoute,
  onSetStartPoint,
  onSetEndPoint,
}: RouteControlsProps) {
  const [mounted, setMounted] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [showCoordInputs, setShowCoordInputs] = useState(true)
  const [startError, setStartError] = useState('')
  const [endError, setEndError] = useState('')

  // Ensure component is mounted before rendering Collapsible to avoid hydration mismatch
  useEffect(() => {
    setMounted(true)
  }, [])

  // Local state for coordinate inputs
  const [startLat, setStartLat] = useState('')
  const [startLng, setStartLng] = useState('')
  const [endLat, setEndLat] = useState('')
  const [endLng, setEndLng] = useState('')

  // Sync local state with parent props
  useEffect(() => {
    if (startPoint) {
      setStartLat(startPoint.lat.toString())
      setStartLng(startPoint.lng.toString())
    }
  }, [startPoint])

  useEffect(() => {
    if (endPoint) {
      setEndLat(endPoint.lat.toString())
      setEndLng(endPoint.lng.toString())
    }
  }, [endPoint])

  const canGenerate = startPoint !== null && endPoint !== null && !isGenerating

  // Parse and validate coordinates
  const parseCoord = (value: string): number | null => {
    const num = parseFloat(value)
    return isNaN(num) ? null : num
  }

  const handleApplyStartCoords = () => {
    const lat = parseCoord(startLat)
    const lng = parseCoord(startLng)
    
    if (startLat === '' || startLng === '') {
      setStartError('Please enter both latitude and longitude')
      return
    }
    
    if (lat === null || lng === null) {
      setStartError('Invalid format. Please enter valid decimal numbers')
      return
    }
    
    if (lat < -90 || lat > 90) {
      setStartError('Latitude must be between -90 and 90')
      return
    }
    
    if (lng < -180 || lng > 180) {
      setStartError('Longitude must be between -180 and 180')
      return
    }
    
    setStartError('')
    onSetStartPoint({ lat, lng })
  }

  const handleApplyEndCoords = () => {
    const lat = parseCoord(endLat)
    const lng = parseCoord(endLng)
    
    if (endLat === '' || endLng === '') {
      setEndError('Please enter both latitude and longitude')
      return
    }
    
    if (lat === null || lng === null) {
      setEndError('Invalid format. Please enter valid decimal numbers')
      return
    }
    
    if (lat < -90 || lat > 90) {
      setEndError('Latitude must be between -90 and 90')
      return
    }
    
    if (lng < -180 || lng > 180) {
      setEndError('Longitude must be between -180 and 180')
      return
    }
    
    setEndError('')
    onSetEndPoint({ lat, lng })
  }

  return (
    <Card className="border-border/40 bg-card/50 shadow-sm shadow-black/10 backdrop-blur-sm" suppressHydrationWarning>
      <CardHeader className="space-y-0 pb-3" suppressHydrationWarning>
        <CardTitle className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground" suppressHydrationWarning>
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-sky-500/10 text-sky-400">
            <Route className="h-3.5 w-3.5" />
          </span>
          Route generation
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4" suppressHydrationWarning>
        {/* Coordinate inputs */}
        {mounted && (
          <Collapsible open={showCoordInputs} onOpenChange={setShowCoordInputs}>
            <CollapsibleTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-9 w-full justify-between rounded-lg border border-border/40 bg-secondary/20 px-3 text-xs font-medium hover:bg-secondary/40"
              >
                <span className="flex items-center gap-2">
                  <LocateFixed className="h-3.5 w-3.5 text-primary" />
                  Coordinates
                </span>
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-4 pt-3">
            {/* Start Point Input */}
            <div className="space-y-2 rounded-xl border border-border/40 bg-secondary/25 p-3">
              <div className="mb-2 flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_8px_oklch(0.72_0.17_160/0.5)]" />
                <span className="text-xs font-semibold text-foreground/90">Start</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-[10px] text-muted-foreground">Latitude</Label>
                  <Input
                    type="number"
                    step="any"
                    placeholder="e.g. 40.7128"
                    value={startLat}
                    onChange={(e) => setStartLat(e.target.value)}
                    className="h-9 border-border/50 bg-background/50 text-xs font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] text-muted-foreground">Longitude</Label>
                  <Input
                    type="number"
                    step="any"
                    placeholder="e.g. -74.0060"
                    value={startLng}
                    onChange={(e) => setStartLng(e.target.value)}
                    className="h-9 border-border/50 bg-background/50 text-xs font-mono"
                  />
                </div>
              </div>
              {startError && (
                <div className="text-xs text-red-500 bg-red-500/10 border border-red-500/30 rounded p-2">
                  ✗ {startError}
                </div>
              )}
              <Button
                variant="outline"
                size="sm"
                className="w-full h-7 text-xs"
                onClick={handleApplyStartCoords}
              >
                {startPoint ? (
                  <>
                    <CheckCircle className="w-3 h-3 mr-1 text-emerald-500" />
                    Start Point Set
                  </>
                ) : (
                  'Apply Start Point'
                )}
              </Button>
            </div>

            {/* End Point Input */}
            <div className="space-y-2 rounded-xl border border-border/40 bg-secondary/25 p-3">
              <div className="mb-2 flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-red-400 shadow-[0_0_8px_oklch(0.63_0.22_25/0.45)]" />
                <span className="text-xs font-semibold text-foreground/90">End</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-[10px] text-muted-foreground">Latitude</Label>
                  <Input
                    type="number"
                    step="any"
                    placeholder="e.g. 34.0522"
                    value={endLat}
                    onChange={(e) => setEndLat(e.target.value)}
                    className="h-9 border-border/50 bg-background/50 text-xs font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] text-muted-foreground">Longitude</Label>
                  <Input
                    type="number"
                    step="any"
                    placeholder="e.g. -118.2437"
                    value={endLng}
                    onChange={(e) => setEndLng(e.target.value)}
                    className="h-9 border-border/50 bg-background/50 text-xs font-mono"
                  />
                </div>
              </div>
              {endError && (
                <div className="text-xs text-red-500 bg-red-500/10 border border-red-500/30 rounded p-2">
                  ✗ {endError}
                </div>
              )}
              <Button
                variant="outline"
                size="sm"
                className="w-full h-7 text-xs"
                onClick={handleApplyEndCoords}
              >
                {endPoint ? (
                  <>
                    <CheckCircle className="w-3 h-3 mr-1 text-emerald-500" />
                    End Point Set
                  </>
                ) : (
                  'Apply End Point'
                )}
              </Button>
            </div>
          </CollapsibleContent>
        </Collapsible>
        )}

        {/* Current point display */}
        <div className="space-y-2 rounded-xl border border-border/35 bg-muted/15 p-3">
          <div className="flex items-center gap-2 text-xs">
            <div className="h-2 w-2 shrink-0 rounded-full bg-emerald-400" />
            <span className="text-muted-foreground">Start:</span>
            <span className="font-mono text-[10px]">
              {startPoint
                ? `${startPoint.lat.toFixed(6)}, ${startPoint.lng.toFixed(6)}`
                : 'Not set'}
            </span>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <div className="h-2 w-2 shrink-0 rounded-full bg-red-400" />
            <span className="text-muted-foreground">End:</span>
            <span className="font-mono text-[10px]">
              {endPoint
                ? `${endPoint.lat.toFixed(6)}, ${endPoint.lng.toFixed(6)}`
                : 'Not set'}
            </span>
          </div>
        </div>

        {/* Generate Route Button */}
        <Button
          onClick={onGenerateRoute}
          disabled={!canGenerate}
          size="sm"
          className="h-10 w-full rounded-xl font-semibold shadow-md shadow-primary/15 transition-shadow hover:shadow-lg hover:shadow-primary/20 disabled:shadow-none"
        >
          {isGenerating ? (
            <>
              <Loader2 className="w-3 h-3 mr-2 animate-spin" />
              Generating...
            </>
          ) : (
            <>
              <Play className="w-3 h-3 mr-2" />
              Generate Route
            </>
          )}
        </Button>

        {/* Route Settings */}
        {mounted && (
        <Collapsible open={showSettings} onOpenChange={setShowSettings}>
          <CollapsibleTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-9 w-full justify-between rounded-lg border border-border/40 bg-secondary/20 px-3 text-xs font-medium hover:bg-secondary/40"
            >
              <span className="flex items-center gap-2">
                <Settings2 className="h-3.5 w-3.5 text-muted-foreground" />
                Route settings
              </span>
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-4 pt-3">
            {/* Max Gradient */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-[10px] font-medium">Max Gradient</Label>
                <span className="text-xs font-mono bg-secondary/50 px-2 py-0.5 rounded">
                  {config.maxGradient.toFixed(1)}%
                </span>
              </div>
              <Slider
                value={[config.maxGradient]}
                onValueChange={(value) =>
                  onConfigChange({ ...config, maxGradient: value[0] })
                }
                min={1}
                max={10}
                step={0.5}
                className="w-full"
              />
              <p className="text-[9px] text-muted-foreground">
                Maximum allowable slope for railway (typical: 2-4%)
              </p>
            </div>

            {/* Grid Resolution */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-[10px] font-medium">Grid Resolution</Label>
                <span className="text-xs font-mono bg-secondary/50 px-2 py-0.5 rounded">
                  {config.gridResolution}m
                </span>
              </div>
              <Slider
                value={[config.gridResolution]}
                onValueChange={(value) =>
                  onConfigChange({ ...config, gridResolution: value[0] })
                }
                min={200}
                max={2000}
                step={100}
                className="w-full"
              />
              <p className="text-[9px] text-muted-foreground">
                Smaller = more precise but slower (200-2000m)
              </p>
            </div>

            {/* Coordinate Interval */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-[10px] font-medium">Coordinate Interval</Label>
                <span className="text-xs font-mono bg-secondary/50 px-2 py-0.5 rounded">
                  {config.coordinateInterval >= 1 
                    ? `${config.coordinateInterval.toFixed(1)}km` 
                    : `${(config.coordinateInterval * 1000).toFixed(0)}m`}
                </span>
              </div>
              <Slider
                value={[config.coordinateInterval]}
                onValueChange={(value) =>
                  onConfigChange({ ...config, coordinateInterval: value[0] })
                }
                min={0.02}
                max={20}
                step={0.01}
                className="w-full"
              />
              <p className="text-[9px] text-muted-foreground">
                Generate waypoint coordinates at this spacing (0.02km - 20km)
              </p>
            </div>

            {/* Obstacle Buffer */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-[10px] font-medium">Obstacle Buffer</Label>
                <span className="text-xs font-mono bg-secondary/50 px-2 py-0.5 rounded">
                  {config.obstacleBuffer}m
                </span>
              </div>
              <Slider
                value={[config.obstacleBuffer]}
                onValueChange={(value) =>
                  onConfigChange({ ...config, obstacleBuffer: value[0] })
                }
                min={0}
                max={500}
                step={10}
                className="w-full"
              />
              <p className="text-[9px] text-muted-foreground">
                Safety buffer around obstacles (0-500m)
              </p>
            </div>
          </CollapsibleContent>
        </Collapsible>
        )}

        {/* Edit Route Mode */}
        {hasRoute && (
          <Button
            variant={mapMode === 'edit-route' ? 'default' : 'outline'}
            size="sm"
            className="h-9 w-full rounded-xl text-xs font-medium"
            onClick={() => onSetMode(mapMode === 'edit-route' ? 'view' : 'edit-route')}
          >
            {mapMode === 'edit-route' ? 'Exit Edit Mode' : 'Edit Route'}
          </Button>
        )}

        {/* Help Text */}
        <div className="rounded-lg border border-border/35 bg-muted/10 p-3">
          <p className="text-[10px] font-semibold text-foreground/80">Workflow</p>
          <ol className="ml-2 mt-2 space-y-1 text-[9px] leading-relaxed text-muted-foreground">
            <li>1. Enter start and end coordinates</li>
            <li>2. Upload spatial datasets (DEM, slope, etc.)</li>
            <li>3. Mark datasets as obstacles</li>
            <li>4. Adjust settings if needed</li>
            <li>5. Click &quot;Generate Route&quot;</li>
            <li>6. Drag waypoints to adjust</li>
            <li>7. Export in your preferred format</li>
          </ol>
        </div>
      </CardContent>
    </Card>
  )
}
