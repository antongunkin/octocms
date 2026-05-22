'use client';

import React, { useCallback, useEffect, useRef, useState, useTransition } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ImageIcon, Upload, X } from 'lucide-react';
import type { JsxEditorProps } from '@mdxeditor/editor';
import { useMdastNodeUpdater } from '@mdxeditor/editor';

import { uploadMedia } from '../../admin/actions';
import { queryKeys } from '../../admin/query/keys';
import { useMediaList } from '../../admin/query/hooks/useMediaList';
import { useConfig } from '../../hooks/useConfig';
import { toast } from '../../hooks/useToast';
import type { MediaFile } from '../../types';
import { suggestedTitleFromFileName } from '../../lib/suggestedMediaTitle';
import { Button } from '../ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui';
import { Label } from '../ui/label';

const ImageEmbedEditor: React.FC<JsxEditorProps> = ({ mdastNode }) => {
  const config = useConfig();
  const queryClient = useQueryClient();
  const updateNode = useMdastNodeUpdater();
  const mediaIdAttr = mdastNode.attributes?.find((a: any) => a.type === 'mdxJsxAttribute' && a.name === 'mediaId');
  const currentMediaId = typeof mediaIdAttr?.value === 'string' ? mediaIdAttr.value : '';

  const [isOpen, setIsOpen] = useState(false);
  const { data: mediaEntries = [], refetch: refetchMedia } = useMediaList({ enabled: isOpen });
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const uploadInputRef = useRef<HTMLInputElement>(null);
  const [stagedFile, setStagedFile] = useState<File | null>(null);
  const [uploadTitle, setUploadTitle] = useState('');

  const selectedEntry = mediaEntries.find((e) => e.id === currentMediaId);

  useEffect(() => {
    if (!isOpen) return;
    void refetchMedia();
  }, [isOpen, refetchMedia]);

  const updateMediaId = useCallback(
    (newId: string) => {
      updateNode({
        attributes: [{ type: 'mdxJsxAttribute', name: 'mediaId', value: newId }],
      } as any);
    },
    [updateNode],
  );

  const handleSelect = useCallback(
    (entry: MediaFile) => {
      updateMediaId(entry.id);
      setIsOpen(false);
    },
    [updateMediaId],
  );

  const stageFileFromList = useCallback(
    (fileList: FileList) => {
      const file = fileList[0];
      if (!file) return;
      const ext = file.name.split('.').pop()?.toLowerCase() || '';
      if (!config.mediaAllowedFormats.includes(ext)) {
        toast({ title: `Format .${ext} not allowed`, variant: 'destructive' });
        return;
      }
      setStagedFile(file);
      setUploadTitle(suggestedTitleFromFileName(file.name));
    },
    [config.mediaAllowedFormats],
  );

  const confirmStagedUpload = useCallback(() => {
    if (!stagedFile) return;
    const title = uploadTitle.trim();
    if (!title) {
      toast({ title: 'Title is required', variant: 'destructive' });
      return;
    }
    const file = stagedFile;
    const formData = new FormData();
    formData.set('file', file);
    formData.set('folder', selectedFolder || '/');
    formData.set('title', title);

    startTransition(async () => {
      const uploadResult = await uploadMedia(formData);
      if (!uploadResult.success) {
        toast({ title: uploadResult.error, variant: 'destructive' });
        return;
      }
      const mediaId = uploadResult.id;
      await queryClient.invalidateQueries({ queryKey: queryKeys.media.list() });
      updateMediaId(mediaId);
      setStagedFile(null);
      setUploadTitle('');
      setIsOpen(false);
      toast({ title: `Uploaded "${file.name}"`, variant: 'success' });
    });
  }, [stagedFile, uploadTitle, selectedFolder, updateMediaId, queryClient]);

  const folders = [...new Set(mediaEntries.map((f) => f.folder))];
  const filteredEntries = selectedFolder ? mediaEntries.filter((f) => f.folder === selectedFolder) : mediaEntries;

  return (
    <div className="octo-image-embed" contentEditable={false}>
      {currentMediaId && selectedEntry ? (
        <div className="octo-image-embed__selected">
          <div className="octo-image-embed__thumb-wrap">
            <img
              src={selectedEntry.publicUrl}
              alt={selectedEntry.title || selectedEntry.originalName || ''}
              className="octo-image-embed__thumb"
            />
            <button type="button" onClick={() => updateMediaId('')} className="octo-image-embed__clear">
              <X className="octo-icon-sm" />
            </button>
          </div>
          <div className="octo-image-embed__info">
            <span className="octo-image-embed__info-label">Image embed</span>
            <span className="octo-image-embed__info-name">{selectedEntry.title || selectedEntry.originalName}</span>
            <Button type="button" variant="outline" size="sm" onClick={() => setIsOpen(true)}>
              Change image
            </Button>
          </div>
        </div>
      ) : (
        <div className="octo-image-embed__empty-state">
          <div className="octo-image-embed__placeholder">
            <ImageIcon className="octo-image-embed__placeholder-icon octo-icon-24" />
          </div>
          <div>
            <span className="octo-image-embed__no-label">No image selected</span>
            <Button type="button" variant="outline" size="sm" onClick={() => setIsOpen(true)}>
              Select image
            </Button>
          </div>
        </div>
      )}

      <Dialog
        open={isOpen}
        onOpenChange={(open) => {
          setIsOpen(open);
          if (!open) {
            setStagedFile(null);
            setUploadTitle('');
          }
        }}
      >
        <DialogContent className="octo-dialog-content--5xl octo-dialog-content--vh-80 octo-dialog-content--flex-col">
          <DialogHeader>
            <DialogTitle>Select or upload image</DialogTitle>
          </DialogHeader>
          <div className="octo-image-embed__dropzone">
            <input
              ref={uploadInputRef}
              type="file"
              accept={config.mediaAllowedFormats.map((f) => `.${f}`).join(',')}
              className="octo-u-hidden"
              onChange={(e) => {
                if (e.target.files) stageFileFromList(e.target.files);
                e.target.value = '';
              }}
            />
            {!stagedFile ? (
              <div className="octo-image-embed__upload-placeholder">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => uploadInputRef.current?.click()}
                  disabled={isPending}
                >
                  <Upload className="octo-icon-md" />
                  Choose file to upload
                </Button>
              </div>
            ) : (
              <div className="octo-image-embed__upload-form">
                <p className="octo-u-text-base octo-u-text-muted octo-u-word-break-all">{stagedFile.name}</p>
                <div>
                  <Label htmlFor="richtext-image-upload-title" className="octo-field-label">
                    Title <span className="octo-u-text-danger">*</span>
                  </Label>
                  <input
                    id="richtext-image-upload-title"
                    type="text"
                    value={uploadTitle}
                    onChange={(e) => setUploadTitle(e.target.value)}
                    className="octo-media-asset__input octo-u-mt-1"
                    placeholder="Shown as default alt text when this image is used"
                    disabled={isPending}
                  />
                </div>
                <div className="octo-u-flex octo-u-gap-2">
                  <Button type="button" size="sm" onClick={confirmStagedUpload} disabled={isPending}>
                    Upload
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setStagedFile(null);
                      setUploadTitle('');
                    }}
                    disabled={isPending}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            )}
            {isPending && <span className="octo-u-text-xs octo-u-text-muted">Uploading...</span>}
          </div>
          <div className="octo-image-embed__body">
            {folders.length > 1 && (
              <div className="octo-image-embed__folders">
                <button
                  type="button"
                  onClick={() => setSelectedFolder(null)}
                  style={{
                    display: 'block',
                    width: '100%',
                    textAlign: 'left',
                    padding: '6px 8px',
                    borderRadius: 6,
                    fontSize: 14,
                    border: 0,
                    cursor: 'pointer',
                    background: selectedFolder === null ? 'var(--brand)' : 'transparent',
                    color: selectedFolder === null ? 'var(--bg)' : 'var(--text)',
                  }}
                >
                  All
                </button>
                {folders.map((folder) => (
                  <button
                    key={folder}
                    type="button"
                    onClick={() => setSelectedFolder(folder)}
                    style={{
                      display: 'block',
                      width: '100%',
                      textAlign: 'left',
                      padding: '6px 8px',
                      borderRadius: 6,
                      fontSize: 14,
                      border: 0,
                      cursor: 'pointer',
                      background: selectedFolder === folder ? 'var(--brand)' : 'transparent',
                      color: selectedFolder === folder ? 'var(--bg)' : 'var(--text)',
                    }}
                  >
                    {folder === '/' ? 'Root' : folder}
                  </button>
                ))}
              </div>
            )}
            <div className="octo-image-embed__scroller">
              <div className="octo-image-embed__grid">
                {filteredEntries.map((entry) => {
                  const isSelected = currentMediaId === entry.id;
                  return (
                    <button
                      key={entry.id}
                      type="button"
                      onClick={() => handleSelect(entry)}
                      style={{
                        position: 'relative',
                        aspectRatio: '1',
                        borderRadius: 8,
                        overflow: 'hidden',
                        border: isSelected ? '2px solid var(--brand)' : '2px solid var(--border)',
                        cursor: 'pointer',
                        padding: 0,
                        background: 'transparent',
                      }}
                    >
                      <img
                        src={entry.publicUrl}
                        alt={entry.title || entry.originalName}
                        className="octo-image-embed__thumb-img"
                      />
                      <div className="octo-image-embed__thumb-overlay">
                        <span className="octo-image-embed__thumb-caption">{entry.title || entry.originalName}</span>
                      </div>
                    </button>
                  );
                })}
                {filteredEntries.length === 0 && <div className="octo-image-embed__empty">No images found</div>}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ImageEmbedEditor;
