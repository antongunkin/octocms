/** Default "Title" suggestion when uploading (filename without extension). */
export function suggestedTitleFromFileName(fileName: string): string {
  const i = fileName.lastIndexOf('.');
  const base = i > 0 ? fileName.slice(0, i) : fileName;
  const t = base.trim();
  return t || fileName.trim() || 'Image';
}
