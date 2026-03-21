export interface CharacterData {
  name: string;
  description: string;
  personality: string;
  scenario: string;
  firstMessage: string;
  first_mes: string;
  mes_example: string;
  creator_notes: string;
  system_prompt: string;
  post_history_instructions: string;
  alternate_greetings: string[];
  character_book: Record<string, unknown> | null;
  creator_notes_multilingual: Record<string, unknown>;
  source: string[];
  group_only_greetings: string[];
  nickname: string;
  tags: string[];
  creator: string;
  character_version: string;
  extensions: Record<string, unknown>;
  spec?: string;
  spec_version?: string;
  data?: Record<string, unknown>;
}

function asString(value: unknown, fallback = ''): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return fallback;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => asString(item)).filter((item) => item.length > 0);
}

function asObject(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

export function parseCharacterFromJSON(jsonString: string): CharacterData {
  const raw = JSON.parse(jsonString) as any;
  const base = raw.data ?? raw;
  const book = base.character_book ?? raw.character_book;

  const result: CharacterData = {
    name: asString(base.name ?? raw.name),
    description: asString(base.description ?? raw.description),
    personality: asString(base.personality ?? raw.personality),
    scenario: asString(base.scenario ?? raw.scenario),
    firstMessage: asString(base.firstMessage ?? base.first_mes ?? raw.firstMessage ?? raw.first_mes),
    first_mes: asString(base.first_mes ?? raw.first_mes),
    mes_example: asString(base.mes_example ?? raw.mes_example),
    creator_notes: asString(base.creator_notes ?? raw.creator_notes),
    system_prompt: asString(base.system_prompt ?? raw.system_prompt),
    post_history_instructions: asString(
      base.post_history_instructions ?? raw.post_history_instructions
    ),
    alternate_greetings: asStringArray(base.alternate_greetings ?? raw.alternate_greetings),
    character_book: book && typeof book === 'object' ? (book as Record<string, unknown>) : null,
    creator_notes_multilingual: asObject(
      base.creator_notes_multilingual ?? raw.creator_notes_multilingual
    ),
    source: asStringArray(base.source ?? raw.source),
    group_only_greetings: asStringArray(base.group_only_greetings ?? raw.group_only_greetings),
    nickname: asString(base.nickname ?? raw.nickname),
    tags: asStringArray(base.tags ?? raw.tags),
    creator: asString(base.creator ?? raw.creator),
    character_version: asString(base.character_version ?? raw.character_version),
    extensions: asObject(base.extensions ?? raw.extensions),
    spec: raw.spec,
    spec_version: raw.spec_version,
    data: base.data ?? raw.data
  };

  return result;
}

export function parseCharacterFromPNG(buffer: Buffer): CharacterData {
  const signature = buffer.subarray(0, 8);
  const pngSignature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  if (!signature.equals(pngSignature)) {
    throw new Error('Not a PNG file');
  }

  let offset = 8;
  let found: string | null = null;

  while (offset + 8 <= buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.toString('ascii', offset + 4, offset + 8);
    const dataStart = offset + 8;
    const dataEnd = dataStart + length;

    if (dataEnd + 4 > buffer.length) break;

    if (type === 'tEXt') {
      const textChunk = buffer.subarray(dataStart, dataEnd);
      const nulIndex = textChunk.indexOf(0);
      if (nulIndex !== -1) {
        const key = textChunk.subarray(0, nulIndex).toString('utf8');
        const value = textChunk.subarray(nulIndex + 1).toString('utf8');
        if (key === 'chara') {
          found = value;
          break;
        }
      }
    }

    offset = dataEnd + 4; // skip CRC
  }

  if (!found) {
    throw new Error('No chara tEXt chunk found');
  }

  const normalized = found.replace(/-/g, '+').replace(/_/g, '/');
  const jsonString = Buffer.from(normalized, 'base64').toString('utf8');
  return parseCharacterFromJSON(jsonString);
}

