import { describe, expect, it } from 'vitest';
import { DownloadFilenameMetadataStore } from '@/lib/download/filename-metadata';

describe('DownloadFilenameMetadataStore', () => {
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
          url,
        },
        0,
      ),
    ).resolves.toEqual({
      filename: 'ИТОГИ ЛДУ 2026.xlsx',
      source: 'content-disposition',
    });
  });

  it('waits briefly for metadata that arrives after onCreated', async () => {
    const store = new DownloadFilenameMetadataStore();
    const url = 'https://mail-attachment.googleusercontent.com/attachment/u/0/';
    const promise = store.resolve(
      {
        url,
      },
      100,
    );

    setTimeout(() => {
      store.rememberContentDisposition(
        url,
        'attachment; filename="=?UTF-8?B?0JjQotCe0JPQmCDQm9CU0KMgMjAyNi54bHN4?="',
      );
    }, 10);

    await expect(promise).resolves.toEqual({
      filename: 'ИТОГИ ЛДУ 2026.xlsx',
      source: 'content-disposition',
    });
  });
});
