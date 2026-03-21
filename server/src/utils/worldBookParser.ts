export interface WorldBookEntry {
  uid: number;
  key: string[];
  keysecondary: string[];
  comment: string;
  content: string;
  constant: boolean;
  selective: boolean;
  insertion_order: number;
  enabled: boolean;
  position: number;
  extensions: Record<string, unknown>;
}

export interface WorldBookData {
  name: string;
  description: string;
  entries: WorldBookEntry[];
  extensions: Record<string, unknown>;
}

function toArrayOfStrings(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item ?? '')).filter((item) => item.length > 0);
}

function toNumber(value: unknown, fallback: number): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

function toBoolean(value: unknown, fallback: boolean): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  if (typeof value === 'string') {
    const lower = value.trim().toLowerCase();
    if (lower === 'true' || lower === '1') return true;
    if (lower === 'false' || lower === '0') return false;
  }
  return fallback;
}

function normalizeEntry(raw: any, fallbackUid: number): WorldBookEntry {
  return {
    uid: toNumber(raw?.uid, fallbackUid),
    key: toArrayOfStrings(raw?.key),
    keysecondary: toArrayOfStrings(raw?.keysecondary),
    comment: String(raw?.comment ?? ''),
    content: String(raw?.content ?? ''),
    constant: toBoolean(raw?.constant, false),
    selective: toBoolean(raw?.selective, false),
    insertion_order: toNumber(raw?.insertion_order, fallbackUid),
    enabled: toBoolean(raw?.enabled, true),
    position: toNumber(raw?.position, 0),
    extensions: (raw?.extensions && typeof raw.extensions === 'object'
      ? raw.extensions
      : {}) as Record<string, unknown>
  };
}

export function isSillyTavernWorldBook(data: unknown): boolean {
  if (!data || typeof data !== 'object') return false;
  const obj = data as Record<string, unknown>;
  return (
    Array.isArray(obj.entries) ||
    (obj.entries !== null && typeof obj.entries === 'object') ||
    typeof obj.originalData === 'string'
  );
}

export function parseWorldBookFromObject(input: any): WorldBookData {
  const entriesSource = input?.entries;
  const entries: WorldBookEntry[] = [];

  if (Array.isArray(entriesSource)) {
    entriesSource.forEach((entry, index) => {
      entries.push(normalizeEntry(entry, index));
    });
  } else if (entriesSource && typeof entriesSource === 'object') {
    Object.entries(entriesSource as Record<string, unknown>).forEach(([key, value], index) => {
      const normalized = normalizeEntry(value, toNumber(key, index));
      entries.push(normalized);
    });
  }

  entries.sort((a, b) => a.insertion_order - b.insertion_order);

  return {
    name: String(input?.name ?? input?.title ?? '未命名世界书'),
    description: String(input?.description ?? ''),
    entries,
    extensions: (input?.extensions && typeof input.extensions === 'object'
      ? input.extensions
      : {}) as Record<string, unknown>
  };
}

export function parseWorldBookFromJSON(jsonString: string): WorldBookData {
  const raw = JSON.parse(jsonString) as any;
  return parseWorldBookFromObject(raw);
}

