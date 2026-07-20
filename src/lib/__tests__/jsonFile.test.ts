import { readJsonFile, writeJsonFile } from '../jsonFile';

describe('readJsonFile / writeJsonFile', () => {
  beforeEach(() => {
    jest.requireMock('expo-file-system').__files.clear();
  });

  it('returns undefined when the file does not exist', async () => {
    expect(await readJsonFile('missing.json')).toBeUndefined();
  });

  it('writes then reads back the same data', async () => {
    writeJsonFile('data.json', { a: 1, b: 'two' });
    expect(await readJsonFile('data.json')).toEqual({ a: 1, b: 'two' });
  });

  it('returns undefined when the stored content is not valid JSON', async () => {
    jest.requireMock('expo-file-system').__files.set('document/corrupt.json', '{not valid json');
    expect(await readJsonFile('corrupt.json')).toBeUndefined();
  });

  it('overwrites existing content on repeated writes', async () => {
    writeJsonFile('data.json', { a: 1 });
    writeJsonFile('data.json', { a: 2 });
    expect(await readJsonFile('data.json')).toEqual({ a: 2 });
  });

  it('round-trips arrays and nested structures', async () => {
    const payload = { list: [1, 2, { nested: true }], nil: null };
    writeJsonFile('nested.json', payload);
    expect(await readJsonFile('nested.json')).toEqual(payload);
  });
});
