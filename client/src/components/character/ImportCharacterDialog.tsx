import { useRef, useState, DragEvent, ChangeEvent } from 'react'
import { UploadCloud, FileJson, Image as ImageIcon, X } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useImportCharacter } from '@/hooks'
import { Button, Modal } from '@/components/ui'
import type { ApiWarning } from '@/api/apiErrorTypes'

interface ImportCharacterDialogProps {
  isOpen: boolean
  onClose: () => void
  onSuccess?: () => void
}

export function ImportCharacterDialog({
  isOpen,
  onClose,
  onSuccess,
}: ImportCharacterDialogProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [dragActive, setDragActive] = useState(false)
  const importMutation = useImportCharacter()
  const [localSuccess, setLocalSuccess] = useState<string | null>(null)
  const [localWarnings, setLocalWarnings] = useState<ApiWarning[]>([])
  const [localError, setLocalError] = useState<string | null>(null)

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
    const f = e.dataTransfer.files?.[0]
    if (f && isValidFile(f)) {
      setFile(f)
    }
  }

  const onDrag = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true)
    } else if (e.type === 'dragleave') {
      setDragActive(false)
    }
  }

  const onChange = (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (f && isValidFile(f)) {
      setFile(f)
    }
  }

  const isValidFile = (f: File) => {
    return f.name.endsWith('.png') || f.name.endsWith('.json')
  }

  const onConfirm = async () => {
    if (!file || importMutation.isPending) return
    try {
      setLocalSuccess(null)
      setLocalWarnings([])
      setLocalError(null)

      const result = await importMutation.mutateAsync(file)

      const warnings = result?.warnings ?? []
      if (warnings.length) {
        setLocalWarnings(warnings)
        setLocalSuccess('导入成功（有警告）')
      } else {
        setLocalSuccess('导入成功')
      }

      setFile(null)
      onSuccess?.()
      if (!warnings.length) onClose()
    } catch (e: any) {
      const payload = e?.response?.data
      setLocalError(payload?.error || payload?.message || '导入失败')
    }
  }

  const onCancel = () => {
    setFile(null)
    onClose()
  }

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const footer = (
    <>
      <Button variant="ghost" onClick={onCancel}>
        取消
      </Button>
      <Button
        variant="primary"
        onClick={onConfirm}
        loading={importMutation.isPending}
        disabled={!file}
      >
        导入
      </Button>
    </>
  )

  return (
    <Modal
      isOpen={isOpen}
      onClose={onCancel}
      title="导入角色卡"
      description="支持 SillyTavern V2 格式的 PNG 或 JSON 角色卡"
      footer={footer}
    >
      <div
        className="border-2 border-dashed rounded-xl px-4 py-8 flex flex-col items-center justify-center text-center transition-all duration-200"
        style={{
          borderColor: dragActive ? 'var(--accent-primary)' : 'var(--border-color)',
          background: dragActive ? 'rgba(124,106,247,0.06)' : 'var(--bg-tertiary)',
        }}
        onDragEnter={onDrag}
        onDragOver={onDrag}
        onDragLeave={onDrag}
        onDrop={onDrop}
      >
        <AnimatePresence mode="wait">
          {file ? (
            <motion.div
              key="file"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="flex flex-col items-center gap-3"
            >
              {file.name.endsWith('.png') ? (
                <ImageIcon size={40} style={{ color: 'var(--accent-primary)' }} />
              ) : (
                <FileJson size={40} style={{ color: 'var(--accent-primary)' }} />
              )}
              <div className="text-center">
                <p
                  className="font-medium text-sm mb-1"
                  style={{ color: 'var(--text-primary)' }}
                >
                  {file.name}
                </p>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  {formatFileSize(file.size)}
                </p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setFile(null)}>
                <X size={14} className="mr-1" />
                移除文件
              </Button>
            </motion.div>
          ) : (
            <motion.div
              key="upload"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center"
            >
              <UploadCloud
                size={40}
                className="mb-3"
                style={{ color: 'var(--text-muted)' }}
              />
              <p className="text-sm mb-1" style={{ color: 'var(--text-secondary)' }}>
                拖拽文件到此处
              </p>
              <p className="text-xs mb-3" style={{ color: 'var(--text-muted)' }}>
                支持 PNG 或 JSON 格式
              </p>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => inputRef.current?.click()}
              >
                选择文件
              </Button>
            </motion.div>
          )}
        </AnimatePresence>

        <input
          ref={inputRef}
          type="file"
          accept=".png,.json"
          className="hidden"
          onChange={onChange}
        />
      </div>

      {importMutation.isError && (
        <motion.p
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          style={{ marginTop: 12, color: 'var(--danger)', fontSize: '0.85rem', textAlign: 'center' }}
        >
          {localError || '导入失败，请检查文件格式是否正确'}
        </motion.p>
      )}

      {(localSuccess || localWarnings.length > 0) && (
        <div style={{ marginTop: 12, width: '100%' }}>
          {localSuccess && (
            <div style={{ color: 'var(--success)', fontSize: '0.85rem', textAlign: 'center' }}>
              {localSuccess}
            </div>
          )}
          {localWarnings.length > 0 && (
            <div style={{ marginTop: 8, borderRadius: 12, border: '1px solid var(--border-color)', padding: 12 }}>
              <div style={{ fontWeight: 800, color: 'var(--warning)', fontSize: '0.85rem', marginBottom: 6 }}>
                警告（部分字段缺失/已做兼容）
              </div>
              <ul style={{ margin: 0, paddingLeft: 18, color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                {localWarnings.map((w, idx) => (
                  <li key={`${w.code ?? 'w'}-${idx}`} style={{ marginBottom: 4 }}>
                    {w.message}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </Modal>
  )
}
