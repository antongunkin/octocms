'use client';

import React, { useRef, useState } from 'react';
import { Paperclip, Send, X } from 'lucide-react';

import { Button } from '../ui/button';

/** Allowed file types for chat attachments — kept in sync with `classifyAttachment`. */
const ACCEPTED_TYPES = '.pdf,.docx,.txt,.md,.markdown,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,text/markdown';

type Props = {
  disabled?: boolean;
  /** Per-attachment size limit in bytes — used to reject oversized files in the picker. */
  maxAttachmentBytes?: number;
  /** Per-turn attachment cap — used to disable the picker once full. */
  maxAttachmentsPerTurn?: number;
  /**
   * Called with the trimmed text and the user's selected attachments. The hook
   * decides whether to send JSON or multipart based on whether `files` is empty.
   */
  onSubmit(text: string, files: File[]): void;
};

export function Composer({
  disabled = false,
  maxAttachmentBytes = 25 * 1024 * 1024,
  maxAttachmentsPerTurn = 3,
  onSubmit,
}: Props) {
  const [value, setValue] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const send = () => {
    const text = value.trim();
    // Allow empty text when files are attached — the model can still reason
    // over the document with a default prompt set on the client side later.
    if ((!text && files.length === 0) || disabled) return;
    onSubmit(text, files);
    setValue('');
    setFiles([]);
    setError(null);
    requestAnimationFrame(() => taRef.current?.focus());
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  const addFiles = (incoming: FileList | File[]) => {
    setError(null);
    const list = Array.from(incoming);
    const next: File[] = [...files];
    for (const f of list) {
      if (next.length >= maxAttachmentsPerTurn) {
        setError(`Attachment limit reached (${maxAttachmentsPerTurn} per turn).`);
        break;
      }
      if (f.size > maxAttachmentBytes) {
        setError(`"${f.name}" exceeds the ${(maxAttachmentBytes / (1024 * 1024)).toFixed(0)} MB per-file limit.`);
        continue;
      }
      next.push(f);
    }
    setFiles(next);
    if (fileRef.current) fileRef.current.value = '';
  };

  const removeFile = (idx: number) => {
    setFiles(files.filter((_, i) => i !== idx));
    setError(null);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (disabled) return;
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) addFiles(e.dataTransfer.files);
  };

  const atCapacity = files.length >= maxAttachmentsPerTurn;

  return (
    <div
      className={`border-t border-border bg-background ${dragOver ? 'ring-2 ring-ring' : ''}`}
      onDragOver={(e) => {
        e.preventDefault();
        if (!disabled) setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={onDrop}
      data-testid="chat-composer"
    >
      {(files.length > 0 || error) && (
        <div className="px-4 pt-3 flex flex-wrap gap-2 items-center">
          {files.map((f, i) => (
            <div
              key={`${f.name}-${i}`}
              className="inline-flex items-center gap-2 rounded-full border border-input bg-muted px-3 py-1 text-xs"
              data-testid="chat-attachment-chip"
            >
              <Paperclip className="h-3 w-3" />
              <span className="max-w-[180px] truncate">{f.name}</span>
              <span className="text-muted-foreground">{formatSize(f.size)}</span>
              <button
                type="button"
                onClick={() => removeFile(i)}
                aria-label={`Remove ${f.name}`}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
          {error && <span className="text-xs text-destructive" role="alert">{error}</span>}
        </div>
      )}

      <div className="flex items-end gap-2 px-4 py-3">
        <input
          ref={fileRef}
          type="file"
          multiple
          accept={ACCEPTED_TYPES}
          className="hidden"
          onChange={(e) => e.target.files && addFiles(e.target.files)}
          data-testid="chat-file-input"
        />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          disabled={disabled || atCapacity}
          aria-label="Attach files"
          title={atCapacity ? `Attachment limit reached (${maxAttachmentsPerTurn})` : 'Attach files (PDF / DOCX / .txt / .md)'}
          onClick={() => fileRef.current?.click()}
        >
          <Paperclip className="h-4 w-4" />
        </Button>
        <textarea
          ref={taRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={onKeyDown}
          rows={1}
          disabled={disabled}
          placeholder={
            files.length > 0
              ? 'Describe what to do with the attachment(s) — or press Send.'
              : "Ask about your content — e.g. 'show me posts about caching'"
          }
          aria-label="Chat message"
          className="flex-1 resize-none rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50 max-h-40"
          onInput={(e) => {
            const el = e.currentTarget;
            el.style.height = 'auto';
            el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
          }}
        />
        <Button
          onClick={send}
          disabled={disabled || (!value.trim() && files.length === 0)}
          size="sm"
          className="gap-1.5"
        >
          <Send className="h-4 w-4" />
          Send
        </Button>
      </div>
    </div>
  );
}

function formatSize(n: number): string {
  if (n >= 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  if (n >= 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${n} B`;
}
