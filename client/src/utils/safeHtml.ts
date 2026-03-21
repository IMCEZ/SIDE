import DOMPurify from 'dompurify'
import type { Config } from 'dompurify'

/**
 * 集中式 HTML 白名单（仅在此处维护；组件只调用 sanitizeHtml / contentUsesHtmlMarkup）。
 * 允许内联 HTML + class + style（由 DOMPurify 清洗 CSS），禁止可执行内容与危险标签。
 */
export const SAFE_HTML_ALLOWED_TAGS = [
  // 排版与容器
  'p',
  'div',
  'span',
  'br',
  'hr',
  'wbr',
  // 强调
  'strong',
  'b',
  'em',
  'i',
  'u',
  's',
  'strike',
  'del',
  'ins',
  'sub',
  'sup',
  'small',
  'mark',
  // 标题与列表
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'ul',
  'ol',
  'li',
  'dl',
  'dt',
  'dd',
  'blockquote',
  'pre',
  'code',
  // 链接与媒体（业务需要：卡片内美化、头像外链图）
  'a',
  'img',
  // 表格
  'table',
  'thead',
  'tbody',
  'tfoot',
  'tr',
  'th',
  'td',
  'caption',
  'colgroup',
  'col',
  // 其它常见
  'abbr',
  'cite',
  'q',
  'font',
  'center',
  'details',
  'summary',
  'figure',
  'figcaption',
] as const

export const SAFE_HTML_ALLOWED_ATTR = [
  'class',
  'style',
  'href',
  'src',
  'alt',
  'title',
  'width',
  'height',
  'loading',
  'decoding',
  'target',
  'rel',
  'colspan',
  'rowspan',
  'align',
  'valign',
  'cellpadding',
  'cellspacing',
  'border',
  'id',
  'role',
  'aria-label',
  'aria-hidden',
  'open',
  'cite',
  'start',
  'reversed',
  'type',
  'color',
  'face',
  'size',
] as const

/** 与 ALLOWED_TAGS 对齐的检测正则：出现其中任一开标签则视为「走 HTML 分支」 */
const HTML_MARKUP_DETECTOR_RE = new RegExp(
  `<\\/?(${SAFE_HTML_ALLOWED_TAGS.join('|')})\\b`,
  'i'
)

let hooksRegistered = false

function ensurePurifyHooks(): void {
  if (hooksRegistered || typeof window === 'undefined') return
  hooksRegistered = true
  DOMPurify.addHook('afterSanitizeAttributes', (node) => {
    if (node.nodeName === 'A' && node instanceof Element && node.getAttribute('target') === '_blank') {
      const rel = node.getAttribute('rel') || ''
      if (!/\bnoopener\b/i.test(rel)) {
        node.setAttribute('rel', rel ? `${rel} noopener noreferrer` : 'noopener noreferrer')
      }
    }
  })
}

const PURIFY_CONFIG: Config = {
  ALLOWED_TAGS: [...SAFE_HTML_ALLOWED_TAGS],
  ALLOWED_ATTR: [...SAFE_HTML_ALLOWED_ATTR],
  ALLOW_DATA_ATTR: false,
  /** 仅 HTML 命名空间，避免 SVG/MathML 子树绕过 */
  ALLOWED_NAMESPACES: ['http://www.w3.org/1999/xhtml'],
  // 全局 <style>、脚本、嵌入等（即使被误写）显式禁止
  FORBID_TAGS: ['style', 'script', 'iframe', 'object', 'embed', 'svg', 'math', 'link', 'meta', 'base', 'form'],
  FORBID_ATTR: ['srcdoc'],
  ALLOW_UNKNOWN_PROTOCOLS: false,
}

/**
 * 检测是否按「含 HTML 标记」路径渲染（与白名单标签一致，减少 `x<y` 等误判）。
 */
export function contentUsesHtmlMarkup(text: string): boolean {
  if (!text || typeof text !== 'string') return false
  return HTML_MARKUP_DETECTOR_RE.test(text)
}

/**
 * 使用 DOMPurify 净化；输出仅用于 `dangerouslySetInnerHTML`，不可执行脚本。
 */
export function sanitizeHtml(html: string): string {
  if (!html) return ''
  ensurePurifyHooks()
  return DOMPurify.sanitize(html, PURIFY_CONFIG)
}

export function renderSafeHtml(html: string): { __html: string } {
  return { __html: sanitizeHtml(html) }
}
