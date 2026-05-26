/**
 * Cross-cutting skeleton building blocks. Each major component owns its own
 * skeleton sibling under `skeletons/` subfolders or `*PageSkeleton` exports.
 * This barrel exports shimmer primitives, small form/card blocks, and the
 * bootstrap fallback for `AdminLayout` Suspense.
 */
export { ShimmerBlock, ShimmerRow } from './primitives';
export { CardSkeleton, FormFieldSkeleton } from './blocks';
export { AdminBootstrapSkeleton } from './MainSlotSkeleton';
