'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle, FileText, Layers } from 'lucide-react';

import { previewSchemaChange } from '../../admin/actions';
import type { PreviewSchemaResult } from '../../admin/actions/schema';
import { useSaveSchema } from '../../admin/query/hooks/useSaveSchema';
import { toast } from '../../hooks/useToast';
import { Button } from '../ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog';
import { Input } from '../ui/input';
import { cn } from '../../lib/utils';
import type { Collection, Config } from '../../types';
import { describeInvalidKey } from './contentTypeKey';
import SchemaImpactList from './SchemaImpactList';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  schema: Config;
  type: string;
  /** Number of existing entries — used to lock the cardinality toggle. */
  entryCount: number;
};

const NAME_LIMIT = 50;
const KEY_LIMIT = 64;

export default function EditContentTypeDialog({ open, onOpenChange, schema, type, entryCount }: Props) {
  const router = useRouter();
  const saveSchemaMutation = useSaveSchema();
  const collection = schema.collections[type];
  const cardinalityLocked = entryCount > 0;

  const [label, setLabel] = useState(collection?.label ?? '');
  const [key, setKey] = useState(type);
  const [hasMany, setHasMany] = useState(collection?.hasMany === true);
  const [preview, setPreview] = useState<PreviewSchemaResult | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open || !collection) return;
    setLabel(collection.label);
    setKey(type);
    setHasMany(collection.hasMany === true);
    setPreview(null);
    setBusy(false);
  }, [open, collection, type]);

  const trimmedLabel = label.trim();
  const trimmedKey = key.trim();
  const labelError = trimmedLabel.length === 0 ? 'Name is required.' : null;
  const keyError = describeInvalidKey(trimmedKey);

  const otherKeys = useMemo(() => new Set(Object.keys(schema.collections).filter((k) => k !== type)), [schema, type]);
  const duplicateKey = otherKeys.has(trimmedKey);

  const keyChanged = trimmedKey !== type;
  const labelChanged = trimmedLabel !== (collection?.label ?? '');
  const hasManyChanged = hasMany !== (collection?.hasMany === true);
  const dirty = keyChanged || labelChanged || hasManyChanged;

  const buildNext = (): Config => {
    if (!collection) return schema;
    const updatedCollection: Collection = {
      ...collection,
      label: trimmedLabel,
      hasMany,
    };
    if (!keyChanged) {
      return {
        ...schema,
        collections: { ...schema.collections, [type]: updatedCollection },
      };
    }
    // Rename: drop the old key, insert the new one. Preserve insertion order
    // for stable JSON output.
    const nextCollections: Record<string, Collection> = {};
    for (const [k, v] of Object.entries(schema.collections)) {
      if (k === type) {
        nextCollections[trimmedKey] = updatedCollection;
      } else {
        nextCollections[k] = v;
      }
    }
    return { ...schema, collections: nextCollections };
  };

  const canSubmit = !labelError && !keyError && !duplicateKey && dirty && !busy && !previewing;

  const previewIfNeeded = async () => {
    if (!keyChanged) {
      // No data migration needed — skip the preview round-trip.
      setPreview(null);
      void doSave();
      return;
    }
    setPreviewing(true);
    const result = await previewSchemaChange(buildNext(), {
      collectionRenames: { [type]: trimmedKey },
    });
    setPreviewing(false);
    setPreview(result);
  };

  const doSave = async () => {
    setBusy(true);
    const next = buildNext();
    try {
      await saveSchemaMutation.mutateAsync({
        next,
        options: {
          ...(keyChanged ? { collectionRenames: { [type]: trimmedKey } } : {}),
          message: keyChanged ? `CMS: rename content type ${type} → ${trimmedKey}` : `CMS: update content type ${type}`,
        },
      });
      toast({
        title: 'Content type updated',
        description: keyChanged ? `Renamed to ${trimmedKey}.` : `${trimmedLabel} saved.`,
        variant: 'success',
      });
      onOpenChange(false);
      if (keyChanged) {
        router.push(`/cms/model/${trimmedKey}`);
      }
    } catch (e) {
      toast({
        title: "Couldn't update content type",
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
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Edit content type</DialogTitle>
          <DialogDescription>
            Rename the content type, change its API identifier, or switch its cardinality. Renames move all entry files
            (and companion <code className="font-mono text-xs">.md</code> files) in a single commit.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div>
            <label htmlFor="ct-label" className="mb-1.5 block text-sm font-medium text-foreground">
              Name
            </label>
            <Input
              id="ct-label"
              value={label}
              maxLength={NAME_LIMIT}
              onChange={(e) => setLabel(e.target.value)}
              disabled={busy}
            />
            {labelError ? <p className="mt-1 text-xs text-destructive">{labelError}</p> : null}
          </div>

          <div>
            <label htmlFor="ct-key" className="mb-1.5 block text-sm font-medium text-foreground">
              API identifier
            </label>
            <Input
              id="ct-key"
              value={key}
              maxLength={KEY_LIMIT}
              onChange={(e) => setKey(e.target.value)}
              className="font-mono text-sm"
              disabled={busy}
              aria-invalid={Boolean(keyError || duplicateKey)}
            />
            <p className={cn('mt-1 text-xs text-muted-foreground', (keyError || duplicateKey) && 'text-destructive')}>
              {duplicateKey
                ? `A content type with key "${trimmedKey}" already exists.`
                : (keyError ??
                  'Renaming will move every entry file. References from other collections will need to be updated manually.')}
            </p>
            {keyChanged && entryCount > 0 && !keyError && !duplicateKey ? (
              <div className="mt-2 flex gap-2 rounded-md border border-amber-900 bg-amber-950 p-2 text-xs text-amber-200 light:border-amber-200 light:bg-amber-50 light:text-amber-900">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>
                  {entryCount} {entryCount === 1 ? 'entry' : 'entries'} will be renamed from{' '}
                  <code className="font-mono">cms/content/{type}/</code> to{' '}
                  <code className="font-mono">cms/content/{trimmedKey}/</code>.
                </span>
              </div>
            ) : null}
          </div>

          <div>
            <span className="mb-1.5 block text-sm font-medium text-foreground">Cardinality</span>
            <div className="grid grid-cols-2 gap-2">
              <CardinalityOption
                active={hasMany}
                disabled={busy || cardinalityLocked}
                onClick={() => setHasMany(true)}
                icon={<Layers className="h-4 w-4" />}
                title="Many entries"
                description="Multiple entries in this collection."
              />
              <CardinalityOption
                active={!hasMany}
                disabled={busy || cardinalityLocked}
                onClick={() => setHasMany(false)}
                icon={<FileText className="h-4 w-4" />}
                title="Singleton"
                description="A single entry."
              />
            </div>
            {cardinalityLocked ? (
              <p className="mt-2 text-xs text-muted-foreground">
                Cardinality is locked once entries exist. Delete every entry first to switch.
              </p>
            ) : null}
          </div>
        </div>

        {preview && preview.impact.length > 0 ? (
          <SchemaImpactList
            tone="amber"
            title={`${preview.impact.length} ${preview.impact.length === 1 ? 'entry' : 'entries'} will be affected`}
            items={preview.impact}
          />
        ) : null}

        {preview && !preview.valid ? (
          <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive">
            <p className="font-medium">The change is invalid:</p>
            <ul className="mt-1 list-disc space-y-1 pl-4">
              {preview.errors.map((e, i) => (
                <li key={i}>{e}</li>
              ))}
            </ul>
          </div>
        ) : null}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          {preview && preview.valid ? (
            <Button onClick={doSave} disabled={busy}>
              {busy ? 'Saving…' : 'Confirm and save'}
            </Button>
          ) : (
            <Button onClick={previewIfNeeded} disabled={!canSubmit}>
              {previewing ? 'Previewing…' : busy ? 'Saving…' : 'Save'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CardinalityOption({
  active,
  disabled,
  onClick,
  icon,
  title,
  description,
}: {
  active: boolean;
  disabled?: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
      className={cn(
        'flex flex-col items-start gap-1 rounded-md border p-3 text-left transition',
        active
          ? 'border-primary bg-primary/10 ring-1 ring-primary/40 text-foreground'
          : 'border-border bg-background hover:bg-muted/50',
        disabled && 'cursor-not-allowed opacity-50',
      )}
    >
      <span className="flex items-center gap-2 text-sm font-medium text-foreground">
        {icon}
        {title}
      </span>
      <span className="text-xs text-muted-foreground">{description}</span>
    </button>
  );
}
