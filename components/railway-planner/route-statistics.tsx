'use client'

import { useState, useEffect } from 'react'
import { Download, BarChart3, TrendingUp, Ruler, MapPin, Image as ImageIcon, Database, ChevronDown } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import type { GeneratedRoute } from '@/lib/types/spatial-types'
import { exportRouteAsGeoJSON } from '@/lib/parsers'

interface RouteStatisticsProps {
  route: GeneratedRoute | null
  dem?: any
  mapRef?: React.RefObject<HTMLDivElement>
  onExport?: (format: string) => void
}

export function RouteStatistics({ route, dem, mapRef, onExport }: RouteStatisticsProps) {
  const [showCoordinates, setShowCoordinates] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [isCollapsed, setIsCollapsed] = useState(true)
  const [isDragging, setIsDragging] = useState(false)

  // Ensure component is mounted before rendering to avoid hydration mismatch
  useEffect(() => {
    setMounted(true)
  }, [])

  const handleDragStart = () => {
    setIsDragging(true)
  }

  const handleDragEnd = () => {
    setIsDragging(false)
  }

  const handleMouseMove = (e: MouseEvent) => {
    if (isDragging && e.clientY > window.innerHeight - 200) {
      setIsCollapsed(true)
      setIsDragging(false)
    }
  }

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove)
      window.addEventListener('mouseup', handleDragEnd)
      return () => {
        window.removeEventListener('mousemove', handleMouseMove)
        window.removeEventListener('mouseup', handleDragEnd)
      }
    }
  }, [isDragging])

  const handleExportGeoJSON = () => {
    if (!route) return
    try {
      console.log('[v0] Exporting GeoJSON for route:', route.name)
      const geojson = exportRouteAsGeoJSON(route.waypoints, route.name, {
        totalDistance: route.totalDistance,
        maxGradient: route.maxGradient,
        avgGradient: route.avgGradient,
        waypointCount: route.waypoints.length,
        intervalCoordinates: route.intervalCoordinates,
        createdAt: route.createdAt.toISOString(),
      })

      const blob = new Blob([JSON.stringify(geojson, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const filename = `${route.name.replace(/\s+/g, '-').toLowerCase()}.geojson`
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      console.log('[v0] Downloading file:', filename)
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      console.log('[v0] GeoJSON export completed')
      onExport?.('geojson')
    } catch (error) {
      console.error('[v0] Failed to export GeoJSON:', error)
    }
  }

  const handleExportCSV = () => {
    if (!route) return
    try {
      console.log('[v0] Exporting CSV with', route.intervalCoordinates?.length || 0, 'coordinates')
      if (!route.intervalCoordinates || route.intervalCoordinates.length === 0) {
        console.warn('[v0] No interval coordinates to export')
        return
      }

      const headers = ['Index', 'Latitude', 'Longitude', 'Distance from Start (km)', 'Elevation (m)']
      const rows = route.intervalCoordinates.map((coord) => [
        coord.index.toString(),
        coord.lat.toFixed(6),
        coord.lng.toFixed(6),
        coord.distanceFromStart.toFixed(2),
        coord.elevation ? coord.elevation.toFixed(2) : 'N/A',
      ])

      const csv = [headers, ...rows].map((row) => row.join(',')).join('\n')
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const filename = `${route.name.replace(/\s+/g, '-').toLowerCase()}-coordinates.csv`
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      console.log('[v0] Downloading CSV:', filename)
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      console.log('[v0] CSV export completed')
      onExport?.('csv')
    } catch (error) {
      console.error('[v0] Failed to export CSV:', error)
    }
  }

  const handleExportPNG = async () => {
    if (!route || !mapRef?.current) return

    try {
      setIsExporting(true)

      const { toPng } = await import('html-to-image')
      const L = (await import('leaflet')).default

      const root = mapRef.current
      const leafletEl = root.querySelector('.leaflet-container') as
        | (HTMLElement & { __railwayLeafletMap?: import('leaflet').Map })
        | null

      if (!leafletEl) {
        alert('Map is not ready yet. Wait a moment and try again.')
        return
      }

      const leafletMap = leafletEl.__railwayLeafletMap
      if (leafletMap && route.waypoints.length >= 2) {
        const latlngs = route.waypoints.map((w) => [w.lat, w.lng] as [number, number])
        const bounds = L.latLngBounds(latlngs)
        leafletMap.fitBounds(bounds, { padding: [48, 48], animate: false, maxZoom: 16 })
        leafletMap.invalidateSize({ animate: false })
        await new Promise((r) => setTimeout(r, 450))
      }

      const scale = Math.min(2, Math.max(1, typeof window !== 'undefined' ? window.devicePixelRatio : 2))

      // html2canvas chokes on Tailwind/modern CSS `lab()` colors; html-to-image uses SVG foreignObject and handles this better.
      const dataUrl = await toPng(leafletEl, {
        cacheBust: true,
        pixelRatio: scale,
        backgroundColor: '#aad3df',
        skipAutoScale: true,
      })

      const mapImg = new Image()
      mapImg.decoding = 'async'
      await new Promise<void>((resolve, reject) => {
        mapImg.onload = () => resolve()
        mapImg.onerror = () => reject(new Error('Failed to decode map image'))
        mapImg.src = dataUrl
      })

      const headerCss = 52
      const footerCss = 28
      const headerPx = Math.round(headerCss * scale)
      const footerPx = Math.round(footerCss * scale)
      const out = document.createElement('canvas')
      out.width = mapImg.width
      out.height = mapImg.height + headerPx + footerPx
      const ctx = out.getContext('2d')
      if (!ctx) throw new Error('Canvas context not available')

      ctx.fillStyle = '#0f172a'
      ctx.fillRect(0, 0, out.width, headerPx)
      ctx.fillStyle = '#f8fafc'
      ctx.font = `${Math.round(14 * scale)}px system-ui, -apple-system, sans-serif`
      ctx.fillText(route.name, Math.round(14 * scale), Math.round(22 * scale))
      ctx.fillStyle = '#94a3b8'
      ctx.font = `${Math.round(12 * scale)}px system-ui, -apple-system, sans-serif`
      ctx.fillText(
        `${route.totalDistance.toFixed(2)} km · ${route.waypoints.length} waypoints · ${route.intervalCoordinates?.length ?? 0} points on map`,
        Math.round(14 * scale),
        Math.round(40 * scale)
      )

      ctx.drawImage(mapImg, 0, headerPx)

      ctx.fillStyle = '#f1f5f9'
      ctx.fillRect(0, headerPx + mapImg.height, out.width, footerPx)
      ctx.fillStyle = '#64748b'
      ctx.font = `${Math.round(10 * scale)}px system-ui, -apple-system, sans-serif`
      ctx.fillText(
        '© OpenStreetMap contributors · Route preview',
        Math.round(12 * scale),
        headerPx + mapImg.height + Math.round(18 * scale)
      )

      const link = document.createElement('a')
      link.href = out.toDataURL('image/png')
      link.download = `${route.name.replace(/\s+/g, '-').toLowerCase()}-map.png`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      onExport?.('png')
    } catch (error) {
      console.error('PNG export failed:', error)
      alert(
        'PNG export failed (often due to map tiles blocking capture in this browser). Try GeoJSON/CSV, or use the browser screenshot tool.'
      )
    } finally {
      setIsExporting(false)
    }
  }

  const handleExportGeoTIFF = () => {
    if (!route) return
    try {
      if (!dem) return
      const bounds = dem.bounds || [0, 0, 1, 1]
      const header = new ArrayBuffer(64)
      const view = new DataView(header)

      view.setUint16(0, 0x4949, true)
      view.setUint16(2, 42, true)

      view.setFloat64(8, bounds[0], true)
      view.setFloat64(16, bounds[1], true)
      view.setFloat64(24, bounds[2], true)
      view.setFloat64(32, bounds[3], true)
      view.setUint32(40, dem.width || 0, true)
      view.setUint32(44, dem.height || 0, true)

      const elevationData = dem.elevation || new Float32Array(0)
      const elevationBuffer = new ArrayBuffer(elevationData.byteLength)
      new Float32Array(elevationBuffer).set(elevationData)

      const blob = new Blob([header, elevationBuffer], { type: 'image/tiff' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${route.name.replace(/\s+/g, '-').toLowerCase()}.tif`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      onExport?.('tif')
    } catch (error) {
      console.error('Failed to export GeoTIFF:', error)
    }
  }

  if (!route || !mounted) return null

  return (
    <div className="flex flex-col">
      {/* Draggable handle only when expanded (drag down to collapse) */}
      {!isCollapsed && (
        <div
          onMouseDown={handleDragStart}
          className="h-1.5 cursor-grab rounded-full bg-gradient-to-r from-transparent via-primary/40 to-transparent transition-all hover:h-2 hover:via-primary/55 active:cursor-grabbing"
          title="Drag down to collapse panel"
        />
      )}
      
      {/* Collapsible Panel */}
      {!isCollapsed && (
        <Card className="rounded-t-none border-border/40 bg-card/60 shadow-lg shadow-black/20 backdrop-blur-md">
          <CardContent className="p-5">
            <div className="mb-5 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/12 ring-1 ring-primary/20">
                  <BarChart3 className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <span className="text-sm font-semibold tracking-tight text-foreground">
                    Results & export
                  </span>
                  <p className="text-[11px] text-muted-foreground">Download route data and map</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsCollapsed(true)}
                className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                title="Collapse panel"
              >
                <ChevronDown className="h-4 w-4 rotate-180" />
              </button>
            </div>

            <div className="mb-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Button
              size="sm"
              variant="outline"
              onClick={handleExportGeoJSON}
              className="h-9 rounded-lg border-border/50 text-xs font-medium transition-colors hover:border-primary/35 hover:bg-primary/10 hover:text-primary"
            >
              <Download className="w-3 h-3 mr-1" />
              GeoJSON
            </Button>

            {route.intervalCoordinates && route.intervalCoordinates.length > 0 && (
              <Button
                size="sm"
                variant="outline"
                onClick={handleExportCSV}
                className="h-9 rounded-lg border-border/50 text-xs font-medium transition-colors hover:border-primary/35 hover:bg-primary/10 hover:text-primary"
              >
                <Download className="w-3 h-3 mr-1" />
                CSV
              </Button>
            )}

            <Button
              size="sm"
              variant="outline"
              onClick={handleExportPNG}
              disabled={!mapRef?.current || isExporting}
              className="h-9 rounded-lg border-border/50 text-xs font-medium transition-colors hover:border-primary/35 hover:bg-primary/10 hover:text-primary"
            >
              <ImageIcon className="w-3 h-3 mr-1" />
              {isExporting ? 'PNG...' : 'PNG'}
            </Button>

            {dem && (
              <Button
                size="sm"
                variant="outline"
                onClick={handleExportGeoTIFF}
                className="h-9 rounded-lg border-border/50 text-xs font-medium transition-colors hover:border-primary/35 hover:bg-primary/10 hover:text-primary"
              >
                <Database className="w-3 h-3 mr-1" />
                TIFF
              </Button>
            )}
          </div>

        <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="flex flex-col gap-1 rounded-xl border border-border/40 bg-secondary/20 p-3">
            <div className="flex items-center gap-1.5">
              <Ruler className="h-3.5 w-3.5 text-sky-400" />
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Distance
              </span>
            </div>
            <p className="text-lg font-bold tabular-nums tracking-tight text-primary">
              {route.totalDistance.toFixed(2)}{' '}
              <span className="text-xs font-medium text-muted-foreground">km</span>
            </p>
          </div>

          <div className="flex flex-col gap-1 rounded-xl border border-border/40 bg-secondary/20 p-3">
            <div className="flex items-center gap-1.5">
              <TrendingUp className="h-3.5 w-3.5 text-amber-400" />
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Max grade
              </span>
            </div>
            <p className="text-lg font-bold tabular-nums tracking-tight text-amber-400">
              {route.maxGradient.toFixed(1)}{' '}
              <span className="text-xs font-medium text-muted-foreground">%</span>
            </p>
          </div>

          <div className="flex flex-col gap-1 rounded-xl border border-border/40 bg-secondary/20 p-3">
            <div className="flex items-center gap-1.5">
              <TrendingUp className="h-3.5 w-3.5 text-emerald-400" />
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Avg grade
              </span>
            </div>
            <p className="text-lg font-bold tabular-nums tracking-tight text-emerald-400">
              {route.avgGradient.toFixed(1)}{' '}
              <span className="text-xs font-medium text-muted-foreground">%</span>
            </p>
          </div>

          <div className="flex flex-col gap-1 rounded-xl border border-border/40 bg-secondary/20 p-3">
            <div className="flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5 text-cyan-400" />
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Waypoints
              </span>
            </div>
            <p className="text-lg font-bold tabular-nums tracking-tight text-cyan-400">{route.waypoints.length}</p>
          </div>
        </div>

        {route.isModified && (
          <div className="mb-4 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[11px] font-medium text-amber-400">
            Route edited — values reflect your adjustments
          </div>
        )}

        {route.intervalCoordinates && route.intervalCoordinates.length > 0 && (
          <div className="border-t border-border/30 pt-3">
            <button
              type="button"
              onClick={() => setShowCoordinates(!showCoordinates)}
              className="group flex w-full items-center gap-2 rounded-xl border border-transparent p-2.5 transition-colors hover:border-border/40 hover:bg-secondary/40"
            >
              <ChevronDown
                className={`w-4 h-4 text-muted-foreground transition-transform group-hover:text-primary ${
                  showCoordinates ? 'rotate-180' : ''
                }`}
              />
              <span className="text-xs font-semibold text-muted-foreground group-hover:text-foreground">
                Route Coordinates ({route.intervalCoordinates.length})
              </span>
            </button>

            {showCoordinates && (
              <div className="mt-2 max-h-48 overflow-y-auto rounded-xl border border-border/40 bg-muted/20 shadow-inner">
                <table className="w-full text-[10px]">
                  <thead className="sticky top-0 bg-secondary/50 border-b border-border/30">
                    <tr>
                      <th className="px-2 py-1.5 text-left font-semibold text-muted-foreground">#</th>
                      <th className="px-2 py-1.5 text-left font-semibold text-muted-foreground">Latitude</th>
                      <th className="px-2 py-1.5 text-left font-semibold text-muted-foreground">Longitude</th>
                      <th className="px-2 py-1.5 text-left font-semibold text-muted-foreground">Dist (km)</th>
                      <th className="px-2 py-1.5 text-left font-semibold text-muted-foreground">Elev (m)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {route.intervalCoordinates.map((coord) => (
                      <tr
                        key={coord.index}
                        className="border-b border-border/20 hover:bg-secondary/40 transition-colors"
                      >
                        <td className="px-2 py-1.5 text-foreground/70 font-medium">{coord.index}</td>
                        <td className="px-2 py-1.5 font-mono text-cyan-400/80">{coord.lat.toFixed(6)}</td>
                        <td className="px-2 py-1.5 font-mono text-cyan-400/80">{coord.lng.toFixed(6)}</td>
                        <td className="px-2 py-1.5 text-primary font-semibold">{coord.distanceFromStart.toFixed(2)}</td>
                        <td className="px-2 py-1.5 text-emerald-400/80">
                          {coord.elevation ? coord.elevation.toFixed(0) : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
      )}

      {/* Expand Button - When Collapsed */}
      {isCollapsed && (
        <button
          type="button"
          className="flex w-full cursor-pointer items-center justify-between gap-3 rounded-xl border border-border/40 bg-card/70 px-4 py-3.5 text-left shadow-md shadow-black/15 backdrop-blur-sm transition-all hover:border-border/60 hover:bg-card hover:shadow-lg"
          onClick={() => setIsCollapsed(false)}
        >
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/12">
              <BarChart3 className="h-4 w-4 text-primary" />
            </span>
            <span className="text-sm font-semibold tracking-tight text-foreground">Results & export</span>
          </div>
          <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
        </button>
      )}
    </div>
  )
}
