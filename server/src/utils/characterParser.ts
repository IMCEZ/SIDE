export interface CharacterData {
  name: string;
  description: string;
  personality: string;
  scenario: string;
  first_mes: string;
  mes_example: string;
  creator_notes: string;
  system_prompt: string;
  post_history_instructions: string;
  tags: string[];
  creator: string;
  character_version: string;
  extensions: Record<string, unknown>;
  spec?: string;
  spec_version?: string;
  data?: Record<string, unknown>;
}

export function parseCharacterFromJSON(jsonString: string): CharacterData {
  const raw = JSON.parse(jsonString) as any;
  const base = raw.data ?? raw;

  const result: CharacterData = {
    name: base.name ?? raw.name ?? '',
    description: base.description ?? raw.description ?? '',
    personality: base.personality ?? raw.personality ?? '',
    scenario: base.scenario ?? raw.scenario ?? '',
    first_mes: base.first_mes ?? raw.first_mes ?? '',
    mes_example: base.mes_example ?? raw.mes_example ?? '',
    creator_notes: base.creator_notes ?? raw.creator_notes ?? '',
    system_prompt: base.system_prompt ?? raw.system_prompt ?? '',
    post_history_instructions:
      base.post_history_instructions ?? raw.post_history_instructions ?? '',
    tags: Array.isArray(base.tags ?? raw.tags) ? (base.tags ?? raw.tags) : [],
    creator: base.creator ?? raw.creator ?? '',
    character_version: base.character_version ?? raw.character_version ?? '',
    extensions: (base.extensions ??
      raw.extensions ??
      {}) as Record<string, unknown>,
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

  const jsonString = Buffer.from(found, 'base64').toString('utf8');
  return parseCharacterFromJSON(jsonString);
}

