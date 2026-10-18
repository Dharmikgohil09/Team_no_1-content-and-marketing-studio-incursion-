import { useState, useMemo } from 'react'
import type { UploadedImage } from '../../core/matching/photoExtractor'

interface PhotoPickerModalProps {
  isOpen: boolean
  onClose: () => void
  participant: { name: string; id: string; rowIndex: number; currentPhoto?: string } | null
  images: UploadedImage[]
  onSelectImage: (image: UploadedImage | null) => void
  onUploadCustomPhoto: (file: File) => Promise<void>
}

export function PhotoPickerModal({
  isOpen,
  onClose,
  participant,
  images,
  onSelectImage,
  onUploadCustomPhoto,
}: PhotoPickerModalProps) {
  const [search, setSearch] = useState('')
  const [uploading, setUploading] = useState(false)

  const filteredImages = useMemo(() => {
    if (!search.trim()) return images
    const query = search.trim().toLowerCase()
    return images.filter(
      img => img.filename.toLowerCase().includes(query) || img.stem.toLowerCase().includes(query)
    )
  }, [images, search])

  if (!isOpen || !participant) return null

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      await onUploadCustomPhoto(file)
      onClose()
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/60 backdrop-blur-sm animate-fade-in">
      <div
        className="w-full max-w-2xl bg-white border border-line rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-scale-in"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-5 border-b border-line flex items-center justify-between">
          <div>
            <h3 className="text-xl font-heading font-normal text-ink">
              Assign Photograph
            </h3>
            <p className="text-xs text-muted mt-0.5">
              Select or upload a photo for <span className="text-ink font-medium">{participant.name}</span> (ID: <span className="font-mono text-accent">{participant.id || 'N/A'}</span>)
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-hover-surface hover:bg-line-strong text-muted hover:text-ink flex items-center justify-center transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Toolbar: Search + Quick Upload + Remove */}
        <div className="p-4 border-b border-line bg-hover-surface/40 flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <input
              type="text"
              placeholder="Search uploaded images by filename..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="input text-xs w-full pl-8 py-2"
            />
            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted text-xs">🔍</span>
          </div>

          <label className="btn-secondary text-xs py-2 px-3 cursor-pointer shrink-0 flex items-center gap-1.5">
            <span>📷</span>
            <span>{uploading ? 'Processing...' : 'Upload New Photo'}</span>
            <input
              type="file"
              accept="image/*"
              className="hidden"
              disabled={uploading}
              onChange={handleFile}
            />
          </label>

          {participant.currentPhoto && (
            <button
              onClick={() => {
                onSelectImage(null)
                onClose()
              }}
              className="btn-ghost text-xs py-2 px-3 text-red-600 hover:text-red-700 hover:bg-red-500/10 shrink-0"
            >
              Remove Photo
            </button>
          )}
        </div>

        {/* Image Grid */}
        <div className="p-4 overflow-y-auto flex-1 max-h-[50vh]">
          {filteredImages.length === 0 ? (
            <div className="py-12 text-center text-muted text-sm">
              {images.length === 0 ? (
                <div>
                  <p className="text-3xl mb-2">🖼️</p>
                  <p className="text-ink font-medium mb-1">No images uploaded yet</p>
                  <p className="text-xs text-muted">Upload a single photo using the button above or upload a ZIP archive on the main page.</p>
                </div>
              ) : (
                <p>No uploaded images match "{search}"</p>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
              {filteredImages.map(img => {
                const isSelected = participant.currentPhoto === img.dataUrl
                return (
                  <div
                    key={img.id}
                    onClick={() => {
                      onSelectImage(img)
                      onClose()
                    }}
                    className={`group relative rounded-xl border p-1.5 flex flex-col items-center cursor-pointer transition-all duration-200
                      ${isSelected
                        ? 'border-accent bg-accent/10 shadow-sm'
                        : 'border-line hover:border-line-strong bg-white hover:bg-hover-surface/30'}`}
                  >
                    <div className="w-full aspect-square rounded-lg overflow-hidden bg-hover-surface flex items-center justify-center mb-1.5">
                      <img
                        src={img.dataUrl}
                        alt={img.filename}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                      />
                    </div>
                    <span className="text-[10px] font-mono text-ink w-full truncate text-center" title={img.filename}>
                      {img.filename}
                    </span>
                    <span className="text-[9px] text-muted">
                      {(img.size / 1024).toFixed(0)} KB
                    </span>
                    {isSelected && (
                      <span className="absolute top-2 right-2 w-5 h-5 rounded-full bg-accent text-white text-[10px] font-bold flex items-center justify-center shadow">
                        ✓
                      </span>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-line bg-white flex items-center justify-between text-xs text-muted">
          <span>{filteredImages.length} of {images.length} image(s) available</span>
          <button onClick={onClose} className="btn-secondary text-xs py-1.5 px-4">
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}
