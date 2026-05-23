'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

import { previewSchemaChange } from '../../admin/actions';
import type { PreviewSchemaResult } from '../../admin/actions/schema';
import { useSaveSchema } from '../../admin/query/hooks/useSaveSchema';
import { toast } from '../../hooks/useToast';
import { Button } from '../ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog';
import type { Config } from '../../types';
import SchemaImpactList from './SchemaImpactList';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  schema: Config;
  type: string;
};

export default function DeleteContentTypeDialog({ open, onOpenChange, schema, type }: Props) {
  const router = useRouter();
  const saveSchemaMutation = useSaveSchema();
  const collection = schema.collections[type];

  const [preview, setPreview] = useState<PreviewSchemaResult | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [confirmText, setConfirmText] = useState('');

  useEffect(() => {
    if (!open) {
      setPreview(null);
      setPreviewing(false);
      setBusy(false);
      setConfirmText('');
      return;
    }
    void runPreview();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, type]);

  const buildNext = (): Config => {
    const nextCollections: Record<string, (typeof schema.collections)[string]> = {};
    for (const [k, v] of Object.entries(schema.collections)) {
      if (k !== type) nextCollections[k] = v;
    }
    return { ...schema, collections: nextCollections };
  };

  const runPreview = async () => {
    setPreviewing(true);
    const result = await previewSchemaChange(buildNext());
    setPreview(result);
    setPreviewing(false);
  };

  const ownEntries = preview?.impact.filter((i) => i.type === type) ?? [];
  const cascadingRefs = preview?.impact.filter((i) => i.type !== type) ?? [];

  const confirmRequired = (collection?.label ?? type).toLowerCase();
  const canConfirm = confirmText.trim().toLowerCase() === confirmRequired && !busy && preview?.valid;

  const doDelete = async () => {
    if (!canConfirm) return;
    setBusy(true);
    try {
      await saveSchemaMutation.mutateAsync({
        next: buildNext(),
        options: { message: `CMS: delete content type ${type}` },
      });
      toast({
        title: 'Content type deleted',
        description: `${collection?.label ?? type} and ${ownEntries.length} ${
          ownEntries.length === 1 ? 'entry' : 'entries'
        } removed.`,
        variant: 'success',
      });
      onOpenChange(false);
      router.push('/cms/model');
    } catch (e) {
      toast({
        title: "Couldn't delete content type",
        description: e instanceof Error ? e.message : 'Save failed',
        variant: 'destructive',
      });
    } finally {
      setBusy(false);
    }
  };

  if (!collection) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="octo-dialog-content octo-dialog-content--2xl">
        <DialogHeader>
          <DialogTitle>Delete content type</DialogTitle>
          <DialogDescription>
            Permanently remove <strong>{collection.label}</strong> (
            <code className="octo-u-mono octo-u-text-xs">{type}</code>) from the schema. All of its entries and
            companion files will be deleted in the same commit.
          </DialogDescription>
        </DialogHeader>

        {previewing ? (
          <p className="octo-dialog-field__hint">Checking impact…</p>
        ) : preview && !preview.valid ? (
          <div className="octo-error-box">
            <p className="octo-error-box__title">The change is invalid:</p>
            <ul className="octo-error-box__list octo-error-box__list--sm">
              {preview.errors.map((e, i) => (
                <li key={i}>{e}</li>
              ))}
            </ul>
          </div>
        ) : preview ? (
          <div className="octo-dialog-fields">
            <SchemaImpactList
              tone="destructive"
              title={`Entries to delete (${ownEntries.length})`}
              emptyMessage="No existing entries — schema-only change."
              items={ownEntries}
            />

            {cascadingRefs.length > 0 ? (
              <div className="octo-dialog-fields">
                <p className="octo-dialog-field__hint">
                  Reference values pointing at <code className="octo-u-mono">{type}</code> entries will be pruned
                  automatically in the same commit so the public site never serves orphaned keys.
                </p>
                <SchemaImpactList
                  tone="amber"
                  title={`${cascadingRefs.length} ${cascadingRefs.length === 1 ? 'entry references' : 'entries reference'} this collection`}
                  items={cascadingRefs}
                />
              </div>
            ) : null}

            <div className="octo-confirm-box">
              <label htmlFor="ct-confirm" className="octo-confirm-box__label">
                Type <code className="octo-u-mono">{confirmRequired}</code> to confirm
              </label>
              <input
                id="ct-confirm"
                type="text"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                disabled={busy}
                className="octo-confirm-box__input"
                autoComplete="off"
              />
            </div>
          </div>
        ) : null}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={doDelete} disabled={!canConfirm}>
            {busy ? 'Deleting…' : 'Delete content type'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
