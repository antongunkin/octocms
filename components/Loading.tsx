'use client';

import React from 'react';

interface LoadingProps {
  message?: string;
}

const Loading = ({ message = 'Loading...' }: LoadingProps) => {
  return (
    <div className="fixed bottom-4 right-4 z-50 flex items-center space-x-2 rounded-lg bg-white px-3 py-2 shadow-lg border">
      <div className="h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-blue-600"></div>
      <span className="text-sm font-medium text-gray-700">{message}</span>
    </div>
  );
};

export default Loading;
