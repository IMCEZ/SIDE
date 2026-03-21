import { useCallback, useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { AlertCircle, CheckCircle2, Globe, Loader2, RefreshCw, Upload } from 'lucide-react'
import type { ApiWarning } from '@/api/apiErrorTypes'
import { ImportResourceError, importResourcesApi, type ImportedWorldbookListItem } from '@/api/services/importResources'

type ImportState = {
  loading: boolean
  success: string | null
  error: string | null
  warnings: ApiWarning[]
}

const initialImportState: ImportState = {
  loading: false,
  success: null,
  error: null,
  warnings: [],
}

function formatDate(value?: number | null) {
  if (!value) return '—'
  return new Date(value).toLocaleString('zh-CN')
}

function getWorldSummary(item: ImportedWorldbookListItem) {
  if (item.description && item.description.trim()) return item.description.trim()
  if (typeof item.entryCount === 'number') return `共 ${item.entryCount} 条目`
  return '暂无摘要'
}

export default function WorldsPage() {
  const [items, setItems] = useState<ImportedWorldbookListItem[]>([])
  const [search, setSearch] = useState('')
  const [listLoading, setListLoading] = useState(false)
  const [importState, setImportState] = useState<ImportState>(initialImportState)
  const [dragOver, setDragOver] = useState(false)

  const fetchWorlds = useCallback(async () => {
    setListLoading(true)
    try {
      const data = await importResourcesApi.listWorldbooks()
      setItems(Array.isArray(data) ? data : [])
    } catch (error) {
      const message = error instanceof Error ? error.message : '获取世界书列表失败'
      setImportState((prev) => ({ ...prev, error: message }))
    } finally {
      setListLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchWorlds()
  }, [fetchWorlds])

  const handleImport = useCallback(
    async (file: File) => {
      if (!file || importState.loading) return

      setImportState({ loading: true, success: null, error: null, warnings: [] })
      try {
        const result = await importResourcesApi.importWorldbook(file)
        const warnings = Array.isArray(result.warnings) ? result.warnings : []
        setImportState({
          loading: false,
          success: warnings.length ? '世界书导入成功（含警告）' : '世界书导入成功',
          error: null,
          warnings,
        })
        await fetchWorlds()
      } catch (error) {
        if (error instanceof ImportResourceError) {
          setImportState({
            loading: false,
            success: null,
            error: error.message,
            warnings: error.warnings ?? [],
          })
          return
        }

        setImportState({
          loading: false,
          success: null,
          error: error instanceof Error ? error.message : '世界书导入失败',
          warnings: [],
        })
      }
    },
    [fetchWorlds, importState.loading]
  )

  const filteredItems = useMemo(() => {
    const keyword = search.trim().toLowerCase()
    if (!keyword) return items
    return items.filter((item) => {
      const summary = getWorldSummary(item).toLowerCase()
      return item.name.toLowerCase().includes(keyword) || summary.includes(keyword)
    })
  }, [items, search])

  return (
    <div className="p-8 pb-20 md:pb-8">
      <motion.div
        initial={{ opacity: 0, y: -16 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between mb-6"
      >
        <div>
          <div className="flex items-center gap-3 mb-2">
            <Globe size={28} style={{ color: 'var(--accent-primary)' }} />
            <h1 className="text-3xl font-extrabold" style={{ color: 'var(--text-primary)' }}>
              世界书
            </h1>
          </div>
          <p style={{ color: 'var(--text-muted)' }}>支持导入、警告展示与列表刷新，当前共 {items.length} 条资源</p>
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => fetchWorlds()}
            disabled={listLoading}
            className="inline-flex items-center gap-2 px-4 py-3 rounded-xl border"
            style={{
              borderColor: 'var(--border-color)',
              color: 'var(--text-primary)',
              background: 'var(--bg-secondary)',
            }}
          >
            <RefreshCw size={16} className={listLoading ? 'animate-spin' : ''} />
            刷新列表
          </button>

          <label
            className="inline-flex items-center gap-2 px-4 py-3 rounded-xl cursor-pointer"
            style={{
              background: 'linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))',
              color: '#fff',
            }}
          >
            {importState.loading ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
            {importState.loading ? '导入中...' : '导入世界书'}
            <input
              type="file"
              accept=".json"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0]
                if (file) void handleImport(file)
                event.currentTarget.value = ''
              }}
            />
          </label>
        </div>
      </motion.div>

      <div className="mb-4">
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="搜索名称或摘要"
          className="w-full px-4 py-3 rounded-xl border outline-none"
          style={{
            borderColor: 'var(--border-color)',
            color: 'var(--text-primary)',
            background: 'var(--bg-secondary)',
          }}
        />
      </div>

      {(importState.success || importState.error || importState.warnings.length > 0) && (
        <div
          className="mb-6 rounded-2xl border p-4"
          style={{
            borderColor: 'var(--border-color)',
            background: 'var(--bg-secondary)',
            color: 'var(--text-primary)',
          }}
        >
          {importState.success && (
            <div className="flex items-center gap-2 mb-2" style={{ color: 'var(--success)' }}>
              <CheckCircle2 size={16} />
              <span>{importState.success}</span>
            </div>
          )}
          {importState.error && (
            <div className="flex items-center gap-2 mb-2" style={{ color: 'var(--danger)' }}>
              <AlertCircle size={16} />
              <span>{importState.error}</span>
            </div>
          )}
          {importState.warnings.length > 0 && (
            <ul className="space-y-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
              {importState.warnings.map((warning, index) => (
                <li key={`${warning.message}-${index}`}>• {warning.message}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div
        onDragOver={(event) => {
          event.preventDefault()
          setDragOver(true)
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(event) => {
          event.preventDefault()
          setDragOver(false)
          const file = event.dataTransfer.files?.[0]
          if (file) void handleImport(file)
        }}
        className="rounded-3xl border-2 transition-all"
        style={{
          borderColor: dragOver ? 'var(--accent-primary)' : 'transparent',
          background: dragOver ? 'rgba(124,106,247,0.06)' : 'transparent',
        }}
      >
        {listLoading ? (
          <div className="py-24 flex items-center justify-center gap-3" style={{ color: 'var(--text-muted)' }}>
            <Loader2 size={18} className="animate-spin" />
            正在加载世界书列表...
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="py-24 text-center" style={{ color: 'var(--text-muted)' }}>
            <p className="text-lg mb-2">暂无世界书资源</p>
            <p className="text-sm">可直接上传 JSON 文件，导入成功后列表会自动刷新。</p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filteredItems.map((item) => (
              <div
                key={item.id}
                className="rounded-2xl border p-5"
                style={{
                  borderColor: 'var(--border-color)',
                  background: 'var(--bg-secondary)',
                }}
              >
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div>
                    <h3 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
                      {item.name}
                    </h3>
                    <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                      更新时间：{formatDate(item.updatedAt ?? item.createdAt)}
                    </p>
                  </div>
                  <span
                    className="px-3 py-1 rounded-full text-xs"
                    style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}
                  >
                    {item.entryCount ?? 0} 条目
                  </span>
                </div>
                <p className="text-sm leading-6" style={{ color: 'var(--text-secondary)' }}>
                  {getWorldSummary(item)}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
