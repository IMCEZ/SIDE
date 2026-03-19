import { useRef, useState, DragEvent, ChangeEvent } from 'react';
import { UploadCloud } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '../ui/dialog';
import { useImportCharacter } from '../../hooks/useCharacters';

interface ImportCharacterDialogProps {
  onImported?: () => void;
}

export const ImportCharacterDialog = ({ onImported }: ImportCharacterDialogProps) => {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const importMutation = useImportCharacter();

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    const f = e.dataTransfer.files?.[0];
    if (f && (f.name.endsWith('.png') || f.name.endsWith('.json'))) {
      setFile(f);
    }
  };

  const onDrag = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const onChange = (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) {
      setFile(f);
    }
  };

  const onConfirm = async () => {
    if (!file || importMutation.isLoading) return;
    try {
      await importMutation.mutateAsync(file);
      setFile(null);
      onImported?.();
    } catch {
      // 错误可后续用 toast 展示
    }
  };

  const prettySize =
    file && file.size
      ? file.size > 1024 * 1024
        ? `${(file.size / (1024 * 1024)).toFixed(2)} MB`
        : `${(file.size / 1024).toFixed(0)} KB`
      : '';

  return (
    <Dialog>
      <DialogTrigger>
        <button
          type="button"
          className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium"
          style={{
            background:
              'linear-gradient(90deg, rgba(124,106,247,0.95), rgba(34,211,238,0.95))',
            color: '#020617'
          }}
        >
          <span className="text-xs">+</span>
          导入角色卡
        </button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>导入角色卡</DialogTitle>
          <DialogDescription>支持 SillyTavern V2 的 PNG 或 JSON 角色卡。</DialogDescription>
        </DialogHeader>
        <div
          className="mt-3 border-2 border-dashed rounded-xl px-4 py-8 flex flex-col items-center justify-center text-xs text-center"
          style={{
            borderColor: dragActive ? 'var(--accent-primary)' : 'var(--border-color)',
            background: dragActive ? 'rgba(124,106,247,0.06)' : 'var(--bg-tertiary)',
            color: 'var(--text-secondary)'
          }}
          onDragEnter={onDrag}
          onDragOver={onDrag}
          onDragLeave={onDrag}
          onDrop={onDrop}
        >
          <UploadCloud size={24} className="mb-2" />
          <div className="mb-1">拖拽 PNG / JSON 文件到此处</div>
          <div className="mb-2 text-[11px]" style={{ color: 'var(--text-muted)' }}>
            或点击下方按钮选择文件
          </div>
          <button
            type="button"
            className="mt-1 px-3 py-1.5 rounded-full text-xs border"
            style={{ borderColor: 'var(--border-color)' }}
            onClick={() => inputRef.current?.click()}
          >
            选择文件
          </button>
          <input
            ref={inputRef}
            type="file"
            accept=".png,.json"
            className="hidden"
            onChange={onChange}
          />
          {file ? (
            <div className="mt-3 text-[11px]" style={{ color: 'var(--text-secondary)' }}>
              已选择：{file.name} {prettySize && `(${prettySize})`}
            </div>
          ) : null}
        </div>
        <DialogFooter>
          <button
            type="button"
            className="px-3 py-1.5 rounded-full text-xs border"
            style={{ borderColor: 'var(--border-color)', color: 'var(--text-secondary)' }}
            onClick={() => {
              setFile(null);
            }}
          >
            清除
          </button>
          <button
            type="button"
            disabled={!file || importMutation.isLoading}
            className="px-3 py-1.5 rounded-full text-xs font-medium disabled:opacity-60"
            style={{
              background:
                'linear-gradient(90deg, rgba(124,106,247,0.95), rgba(34,211,238,0.95))',
              color: '#020617'
            }}
            onClick={onConfirm}
          >
            {importMutation.isLoading ? '导入中...' : '确认导入'}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

