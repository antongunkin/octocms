'use client';

import React, { useState, useContext, createContext } from 'react';

import { FileContextValues, SelectedFile } from '../types';

const FileContext = createContext<FileContextValues>({
  selectedType: undefined,
  selectedFile: undefined,
  onTypeClick: () => {},
  onFileClick: () => {},
});

export const FileContextProvider = ({
  children,
  defaultType,
  defaultFile,
}: {
  children: React.ReactNode;
  defaultType?: string;
  defaultFile?: SelectedFile;
}) => {
  const [selectedType, setSelectedType] = useState<string | undefined>(defaultType);
  const [selectedFile, setSelectedFile] = useState<SelectedFile | undefined>(defaultFile);

  const onTypeClick = (type: string | undefined) => {
    setSelectedType(type);
  };

  const onFileClick = (file: SelectedFile | undefined) => {
    setSelectedFile(file);
  };

  const value = {
    selectedType,
    selectedFile,
    onTypeClick,
    onFileClick,
  };

  return <FileContext.Provider value={value}>{children}</FileContext.Provider>;
};

export const useFileState = (): FileContextValues => useContext(FileContext);
