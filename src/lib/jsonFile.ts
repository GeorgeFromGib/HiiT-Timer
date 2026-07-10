import { File, Paths } from 'expo-file-system';

export async function readJsonFile<T>(name: string): Promise<T | undefined> {
  try {
    const f = new File(Paths.document, name);
    if (!f.exists) return undefined;
    const raw = await f.text();
    return JSON.parse(raw) as T;
  } catch {
    return undefined;
  }
}

export function writeJsonFile(name: string, data: unknown): void {
  try {
    new File(Paths.document, name).write(JSON.stringify(data));
  } catch {}
}
