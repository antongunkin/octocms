import { cleanup, render } from '@testing-library/react';
import React from 'react';
import { afterEach, describe, expect, it } from 'vitest';

import { ContentModelListSkeleton } from '../ContentModel/ContentModelList.skeleton';
import { ContentTypeDetailSkeleton } from '../ContentModel/ContentTypeDetail.skeleton';
import { DashboardCollectionSkeleton } from '../Dashboard/DashboardContent.collection.skeleton';
import { DashboardListSkeleton } from '../Dashboard/DashboardContent.list.skeleton';
import { DashboardContentSkeleton } from '../Dashboard/DashboardContent.skeleton';
import { EditPostSkeleton } from '../EditPost/EditPost.skeleton';
import { MediaAssetSkeleton } from '../MediaAsset/MediaAsset.skeleton';
import { MediaManagerSkeleton } from '../MediaManager/MediaManager.skeleton';

import {
  AdminBootstrapSkeleton,
  CardSkeleton,
  FormFieldSkeleton,
  MainSlotSkeleton,
  ShimmerBlock,
  ShimmerRow,
} from './index';

afterEach(() => {
  cleanup();
});

describe('skeleton primitives', () => {
  it('ShimmerBlock renders an animate-pulse div', () => {
    const { container } = render(<ShimmerBlock data-testid="x" />);
    const el = container.querySelector('[data-testid="x"]');
    expect(el).not.toBeNull();
    expect(el!.className).toContain('animate-pulse');
  });

  it('ShimmerRow renders one block per width', () => {
    const { container } = render(<ShimmerRow widths={['10%', '20%', '30%']} />);
    expect(container.querySelectorAll('.animate-pulse').length).toBe(3);
  });
});

describe('main slot fallbacks', () => {
  it('MainSlotSkeleton exposes role=status', () => {
    const { container } = render(<MainSlotSkeleton />);
    expect(container.querySelector('[role="status"]')).not.toBeNull();
    expect(container.querySelector('.animate-pulse')).not.toBeNull();
  });

  it('AdminBootstrapSkeleton exposes role=status', () => {
    const { container } = render(<AdminBootstrapSkeleton />);
    expect(container.querySelector('[role="status"]')).not.toBeNull();
    expect(container.querySelectorAll('.animate-pulse').length).toBeGreaterThan(4);
  });
});

describe('shared block skeletons', () => {
  const cases: { name: string; render: () => React.ReactNode }[] = [
    { name: 'FormFieldSkeleton', render: () => <FormFieldSkeleton /> },
    { name: 'CardSkeleton', render: () => <CardSkeleton /> },
  ];

  for (const c of cases) {
    it(`${c.name} exposes role=status and shimmer`, () => {
      const { container } = render(<>{c.render()}</>);
      expect(container.querySelector('[role="status"]')).not.toBeNull();
      expect(container.querySelector('.animate-pulse')).not.toBeNull();
    });
  }

  it('CardSkeleton honours `lines` prop', () => {
    const { container } = render(<CardSkeleton lines={5} />);
    // Header shimmer + 5 body lines = 6 shimmer blocks.
    expect(container.querySelectorAll('.animate-pulse').length).toBe(6);
  });
});

describe('co-located component skeletons', () => {
  const cases: { name: string; render: () => React.ReactNode }[] = [
    { name: 'DashboardContentSkeleton', render: () => <DashboardContentSkeleton /> },
    { name: 'DashboardListSkeleton', render: () => <DashboardListSkeleton /> },
    { name: 'DashboardCollectionSkeleton', render: () => <DashboardCollectionSkeleton /> },
    { name: 'EditPostSkeleton', render: () => <EditPostSkeleton /> },
    { name: 'MediaManagerSkeleton', render: () => <MediaManagerSkeleton /> },
    { name: 'MediaAssetSkeleton', render: () => <MediaAssetSkeleton /> },
    { name: 'ContentModelListSkeleton', render: () => <ContentModelListSkeleton /> },
    { name: 'ContentTypeDetailSkeleton', render: () => <ContentTypeDetailSkeleton /> },
  ];

  for (const c of cases) {
    it(`${c.name} renders without crashing and exposes role=status`, () => {
      const { container } = render(<>{c.render()}</>);
      expect(container.querySelector('[role="status"]')).not.toBeNull();
      expect(container.querySelector('.animate-pulse')).not.toBeNull();
    });
  }
});
