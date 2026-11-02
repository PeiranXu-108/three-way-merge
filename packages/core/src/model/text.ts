/**
 * Text helpers: line endings and safe JSON formatting.
 */

export type Eol = '\n' | '\r\n';

/** Detect the line separator, preferring the primary text when it contains line breaks */
export const detectEol = (primary: string, secondary: string): Eol => {
  if (primary.includes('\n')) return primary.includes('\r\n') ? '\r\n' : '\n';
  return secondary.includes('\r\n') ? '\r\n' : '\n';
};

/** Convert CRLF / CR line breaks to LF */
export const normalizeEol = (text: string): string => text.replace(/\r\n?/g, '\n');

const TOKEN = /"(?:[^"\\]|\\.)*"|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/g;

/**
 * True when re-serialising the JSON text could change a number: integers beyond
 * `Number.MAX_SAFE_INTEGER`, or decimals with more than 15 significant digits.
 */
export const hasLossyNumbers = (json: string): boolean => {
  TOKEN.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = TOKEN.exec(json))) {
    const token = match[0];
    if (token[0] === '"') continue;
    if (!/[.eE]/.test(token)) {
      if (!Number.isSafeInteger(Number(token))) return true;
      continue;
    }
    const digits = token
      .replace(/^-/, '')
      .replace(/[eE].*$/, '')
      .replace('.', '')
      .replace(/^0+/, '');
    if (digits.length > 15) return true;
  }
  return false;
};

const parseJsonContainer = (text: string): unknown => {
  const trimmed = text.trim();
  if (!trimmed || (trimmed[0] !== '{' && trimmed[0] !== '[')) return undefined;
  try {
    return JSON.parse(trimmed);
  } catch {
    return undefined;
  }
};

/**
 * Pretty-print JSON objects/arrays with 2-space indentation (the legacy behaviour), but leave the
 * text untouched when it is empty, not an object/array, invalid, or would lose number precision.
 */
export const formatJsonSafe = (text: string): string => {
  const parsed = parseJsonContainer(text);
  if (parsed === undefined || hasLossyNumbers(text)) return text;
  return JSON.stringify(parsed, null, 2);
};

/** True when every non-empty input parses as a JSON object/array (and at least one is non-empty) */
export const looksLikeJson = (...texts: string[]): boolean => {
  const nonEmpty = texts.filter((t) => t.trim() !== '');
  return nonEmpty.length > 0 && nonEmpty.every((t) => parseJsonContainer(t) !== undefined);
};
