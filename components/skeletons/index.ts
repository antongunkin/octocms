/**
 * Cross-cutting skeleton building blocks. Each major component owns its own
 * skeleton sibling (see `octocms/components/<Component>/<Component>.skeleton.tsx`)
 * for its specific layout; only the bits that are shared across many of those
 * (the shimmer primitives, the generic admin shell, the small section card
 * used as a Suspense fallback inside pages) live here.
 */
export { ShimmerBlock, ShimmerRow, HeaderShimmer } from './primitives';
export { AdminGenericSkeleton } from './AdminGenericSkeleton';
export { SectionSkeleton } from './SectionSkeleton';
export { BreadcrumbSkeleton, CardSkeleton, FormFieldSkeleton, TabBarSkeleton } from './blocks';
