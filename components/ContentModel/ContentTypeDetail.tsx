'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { keepPreviousData } from '@tanstack/react-query';
import Link from 'next/link';
import { Icon } from '../ui/icons';

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
import { PageBar } from '../Layout/PageBar';

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
        <div className="octo-page-top">
          <Button asChild variant="ghost" size="icon" className="octo-btn-back">
            <Link href="/cms/model" aria-label="Back to Content Model">
              <Icon.ArrowLeft className="octo-icon-md" />
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
        <Button asChild variant="outline">
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
      <PageBar
        title={collection.label}
        breadcrumbs={[{ label: 'Model', href: '/cms/model' }]}
        actions={
          <>
            <Button className="octo-button octo-button--action" onClick={() => setAddFieldOpen(true)}>
              <Icon.Plus className="octo-icon-md" />
              Add field
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  size="icon"
                  variant="outline"
                  aria-label="More actions"
                  className="octo-button octo-button--icon-sm"
                >
                  <Icon.MoreHorizontal className="octo-icon-md" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onSelect={() => setEditOpen(true)}>
                  <Icon.Pencil className="octo-icon-sm" />
                  Edit content type
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onSelect={() => setDeleteOpen(true)}
                  className="octo-menu-item octo-menu-item--danger"
                >
                  <Icon.Trash2 className="octo-icon-sm" />
                  Delete content type
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        }
      />

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
          <Tabs defaultValue="fields" className="octo-tabs octo-tabs--flex-col">
            <TabsList className="octo-u-self-start">
              <TabsTrigger value="fields">Fields</TabsTrigger>
              <TabsTrigger value="json">JSON</TabsTrigger>
            </TabsList>

            <TabsContent value="fields" className="octo-tabs-content octo-tabs-content--mt">
              <Card className="octo-card octo-card--no-padding">
                <Table>
                  <TableHeader>
                    <TableRow className="octo-table-row octo-table-row--no-hover">
                      <TableHead className="octo-table-cell octo-table-cell--w8" />
                      <TableHead className="octo-table-head octo-table-head--muted">Field</TableHead>
                      <TableHead className="octo-table-head octo-table-head--muted">Key</TableHead>
                      <TableHead className="octo-table-head octo-table-head--muted">Type</TableHead>
                      <TableHead className="octo-table-head octo-table-head--muted">Flags</TableHead>
                      <TableHead className="octo-table-head octo-table-head--muted octo-table-head--right octo-table-head--w20">
                        Title
                      </TableHead>
                      <TableHead className="octo-table-head octo-table-head--w20" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {fields.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="octo-table-cell octo-table-cell--empty">
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
                            className={cn(
                              'octo-table-row octo-table-row--hover-group',
                              dragKey === key && 'octo-u-opacity-50',
                            )}
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
                            <TableCell className="octo-table-cell octo-table-cell--drag" aria-label="Drag to reorder">
                              <Icon.GripVertical className="octo-icon-sm" />
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
                            <TableCell className="octo-table-cell octo-table-cell--mono">{key}</TableCell>
                            <TableCell>
                              <FormatBadge field={field} />
                            </TableCell>
                            <TableCell>
                              <FieldFlags field={field} />
                            </TableCell>
                            <TableCell className="octo-table-cell octo-table-cell--right">
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
                                    ? 'octo-field-table__star octo-field-table__star--active'
                                    : titleAllowed
                                      ? 'octo-field-table__star octo-field-table__star--allowed'
                                      : 'octo-field-table__star octo-field-table__star--disabled',
                                )}
                                aria-pressed={field.entryTitle === true}
                                aria-label={field.entryTitle ? 'Current entry title' : 'Set as entry title'}
                              >
                                <Icon.Star
                                  className={cn(
                                    'octo-icon-sm',
                                    field.entryTitle && 'octo-field-table__star octo-field-table__star--filled',
                                  )}
                                />
                              </button>
                            </TableCell>
                            <TableCell className="octo-table-cell octo-table-cell--right">
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className="octo-button octo-button--icon-sm octo-btn-row-action"
                                    aria-label={`Actions for ${field.label}`}
                                  >
                                    <Icon.MoreHorizontal className="octo-icon-md" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem onSelect={() => setEditFieldKey(key)}>
                                    <Icon.Pencil className="octo-icon-sm" />
                                    Edit field
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    onSelect={() => setDeleteFieldKey(key)}
                                    className="octo-menu-item octo-menu-item--danger"
                                  >
                                    <Icon.Trash2 className="octo-icon-sm" />
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

            <TabsContent value="json" className="octo-tabs-content octo-tabs-content--mt">
              <Card className="octo-card octo-card--no-padding octo-u-overflow-hidden">
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
                    <code className="octo-schema-detail__detail-val octo-schema-detail__detail-val--mono">
                      {entryTitleKey}
                    </code>
                  ) : (
                    <span className="octo-u-text-muted">— not set —</span>
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
        <span className="octo-u-text-xs octo-u-text-muted">—</span>
      </span>
    );
  }

  return (
    <div className="octo-field-table__flags">
      {flags.map((flag, i) => (
        <span
          key={i}
          className={cn(
            'octo-field-table__flag',
            flag === 'required' && 'octo-field-table__flag octo-field-table__flag--required',
          )}
        >
          {flag}
        </span>
      ))}
    </div>
  );
}
