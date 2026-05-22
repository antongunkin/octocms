'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { keepPreviousData } from '@tanstack/react-query';
import Link from 'next/link';
import {
  ArrowLeft,
  ChevronRight,
  FileText,
  GripVertical,
  Layers,
  MoreHorizontal,
  Pencil,
  Plus,
  Star,
  Trash2,
} from 'lucide-react';

import { useEntryList } from '../../admin/query/hooks/useEntryList';
import { useSaveSchema } from '../../admin/query/hooks/useSaveSchema';
import { useSchema } from '../../admin/query/hooks/useSchema';
import { toast } from '../../hooks/useToast';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
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
import { FieldTableSkeleton } from './skeletons/FieldTableSkeleton';

type Props = {
  type: string;
};

export default function ContentTypeDetail({ type }: Props) {
  const schemaQuery = useSchema();
  const entriesQuery = useEntryList(type, { placeholderData: keepPreviousData });
  const saveSchemaMutation = useSaveSchema();
  const schema = schemaQuery.data;
  const entries = entriesQuery.data ?? [];
  const entryCount = entries.filter((e) => e.type === type).length;
  const isLoading = schemaQuery.isPending && !schema;
  const collection: Collection | undefined = schema?.collections[type];

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

  // Loading state — render the field-table skeleton while schema resolves.
  if (isLoading || !schema) {
    return (
      <div className="octo-content-model">
        <div className="octo-page-chrome">
          <Button asChild variant="ghost" size="icon" className="-ml-2 h-7 w-7 shrink-0 text-muted-foreground">
            <Link href="/cms/model" aria-label="Back to Content Model">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
        </div>
        <div className="octo-schema-detail__main">
          <FieldTableSkeleton />
        </div>
      </div>
    );
  }

  if (!collection) {
    return (
      <div className="octo-not-found">
        <p className="octo-not-found__title">Content type not found</p>
        <p className="octo-not-found__desc">
          No collection with key <code className="octo-not-found__code">{type}</code> exists in the schema.
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
    try {
      await saveSchemaMutation.mutateAsync({ next, options: { message } });
      toast({ title: onSuccessTitle, description: onSuccessDesc, variant: 'success' });
    } catch (e) {
      // Roll back optimistic order if reorder failed.
      setOrderOverride(null);
      toast({
        title: "Couldn't save",
        description: e instanceof Error ? e.message : 'Save failed',
        variant: 'destructive',
      });
    }
  };

  const reorderTo = async (nextOrder: string[]) => {
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
    <div className="octo-content-model">
      {/* Page header — same chrome as DashboardContent / EditPost */}
      <div className="octo-page-chrome">
        <div className="octo-page-chrome__title-area">
          <div style={{ display: 'flex', minWidth: 0, flex: 1, alignItems: 'center', gap: 8 }}>
            <Button asChild variant="ghost" size="icon" className="-ml-2 h-7 w-7 shrink-0 text-muted-foreground">
              <Link href="/cms/model" aria-label="Back to Content Model">
                <ArrowLeft className="h-4 w-4" />
              </Link>
            </Button>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div className="octo-page-chrome__breadcrumb">
                <Link
                  href="/cms/model"
                  className="transition-colors hover:text-foreground"
                  style={{ color: 'var(--text-2)' }}
                >
                  Model
                </Link>
                <ChevronRight className="h-3 w-3 opacity-60" />
                <span style={{ fontFamily: 'var(--ft-mono)', fontSize: 11, color: 'var(--muted)' }}>{type}</span>
              </div>
              <div className="octo-page-chrome__title-row">
                {collection.hasMany ? (
                  <Layers className="h-4 w-4 shrink-0 text-muted-foreground" />
                ) : (
                  <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                )}
                <h1 className="octo-page-chrome__title">{collection.label}</h1>
              </div>
            </div>
          </div>
        </div>
        <div className="octo-page-chrome__right">
          <div className="octo-hdr-right">
            <Button
              size="sm"
              className="gap-1.5 bg-foreground text-background hover:bg-foreground/90"
              onClick={() => setAddFieldOpen(true)}
            >
              <Plus className="h-4 w-4" />
              Add field
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="icon" variant="outline" aria-label="More actions" className="h-9 w-9">
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

      <div className="octo-schema-detail">
        {/* Main content column — independently scrollable */}
        <div className="octo-schema-detail__main">
          <Tabs defaultValue="fields" className="flex flex-1 flex-col">
            <TabsList className="self-start">
              <TabsTrigger value="fields">Fields</TabsTrigger>
              <TabsTrigger value="json">JSON</TabsTrigger>
            </TabsList>

            <TabsContent value="fields" className="mt-4 flex-1">
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
                                className="octo-field-table__label-btn"
                              >
                                <span className="octo-field-table__label-name">{field.label}</span>
                                {field.hint ? <span className="octo-field-table__label-hint">{field.hint}</span> : null}
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
                                  'octo-field-table__star',
                                  field.entryTitle
                                    ? 'octo-field-table__star--active'
                                    : titleAllowed
                                      ? 'octo-field-table__star--allowed'
                                      : 'octo-field-table__star--disabled',
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
            </TabsContent>

            <TabsContent value="json" className="mt-4 flex-1">
              <Card className="overflow-hidden p-0">
                <pre className="octo-field-table__json-pre">
                  <code>{collectionJson}</code>
                </pre>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        {/* Sidebar — same chrome as EditPost */}
        <aside className="octo-schema-detail__aside">
          <div className="octo-schema-detail__aside-section">
            <div className="octo-schema-detail__aside-label">Type details</div>
            <div className="octo-schema-detail__detail-rows">
              <div className="octo-schema-detail__detail-row">
                <span className="octo-schema-detail__detail-key">Key</span>
                <span className="octo-schema-detail__detail-val octo-schema-detail__detail-val--mono" title={type}>
                  {type}
                </span>
              </div>
              <div className="octo-schema-detail__detail-row">
                <span className="octo-schema-detail__detail-key">Cardinality</span>
                <span className="octo-schema-detail__detail-val">
                  {collection.hasMany ? 'Many entries' : 'Singleton'}
                </span>
              </div>
              <div className="octo-schema-detail__detail-row">
                <span className="octo-schema-detail__detail-key">Entry title</span>
                <span className="octo-schema-detail__detail-val">
                  {entryTitleKey ? (
                    <code className="octo-schema-detail__detail-val--mono">{entryTitleKey}</code>
                  ) : (
                    <span style={{ color: 'var(--muted)' }}>— not set —</span>
                  )}
                </span>
              </div>
              <div className="octo-schema-detail__detail-row">
                <span className="octo-schema-detail__detail-key">Fields</span>
                <span className="octo-schema-detail__detail-val">{fields.length}</span>
              </div>
              <div className="octo-schema-detail__detail-row">
                <span className="octo-schema-detail__detail-key">Entries</span>
                <span className="octo-schema-detail__detail-val">{entryCount}</span>
              </div>
            </div>
          </div>
        </aside>
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
    <span className="octo-field-table__format-badge" title={meta?.description ?? field.format}>
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
    return (
      <span className="octo-field-table__flags">
        <span className="text-xs text-muted-foreground">—</span>
      </span>
    );
  }

  return (
    <div className="octo-field-table__flags">
      {flags.map((flag, i) => (
        <span
          key={i}
          className={cn('octo-field-table__flag', flag === 'required' && 'octo-field-table__flag--required')}
        >
          {flag}
        </span>
      ))}
    </div>
  );
}
