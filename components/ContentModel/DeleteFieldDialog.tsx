'use client';

/**
 * Delete a single field from a content type.
 *
 * Behaviour:
 *  - Runs `previewSchemaChange` on open so we can list every entry that will
 *    be rewritten and surface migration warnings (e.g. "value could not be
 *    coerced and was dropped" — though for plain field-removed migrations
 *    no coercion warnings fire; the impact list itself is the warning).
 *  - Refuses to delete the field if it's the sole `entryTitle` of the
 *    collection AND a slug field depends on `entryTitle` (validateConfig
 *    would reject the save anyway — we mirror the rule here for a clearer
 *    error).
 *  - For `markdown` / `richtext` fields, calls out that companion
 *    `.md` / `.mdx` files will be deleted in the same commit.
 */

import React, { useEffect, useState } from 'react';

import { previewSchemaChange } from '../../admin/actions';
import type { PreviewSchemaResult } from '../../admin/actions/schema';
import { useSaveSchema } from '../../admin/query/hooks/useSaveSchema';
import { toast } from '../../hooks/useToast';
import { Button } from '../ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog';
import { Input } from '../ui/input';
import type { Collection, CollectionField, Config } from '../../types';
import SchemaImpactList from './SchemaImpactList';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  schema: Config;
  type: string;
  fieldKey: string;
}

export default function DeleteFieldDialog({ open, onOpenChange, schema, type, fieldKey }: Props) {
  const saveSchemaMutation = useSaveSchema();
  const collection: Collection | undefined = schema.collections[type];
  const field: CollectionField | undefined = collection?.fields[fieldKey];

  const [preview, setPreview] = useState<PreviewSchemaResult | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState('');

  useEffect(() => {
    if (!open || !collection || !field) {
      setPreview(null);
      setBusy(false);
      setConfirm('');
      return;
    }
    void run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, type, fieldKey]);

  const buildNext = (): Config => {
    if (!collection) return schema;
    const nextFields: Record<string, CollectionField> = {};
    for (const [k, f] of Object.entries(collection.fields)) {
      if (k === fieldKey) continue;
      nextFields[k] = f;
    }
    return {
      ...schema,
      collections: { ...schema.collections, [type]: { ...collection, fields: nextFields } },
    };
  };

  const run = async () => {
    setPreviewing(true);
    const result = await previewSchemaChange(buildNext());
    setPreview(result);
    setPreviewing(false);
  };

  if (!collection || !field) return null;

  const ownEntries = preview?.impact.filter((i) => i.type === type) ?? [];
  const canConfirm = confirm.trim() === fieldKey && !busy && preview?.valid;
  const hasCompanionFiles = field.format === 'markdown' || field.format === 'richtext';

  const doDelete = async () => {
    if (!canConfirm) return;
    setBusy(true);
    try {
      await saveSchemaMutation.mutateAsync({
        next: buildNext(),
        options: { message: `CMS: delete field ${type}.${fieldKey}` },
      });
      toast({
        title: 'Field deleted',
        description: `${field.label} (${fieldKey}) removed from ${collection.label}.`,
        variant: 'success',
      });
      onOpenChange(false);
    } catch (e) {
      toast({
        title: "Couldn't delete field",
        description: e instanceof Error ? e.message : 'Save failed',
        variant: 'destructive',
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Delete field</DialogTitle>
          <DialogDescription>
            Permanently remove <strong>{field.label}</strong> (<code className="font-mono text-xs">{fieldKey}</code>)
            from <strong>{collection.label}</strong>.
            {hasCompanionFiles ? (
              <>
                {' '}
                The companion <code className="font-mono text-xs">{field.format === 'markdown' ? '.md' : '.mdx'}</code>{' '}
                file for every entry will be deleted in the same commit.
              </>
            ) : null}
          </DialogDescription>
        </DialogHeader>

        {previewing ? (
          <p className="text-sm text-muted-foreground">Checking impact…</p>
        ) : preview && !preview.valid ? (
          <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
            <p className="font-medium">The change is invalid:</p>
            <ul className="mt-1 list-disc space-y-1 pl-4 text-xs">
              {preview.errors.map((e, i) => (
                <li key={i}>{e}</li>
              ))}
            </ul>
            <p className="mt-2 text-xs">
              Cancel and adjust the schema first (e.g. set a different field as the entry title or add a slugSource).
            </p>
          </div>
        ) : preview ? (
          <div className="space-y-3">
            {ownEntries.length === 0 ? (
              <p className="text-xs text-muted-foreground">Schema-only change — no entries store this field.</p>
            ) : (
              <>
                <p className="text-xs text-muted-foreground">
                  Any value stored in <code className="font-mono">{fieldKey}</code> on these entries will be discarded.
                </p>
                <SchemaImpactList
                  tone="amber"
                  title={`${ownEntries.length} ${ownEntries.length === 1 ? 'entry' : 'entries'} will be rewritten`}
                  items={ownEntries}
                />
              </>
            )}

            <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm">
              <label htmlFor="field-confirm" className="mb-1.5 block font-medium text-destructive">
                Type <code className="font-mono">{fieldKey}</code> to confirm
              </label>
              <Input
                id="field-confirm"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                disabled={busy}
                className="font-mono text-sm"
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
            {busy ? 'Deleting…' : 'Delete field'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
