'use client';

import React from 'react';
import { CircleCheck, Info, LoaderCircle, OctagonX, TriangleAlert } from './icons';
import { Toaster as Sonner } from 'sonner';

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      theme="system"
      icons={{
        success: <CircleCheck style={{ width: 16, height: 16 }} />,
        info: <Info style={{ width: 16, height: 16 }} />,
        warning: <TriangleAlert style={{ width: 16, height: 16 }} />,
        error: <OctagonX style={{ width: 16, height: 16 }} />,
        loading: <LoaderCircle style={{ width: 16, height: 16, animation: 'octo-spin 1s linear infinite' }} />,
      }}
      {...props}
    />
  );
};

export { Toaster };
