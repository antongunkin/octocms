import { getConfig } from '../lib/configStore';

import { SelectedFile } from '../types';

export const parseFileName = (file: string): SelectedFile => {
  const config = getConfig();
  const nameWithoutFolder = file.replace(`${config.contentFolder}/`, '').replace('.json', '');
  const split = nameWithoutFolder.split('/');
  const type = split[0];
  const id = split.pop() as string;

  return { type, id, path: file };
};

export const parseMediaFileName = (file: string): SelectedFile => {
  const config = getConfig();
  let nameWithoutFolder = file.replace(`${config.mediaFolder}/`, '');
  (config.mediaAllowedFormats || []).forEach((format) => {
    nameWithoutFolder = nameWithoutFolder.replace(`.${format}`, '');
  });
  const split = nameWithoutFolder.split('/');
  let type = split[0];
  const id = split.pop() as string;

  if (type === id) {
    type = '/';
  }

  return { type, id, path: file };
};
