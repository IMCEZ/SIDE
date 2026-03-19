export const THEMES = [
  { id: 'theme-midnight', name: '午夜', description: '深邃的深蓝黑色调', preview: '#7c6af7' },
  { id: 'theme-abyss', name: '深渊', description: '神秘的黑紫配青色', preview: '#06b6d4' },
  { id: 'theme-rose', name: '蔷薇', description: '优雅的暗玫瑰色调', preview: '#f43f5e' },
  { id: 'theme-forest', name: '幽林', description: '沉静的墨绿暗色调', preview: '#10b981' },
  { id: 'theme-light', name: '晴空', description: '清爽的浅色主题', preview: '#6366f1' }
] as const;

export type ThemeId = (typeof THEMES)[number]['id'];

