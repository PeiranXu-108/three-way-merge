import { newContent as jsonNew, oldContent as jsonOld } from './demoData';

export interface Sample {
  label: string;
  oldContent: string;
  newContent: string;
}

/** ~20k lines with a few percent of modified, removed and added lines */
const makeLarge = (count = 20000): Sample => {
  const oldLines: string[] = [];
  const newLines: string[] = [];
  for (let i = 0; i < count; i += 1) {
    const no = String(i + 1).padStart(5, '0');
    const line = `${no} const value${i} = compute(${i}, "item-${i % 97}");`;
    oldLines.push(line);
    if (i % 97 === 13) continue;
    newLines.push(i % 40 === 7 ? line.replace('compute(', 'computeFast(') : line);
    if (i % 151 === 50) newLines.push(`${no}+ // note added after value${i}`);
  }
  return {
    label: 'Large file (20k lines)',
    oldContent: `${oldLines.join('\n')}\n`,
    newContent: `${newLines.join('\n')}\n`,
  };
};

export const SAMPLES = {
  json: { label: 'JSON config', oldContent: jsonOld, newContent: jsonNew },
  large: makeLarge(),
  crlf: {
    label: 'CRLF text',
    oldContent: 'alpha\r\nbeta\r\ngamma\r\n',
    newContent: 'alpha\r\nBETA\r\ngamma\r\ndelta\r\n',
  },
  empty: { label: 'Empty left side', oldContent: '', newContent: 'first line\nsecond line\n' },
  blank: {
    label: 'Blank lines',
    oldContent: 'one\n\ntwo\n\nthree\n',
    newContent: 'one\n\n2\n\nthree\nfour\n',
  },
} satisfies Record<string, Sample>;

export type SampleKey = keyof typeof SAMPLES;

export const isSampleKey = (value: string | null): value is SampleKey => !!value && value in SAMPLES;
