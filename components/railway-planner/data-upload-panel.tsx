'use client'

import { useState, useCallback } from 'react'
import { Upload, FileIcon, X, AlertCircle, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import type { SpatialDataset, UploadState } from '@/lib/types/spatial-types'
import { parseFile } from '@/lib/parsers'

interface DataUploadPanelProps {
  datasets: SpatialDataset[]
  onDatasetAdd: (dataset: SpatialDataset) => void
  onDatasetRemove: (id: string) => void
}

const FILE_TYPE_LABELS: Record<string, string> = {
  geojson: 'GeoJSON',
  csv: 'CSV',
  dem: 'DEM',
  shapefile: 'Shapefile',
}

const FILE_TYPE_COLORS: Record<string, string> = {
  geojson: 'bg-blue-500/20 text-blue-400',
  csv: 'bg-green-500/20 text-green-400',
  dem: 'bg-amber-500/20 text-amber-400',
  shapefile: 'bg-purple-500/20 text-purple-400',
}

export function DataUploadPanel({
  datasets,
  onDatasetAdd,
  onDatasetRemove,
}: DataUploadPanelProps) {
  const [uploadState, setUploadState] = useState<UploadState>({
    isUploading: false,
    progress: 0,
    error: null,
  })
  const [isDragging, setIsDragging] = useState(false)

  const handleFiles = useCallback(
    async (files: FileList | null) => {
      if (!files || files.length === 0) return

      setUploadState({ isUploading: true, progress: 0, error: null })

      const totalFiles = files.length
      let processedFiles = 0

      for (const file of Array.from(files)) {
        try {
          const dataset = await parseFile(file)
          onDatasetAdd(dataset)
          processedFiles++
          setUploadState((prev) => ({
            ...prev,
            progress: (processedFiles / totalFiles) * 100,
          }))
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Unknown error'
          setUploadState((prev) => ({
            ...prev,
            error: `Failed to parse ${file.name}: ${message}`,
          }))
        }
      }

      setUploadState((prev) => ({ ...prev, isUploading: false }))
    },
    [onDatasetAdd]
  )

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }, [])

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      setIsDragging(false)
      handleFiles(e.dataTransfer.files)
    },
    [handleFiles]
  )

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      handleFiles(e.target.files)
      e.target.value = ''
    },
    [handleFiles]
  )

  return (
    <Card className="w-full min-w-0 max-w-full overflow-hidden border-border/40 bg-card/50 shadow-sm shadow-black/10 backdrop-blur-sm">
      <CardHeader className="min-w-0 space-y-0 pb-3">
        <CardTitle className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Upload className="h-3.5 w-3.5" />
          </span>
          Spatial data
        </CardTitle>
      </CardHeader>
      <CardContent className="min-w-0 space-y-4 overflow-x-hidden">
        {/* Drop zone */}
        <div
          className={`
            relative rounded-xl border-2 border-dashed p-5 text-center transition-all duration-200
            ${isDragging
              ? 'border-primary/70 bg-primary/[0.07] shadow-[inset_0_0_0_1px_oklch(0.65_0.18_160/0.2)]'
              : 'border-border/60 bg-muted/20 hover:border-primary/40 hover:bg-muted/30'
            }
          `}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <input
            type="file"
            multiple
            accept=".json,.geojson,.csv,.tif,.tiff,.zip"
            onChange={handleInputChange}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            disabled={uploadState.isUploading}
          />
          
          {uploadState.isUploading ? (
            <div className="py-2">
              <Loader2 className="mx-auto h-7 w-7 animate-spin text-primary/70" />
              <p className="mt-3 text-xs font-medium text-muted-foreground">
                Processing… {uploadState.progress.toFixed(0)}%
              </p>
            </div>
          ) : (
            <>
              <Upload className="mx-auto mb-2 h-7 w-7 text-muted-foreground/80" />
              <p className="text-sm font-medium text-foreground/90">Drop files or click to browse</p>
              <p className="mt-1 text-[11px] text-muted-foreground">
                GeoJSON, CSV, GeoTIFF, Shapefile (ZIP)
              </p>
            </>
          )}
        </div>

        {/* Error message */}
        {uploadState.error && (
          <div className="flex items-start gap-2 rounded-lg border border-destructive/25 bg-destructive/10 p-3 text-xs text-destructive">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span className="min-w-0 break-words leading-snug">{uploadState.error}</span>
          </div>
        )}

        {/* Dataset list */}
        {datasets.length > 0 && (
          <ScrollArea className="h-[180px] w-full min-w-0 max-w-full pr-1">
            <div className="min-w-0 space-y-2">
              {datasets.map((dataset) => (
                <div
                  key={dataset.id}
                  className="group flex min-w-0 max-w-full items-center gap-2 rounded-lg border border-border/30 bg-secondary/30 p-2.5 transition-colors hover:border-border/50 hover:bg-secondary/45"
                >
                  <div
                    className="w-3 h-3 rounded-full shrink-0"
                    style={{ backgroundColor: dataset.color }}
                  />
                  <div className="min-w-0 flex-1 overflow-hidden">
                    <p className="truncate text-xs font-medium" title={dataset.name}>
                      {dataset.name}
                    </p>
                    <div className="flex min-w-0 flex-wrap items-center gap-1">
                      <span
                        className={`text-[10px] px-1.5 py-0.5 rounded ${
                          FILE_TYPE_COLORS[dataset.type] || 'bg-secondary'
                        }`}
                      >
                        {FILE_TYPE_LABELS[dataset.type] || dataset.type}
                      </span>
                      {dataset.isObstacle && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-500/20 text-red-400">
                          Obstacle
                        </span>
                      )}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => onDatasetRemove(dataset.id)}
                  >
                    <X className="w-3 h-3" />
                    <span className="sr-only">Remove dataset</span>
                  </Button>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}

        {datasets.length === 0 && !uploadState.isUploading && (
          <div className="flex items-center justify-center gap-2 rounded-lg border border-dashed border-border/40 py-4 text-xs text-muted-foreground">
            <FileIcon className="h-4 w-4 opacity-70" />
            No datasets loaded
          </div>
        )}
      </CardContent>
    </Card>
  )
}
