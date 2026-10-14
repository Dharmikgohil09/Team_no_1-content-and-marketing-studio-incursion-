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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
      <div
        className="w-full max-w-2xl bg-surface-900 border border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-scale-in"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-5 border-b border-white/10 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-display font-semibold text-white">
              Assign Photograph
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Select or upload a photo for <span className="text-white font-medium">{participant.name}</span> (ID: <span className="font-mono text-acm-300">{participant.id || 'N/A'}</span>)
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white flex items-center justify-center transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Toolbar: Search + Quick Upload + Remove */}
        <div className="p-4 border-b border-white/5 bg-surface-800/50 flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <input
              type="text"
              placeholder="Search uploaded images by filename..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="input text-xs w-full pl-8 py-2"
            />
            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500 text-xs">🔍</span>
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
              className="btn-ghost text-xs py-2 px-3 text-red-400 hover:text-red-300 hover:bg-red-500/10 shrink-0"
            >
              Remove Photo
            </button>
          )}
        </div>

        {/* Image Grid */}
        <div className="p-4 overflow-y-auto flex-1 max-h-[50vh]">
          {filteredImages.length === 0 ? (
            <div className="py-12 text-center text-slate-500 text-sm">
              {images.length === 0 ? (
                <div>
                  <p className="text-3xl mb-2">🖼️</p>
                  <p className="text-white font-medium mb-1">No images uploaded yet</p>
                  <p className="text-xs text-slate-400">Upload a single photo using the button above or upload a ZIP archive on the main page.</p>
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
                        ? 'border-emerald-500 bg-emerald-500/10 shadow-glow-acm'
                        : 'border-white/10 hover:border-acm-500/50 bg-white/[0.02] hover:bg-white/[0.06]'}`}
                  >
                    <div className="w-full aspect-square rounded-lg overflow-hidden bg-black/40 flex items-center justify-center mb-1.5">
                      <img
                        src={img.dataUrl}
                        alt={img.filename}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                      />
                    </div>
                    <span className="text-[10px] font-mono text-slate-300 w-full truncate text-center" title={img.filename}>
                      {img.filename}
                    </span>
                    <span className="text-[9px] text-slate-500">
                      {(img.size / 1024).toFixed(0)} KB
                    </span>
                    {isSelected && (
                      <span className="absolute top-2 right-2 w-5 h-5 rounded-full bg-emerald-500 text-white text-[10px] font-bold flex items-center justify-center shadow">
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
        <div className="p-4 border-t border-white/10 bg-surface-900 flex items-center justify-between text-xs text-slate-500">
          <span>{filteredImages.length} of {images.length} image(s) available</span>
          <button onClick={onClose} className="btn-secondary text-xs py-1.5 px-4">
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}
