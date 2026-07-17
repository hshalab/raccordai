/**
 * Static <video> thumbnail. A never-played <video preload="metadata"> decodes no
 * frame (and generated videos often open on black), so on loadedmetadata we seek
 * a little into the clip to force a representative frame to be painted.
 */
export function posterTime(duration: number): number {
  if (!Number.isFinite(duration) || duration <= 0) return 0
  return Math.min(1, duration / 2)
}

export function VideoThumb({ src, className }: { src: string; className?: string }) {
  return (
    <video
      src={src}
      muted
      playsInline
      preload="metadata"
      onLoadedMetadata={(e) => {
        e.currentTarget.currentTime = posterTime(e.currentTarget.duration)
      }}
      className={className}
    />
  )
}
