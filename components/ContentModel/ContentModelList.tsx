'use client';

import React, { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronRight, FileText, Layers, Plus, Search } from 'lucide-react';

import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { Input } from '../ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import type { Config, EntryListItem } from '../../types';
import CreateContentTypeDialog from './CreateContentTypeDialog';

type Props = {
  schema: Config;
  entries: EntryListItem[];
};

export default function ContentModelList({ schema, entries }: Props) {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [createOpen, setCreateOpen] = useState(false);

  const rows = useMemo(() => {
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
    <div className="flex flex-1 flex-col overflow-hidden bg-muted/20">
      {/* Page header */}
      <div className="flex items-center justify-between border-b border-border bg-background px-6 py-4">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Content Model</h1>
          <p className="text-sm text-muted-foreground">
            {rows.length} content {rows.length === 1 ? 'type' : 'types'} in this project.
          </p>
        </div>
        <Button
          size="sm"
          className="gap-1.5 bg-blue-600 text-white hover:bg-blue-700"
          onClick={() => setCreateOpen(true)}
        >
          <Plus className="h-4 w-4" />
          Create content type
        </Button>
      </div>

      <CreateContentTypeDialog open={createOpen} onOpenChange={setCreateOpen} schema={schema} />

      <div className="flex flex-1 flex-col overflow-hidden p-6">
        {/* Filter bar */}
        <div className="mb-4 flex items-center gap-3">
          <div className="relative max-w-sm flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filter content types…"
              className="pl-9"
            />
          </div>
        </div>

        {/* Table */}
        <Card className="flex-1 overflow-auto p-0">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="font-medium text-muted-foreground">Name</TableHead>
                <TableHead className="font-medium text-muted-foreground">Key</TableHead>
                <TableHead className="font-medium text-muted-foreground">Cardinality</TableHead>
                <TableHead className="font-medium text-muted-foreground">Fields</TableHead>
                <TableHead className="font-medium text-muted-foreground">Entries</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-32 text-center text-sm text-muted-foreground">
                    No content types match your search.
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((r) => (
                  <TableRow key={r.key} className="cursor-pointer" onClick={() => router.push(`/cms/model/${r.key}`)}>
                    <TableCell className="font-medium">
                      <span className="inline-flex items-center gap-2">
                        {r.hasMany ? (
                          <Layers className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <FileText className="h-4 w-4 text-muted-foreground" />
                        )}
                        {r.label}
                      </span>
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">{r.key}</TableCell>
                    <TableCell className="text-muted-foreground">{r.hasMany ? 'Many entries' : 'Singleton'}</TableCell>
                    <TableCell className="text-muted-foreground">{r.fieldCount}</TableCell>
                    <TableCell className="text-muted-foreground">{r.entryCount}</TableCell>
                    <TableCell>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </Card>
      </div>
    </div>
  );
}
