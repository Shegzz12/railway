'use client'

import { ShieldAlert, Eye, EyeOff } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Button } from '@/components/ui/button'
import type { SpatialDataset } from '@/lib/types/spatial-types'

interface ObstacleSelectorProps {
  datasets: SpatialDataset[]
  onToggleObstacle: (id: string, isObstacle: boolean) => void
  onToggleVisibility: (id: string, visible: boolean) => void
}

export function ObstacleSelector({
  datasets,
  onToggleObstacle,
  onToggleVisibility,
}: ObstacleSelectorProps) {
  const obstacleCount = datasets.filter((d) => d.isObstacle).length

  return (
    <Card className="w-full min-w-0 max-w-full overflow-hidden border-border/40 bg-card/50 shadow-sm shadow-black/10 backdrop-blur-sm">
      <CardHeader className="min-w-0 space-y-0 pb-3">
        <CardTitle className="flex min-w-0 items-center justify-between gap-2">
          <span className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-amber-500/10 text-amber-500">
              <ShieldAlert className="h-3.5 w-3.5" />
            </span>
            <span className="truncate">Layers & obstacles</span>
          </span>
          {obstacleCount > 0 && (
            <span className="shrink-0 rounded-full border border-red-500/30 bg-red-500/15 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-red-400">
              {obstacleCount} active
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="min-w-0">
        {datasets.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border/40 py-6 text-center text-xs text-muted-foreground">
            Upload datasets to configure obstacle layers
          </p>
        ) : (
          <ScrollArea className="h-[200px] w-full min-w-0 max-w-full pr-3">
            <div className="min-w-0 space-y-2.5 pr-1">
              {datasets.map((dataset) => (
                <div
                  key={dataset.id}
                  className={`
                    max-w-full min-w-0 rounded-xl border p-3 pe-2 transition-colors
                    ${dataset.isObstacle
                      ? 'border-red-500/35 bg-red-500/[0.08] shadow-sm shadow-red-950/20'
                      : 'border-border/40 bg-secondary/25 hover:border-border/55'
                    }
                  `}
                >
                  <div className="flex min-w-0 items-start gap-3">
                    <div
                      className="mt-0.5 h-4 w-4 shrink-0 rounded"
                      style={{ 
                        backgroundColor: dataset.isObstacle ? '#ef4444' : dataset.color 
                      }}
                    />
                    <div className="min-w-0 flex-1 overflow-hidden">
                      <p className="truncate text-sm font-medium" title={dataset.name}>
                        {dataset.name}
                      </p>
                      <p className="truncate text-[10px] capitalize text-muted-foreground">
                        {dataset.type === 'dem' ? 'Elevation Data' : dataset.type}
                      </p>
                      {dataset.type === 'dem' && dataset.isObstacle && (
                        <p className="mt-1 break-words text-[9px] text-amber-400">
                          Used as cost layer in routing (slope, drainage, LULC)
                        </p>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 shrink-0"
                      onClick={() => onToggleVisibility(dataset.id, !dataset.visible)}
                    >
                      {dataset.visible ? (
                        <Eye className="w-4 h-4" />
                      ) : (
                        <EyeOff className="w-4 h-4 text-muted-foreground" />
                      )}
                      <span className="sr-only">
                        {dataset.visible ? 'Hide' : 'Show'} layer
                      </span>
                    </Button>
                  </div>
                  
                  <div className="mt-3 flex flex-col gap-2 border-t border-border/30 pt-3">
                    <Label
                      htmlFor={`obstacle-${dataset.id}`}
                      className="min-w-0 cursor-pointer text-xs leading-snug"
                    >
                      Mark as obstacle
                    </Label>
                    <div className="flex shrink-0">
                      <Switch
                        id={`obstacle-${dataset.id}`}
                        className="shrink-0"
                        checked={dataset.isObstacle}
                        onCheckedChange={(checked) => onToggleObstacle(dataset.id, checked)}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}

        {datasets.length > 0 && (
          <div className="mt-4 min-w-0 max-w-full rounded-lg border border-border/35 bg-muted/20 p-3">
            <p className="mb-2 break-words text-[10px] font-medium leading-relaxed text-muted-foreground">
              <span className="text-foreground/80">Routing:</span> Obstacle layers raise cost; GeoTIFF
              layers can drive slope and elevation.
            </p>
            <ul className="ml-1 space-y-1 break-words text-[9px] leading-relaxed text-muted-foreground">
              <li>• <strong>DEM</strong>: Used for elevation and gradient calculation</li>
              <li>• <strong>Slope</strong>: Increases cost on steep terrain</li>
              <li>• <strong>Drainage</strong>: Avoids water-prone areas</li>
              <li>• <strong>LULC</strong>: Considers land use costs</li>
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
