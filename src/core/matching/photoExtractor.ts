import JSZip from 'jszip'
import { nanoid } from '../../utils/nanoid'

export interface UploadedImage {
  id: string
  filename: string          // Original base filename, e.g. "student_01.jpg"
  normalizedName: string    // Lowercase trimmed filename
  stem: string              // Lowercase filename without extension, e.g. "student_01"
  extension: string         // Lowercase extension without dot, e.g. "jpg"
  mimeType: string
  size: number
  dataUrl: string           // Base64 data URI for rendering and storage
  blob?: Blob
  isValid: boolean
  validationError?: string
}

export interface ExtractionResult {
  images: UploadedImage[]
  invalidFiles: { name: string; reason: string }[]
  totalProcessed: number
}

const SUPPORTED_IMAGE_EXTENSIONS = new Set([
  'jpg',
  'jpeg',
  'png',
  'webp',
  'svg',
  'gif',
  'avif',
  'bmp',
])

const MIME_MAP: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  svg: 'image/svg+xml',
  gif: 'image/gif',
  avif: 'image/avif',
  bmp: 'image/bmp',
}

/**
 * Extracts base filename from a path (handles both '/' and '\').
 */
export function getBaseFilename(filePath: string): string {
  const parts = filePath.split(/[/\\]/)
  return parts[parts.length - 1].trim()
}

/**
 * Splits filename into stem and lowercase extension.
 */
export function parseFilename(filename: string): { stem: string; extension: string; normalizedName: string } {
  const base = getBaseFilename(filename).trim()
  const lastDot = base.lastIndexOf('.')
  if (lastDot === -1 || lastDot === 0 || lastDot === base.length - 1) {
    return {
      stem: base.toLowerCase(),
      extension: '',
      normalizedName: base.toLowerCase(),
    }
  }
  const stem = base.substring(0, lastDot).trim().toLowerCase()
  const extension = base.substring(lastDot + 1).trim().toLowerCase()
  return {
    stem,
    extension,
    normalizedName: `${stem}.${extension}`,
  }
}

/**
 * Check if a filename has a supported image extension.
 */
export function isSupportedImageExtension(filename: string): boolean {
  const { extension } = parseFilename(filename)
  return SUPPORTED_IMAGE_EXTENSIONS.has(extension)
}

/**
 * Convert a Blob/File to a base64 Data URL (browser FileReader + Node Buffer fallback).
 */
export async function blobToDataUrl(blob: Blob, mime = 'image/jpeg'): Promise<string> {
  if (typeof FileReader !== 'undefined') {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          resolve(reader.result)
        } else {
          reject(new Error('Failed to read file as data URL'))
        }
      }
      reader.onerror = () => reject(reader.error || new Error('FileReader error'))
      reader.readAsDataURL(blob)
    })
  }
  const buffer = Buffer.from(await blob.arrayBuffer())
  return `data:${mime};base64,${buffer.toString('base64')}`
}

/**
 * Process a single image File object.
 */
export async function processImageFile(file: File): Promise<UploadedImage> {
  const { stem, extension, normalizedName } = parseFilename(file.name)
  const baseName = getBaseFilename(file.name)

  if (!SUPPORTED_IMAGE_EXTENSIONS.has(extension)) {
    return {
      id: nanoid(),
      filename: baseName,
      normalizedName,
      stem,
      extension,
      mimeType: file.type || 'application/octet-stream',
      size: file.size,
      dataUrl: '',
      isValid: false,
      validationError: `Unsupported format ".${extension}". Supported: ${Array.from(SUPPORTED_IMAGE_EXTENSIONS).join(', ')}`,
    }
  }

  if (file.size === 0) {
    return {
      id: nanoid(),
      filename: baseName,
      normalizedName,
      stem,
      extension,
      mimeType: file.type || MIME_MAP[extension] || 'application/octet-stream',
      size: 0,
      dataUrl: '',
      isValid: false,
      validationError: 'Image file is empty (0 bytes)',
    }
  }

  try {
    const mime = file.type || MIME_MAP[extension] || 'image/jpeg'
    const dataUrl = await blobToDataUrl(file, mime)
    return {
      id: nanoid(),
      filename: baseName,
      normalizedName,
      stem,
      extension,
      mimeType: mime,
      size: file.size,
      dataUrl,
      blob: file,
      isValid: true,
    }
  } catch (err: any) {
    return {
      id: nanoid(),
      filename: baseName,
      normalizedName,
      stem,
      extension,
      mimeType: file.type || 'application/octet-stream',
      size: file.size,
      dataUrl: '',
      isValid: false,
      validationError: err?.message || 'Failed to read image data',
    }
  }
}

/**
 * Extract images from a ZIP archive.
 */
export async function extractImagesFromZip(zipFile: File | Blob, zipFileName = 'archive.zip'): Promise<ExtractionResult> {
  const images: UploadedImage[] = []
  const invalidFiles: { name: string; reason: string }[] = []
  let totalProcessed = 0

  let zip: JSZip
  try {
    zip = await JSZip.loadAsync(zipFile)
  } catch (err: any) {
    return {
      images: [],
      invalidFiles: [{ name: zipFileName, reason: `Failed to unpack ZIP archive: ${err?.message || 'Corrupted archive'}` }],
      totalProcessed: 1,
    }
  }

  const entries = Object.keys(zip.files)

  for (const entryPath of entries) {
    const entry = zip.files[entryPath]
    // Skip directories and metadata files (like __MACOSX, .DS_Store)
    if (entry.dir || entryPath.includes('__MACOSX') || entryPath.endsWith('.DS_Store') || entryPath.endsWith('Thumbs.db')) {
      continue
    }

    totalProcessed++
    const baseName = getBaseFilename(entryPath)
    const { stem, extension, normalizedName } = parseFilename(baseName)

    if (!SUPPORTED_IMAGE_EXTENSIONS.has(extension)) {
      invalidFiles.push({
        name: baseName,
        reason: `Unsupported extension .${extension || 'unknown'}`,
      })
      continue
    }

    try {
      const mime = MIME_MAP[extension] || 'image/jpeg'
      const base64Data = await entry.async('base64')

      if (!base64Data || base64Data.length === 0) {
        invalidFiles.push({ name: baseName, reason: 'File inside archive is empty' })
        continue
      }

      const dataUrl = `data:${mime};base64,${base64Data}`
      const approxSize = Math.round((base64Data.length * 3) / 4)

      images.push({
        id: nanoid(),
        filename: baseName,
        normalizedName,
        stem,
        extension,
        mimeType: mime,
        size: approxSize,
        dataUrl,
        isValid: true,
      })
    } catch (err: any) {
      invalidFiles.push({
        name: baseName,
        reason: `Failed to extract image: ${err?.message || 'Read error'}`,
      })
    }
  }

  return { images, invalidFiles, totalProcessed }
}

/**
 * Extract images from an arbitrary list of File objects (supports regular files and ZIP archives).
 */
export async function extractImagesFromFiles(files: FileList | File[]): Promise<ExtractionResult> {
  const images: UploadedImage[] = []
  const invalidFiles: { name: string; reason: string }[] = []
  let totalProcessed = 0

  const fileArray = Array.from(files)

  for (const file of fileArray) {
    totalProcessed++
    const lowerName = file.name.toLowerCase()

    // Handle ZIP archive
    if (lowerName.endsWith('.zip') || file.type === 'application/zip' || file.type === 'application/x-zip-compressed') {
      const zipRes = await extractImagesFromZip(file, file.name)
      images.push(...zipRes.images)
      invalidFiles.push(...zipRes.invalidFiles)
      continue
    }

    const processed = await processImageFile(file)
    if (processed.isValid) {
      images.push(processed)
    } else {
      invalidFiles.push({
        name: processed.filename,
        reason: processed.validationError || 'Invalid image',
      })
    }
  }

  return { images, invalidFiles, totalProcessed }
}
