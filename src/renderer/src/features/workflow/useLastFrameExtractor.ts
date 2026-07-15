import { useEffect, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { getModel } from '@shared/models'
import type { GraphNode } from '@shared/ipc/contracts'
import { invoke } from '@renderer/lib/ipc'
import { extractLastFrame } from '@renderer/lib/extractLastFrame'
import { graphKeys, useVideoGenerations } from './data'

/**
 * Watches the video's generations and extracts the last frame of every fresh
 * successful video generation (browser <video> + <canvas>), then hands the
 * JPEG to the main process which stores it next to the generation. Downstream
 * 'lastFrame' edges resolve against that file.
 */
/** A failing video (bad codec, dead remote URL) must not be re-decoded forever. */
const MAX_EXTRACTION_ATTEMPTS = 3

export function useLastFrameExtractor(videoId: string, graphNodes: GraphNode[]): void {
  const generations = useVideoGenerations(videoId).data
  const queryClient = useQueryClient()
  const inFlight = useRef(new Set<string>())
  const attempts = useRef(new Map<string, number>())

  useEffect(() => {
    if (!generations) return
    const nodesById = new Map(graphNodes.map((n) => [n.id, n]))
    const candidates = generations.filter((g) => {
      if (g.status !== 'success' || g.lastFrameUrl || !g.url) return false
      if (inFlight.current.has(g.id)) return false
      if ((attempts.current.get(g.id) ?? 0) >= MAX_EXTRACTION_ATTEMPTS) return false
      const node = nodesById.get(g.nodeId)
      if (!node) return false // node deleted — no edge can consume the frame
      // Model kind when the model is known; unknown ids (imported graphs,
      // retired models) fall back to the recorded mime so their generations
      // still get a last frame.
      const model = getModel(node.modelId)
      if (model) return model.kind === 'video'
      return g.resultMimeType?.startsWith('video/') ?? false
    })
    if (candidates.length === 0) return

    // Serial: frame extraction decodes a whole video — one at a time is plenty.
    let cancelled = false
    void (async () => {
      for (const gen of candidates) {
        if (cancelled) return
        inFlight.current.add(gen.id)
        try {
          const blob = await extractLastFrame(gen.url as string)
          const bytes = new Uint8Array(await blob.arrayBuffer())
          let binary = ''
          for (let i = 0; i < bytes.length; i += 0x8000) {
            binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
          }
          await invoke('generations:setLastFrame', {
            generationId: gen.id,
            jpegBase64: btoa(binary)
          })
          void queryClient.invalidateQueries({
            queryKey: graphKeys.generationsForVideo(videoId)
          })
        } catch (err) {
          attempts.current.set(gen.id, (attempts.current.get(gen.id) ?? 0) + 1)
          console.error(`[last-frame] extraction failed for ${gen.id}`, err)
        } finally {
          inFlight.current.delete(gen.id)
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [generations, graphNodes, videoId, queryClient])
}
