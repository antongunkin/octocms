'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ChevronLeft,
  FileText,
  GripVertical,
  Key,
  Layers,
  MoreHorizontal,
  Pencil,
  Plus,
  Star,
  Trash2,
} from 'lucide-react';

import { saveSchema } from '../../admin/actions';
import { toast } from '../../hooks/useToast';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { cn } from '../../lib/utils';
import { FIELD_FORMAT_META } from '../../schema/fieldFormats';
import type { Collection, CollectionField, Config } from '../../types';
import DeleteContentTypeDialog from './DeleteContentTypeDialog';
import DeleteFieldDialog from './DeleteFieldDialog';
import EditContentTypeDialog from './EditContentTypeDialog';
import FieldDialog from './FieldDialog';

type Props = {
  schema: Config;
  type: string;
  entryCount: number;
};

export default function ContentTypeDetail({ schema, type, entryCount }: Props) {
  const router = useRouter();
  const collection: Collection | undefined = schema.collections[type];

  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  // Field-level dialogs
  const [addFieldOpen, setAddFieldOpen] = useState(false);
  const [editFieldKey, setEditFieldKey] = useState<string | null>(null);
  const [deleteFieldKey, setDeleteFieldKey] = useState<string | null>(null);

  // Drag reorder state.
  const [dragKey, setDragKey] = useState<string | null>(null);
  // Optimistic local order so the row hops while we wait for the save → refresh
  // round-trip. Reset whenever the underlying schema (props) changes.
  const [orderOverride, setOrderOverride] = useState<string[] | null>(null);
  useEffect(() => setOrderOverride(null), [collection]);

  const fields = useMemo(() => {
    if (!collection) return [];
    const baseOrder = orderOverride ?? Object.keys(collection.fields);
    return baseOrder
      .filter((k) => k in collection.fields)
      .map((k) => [k, collection.fields[k]!] as [string, CollectionField]);
  }, [collection, orderOverride]);

  const collectionJson = useMemo(
    () => (collection ? JSON.stringify({ [type]: collection }, null, 2) : ''),
    [collection, type],
  );

  if (!collection) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 bg-muted/20 p-6 text-center">
        <p className="text-sm font-medium text-foreground">Content type not found</p>
        <p className="max-w-sm text-sm text-muted-foreground">
          No collection with key <code className="rounded bg-muted px-1 py-0.5 font-mono">{type}</code> exists in the
          schema.
        </p>
        <Button asChild variant="outline" size="sm">
          <Link href="/cms/model">Back to Content Model</Link>
        </Button>
      </div>
    );
  }

  const entryTitleKey = fields.find(([, f]) => f.entryTitle === true)?.[0];

  // ---------------------------------------------------------------------
  // Mutations
  // ---------------------------------------------------------------------

  const saveCollectionFields = async (
    nextFields: Record<string, CollectionField>,
    message: string,
    onSuccessTitle: string,
    onSuccessDesc: string,
  ) => {
    const next: Config = {
      ...schema,
      collections: { ...schema.collections, [type]: { ...collection, fields: nextFields } },
    };
    const result = await saveSchema(next, { message });
    if (result.success) {
      toast({ title: onSuccessTitle, description: onSuccessDesc, variant: 'success' });
      router.refresh();
    } else {
      // Roll back optimistic order if reorder failed.
      setOrderOverride(null);
      toast({ title: "Couldn't save", description: result.error, variant: 'destructive' });
    }
  };

  const reorderTo = async (nextOrder: string[]) => {
    setOrderOverride(nextOrder);
    const nextFields: Record<string, CollectionField> = {};
    for (const k of nextOrder) {
      if (k in collection.fields) nextFields[k] = collection.fields[k]!;
    }
    await saveCollectionFields(
      nextFields,
      `CMS: reorder fields on ${type}`,
      'Fields reordered',
      `New order saved on ${collection.label}.`,
    );
  };

  const setEntryTitle = async (key: string) => {
    const nextFields: Record<string, CollectionField> = {};
    for (const [k, f] of Object.entries(collection.fields)) {
      if (k === key) {
        nextFields[k] = { ...f, entryTitle: true } as CollectionField;
      } else if (f.entryTitle === true) {
        const stripped = { ...f } as CollectionField & { entryTitle?: boolean };
        delete stripped.entryTitle;
        nextFields[k] = stripped;
      } else {
        nextFields[k] = f;
      }
    }
    await saveCollectionFields(
      nextFields,
      `CMS: set entry title to ${type}.${key}`,
      'Entry title updated',
      `${collection.fields[key]?.label ?? key} is now the entry title.`,
    );
  };

  // ---------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------

  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-muted/20">
      <div className="flex items-start justify-between border-b border-border bg-background px-6 py-4">
        <div className="flex items-start gap-3">
          <Button asChild variant="ghost" size="icon" className="mt-0.5 h-8 w-8">
            <Link href="/cms/model" aria-label="Back to Content Model">
              <ChevronLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <div className="flex items-center gap-2">
              {collection.hasMany ? (
                <Layers className="h-5 w-5 text-muted-foreground" />
              ) : (
                <FileText className="h-5 w-5 text-muted-foreground" />
              )}
              <h1 className="text-xl font-semibold text-foreground">{collection.label}</h1>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              <span className="font-mono text-xs">{type}</span> · {collection.hasMany ? 'Many entries' : 'Singleton'} ·{' '}
              {fields.length} {fields.length === 1 ? 'field' : 'fields'} · {entryCount}{' '}
              {entryCount === 1 ? 'entry' : 'entries'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={() => setAddFieldOpen(true)}>
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            Add field
          </Button>
          <Button size="sm" variant="outline" onClick={() => setEditOpen(true)}>
            <Pencil className="mr-1.5 h-3.5 w-3.5" />
            Edit
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="icon" variant="outline" aria-label="More actions" className="h-8 w-8">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => setEditOpen(true)}>
                <Pencil className="mr-2 h-3.5 w-3.5" />
                Edit content type
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onSelect={() => setDeleteOpen(true)}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="mr-2 h-3.5 w-3.5" />
                Delete content type
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <EditContentTypeDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        schema={schema}
        type={type}
        entryCount={entryCount}
      />
      <DeleteContentTypeDialog open={deleteOpen} onOpenChange={setDeleteOpen} schema={schema} type={type} />

      {addFieldOpen ? (
        <FieldDialog mode="add" open={addFieldOpen} onOpenChange={setAddFieldOpen} schema={schema} type={type} />
      ) : null}
      {editFieldKey ? (
        <FieldDialog
          mode="edit"
          existingFieldKey={editFieldKey}
          open={editFieldKey !== null}
          onOpenChange={(o) => !o && setEditFieldKey(null)}
          schema={schema}
          type={type}
        />
      ) : null}
      {deleteFieldKey ? (
        <DeleteFieldDialog
          open={deleteFieldKey !== null}
          onOpenChange={(o) => !o && setDeleteFieldKey(null)}
          schema={schema}
          type={type}
          fieldKey={deleteFieldKey}
        />
      ) : null}

      <div className="flex flex-1 flex-col overflow-auto p-6">
        <Tabs defaultValue="fields" className="flex flex-1 flex-col">
          <TabsList className="self-start">
            <TabsTrigger value="fields">Fields</TabsTrigger>
            <TabsTrigger value="json">JSON</TabsTrigger>
          </TabsList>

          <TabsContent value="fields" className="flex-1">
            <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
              <Card className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="w-8" />
                      <TableHead className="font-medium text-muted-foreground">Field</TableHead>
                      <TableHead className="font-medium text-muted-foreground">Key</TableHead>
                      <TableHead className="font-medium text-muted-foreground">Type</TableHead>
                      <TableHead className="font-medium text-muted-foreground">Flags</TableHead>
                      <TableHead className="w-20 text-right font-medium text-muted-foreground">Title</TableHead>
                      <TableHead className="w-20" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {fields.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="h-32 text-center text-sm text-muted-foreground">
                          No fields configured. Click <strong>Add field</strong> to get started.
                        </TableCell>
                      </TableRow>
                    ) : (
                      fields.map(([key, field]) => {
                        const titleAllowed =
                          (field.format === 'string' && field.list !== true) ||
                          field.format === 'text' ||
                          field.format === 'slug';
                        return (
                          <TableRow
                            key={key}
                            className={cn('group hover:bg-muted/30', dragKey === key && 'opacity-40')}
                            draggable
                            onDragStart={() => setDragKey(key)}
                            onDragOver={(e) => e.preventDefault()}
                            onDragEnd={() => setDragKey(null)}
                            onDrop={(e) => {
                              e.preventDefault();
                              if (!dragKey || dragKey === key) {
                                setDragKey(null);
                                return;
                              }
                              const order = (orderOverride ?? Object.keys(collection.fields)).filter(
                                (k) => k in collection.fields,
                              );
                              const from = order.indexOf(dragKey);
                              const to = order.indexOf(key);
                              if (from < 0 || to < 0) {
                                setDragKey(null);
                                return;
                              }
                              const nextOrder = [...order];
                              nextOrder.splice(from, 1);
                              nextOrder.splice(to, 0, dragKey);
                              setDragKey(null);
                              void reorderTo(nextOrder);
                            }}
                          >
                            <TableCell className="cursor-grab text-muted-foreground" aria-label="Drag to reorder">
                              <GripVertical className="h-3.5 w-3.5" />
                            </TableCell>
                            <TableCell>
                              <button
                                type="button"
                                onClick={() => setEditFieldKey(key)}
                                className="flex flex-col items-start text-left hover:underline"
                              >
                                <span className="font-medium">{field.label}</span>
                                {field.hint ? (
                                  <span className="mt-0.5 text-xs text-muted-foreground">{field.hint}</span>
                                ) : null}
                              </button>
                            </TableCell>
                            <TableCell className="font-mono text-xs text-muted-foreground">{key}</TableCell>
                            <TableCell>
                              <FormatBadge field={field} />
                            </TableCell>
                            <TableCell>
                              <FieldFlags field={field} />
                            </TableCell>
                            <TableCell className="text-right">
                              <button
                                type="button"
                                title={
                                  titleAllowed
                                    ? field.entryTitle
                                      ? 'Current entry title'
                                      : 'Set as entry title'
                                    : 'Entry title must be a non-list string, text, or slug field.'
                                }
                                disabled={!titleAllowed || field.entryTitle === true}
                                onClick={() => void setEntryTitle(key)}
                                className={cn(
                                  'inline-flex h-7 w-7 items-center justify-center rounded-full transition',
                                  field.entryTitle
                                    ? 'bg-amber-50 text-amber-500 dark:bg-amber-950'
                                    : titleAllowed
                                      ? 'text-muted-foreground hover:bg-muted hover:text-amber-500'
                                      : 'cursor-not-allowed text-muted-foreground/30',
                                )}
                                aria-pressed={field.entryTitle === true}
                                aria-label={field.entryTitle ? 'Current entry title' : 'Set as entry title'}
                              >
                                <Star
                                  className={cn('h-3.5 w-3.5', field.entryTitle && 'fill-amber-400 text-amber-500')}
                                />
                              </button>
                            </TableCell>
                            <TableCell className="text-right">
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-7 w-7 opacity-0 group-hover:opacity-100 data-[state=open]:opacity-100"
                                    aria-label={`Actions for ${field.label}`}
                                  >
                                    <MoreHorizontal className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem onSelect={() => setEditFieldKey(key)}>
                                    <Pencil className="mr-2 h-3.5 w-3.5" />
                                    Edit field
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    onSelect={() => setDeleteFieldKey(key)}
                                    className="text-destructive focus:text-destructive"
                                  >
                                    <Trash2 className="mr-2 h-3.5 w-3.5" />
                                    Delete field
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </Card>

              <div className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Summary</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm">
                    <SummaryRow icon={<Key className="h-3.5 w-3.5" />} label="Key">
                      <code className="font-mono text-xs">{type}</code>
                    </SummaryRow>
                    <SummaryRow
                      icon={
                        collection.hasMany ? <Layers className="h-3.5 w-3.5" /> : <FileText className="h-3.5 w-3.5" />
                      }
                      label="Cardinality"
                    >
                      {collection.hasMany ? 'Many entries' : 'Singleton'}
                    </SummaryRow>
                    <SummaryRow icon={<Star className="h-3.5 w-3.5" />} label="Entry title">
                      {entryTitleKey ? (
                        <code className="font-mono text-xs">{entryTitleKey}</code>
                      ) : (
                        <span className="text-muted-foreground">— not set —</span>
                      )}
                    </SummaryRow>
                    <SummaryRow label="Fields">{fields.length}</SummaryRow>
                    <SummaryRow label="Entries">{entryCount}</SummaryRow>
                  </CardContent>
                </Card>

                <Card className="p-0">
                  <CardHeader>
                    <CardTitle>Tips</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 pb-4 text-xs text-muted-foreground">
                    <p>
                      Drag fields by the grip handle to reorder them. The order is reflected in generated types and the
                      editor UI.
                    </p>
                    <p>
                      The starred field is the <strong>entry title</strong> — it appears in entry lists and is the
                      default slug source.
                    </p>
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="json" className="flex-1">
            <Card className="overflow-hidden p-0">
              <CardHeader>
                <CardTitle>Generated JSON</CardTitle>
              </CardHeader>
              <pre className="m-0 max-h-[60vh] overflow-auto bg-muted/30 p-4 font-mono text-xs leading-5 text-foreground">
                <code>{collectionJson}</code>
              </pre>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helper components
// ---------------------------------------------------------------------------

function FormatBadge({ field }: { field: CollectionField }) {
  const meta = FIELD_FORMAT_META[field.format];
  return (
    <span
      className="inline-flex items-center rounded-md border border-border bg-muted/40 px-2 py-0.5 font-mono text-xs text-foreground"
      title={meta?.description ?? field.format}
    >
      {field.format}
    </span>
  );
}

function FieldFlags({ field }: { field: CollectionField }) {
  const flags: string[] = [];
  if (field.required) flags.push('required');
  if (field.searchable === false) flags.push('not searchable');

  switch (field.format) {
    case 'string':
      if (field.list) flags.push('list');
      break;
    case 'reference': {
      const cardinality = field.reference?.cardinality ?? 'many';
      flags.push(cardinality);
      const targets = field.reference?.collections;
      if (targets && targets.length > 0) flags.push(`→ ${targets.join(', ')}`);
      if (field.reference?.min !== undefined) flags.push(`min ${field.reference.min}`);
      if (field.reference?.max !== undefined) flags.push(`max ${field.reference.max}`);
      break;
    }
    case 'select':
      flags.push(field.multiple ? 'multiple' : 'single');
      flags.push(`${field.options?.length ?? 0} options`);
      break;
    case 'number':
      if (field.min !== undefined) flags.push(`min ${field.min}`);
      if (field.max !== undefined) flags.push(`max ${field.max}`);
      if (field.valueType) flags.push(field.valueType);
      break;
    case 'datetime':
      if (field.dateOnly) flags.push('date only');
      if (field.defaultNow) flags.push('default: now');
      break;
    case 'text':
      if (field.rows) flags.push(`rows: ${field.rows}`);
      break;
    case 'boolean':
      if (field.defaultBoolean !== undefined) flags.push(`default: ${field.defaultBoolean}`);
      break;
    case 'slug':
      if (field.slugSource) flags.push(`from: ${field.slugSource}`);
      break;
    case 'conditional':
      flags.push(`${field.conditional.branches.length} branches`);
      break;
    default:
      break;
  }

  if (flags.length === 0) {
    return <span className="text-xs text-muted-foreground">—</span>;
  }

  return (
    <div className="flex flex-wrap gap-1">
      {flags.map((flag, i) => (
        <span
          key={i}
          className={cn(
            'inline-flex items-center rounded-md border border-border bg-background px-1.5 py-0.5 text-[11px] text-muted-foreground',
            flag === 'required' && 'border-blue-200 bg-blue-50 text-blue-700',
          )}
        >
          {flag}
        </span>
      ))}
    </div>
  );
}

function SummaryRow({ icon, label, children }: { icon?: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
        {icon}
        {label}
      </span>
      <span className="text-sm">{children}</span>
    </div>
  );
}
