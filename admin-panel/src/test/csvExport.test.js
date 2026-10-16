// Runtime validation coverage for CSV serialization and browser download setup.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { dateRangeMatches, downloadCsv, formatDateLabel } from '../utils/csvExport.js';

function readBlob(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(new TextDecoder('utf-8', { ignoreBOM: true }).decode(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(blob);
  });
}

describe('CSV serialization', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('writes headers, Unicode, commas, quotes, and line breaks as escaped CSV fields', async () => {
    let downloadedBlob;
    const urlApi = {
      createObjectURL: vi.fn((blob) => {
        downloadedBlob = blob;
        return 'blob:csv-test';
      }),
      revokeObjectURL: vi.fn(),
    };
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function clickAnchor() {
      expect(this.download).toBe('records.csv');
      expect(this.href).toMatch(/^blob:/);
    });
    vi.stubGlobal('URL', urlApi);
    vi.spyOn(window, 'setTimeout').mockImplementation((callback) => {
      callback();
      return 1;
    });

    downloadCsv('records.csv', [
      { label: 'Name', value: (row) => row.name },
      { label: 'Details', value: (row) => row.details },
      { label: 'Amount', value: (row) => row.amount },
    ], [
      { name: 'Mira, "M"', details: 'Line one\nLine two — ₹', amount: -12.5 },
    ]);

    const csv = await readBlob(downloadedBlob);
    expect(csv.charCodeAt(0)).toBe(0xFEFF);
    expect(csv).toContain('"Name","Details","Amount"');
    expect(csv).toContain('"Mira, ""M"""');
    expect(csv).toContain('"Line one\nLine two — ₹"');
    expect(csv).toContain('"-12.5"');
    expect(click).toHaveBeenCalledOnce();
    expect(urlApi.revokeObjectURL).toHaveBeenCalledWith('blob:csv-test');
  });

  it('escapes formula-leading text while leaving numeric negatives intact', async () => {
    let blob;
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    vi.stubGlobal('URL', {
      createObjectURL: vi.fn((value) => {
        blob = value;
        return 'blob:formula-test';
      }),
      revokeObjectURL: vi.fn(),
    });
    vi.spyOn(window, 'setTimeout').mockImplementation(() => 1);
    downloadCsv('safe.csv', [
      { label: 'Text', value: (row) => row.text },
      { label: 'Number', value: (row) => row.number },
    ], [
      { text: '  =1+1', number: -99 },
      { text: '+cmd', number: 10 },
      { text: '@value', number: 2 },
    ]);
    const csv = await readBlob(blob);
    expect(csv).toContain("\"'  =1+1\"");
    expect(csv).toContain("\"'+cmd\"");
    expect(csv).toContain("\"'@value\"");
    expect(csv).toContain('"-99"');
  });

  it('applies inclusive ISO date boundaries and formats date labels', () => {
    expect(dateRangeMatches('2026-10-15', '2026-10-15', '2026-10-15')).toBe(true);
    expect(dateRangeMatches('2026-10-14', '2026-10-15', '')).toBe(false);
    expect(formatDateLabel('2026-10-15')).toMatch(/15 Oct 2026/);
    expect(formatDateLabel('')).toBe('—');
  });
});
