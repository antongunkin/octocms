export function formatUpdatedAt(updatedAt?: string): string {
  if (!updatedAt) return '—';
  const date = new Date(updatedAt);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}
