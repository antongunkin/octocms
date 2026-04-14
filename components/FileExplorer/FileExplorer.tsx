'use client';

import React, { useMemo } from 'react';

import { cn } from '../../lib/utils';
import { Button } from '../ui/button';
import { useFileState } from '../../hooks/useFileState';
import type { SelectedFile } from '../../types';

type FileExplorerProps = {
  files: SelectedFile[];
  folders: string[];
};

const FileExplorer = ({ files = [], folders = [] }: FileExplorerProps) => {
  const { selectedType = '/', selectedFile, onTypeClick, onFileClick } = useFileState();

  const sortedFiles = useMemo(() => {
    return selectedType ? files.filter((file) => file.type === selectedType) : [];
  }, [files, selectedType]);

  const addNew = async () => {
    // if (selectedType) {
    //   const path = await newFile(selectedType);
    //   if (path) {
    //     const parsedFileName = parseFileName(path);
    //     onFileClick(parsedFileName);
    //     router.push(`/cms/${parsedFileName.type}/${parsedFileName.id}`);
    //   }
    // }
  };

  return (
    <div className="flex w-full h-full">
      {/* Folders sidebar — matches CMSSidebar */}
      <aside className="flex w-56 shrink-0 flex-col border-r border-border bg-background overflow-y-auto">
        <div className="p-2">
          <p className="mb-1 px-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">Folders</p>
          <nav className="space-y-0.5">
            {folders.map((folder) => (
              <Button
                key={folder}
                asChild
                variant="ghost"
                className={cn(
                  'h-8 w-full justify-start gap-2 px-2 text-sm font-normal',
                  selectedType === folder ? 'bg-accent text-accent-foreground' : 'text-foreground hover:bg-accent',
                )}
              >
                <button type="button" onClick={() => onTypeClick(folder)}>
                  {folder !== '/' && '/'}
                  {folder}
                </button>
              </Button>
            ))}
          </nav>
        </div>
      </aside>

      {/* Files area — matches DashboardContent layout */}
      <div className="flex flex-1 flex-col overflow-hidden bg-muted/20">
        <div className="flex items-center justify-between border-b border-border bg-background px-6 py-4">
          <h1 className="text-xl font-semibold text-foreground">Files</h1>
          {selectedType && (
            <Button size="sm" className="bg-blue-600 hover:bg-blue-500 text-white" onClick={addNew}>
              Add New
            </Button>
          )}
        </div>
        <div className="flex-1 overflow-y-auto p-6">
          <nav className="space-y-0.5">
            {sortedFiles.map((file, i) => (
              <Button
                key={i}
                asChild
                variant="ghost"
                className={cn(
                  'h-8 w-full justify-start gap-2 px-2 text-sm font-normal',
                  selectedFile?.path === file.path
                    ? 'bg-accent text-accent-foreground'
                    : 'text-foreground hover:bg-accent',
                )}
              >
                <a
                  href={`/cms/media/${file.type === '/' ? '' : file.type + '/'}${file.id}`}
                  onClick={() => onFileClick(file)}
                >
                  {file.id}
                </a>
              </Button>
            ))}
          </nav>
        </div>
      </div>
    </div>
  );
};

export default FileExplorer;
