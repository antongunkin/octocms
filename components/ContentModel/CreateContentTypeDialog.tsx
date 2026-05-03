'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { FileText, Layers } from 'lucide-react';

import { useSaveSchema } from '../../admin/query/hooks/useSaveSchema';
import { toast } from '../../hooks/useToast';
import { Button } from '../ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog';
import { Input } from '../ui/input';
import { cn } from '../../lib/utils';
import type { Collection, CollectionField, Config } from '../../types';
import { describeInvalidKey, slugifyKey } from './contentTypeKey';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  schema: Config;
};

const NAME_LIMIT = 50;
const KEY_LIMIT = 64;

export default function CreateContentTypeDialog({ open, onOpenChange, schema }: Props) {
  const router = useRouter();
  const saveSchemaMutation = useSaveSchema();
  const [name, setName] = useState('');
  const [key, setKey] = useState('');
  const [keyTouched, setKeyTouched] = useState(false);
  const [hasMany, setHasMany] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName('');
    setKey('');
    setKeyTouched(false);
    setHasMany(true);
    setBusy(false);
  }, [open]);

  // Auto-derive the API identifier from the name until the user edits it directly.
  useEffect(() => {
    if (keyTouched) return;
    setKey(slugifyKey(name));
  }, [name, keyTouched]);

  const existingKeys = useMemo(() => new Set(Object.keys(schema.collections)), [schema]);

  const trimmedName = name.trim();
  const trimmedKey = key.trim();
  const keyError = describeInvalidKey(trimmedKey);
  const duplicateKey = existingKeys.has(trimmedKey);
  const nameError = trimmedName.length === 0 ? 'Name is required.' : null;

  const canSubmit = !nameError && !keyError && !duplicateKey && !busy;

  const handleCreate = async () => {
    if (!canSubmit) return;

    const newCollection: Collection = {
      label: trimmedName,
      hasMany,
      fields: { title: defaultTitleField() },
    };

    const next: Config = {
      ...schema,
      collections: { ...schema.collections, [trimmedKey]: newCollection },
    };

    setBusy(true);
    try {
      await saveSchemaMutation.mutateAsync({
        next,
        options: { message: `CMS: create content type ${trimmedKey}` },
      });
      toast({
        title: 'Content type created',
        description: `${trimmedName} is ready to edit.`,
        variant: 'success',
      });
      onOpenChange(false);
      router.push(`/cms/model/${trimmedKey}`);
    } catch (e) {
      toast({
        title: "Couldn't create content type",
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
          <DialogTitle>Create new content type</DialogTitle>
          <DialogDescription>
            Define a new content type. A default <code className="font-mono text-xs">title</code> field is added so you
            can save and start editing — you can rename it or add more fields right after.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div>
            <label htmlFor="ct-name" className="mb-1.5 block text-sm font-medium text-foreground">
              Name <span className="text-muted-foreground">(required)</span>
            </label>
            <Input
              id="ct-name"
              value={name}
              maxLength={NAME_LIMIT}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Recipe"
              disabled={busy}
            />
            <div className="mt-1 flex justify-between text-xs text-muted-foreground">
              <span>Appears in entry lists and the editor header.</span>
              <span>
                {trimmedName.length} / {NAME_LIMIT}
              </span>
            </div>
          </div>

          <div>
            <label htmlFor="ct-key" className="mb-1.5 block text-sm font-medium text-foreground">
              API identifier <span className="text-muted-foreground">(required)</span>
            </label>
            <Input
              id="ct-key"
              value={key}
              maxLength={KEY_LIMIT}
              onChange={(e) => {
                setKey(e.target.value);
                setKeyTouched(true);
              }}
              placeholder="e.g. recipe"
              className="font-mono text-sm"
              disabled={busy}
              aria-invalid={Boolean(keyError || duplicateKey)}
            />
            <div className="mt-1 flex justify-between gap-3 text-xs">
              <span className={cn('text-muted-foreground', (keyError || duplicateKey) && 'text-destructive')}>
                {duplicateKey
                  ? `A content type with key "${trimmedKey}" already exists.`
                  : (keyError ?? 'Used in JSON, generated types, and the query API.')}
              </span>
              <span className="text-muted-foreground">
                {trimmedKey.length} / {KEY_LIMIT}
              </span>
            </div>
          </div>

          <div>
            <span className="mb-1.5 block text-sm font-medium text-foreground">Cardinality</span>
            <div className="grid grid-cols-2 gap-2">
              <CardinalityOption
                active={hasMany}
                disabled={busy}
                onClick={() => setHasMany(true)}
                icon={<Layers className="h-4 w-4" />}
                title="Many entries"
                description="A collection of entries (e.g. blog posts, products)."
              />
              <CardinalityOption
                active={!hasMany}
                disabled={busy}
                onClick={() => setHasMany(false)}
                icon={<FileText className="h-4 w-4" />}
                title="Singleton"
                description="A single entry (e.g. home page, site settings)."
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={handleCreate} disabled={!canSubmit}>
            {busy ? 'Creating…' : 'Create'}
          </Button>
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

function defaultTitleField(): CollectionField {
  return {
    label: 'Title',
    format: 'string',
    entryTitle: true,
    required: true,
  };
}
