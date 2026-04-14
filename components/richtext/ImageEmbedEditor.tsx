'use client';

import React, { useCallback, useEffect, useRef, useState, useTransition } from 'react';
import { ImageIcon, Upload, X } from 'lucide-react';
import type { JsxEditorProps } from '@mdxeditor/editor';
import { useMdastNodeUpdater } from '@mdxeditor/editor';

import { useConfig } from '../../hooks/useConfig';
import { getMediaEntries, uploadMedia } from '../../admin/actions';
import { toast } from '../../hooks/useToast';
import type { MediaFile } from '../../types';
import { suggestedTitleFromFileName } from '../../lib/suggestedMediaTitle';
import { Button } from '../ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui';
import { Label } from '../ui/label';

const ImageEmbedEditor: React.FC<JsxEditorProps> = ({ mdastNode }) => {
  const config = useConfig();
  const updateNode = useMdastNodeUpdater();
  const mediaIdAttr = mdastNode.attributes?.find((a: any) => a.type === 'mdxJsxAttribute' && a.name === 'mediaId');
  const currentMediaId = typeof mediaIdAttr?.value === 'string' ? mediaIdAttr.value : '';

  const [isOpen, setIsOpen] = useState(false);
  const [mediaEntries, setMediaEntries] = useState<MediaFile[]>([]);
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const uploadInputRef = useRef<HTMLInputElement>(null);
  const [stagedFile, setStagedFile] = useState<File | null>(null);
  const [uploadTitle, setUploadTitle] = useState('');
  const [loaded, setLoaded] = useState(false);

  const selectedEntry = mediaEntries.find((e) => e.id === currentMediaId);

  useEffect(() => {
    if (!loaded && isOpen) {
      getMediaEntries().then((entries) => {
        setMediaEntries(entries);
        setLoaded(true);
      });
    }
  }, [isOpen, loaded]);

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
      const fresh = await getMediaEntries();
      setMediaEntries(fresh);
      updateMediaId(mediaId);
      setStagedFile(null);
      setUploadTitle('');
      setIsOpen(false);
      toast({ title: `Uploaded "${file.name}"`, variant: 'success' });
    });
  }, [stagedFile, uploadTitle, selectedFolder, updateMediaId]);

  const folders = [...new Set(mediaEntries.map((f) => f.folder))];
  const filteredEntries = selectedFolder ? mediaEntries.filter((f) => f.folder === selectedFolder) : mediaEntries;

  return (
    <div className="my-2 rounded-lg border border-border bg-muted/30 p-3" contentEditable={false}>
      {currentMediaId && selectedEntry ? (
        <div className="flex items-start gap-3">
          <div className="relative w-48 h-32 rounded-lg border border-border overflow-hidden bg-muted flex-none">
            <img
              src={selectedEntry.publicUrl}
              alt={selectedEntry.title || selectedEntry.originalName || ''}
              className="w-full h-full object-cover"
            />
            <button
              type="button"
              onClick={() => updateMediaId('')}
              className="absolute top-1 right-1 rounded-full bg-black/60 text-white p-0.5 hover:bg-black/80"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="flex flex-col gap-1.5 pt-1">
            <span className="text-xs font-medium text-muted-foreground">Image embed</span>
            <span className="text-sm break-all">{selectedEntry.title || selectedEntry.originalName}</span>
            <Button type="button" variant="outline" size="sm" onClick={() => setIsOpen(true)}>
              Change image
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-3">
          <div className="w-16 h-16 rounded-lg border-2 border-dashed border-border flex items-center justify-center bg-muted/50 flex-none">
            <ImageIcon className="w-6 h-6 text-muted-foreground" />
          </div>
          <div>
            <span className="text-sm text-muted-foreground block mb-1">No image selected</span>
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
        <DialogContent className="max-w-3xl max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Select or upload image</DialogTitle>
          </DialogHeader>
          <div className="border-2 border-dashed border-border rounded-lg p-4 flex flex-col gap-3">
            <input
              ref={uploadInputRef}
              type="file"
              accept={config.mediaAllowedFormats.map((f) => `.${f}`).join(',')}
              className="hidden"
              onChange={(e) => {
                if (e.target.files) stageFileFromList(e.target.files);
                e.target.value = '';
              }}
            />
            {!stagedFile ? (
              <div className="flex items-center justify-center gap-3">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => uploadInputRef.current?.click()}
                  disabled={isPending}
                >
                  <Upload className="w-4 h-4" />
                  Choose file to upload
                </Button>
              </div>
            ) : (
              <div className="space-y-3 max-w-md">
                <p className="text-sm text-muted-foreground break-all">{stagedFile.name}</p>
                <div>
                  <Label htmlFor="richtext-image-upload-title" className="text-sm">
                    Title <span className="text-destructive">*</span>
                  </Label>
                  <input
                    id="richtext-image-upload-title"
                    type="text"
                    value={uploadTitle}
                    onChange={(e) => setUploadTitle(e.target.value)}
                    className="mt-1 w-full text-sm px-2 py-1.5 rounded border border-border bg-layout-bg"
                    placeholder="Shown as default alt text when this image is used"
                    disabled={isPending}
                  />
                </div>
                <div className="flex gap-2">
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
            {isPending && <span className="text-xs text-muted-foreground">Uploading...</span>}
          </div>
          <div className="flex gap-4 flex-1 min-h-0 overflow-hidden">
            {folders.length > 1 && (
              <div className="w-36 flex-none overflow-y-auto border-r border-border pr-2">
                <button
                  type="button"
                  onClick={() => setSelectedFolder(null)}
                  className={`block w-full text-left px-2 py-1.5 rounded text-sm ${selectedFolder === null ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}
                >
                  All
                </button>
                {folders.map((folder) => (
                  <button
                    key={folder}
                    type="button"
                    onClick={() => setSelectedFolder(folder)}
                    className={`block w-full text-left px-2 py-1.5 rounded text-sm ${selectedFolder === folder ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}
                  >
                    {folder === '/' ? 'Root' : folder}
                  </button>
                ))}
              </div>
            )}
            <div className="flex-1 overflow-y-auto">
              <div className="grid grid-cols-3 gap-3">
                {filteredEntries.map((entry) => {
                  const isSelected = currentMediaId === entry.id;
                  return (
                    <button
                      key={entry.id}
                      type="button"
                      onClick={() => handleSelect(entry)}
                      className={`group relative aspect-square rounded-lg overflow-hidden border-2 transition-colors ${isSelected ? 'border-primary ring-2 ring-primary/30' : 'border-border hover:border-primary/50'}`}
                    >
                      <img
                        src={entry.publicUrl}
                        alt={entry.title || entry.originalName}
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-x-0 bottom-0 bg-black/60 px-2 py-1">
                        <span className="text-xs text-white truncate block">{entry.title || entry.originalName}</span>
                      </div>
                    </button>
                  );
                })}
                {filteredEntries.length === 0 && (
                  <div className="col-span-3 text-center py-12 text-muted-foreground">No images found</div>
                )}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ImageEmbedEditor;
