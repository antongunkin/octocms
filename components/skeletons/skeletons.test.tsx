import { cleanup, render } from '@testing-library/react';
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ContentModelListPageSkeleton } from '../ContentModel/skeletons/ContentModelListPageSkeleton';
import { ContentTypeDetailPageSkeleton } from '../ContentModel/skeletons/ContentTypeDetailPageSkeleton';
import { DashboardCollectionPageSkeleton } from '../Dashboard/skeletons/DashboardCollectionPageSkeleton';
import { DashboardPageSkeleton } from '../Dashboard/skeletons/DashboardPageSkeleton';
import { EditPostPageSkeleton } from '../EditPost/skeletons/EditPostPageSkeleton';
import { MediaAssetPageSkeleton } from '../MediaAsset/skeletons/MediaAssetPageSkeleton';
import { MediaManagerPageSkeleton } from '../MediaManager/skeletons/MediaManagerPageSkeleton';
import { RouteMainSlotSkeleton } from '../Layout/skeletons/RouteMainSlotSkeleton';
import { resolveAdminRouteSkeleton } from '../Layout/skeletons/routeSkeletons';

import { AdminBootstrapSkeleton, CardSkeleton, FormFieldSkeleton, ShimmerBlock, ShimmerRow } from './index';

vi.mock('next/navigation', () => ({
  usePathname: () => '/cms',
}));

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

describe('layout fallbacks', () => {
  it('RouteMainSlotSkeleton exposes role=status via nested page skeleton', () => {
    const { container } = render(<RouteMainSlotSkeleton />);
    expect(container.querySelector('[role="status"]')).not.toBeNull();
    expect(container.querySelector('.animate-pulse')).not.toBeNull();
  });

  it('AdminBootstrapSkeleton exposes role=status', () => {
    const { container } = render(<AdminBootstrapSkeleton />);
    expect(container.querySelector('[role="status"]')).not.toBeNull();
    expect(container.querySelectorAll('.animate-pulse').length).toBeGreaterThan(4);
  });
});

describe('route skeleton resolver', () => {
  it('maps content routes to dashboard skeletons', () => {
    const { container: cms } = render(<>{resolveAdminRouteSkeleton('/cms')}</>);
    expect(cms.querySelector('[aria-label="Loading content"]')).not.toBeNull();

    const { container: collection } = render(<>{resolveAdminRouteSkeleton('/cms/content/post')}</>);
    expect(collection.querySelector('[aria-label="Loading content"]')).not.toBeNull();
  });

  it('maps media routes to media skeletons', () => {
    const { container: list } = render(<>{resolveAdminRouteSkeleton('/cms/media')}</>);
    expect(list.querySelector('[aria-label="Loading media"]')).not.toBeNull();

    const { container: asset } = render(<>{resolveAdminRouteSkeleton('/cms/media/abc-123')}</>);
    expect(asset.querySelector('[aria-label="Loading asset"]')).not.toBeNull();
  });

  it('maps entry editor routes to edit skeleton', () => {
    const { container } = render(<>{resolveAdminRouteSkeleton('/cms/content/post/my-id')}</>);
    expect(container.querySelector('[aria-label="Loading entry"]')).not.toBeNull();
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
    expect(container.querySelectorAll('.animate-pulse').length).toBe(6);
  });
});

describe('page skeleton compositions', () => {
  const cases: { name: string; render: () => React.ReactNode }[] = [
    { name: 'DashboardPageSkeleton', render: () => <DashboardPageSkeleton /> },
    { name: 'DashboardCollectionPageSkeleton', render: () => <DashboardCollectionPageSkeleton /> },
    { name: 'EditPostPageSkeleton', render: () => <EditPostPageSkeleton /> },
    { name: 'MediaManagerPageSkeleton', render: () => <MediaManagerPageSkeleton /> },
    { name: 'MediaAssetPageSkeleton', render: () => <MediaAssetPageSkeleton /> },
    { name: 'ContentModelListPageSkeleton', render: () => <ContentModelListPageSkeleton /> },
    { name: 'ContentTypeDetailPageSkeleton', render: () => <ContentTypeDetailPageSkeleton /> },
  ];

  for (const c of cases) {
    it(`${c.name} renders without crashing and exposes role=status`, () => {
      const { container } = render(<>{c.render()}</>);
      expect(container.querySelector('[role="status"]')).not.toBeNull();
      expect(container.querySelector('.animate-pulse')).not.toBeNull();
    });
  }
});
