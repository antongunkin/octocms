'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronRight, FileText, Layers, Plus, Search } from 'lucide-react';

import { useEntryList } from '../../admin/query/hooks/useEntryList';
import { useSchema } from '../../admin/query/hooks/useSchema';
import { Button } from '../ui/button';
import { cn } from '../../lib/utils';
import CreateContentTypeDialog from './CreateContentTypeDialog';
import { SchemaTableSkeleton } from './skeletons/SchemaTableSkeleton';

export default function ContentModelList() {
  const router = useRouter();
  const schemaQuery = useSchema();
  const entriesQuery = useEntryList();
  const schema = schemaQuery.data;
  const entriesData = entriesQuery.data;
  const entries = useMemo(() => entriesData ?? [], [entriesData]);
  const isLoading = (schemaQuery.isPending && !schema) || (entriesQuery.isPending && !entriesData);
  const searchRef = useRef<HTMLInputElement>(null);
  const [search, setSearch] = useState('');
  const [createOpen, setCreateOpen] = useState(false);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (e.key === '/' && tag !== 'INPUT' && tag !== 'TEXTAREA') {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const rows = useMemo(() => {
    if (!schema) return [];
    const counts = new Map<string, number>();
    for (const e of entries) {
      counts.set(e.type, (counts.get(e.type) ?? 0) + 1);
    }
    return Object.entries(schema.collections).map(([key, col]) => ({
      key,
      label: col.label,
      hasMany: col.hasMany === true,
      fieldCount: Object.keys(col.fields).length,
      entryCount: counts.get(key) ?? 0,
    }));
  }, [schema, entries]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => r.label.toLowerCase().includes(q) || r.key.toLowerCase().includes(q));
  }, [rows, search]);

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* Page header */}
      <div className="flex min-h-[52px] items-center justify-between gap-3 border-b border-border bg-[var(--bg)] px-6 py-3">
        <div className="min-w-0 flex-1">
          <div className="mb-px flex items-center gap-1.5 text-[12px] text-[var(--muted)]">
            <span style={{ color: 'var(--text-2)' }}>Model</span>
          </div>
          <div>
            <h1 className="m-0 overflow-hidden text-ellipsis whitespace-nowrap text-[16px] font-semibold tracking-[-0.012em] text-foreground">
              Content Model
            </h1>
          </div>
        </div>
        <div className="flex flex-none items-center gap-2">
          <span className="text-[13px] font-medium text-[var(--text-2)]">
            Content types
            <span className="ml-1.5 font-mono text-[12px] font-normal text-[var(--muted)]">{rows.length}</span>
          </span>
          <Button
            size="sm"
            className="gap-1.5 bg-foreground text-background hover:bg-foreground/90"
            onClick={() => setCreateOpen(true)}
          >
            <Plus className="h-4 w-4" />
            Create content type
          </Button>
        </div>
      </div>

      {schema ? <CreateContentTypeDialog open={createOpen} onOpenChange={setCreateOpen} schema={schema} /> : null}

      {/* Body */}
      <div className="flex flex-1 flex-col overflow-hidden bg-[var(--bg)]">
        <div className="scroll flex-1 overflow-auto px-6 pb-12 pt-5">
          <div className="flex flex-col gap-4">
            {/* Filter bar */}
            <div className="flex min-w-0 items-center gap-2.5">
              <div className="relative min-w-[220px] flex-[0_1_420px]">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  ref={searchRef}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Filter content types…"
                  className="h-9 w-full rounded-lg border border-border bg-background pl-9 pr-12 text-sm text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/20"
                />
                <kbd className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 rounded border border-border bg-[var(--surface-2)] px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                  /
                </kbd>
              </div>
            </div>

            {isLoading ? (
              <SchemaTableSkeleton />
            ) : (
              /* Table */
              <div className="overflow-hidden rounded-xl border border-border bg-[var(--surface-1)] shadow-[var(--shadow-1)]">
                <div className="overflow-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-border bg-[var(--surface-2)]">
                        <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
                          Name
                        </th>
                        <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
                          Key
                        </th>
                        <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
                          Cardinality
                        </th>
                        <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
                          Fields
                        </th>
                        <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
                          Entries
                        </th>
                        <th className="w-10 px-4 py-2.5" />
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="h-32 text-center text-sm text-muted-foreground">
                            No content types match your search.
                          </td>
                        </tr>
                      ) : (
                        filtered.map((r, i) => (
                          <tr
                            key={r.key}
                            onClick={() => router.push(`/cms/model/${r.key}`)}
                            className={cn(
                              'group cursor-pointer transition-colors hover:bg-[var(--surface-2)]/60',
                              i > 0 && 'border-t border-border',
                            )}
                            onKeyDown={() => router.push(`/cms/model/${r.key}`)}
                          >
                            <td className="px-4 py-3 text-sm">
                              <span className="inline-flex items-center gap-2 font-medium text-foreground">
                                {r.hasMany ? (
                                  <Layers className="h-4 w-4 text-muted-foreground" />
                                ) : (
                                  <FileText className="h-4 w-4 text-muted-foreground" />
                                )}
                                {r.label}
                              </span>
                            </td>
                            <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{r.key}</td>
                            <td className="px-4 py-3 text-sm text-muted-foreground">
                              {r.hasMany ? 'Many entries' : 'Singleton'}
                            </td>
                            <td className="px-4 py-3 text-sm text-muted-foreground">{r.fieldCount}</td>
                            <td className="px-4 py-3 text-sm text-muted-foreground">{r.entryCount}</td>
                            <td className="w-10 px-4 py-3 text-right">
                              <ChevronRight className="ml-auto h-4 w-4 text-muted-foreground opacity-60 transition-opacity group-hover:opacity-100" />
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
