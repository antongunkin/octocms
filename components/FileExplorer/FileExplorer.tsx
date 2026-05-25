'use client';

import Link from 'next/link';
import React, { useMemo } from 'react';

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
    <div className="octo-file-explorer">
      {/* Folders sidebar */}
      <aside className="octo-file-explorer__sidebar">
        <div className="octo-file-explorer__sidebar-inner">
          <p className="octo-file-explorer__sidebar-label">Folders</p>
          <nav className="octo-file-explorer__sidebar-nav">
            {folders.map((folder) => (
              <button
                key={folder}
                type="button"
                className={`octo-file-explorer__item${selectedType === folder ? ' octo-file-explorer__item octo-file-explorer__item--active' : ''}`}
                onClick={() => onTypeClick(folder)}
              >
                {folder !== '/' && '/'}
                {folder}
              </button>
            ))}
          </nav>
        </div>
      </aside>

      {/* Files area */}
      <div className="octo-file-explorer__main">
        <div className="octo-file-explorer__main-header">
          <h1 className="octo-file-explorer__main-title">Files</h1>
          {selectedType && (
            <Button style={{ background: '#2563eb', color: '#fff' }} onClick={addNew}>
              Add New
            </Button>
          )}
        </div>
        <div className="octo-file-explorer__main-body">
          <nav className="octo-file-explorer__files-nav">
            {sortedFiles.map((file, i) => (
              <Link
                key={i}
                href={`/cms/media/${file.type === '/' ? '' : file.type + '/'}${file.id}`}
                className={`octo-file-explorer__item${selectedFile?.path === file.path ? ' octo-file-explorer__item octo-file-explorer__item--active' : ''}`}
                onClick={() => onFileClick(file)}
              >
                {file.id}
              </Link>
            ))}
          </nav>
        </div>
      </div>
    </div>
  );
};

export default FileExplorer;
