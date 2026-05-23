'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronRight, FileText, Layers, Plus, Search } from '../ui/icons';

import { useEntryList } from '../../admin/query/hooks/useEntryList';
import { useSchema } from '../../admin/query/hooks/useSchema';
import { Button } from '../ui/button';
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
    <div className="octo-content-model">
      {/* Page header */}
      <div className="octo-page-chrome">
        <div className="octo-page-chrome__title-area">
          <div className="octo-page-chrome__breadcrumb">
            <span className="octo-u-text-2">Model</span>
          </div>
          <div className="octo-page-chrome__title-row">
            <h1 className="octo-page-chrome__title">Content Model</h1>
          </div>
        </div>
        <div className="octo-page-chrome__right">
          <div className="octo-hdr-right">
            <span className="octo-hdr-right__label">
              Content types
              <span className="octo-hdr-right__mono">{rows.length}</span>
            </span>
            <Button size="sm" className="octo-button octo-button--action" onClick={() => setCreateOpen(true)}>
              <Plus className="octo-icon-md" />
              Create content type
            </Button>
          </div>
        </div>
      </div>

      {schema ? <CreateContentTypeDialog open={createOpen} onOpenChange={setCreateOpen} schema={schema} /> : null}

      {/* Body */}
      <div className="octo-content-model__body">
        <div className="octo-content-model__scroll octo-scroll">
          <div className="octo-content-model__inner">
            {/* Filter bar */}
            <div className="octo-content-model__filters">
              <div className="octo-search-wrap">
                <Search className="octo-search-wrap__icon" />
                <input
                  ref={searchRef}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Filter content types…"
                  className="octo-input octo-search-wrap__input"
                />
                <kbd className="octo-search-wrap__kbd">/</kbd>
              </div>
            </div>

            {isLoading ? (
              <SchemaTableSkeleton />
            ) : (
              /* Table */
              <div className="octo-schema-list">
                <div className="octo-schema-list__scroll">
                  <table className="octo-schema-list__table">
                    <thead className="octo-schema-list__thead">
                      <tr className="octo-schema-list__th-row">
                        <th className="octo-schema-list__th">Name</th>
                        <th className="octo-schema-list__th">Key</th>
                        <th className="octo-schema-list__th">Cardinality</th>
                        <th className="octo-schema-list__th">Fields</th>
                        <th className="octo-schema-list__th">Entries</th>
                        <th className="octo-schema-list__th octo-schema-list__th--icon" />
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="octo-schema-list__empty">
                            No content types match your search.
                          </td>
                        </tr>
                      ) : (
                        filtered.map((r) => (
                          <tr
                            key={r.key}
                            onClick={() => router.push(`/cms/model/${r.key}`)}
                            className="octo-schema-list__item"
                            onKeyDown={() => router.push(`/cms/model/${r.key}`)}
                          >
                            <td className="octo-schema-list__td">
                              <span className="octo-schema-list__name">
                                <span className="octo-schema-list__name-icon">
                                  {r.hasMany ? (
                                    <Layers className="octo-icon-md" />
                                  ) : (
                                    <FileText className="octo-icon-md" />
                                  )}
                                </span>
                                {r.label}
                              </span>
                            </td>
                            <td className="octo-schema-list__td octo-schema-list__key">{r.key}</td>
                            <td className="octo-schema-list__td octo-schema-list__count">
                              {r.hasMany ? 'Many entries' : 'Singleton'}
                            </td>
                            <td className="octo-schema-list__td octo-schema-list__count">{r.fieldCount}</td>
                            <td className="octo-schema-list__td octo-schema-list__count">{r.entryCount}</td>
                            <td className="octo-schema-list__td octo-schema-list__th octo-schema-list__th--icon">
                              <div className="octo-schema-list__chevron">
                                <ChevronRight className="octo-icon-md" />
                              </div>
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
