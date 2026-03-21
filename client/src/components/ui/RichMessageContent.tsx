import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { contentUsesHtmlMarkup, sanitizeHtml } from '@/utils/safeHtml'

type Props = {
  content: string
  className?: string
  style?: React.CSSProperties
}

/**
 * 统一消息/描述渲染：检测到白名单 HTML 标签时经 DOMPurify 后 innerHTML；否则走 Markdown。
 * 净化逻辑仅在 `@/utils/safeHtml`。
 */
export function RichMessageContent({ content, className, style }: Props) {
  return contentUsesHtmlMarkup(content) ? (
    <div
      className={className ? `rich-text-content ${className}` : 'rich-text-content'}
      style={style}
      dangerouslySetInnerHTML={{ __html: sanitizeHtml(content) }}
    />
  ) : (
    <div className={className ? `rich-text-content ${className}` : 'rich-text-content'} style={style}>
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
    </div>
  )
}
