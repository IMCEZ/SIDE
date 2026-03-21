import { describe, expect, it } from 'vitest'
import { extractAnyOpenAIText, extractOpenAIStreamDelta } from './llm'

describe('LLM OpenAI-compatible parsing', () => {
  it('extracts streaming delta content (choices[0].delta.content)', () => {
    const parsed = {
      choices: [
        {
          delta: {
            content: 'Hello, ',
          },
        },
      ],
    }

    expect(extractOpenAIStreamDelta(parsed)).toBe('Hello, ')
  })

  it('extracts streaming reasoning_content when content is empty', () => {
    const parsed = {
      choices: [
        {
          delta: {
            content: '',
            reasoning_content: 'Reason: ',
          },
        },
      ],
    }

    expect(extractOpenAIStreamDelta(parsed)).toBe('Reason: ')
  })

  it('extracts OpenAI multi-part delta content arrays', () => {
    const parsed = {
      choices: [
        {
          delta: {
            content: [
              { type: 'text', text: 'A' },
              { type: 'text', text: 'B' },
              { type: 'other', content: 'C' },
            ],
          },
        },
      ],
    }

    // normalizeOpenAIContentPiece picks {type:'text',text} and also string content parts.
    expect(extractOpenAIStreamDelta(parsed)).toBe('ABC')
  })

  it('extracts non-stream completion (choices[0].message.content)', () => {
    const parsed = {
      choices: [
        {
          message: {
            content: 'Final answer',
          },
        },
      ],
    }

    expect(extractAnyOpenAIText(parsed)).toBe('Final answer')
  })

  it('extracts responses-style output_text parts', () => {
    const parsed = {
      output: [
        {
          content: [
            { type: 'output_text', text: 'R1' },
            { type: 'output_text', text: 'R2' },
          ],
        },
      ],
    }

    expect(extractAnyOpenAIText(parsed)).toBe('R1R2')
  })

  it('returns empty string when no known text fields exist', () => {
    const parsed = { id: 'x', object: 'y', choices: [{ delta: {} }] }
    expect(extractAnyOpenAIText(parsed)).toBe('')
  })
})

