import { describe, expect, it } from 'vitest';
import { autoConvertPreset } from './presetConverter';
import { parseWorldBookFromObject } from './worldBookParser';
import { parseCharacterFromJSON, parseCharacterFromPNG } from './characterParser';

describe('SillyTavern compatibility', () => {
  it('converts ST preset to SIDE format', () => {
    const stPreset = {
      temperature: 0.8,
      max_tokens: 1024,
      prompts: [
        { identifier: 'main_prompt', name: 'Main', content: 'You are helpful', role: 'system' },
        { identifier: 'user_input', name: 'User Input', content: '{{input}}' }
      ],
      prompt_order: [
        { identifier: 'user_input', enabled: true },
        { identifier: 'main_prompt', enabled: true }
      ]
    };

    const converted = autoConvertPreset(stPreset);
    expect(converted.params.maxTokens).toBe(1024);
    expect(converted.promptOrder).toHaveLength(2);
    expect(converted.promptOrder[0].identifier).toBe('user_input');
    expect(converted.promptOrder[1].identifier).toBe('main_prompt');
  });

  it('parses world book object entries and sorts by insertion order', () => {
    const stWorldBook = {
      name: 'Test World',
      entries: {
        '10': { uid: 10, key: ['alpha'], content: 'Alpha content', insertion_order: 3 },
        '11': { uid: 11, key: ['beta'], content: 'Beta content', insertion_order: 1 }
      }
    };

    const parsed = parseWorldBookFromObject(stWorldBook);
    expect(parsed.name).toBe('Test World');
    expect(parsed.entries).toHaveLength(2);
    expect(parsed.entries[0].uid).toBe(11);
    expect(parsed.entries[1].uid).toBe(10);
  });

  it('normalizes world book primitive-like field values', () => {
    const stWorldBook = {
      name: 'Normalize Test',
      entries: [
        {
          uid: '7',
          key: ['alpha', 1, true],
          keysecondary: ['beta', 2],
          content: 12345,
          constant: 'true',
          selective: '0',
          insertion_order: '9',
          enabled: '1',
          position: '2'
        }
      ]
    };

    const parsed = parseWorldBookFromObject(stWorldBook);
    expect(parsed.entries[0].uid).toBe(7);
    expect(parsed.entries[0].key).toEqual(['alpha', '1', 'true']);
    expect(parsed.entries[0].keysecondary).toEqual(['beta', '2']);
    expect(parsed.entries[0].content).toBe('12345');
    expect(parsed.entries[0].constant).toBe(true);
    expect(parsed.entries[0].selective).toBe(false);
    expect(parsed.entries[0].enabled).toBe(true);
    expect(parsed.entries[0].position).toBe(2);
  });

  it('parses ST V2 character fields', () => {
    const stV2 = {
      spec: 'chara_card_v2',
      spec_version: '2.0',
      data: {
        name: 'Alice',
        description: 'desc',
        personality: 'kind',
        scenario: 'test scene',
        first_mes: 'Hello',
        mes_example: 'Example',
        alternate_greetings: ['Hi', 'Hey'],
        creator_notes_multilingual: { zh: 'note' },
        source: ['book'],
        group_only_greetings: ['Group hello'],
        nickname: 'Ally'
      }
    };

    const parsed = parseCharacterFromJSON(JSON.stringify(stV2));
    expect(parsed.name).toBe('Alice');
    expect(parsed.alternate_greetings).toHaveLength(2);
    expect(parsed.nickname).toBe('Ally');
    expect(parsed.spec).toBe('chara_card_v2');
  });

  it('parses PNG chara chunk with base64url payload', () => {
    const card = {
      spec: 'chara_card_v2',
      spec_version: '2.0',
      data: {
        name: 'PNG Alice',
        first_mes: 'Hello from PNG'
      }
    };

    const base64url = Buffer.from(JSON.stringify(card), 'utf8')
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_');
    const textData = Buffer.concat([
      Buffer.from('chara', 'utf8'),
      Buffer.from([0]),
      Buffer.from(base64url, 'utf8')
    ]);
    const chunkLength = Buffer.alloc(4);
    chunkLength.writeUInt32BE(textData.length, 0);

    const pngBuffer = Buffer.concat([
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      chunkLength,
      Buffer.from('tEXt', 'ascii'),
      textData,
      Buffer.from([0, 0, 0, 0])
    ]);

    const parsed = parseCharacterFromPNG(pngBuffer);
    expect(parsed.name).toBe('PNG Alice');
    expect(parsed.first_mes).toBe('Hello from PNG');
  });

  it('throws for non-PNG input buffer', () => {
    const notPng = Buffer.from('not a png');
    expect(() => parseCharacterFromPNG(notPng)).toThrow('Not a PNG file');
  });

  it('throws when PNG has no chara tEXt chunk', () => {
    const textData = Buffer.concat([
      Buffer.from('other_key', 'utf8'),
      Buffer.from([0]),
      Buffer.from('value', 'utf8')
    ]);
    const chunkLength = Buffer.alloc(4);
    chunkLength.writeUInt32BE(textData.length, 0);
    const pngBuffer = Buffer.concat([
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      chunkLength,
      Buffer.from('tEXt', 'ascii'),
      textData,
      Buffer.from([0, 0, 0, 0])
    ]);

    expect(() => parseCharacterFromPNG(pngBuffer)).toThrow('No chara tEXt chunk found');
  });

  it('throws when chara chunk payload is invalid JSON', () => {
    const invalidPayload = Buffer.from('not-json', 'utf8').toString('base64');
    const textData = Buffer.concat([
      Buffer.from('chara', 'utf8'),
      Buffer.from([0]),
      Buffer.from(invalidPayload, 'utf8')
    ]);
    const chunkLength = Buffer.alloc(4);
    chunkLength.writeUInt32BE(textData.length, 0);
    const pngBuffer = Buffer.concat([
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      chunkLength,
      Buffer.from('tEXt', 'ascii'),
      textData,
      Buffer.from([0, 0, 0, 0])
    ]);

    expect(() => parseCharacterFromPNG(pngBuffer)).toThrow();
  });
});
