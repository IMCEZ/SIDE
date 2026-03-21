import { useCallback, useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { AlertCircle, CheckCircle2, FileText, Loader2, RefreshCw, Upload } from 'lucide-react'
import type { ApiWarning } from '@/api/apiErrorTypes'
import { ImportResourceError, importResourcesApi, type ImportedRegexListItem } from '@/api/services/importResources'

type RegexPlacementSummary = {
  input: number
  output: number
  both: number
}

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

function normalizePlacementSummary(summary?: Partial<RegexPlacementSummary>) {
  return {
    input: Number(summary?.input ?? 0),
    output: Number(summary?.output ?? 0),
    both: Number(summary?.both ?? 0),
  }
}

function getPlacementSummaryText(summary?: Partial<RegexPlacementSummary>) {
  if (!summary) return '未知'
  const normalized = normalizePlacementSummary(summary)
  return `input ${normalized.input} / output ${normalized.output} / both ${normalized.both}`
}

function getEnabledSummary(item: ImportedRegexListItem) {
  if (typeof item.enabledCount === 'number' && typeof item.ruleCount === 'number') {
    return `${item.enabledCount}/${item.ruleCount} 启用`
  }
  if (typeof item.enabledCount === 'number') {
    return `${item.enabledCount} 条启用`
  }
  return '未知'
}

function getRegexUpdatedAt(item: ImportedRegexListItem) {
  return item.updatedAt ?? item.createdAt
}

export default function RegexPage() {
  const [items, setItems] = useState<ImportedRegexListItem[]>([])
  const [search, setSearch] = useState('')
  const [listLoading, setListLoading] = useState(false)
  const [importState, setImportState] = useState<ImportState>(initialImportState)
  const [dragOver, setDragOver] = useState(false)

  const fetchRegexRulesets = useCallback(async () => {
    setListLoading(true)
    try {
      const data = await importResourcesApi.listRegexRulesets()
      setItems(Array.isArray(data) ? data : [])
    } catch (error) {
      const message = error instanceof Error ? error.message : '获取 Regex 列表失败'
      setImportState((prev) => ({ ...prev, error: message }))
    } finally {
      setListLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchRegexRulesets()
  }, [fetchRegexRulesets])

  const handleImport = useCallback(
    async (file: File) => {
      if (!file || importState.loading) return

      setImportState({ loading: true, success: null, error: null, warnings: [] })
      try {
        const result = await importResourcesApi.importRegexRules(file)
        const warnings = Array.isArray(result.warnings) ? result.warnings : []
        setImportState({
          loading: false,
          success: warnings.length ? 'Regex 规则导入成功（含警告）' : 'Regex 规则导入成功',
          error: null,
          warnings,
        })
        await fetchRegexRulesets()
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
          error: error instanceof Error ? error.message : 'Regex 规则导入失败',
          warnings: [],
        })
      }
    },
    [fetchRegexRulesets, importState.loading]
  )

  const filteredItems = useMemo(() => {
    const keyword = search.trim().toLowerCase()
    if (!keyword) return items
    return items.filter((item) => {
      const placement = getPlacementSummaryText(item.placementSummary).toLowerCase()
      return item.name.toLowerCase().includes(keyword) || placement.includes(keyword)
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
            <FileText size={28} style={{ color: 'var(--accent-primary)' }} />
            <h1 className="text-3xl font-extrabold" style={{ color: 'var(--text-primary)' }}>
              Regex 规则
            </h1>
          </div>
          <p style={{ color: 'var(--text-muted)' }}>轻量资源页，提供导入、状态反馈、规则概览与列表刷新</p>
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => fetchRegexRulesets()}
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
            {importState.loading ? '导入中...' : '导入 Regex'}
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
          placeholder="搜索规则集名称或 placement 概览"
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
            正在加载 Regex 列表...
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="py-24 text-center" style={{ color: 'var(--text-muted)' }}>
            <p className="text-lg mb-2">暂无 Regex 规则资源</p>
            <p className="text-sm">当前页面已接入导入接口，导入成功后会自动刷新列表。</p>
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
                      更新时间：{formatDate(getRegexUpdatedAt(item))}
                    </p>
                  </div>
                  <span
                    className="px-3 py-1 rounded-full text-xs"
                    style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}
                  >
                    {item.ruleCount ?? 0} 条规则
                  </span>
                </div>
                <div className="space-y-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
                  <p>启用概览：{getEnabledSummary(item)}</p>
                  <p>placement：{getPlacementSummaryText(item.placementSummary)}</p>
                  <p>摘要：规则数 {item.ruleCount ?? 0}，适合做输入/输出替换预览。</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
