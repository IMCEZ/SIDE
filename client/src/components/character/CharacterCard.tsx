import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Trash2 } from 'lucide-react';
import type { CharacterListItem } from '../../hooks/useCharacters';
import { useDeleteCharacter } from '../../hooks/useCharacters';
import { useState } from 'react';

interface CharacterCardProps {
  character: CharacterListItem;
}

export const CharacterCard = ({ character }: CharacterCardProps) => {
  const navigate = useNavigate();
  const deleteMutation = useDeleteCharacter();
  const [hovered, setHovered] = useState(false);

  const initial = character.name?.trim()?.[0]?.toUpperCase() || 'C';

  const handleDelete = () => {
    if (deleteMutation.isLoading) return;
    // 简单 confirm，可后续替换为对话框
    // eslint-disable-next-line no-alert
    if (window.confirm(`确定删除角色「${character.name}」吗？`)) {
      deleteMutation.mutate(character.id);
    }
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -4 }}
      whileTap={{ scale: 0.98 }}
      className="rounded-2xl p-3 flex flex-col cursor-pointer"
      style={{
        background: hovered ? 'var(--bg-tertiary)' : 'var(--bg-secondary)',
        border: `1px solid ${hovered ? 'var(--accent-primary)' : 'var(--border-color)'}`
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div
        className="relative w-full aspect-square mb-3 rounded-xl overflow-hidden flex items-center justify-center text-3xl font-bold select-none"
        style={{
          background: 'radial-gradient(circle at 20% 0, var(--accent-secondary), var(--bg-tertiary))',
          color: 'var(--text-primary)'
        }}
      >
        {character.avatarPath ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={`/api/v1/characters/${character.id}/avatar`}
            alt={character.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <span>{initial}</span>
        )}
      </div>
      <div className="flex-1 flex flex-col">
        <div className="font-semibold text-sm mb-1 truncate" title={character.name}>
          {character.name}
        </div>
        <div
          className="text-xs line-clamp-2 mb-3"
          style={{ color: 'var(--text-secondary)' }}
        >
          角色描述将在后续版本中展示。
        </div>
        <div className="mt-auto flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => navigate(`/chat/${character.id}`)}
            className="flex-1 text-xs font-medium px-3 py-1.5 rounded-full"
            style={{
              background:
                'linear-gradient(90deg, rgba(124,106,247,0.95), rgba(34,211,238,0.95))',
              color: '#020617'
            }}
          >
            开始对话
          </button>
          <button
            type="button"
            onClick={handleDelete}
            className="p-1.5 rounded-full hover:bg-red-500/10"
            style={{ color: '#f97373' }}
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>
    </motion.div>
  );
};

