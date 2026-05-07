/**
 * Validate a `FileList` (from a file `<input>` or drop event) against the
 * configured `mediaAllowedFormats`. Pure — no toasts, no React. Callers decide
 * how to surface skipped files (`FormImageField` and `MarkdownInsertImageDialog`
 * both render destructive toasts; share the validation logic, not the UI).
 */
export type StageMediaFilesResult = {
  accepted: File[];
  /** Files rejected because the extension wasn't in `allowedFormats`. */
  skipped: { name: string; ext: string }[];
};

export function stageMediaFiles(fileList: FileList | File[], allowedFormats: string[]): StageMediaFilesResult {
  const files = fileList instanceof FileList ? Array.from(fileList) : fileList;
  const accepted: File[] = [];
  const skipped: { name: string; ext: string }[] = [];

  for (const file of files) {
    const ext = file.name.split('.').pop()?.toLowerCase() || '';
    if (!allowedFormats.includes(ext)) {
      skipped.push({ name: file.name, ext });
      continue;
    }
    accepted.push(file);
  }

  return { accepted, skipped };
}
