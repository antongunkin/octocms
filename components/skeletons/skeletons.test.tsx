import { cleanup, render } from '@testing-library/react';
import React from 'react';
import { afterEach, describe, expect, it } from 'vitest';

import { ChatPageSkeleton } from '../Chat/ChatPage.skeleton';
import { ContentModelListSkeleton } from '../ContentModel/ContentModelList.skeleton';
import { ContentTypeDetailSkeleton } from '../ContentModel/ContentTypeDetail.skeleton';
import { DashboardCollectionSkeleton } from '../Dashboard/DashboardContent.collection.skeleton';
import { DashboardListSkeleton } from '../Dashboard/DashboardContent.list.skeleton';
import { DashboardContentSkeleton } from '../Dashboard/DashboardContent.skeleton';
import { EditPostSkeleton } from '../EditPost/EditPost.skeleton';
import { MediaAssetSkeleton } from '../MediaAsset/MediaAsset.skeleton';
import { MediaManagerSkeleton } from '../MediaManager/MediaManager.skeleton';

import { AdminGenericSkeleton, HeaderShimmer, SectionSkeleton, ShimmerBlock, ShimmerRow } from './index';

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

  it('HeaderShimmer renders a 56px header bar', () => {
    const { container } = render(<HeaderShimmer />);
    const root = container.firstChild as HTMLElement;
    expect(root.className).toContain('h-14');
  });
});

describe('co-located component skeletons', () => {
  const cases: { name: string; render: () => React.ReactNode }[] = [
    { name: 'AdminGenericSkeleton', render: () => <AdminGenericSkeleton /> },
    { name: 'DashboardContentSkeleton', render: () => <DashboardContentSkeleton /> },
    { name: 'DashboardListSkeleton', render: () => <DashboardListSkeleton /> },
    { name: 'DashboardCollectionSkeleton', render: () => <DashboardCollectionSkeleton /> },
    { name: 'EditPostSkeleton', render: () => <EditPostSkeleton /> },
    { name: 'MediaManagerSkeleton', render: () => <MediaManagerSkeleton /> },
    { name: 'MediaAssetSkeleton', render: () => <MediaAssetSkeleton /> },
    { name: 'ContentModelListSkeleton', render: () => <ContentModelListSkeleton /> },
    { name: 'ContentTypeDetailSkeleton', render: () => <ContentTypeDetailSkeleton /> },
    { name: 'ChatPageSkeleton', render: () => <ChatPageSkeleton /> },
    { name: 'SectionSkeleton', render: () => <SectionSkeleton /> },
  ];

  for (const c of cases) {
    it(`${c.name} renders without crashing and exposes role=status`, () => {
      const { container } = render(<>{c.render()}</>);
      expect(container.querySelector('[role="status"]')).not.toBeNull();
      expect(container.querySelector('.animate-pulse')).not.toBeNull();
    });
  }
});
