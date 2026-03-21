import type { ApiWarning } from '../apiErrorTypes'

type ImportSuccessResponse = {
  success: true
  warnings?: ApiWarning[]
  [key: string]: unknown
}

export type ImportedWorldbookListItem = {
  id: number
  name: string
  description?: string | null
  createdAt?: number | null
  updatedAt?: number | null
  entryCount?: number
}

export type ImportedPresetListItem = {
  id: number
  name: string
  isDefault?: number | boolean
  createdAt?: number | null
  updatedAt?: number | null
  promptCount?: number
}

export type ImportedRegexListItem = {
  id: number
  name: string
  createdAt?: number | null
  updatedAt?: number | null
  ruleCount?: number
  enabledCount?: number
  placementSummary?: {
    input: number
    output: number
    both: number
  }
}

export class ImportResourceError extends Error {
  warnings?: ApiWarning[]

  constructor(message: string, warnings?: ApiWarning[]) {
    super(message)
    this.name = 'ImportResourceError'
    this.warnings = warnings
  }
}

function getAuthHeaders(): HeadersInit {
  const token = localStorage.getItem('side_token')
  const headers: Record<string, string> = {}
  if (token) {
    headers.Authorization = `Bearer ${token}`
  }
  return headers
}

async function parseResponseBody(response: Response) {
  const text = await response.text().catch(() => '')
  if (!text) return null

  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}

async function requestJson<T>(input: string, init?: RequestInit): Promise<T> {
  const response = await fetch(input, {
    ...init,
    headers: {
      ...getAuthHeaders(),
      ...(init?.headers ?? {}),
    },
  })

  const payload = await parseResponseBody(response)

  if (!response.ok) {
    const message =
      typeof payload === 'object' && payload
        ? String((payload as { error?: string; message?: string }).error || (payload as { message?: string }).message || `HTTP ${response.status}`)
        : typeof payload === 'string' && payload
          ? payload
          : `HTTP ${response.status}`

    const warnings =
      typeof payload === 'object' && payload && Array.isArray((payload as { warnings?: ApiWarning[] }).warnings)
        ? (payload as { warnings?: ApiWarning[] }).warnings
        : undefined

    throw new ImportResourceError(message, warnings)
  }

  return payload as T
}

async function importFile<T extends ImportSuccessResponse>(path: string, file: File): Promise<T> {
  const formData = new FormData()
  formData.append('file', file)

  return requestJson<T>(path, {
    method: 'POST',
    body: formData,
  })
}

export const importResourcesApi = {
  listWorldbooks: () => requestJson<ImportedWorldbookListItem[]>('/api/import/worldbook'),
  importWorldbook: (file: File) => importFile<ImportSuccessResponse & { worldbookId?: number; id?: number }>('/api/import/worldbook', file),

  listPresets: () => requestJson<ImportedPresetListItem[]>('/api/import/preset'),
  importPreset: (file: File) => importFile<ImportSuccessResponse & { presetId?: number; id?: number }>('/api/import/preset', file),

  listRegexRulesets: () => requestJson<ImportedRegexListItem[]>('/api/import/regex'),
  importRegexRules: (file: File) => importFile<ImportSuccessResponse & { rulesetId?: number; id?: number }>('/api/import/regex', file),
}
