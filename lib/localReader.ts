import fsPromises from 'fs/promises';
import path from 'path';

/** Read a JSON content file from local disk. Returns null on ENOENT or parse error. */
export async function readLocalContentFile(filePath: string): Promise<unknown | null> {
  const fullPath = path.join(process.cwd(), filePath);
  try {
    const data = await fsPromises.readFile(fullPath, { encoding: 'utf8' });
    return JSON.parse(data);
  } catch (error: any) {
    if (error?.code === 'ENOENT' || error instanceof SyntaxError) return null;
    throw error;
  }
}

/** Read a raw text file (e.g. companion .md) from local disk. Returns '' on ENOENT. */
export async function readLocalRawFile(filePath: string): Promise<string> {
  const fullPath = path.join(process.cwd(), filePath);
  try {
    return await fsPromises.readFile(fullPath, { encoding: 'utf8' });
  } catch (error: any) {
    if (error?.code === 'ENOENT') return '';
    throw error;
  }
}

/** List .json files in a collection directory on local disk. Returns [] if directory does not exist. */
export async function listLocalCollectionFiles(dirPath: string): Promise<string[]> {
  const fullDir = path.join(process.cwd(), dirPath);
  try {
    const entries = await fsPromises.readdir(fullDir, { withFileTypes: true });
    return entries.filter((e) => e.isFile() && e.name.endsWith('.json')).map((e) => `${dirPath}/${e.name}`);
  } catch (error: any) {
    if (error?.code === 'ENOENT') return [];
    throw error;
  }
}
