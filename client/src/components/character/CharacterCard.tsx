import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { Trash2, MessageCircle } from 'lucide-react'
import { useState } from 'react'
import { useDeleteCharacter } from '@/hooks'
import { Button, RichMessageContent } from '@/components/ui'
import type { Character } from '@/api/services/characters'

interface CharacterCardProps {
  character: Character
}

export function CharacterCard({ character }: CharacterCardProps) {
  const navigate = useNavigate()
  const deleteMutation = useDeleteCharacter()
  const [isHovered, setIsHovered] = useState(false)

  const initial = character.name?.trim()?.[0]?.toUpperCase() || 'C'
  const avatarUrl = character.avatarPath
    ? `/api/v1/characters/${character.id}/avatar`
    : null

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (deleteMutation.isPending) return

    if (window.confirm(`确定删除角色「${character.name}」吗？`)) {
      deleteMutation.mutate(character.id)
    }
  }

  const handleChat = (e: React.MouseEvent) => {
    e.stopPropagation()
    navigate(`/chat/${character.id}`)
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -4 }}
      whileTap={{ scale: 0.98 }}
      className="rounded-2xl p-3 flex flex-col cursor-pointer group"
      style={{
        background: isHovered ? 'var(--bg-tertiary)' : 'var(--bg-secondary)',
        border: `1px solid ${isHovered ? 'var(--accent-primary)' : 'var(--border-color)'}`,
        transition: 'all 0.2s ease',
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* 头像区域 */}
      <div
        className="relative w-full aspect-square mb-3 rounded-xl overflow-hidden flex items-center justify-center text-3xl font-bold select-none"
        style={{
          background: 'radial-gradient(circle at 20% 0, var(--accent-secondary), var(--bg-tertiary))',
          color: 'var(--text-primary)',
        }}
      >
        {avatarUrl ? (
          <img
            src={avatarUrl}
            alt={character.name}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        ) : (
          <span>{initial}</span>
        )}
      </div>

      {/* 信息区域 */}
      <div className="flex-1 flex flex-col min-w-0">
        <div
          className="font-semibold text-sm mb-1 truncate"
          style={{ color: 'var(--text-primary)' }}
          title={character.name}
        >
          {character.name}
        </div>
        <div
          className="text-xs line-clamp-2 mb-3"
          style={{ color: 'var(--text-secondary)' }}
        >
          {character.description ? (
            <RichMessageContent content={character.description} />
          ) : (
            '暂无描述'
          )}
        </div>

        {/* 操作按钮 */}
        <div className="mt-auto flex items-center justify-between gap-2">
          <Button
            variant="primary"
            size="sm"
            className="flex-1 text-xs"
            onClick={handleChat}
          >
            <MessageCircle size={14} className="mr-1" />
            开始对话
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="p-2 text-red-400 hover:text-red-300"
            onClick={handleDelete}
            loading={deleteMutation.isPending}
          >
            <Trash2 size={14} />
          </Button>
        </div>
      </div>
    </motion.div>
  )
}
