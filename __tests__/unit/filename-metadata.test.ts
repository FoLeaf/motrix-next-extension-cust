import { describe, expect, it } from 'vitest';
import { DownloadFilenameMetadataStore } from '@/lib/download/filename-metadata';

describe('DownloadFilenameMetadataStore', () => {
  it('resolves a browser-determined Cyrillic filename by download id', async () => {
    const store = new DownloadFilenameMetadataStore(() => 1_000);
    store.rememberDeterminedFilename({
      id: 7,
      url: 'https://mail-attachment.googleusercontent.com/attachment/u/0/',
      filename: 'ИТОГИ ЛДУ 2026.xlsx',
    });

    await expect(
      store.resolve(
        {
          id: 7,
          url: 'https://mail-attachment.googleusercontent.com/attachment/u/0/',
        },
        0,
      ),
    ).resolves.toEqual({
      filename: 'ИТОГИ ЛДУ 2026.xlsx',
      source: 'determining-filename',
    });
  });

  it('resolves RFC 2047 Content-Disposition metadata by URL', async () => {
    const store = new DownloadFilenameMetadataStore(() => 1_000);
    const url = 'https://mail-attachment.googleusercontent.com/attachment/u/0/?ui=2&disp=safe';
    store.rememberContentDisposition(
      url,
      'attachment; filename="=?UTF-8?B?0JjQotCe0JPQmCDQm9CU0KMgMjAyNi54bHN4?="',
    );

    await expect(
      store.resolve(
        {
          id: 8,
          url,
        },
        0,
      ),
    ).resolves.toEqual({
      filename: 'ИТОГИ ЛДУ 2026.xlsx',
      source: 'content-disposition',
    });
  });

  it('prefers Content-Disposition metadata over browser placeholder filenames', async () => {
    const store = new DownloadFilenameMetadataStore(() => 1_000);
    const url = 'https://mail-attachment.googleusercontent.com/attachment/u/0/?ui=2&disp=safe';
    store.rememberDeterminedFilename({
      id: 9,
      url,
      filename: '0.xlsx',
    });
    store.rememberContentDisposition(
      url,
      'attachment; filename="=?UTF-8?B?0JjQotCe0JPQmCDQm9CU0KMgMjAyNi54bHN4?="',
    );

    await expect(
      store.resolve(
        {
          id: 9,
          url,
        },
        0,
      ),
    ).resolves.toEqual({
      filename: 'ИТОГИ ЛДУ 2026.xlsx',
      source: 'content-disposition',
    });
  });

  it('ignores generic browser placeholder filenames', async () => {
    const store = new DownloadFilenameMetadataStore(() => 1_000);
    store.rememberDeterminedFilename({
      id: 9,
      url: 'https://mail-attachment.googleusercontent.com/attachment/u/0/',
      filename: 'download',
    });

    await expect(
      store.resolve(
        {
          id: 9,
          url: 'https://mail-attachment.googleusercontent.com/attachment/u/0/',
        },
        0,
      ),
    ).resolves.toBeUndefined();
  });

  it('waits briefly for metadata that arrives after onCreated', async () => {
    const store = new DownloadFilenameMetadataStore();
    const promise = store.resolve(
      {
        id: 10,
        url: 'https://mail-attachment.googleusercontent.com/attachment/u/0/',
      },
      100,
    );

    setTimeout(() => {
      store.rememberDeterminedFilename({
        id: 10,
        url: 'https://mail-attachment.googleusercontent.com/attachment/u/0/',
        filename: 'ИТОГИ ЛДУ 2026.xlsx',
      });
    }, 10);

    await expect(promise).resolves.toEqual({
      filename: 'ИТОГИ ЛДУ 2026.xlsx',
      source: 'determining-filename',
    });
  });
});
