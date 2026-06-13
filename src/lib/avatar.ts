// Client-side avatar processing: downscale an uploaded image to a small square
// JPEG (so it fits comfortably in the settings store) and derive a representative
// highlight color from its pixels. No network or external libraries.

const SIZE = 112 // px — square avatar; a ~few-KB JPEG at this size

export interface ProcessedAvatar {
  dataUrl: string // image/jpeg data-URL
  color: string // representative #RRGGBB, used as the member's highlight color
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve(img)
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('image load failed'))
    }
    img.src = url
  })
}

// Average color over sampled, sufficiently-opaque pixels — a stable, cheap proxy
// for the dominant tone that reads well as a highlight color.
function representativeColor(ctx: CanvasRenderingContext2D, w: number, h: number): string {
  const { data } = ctx.getImageData(0, 0, w, h)
  let r = 0
  let g = 0
  let b = 0
  let n = 0
  for (let i = 0; i < data.length; i += 4 * 8) {
    if (data[i + 3] < 128) continue // skip near-transparent
    r += data[i]
    g += data[i + 1]
    b += data[i + 2]
    n++
  }
  if (n === 0) return '#1f232c'
  const hex = (x: number) => Math.round(x / n).toString(16).padStart(2, '0')
  return `#${hex(r)}${hex(g)}${hex(b)}`
}

export async function processAvatar(file: File): Promise<ProcessedAvatar> {
  const img = await loadImage(file)
  const canvas = document.createElement('canvas')
  canvas.width = SIZE
  canvas.height = SIZE
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('canvas unavailable')

  // Cover-crop into the square so portraits aren't distorted.
  const scale = Math.max(SIZE / img.width, SIZE / img.height)
  const w = img.width * scale
  const h = img.height * scale
  ctx.drawImage(img, (SIZE - w) / 2, (SIZE - h) / 2, w, h)

  return {
    dataUrl: canvas.toDataURL('image/jpeg', 0.82),
    color: representativeColor(ctx, SIZE, SIZE),
  }
}
