/**
 * Cross-cutting skeleton building blocks. Each major component owns its own
 * skeleton sibling (see `octocms/components/<Component>/<Component>.skeleton.tsx`).
 * This barrel exports shimmer primitives, small form/card blocks, and layout
 * fallbacks (`MainSlotSkeleton`, `AdminBootstrapSkeleton`) for `Suspense` edges.
 */
export { ShimmerBlock, ShimmerRow } from './primitives';
export { CardSkeleton, FormFieldSkeleton } from './blocks';
export { AdminBootstrapSkeleton, MainSlotSkeleton } from './MainSlotSkeleton';
