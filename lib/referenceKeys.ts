const CONTENT_PATH_REGEX = /^cms\/content\/([^/]+)\/([^/]+)\.json$/;
const REFERENCE_KEY_REGEX = /^([^-]+)-(.+?)(?:\.json)?$/;

/**
 * Normalizes a content path or reference key to the stored form (`post-123.json`).
 * Prefer passing a full **`cms/content/.../file.json` path** from `EntryListItem.path` — do not build
 * `type + '-' + entry.id` when `id` is already a prefixed stem (e.g. `post-123`), or you will double
 * the collection prefix (`post-post-123.json`).
 */
export const toReferenceKey = (value: string): string => {
  const match = value.match(CONTENT_PATH_REGEX);

  if (match) {
    const [, type, fileStem] = match;
    if (fileStem.startsWith(`${type}-`)) {
      return `${fileStem}.json`;
    }
    return `${type}-${fileStem}.json`;
  }

  const keyMatch = value.match(REFERENCE_KEY_REGEX);
  if (keyMatch) {
    const [, type, id] = keyMatch;
    return `${type}-${id}.json`;
  }

  return value;
};

export const toContentPath = (value: string): string => {
  const match = value.match(REFERENCE_KEY_REGEX);
  if (!match) {
    return '';
  }

  const [, type, id] = match;
  return `cms/content/${type}/${type}-${id}.json`;
};

export const toGeneratedJsonName = (contentPath: string): string => {
  const match = contentPath.match(CONTENT_PATH_REGEX);
  if (!match) {
    return '';
  }

  const [, type, fileStem] = match;
  if (fileStem.startsWith(`${type}-`)) {
    return `${fileStem}.json`;
  }
  return `${type}-${fileStem}.json`;
};
