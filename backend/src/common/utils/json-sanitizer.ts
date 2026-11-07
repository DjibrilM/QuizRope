/**
 * Sanitizes JSON text returned by LLMs (e.g. Gemini) before JSON.parse.
 *
 * Specifically handles:
 * 1. LaTeX backslashes inside math formulas (e.g. \frac, \times, \ge, \le, \cdot, \overline, \sqrt).
 *    JSON strictly disallows unescaped backslashes (\g, \c, \o, etc.) and misinterprets \f as formfeed
 *    and \t as tab when part of LaTeX commands like \frac or \times.
 * 2. Unescaped control characters (< 0x20) inside string literals (such as raw unescaped newlines or tabs).
 * 3. Trailing commas before ']' or '}'.
 * 4. Preserves legitimate JSON escape sequences (\", \\, \/, \uXXXX, and \n, \r, \t when not part of LaTeX commands).
 */
export function sanitizeJson(raw: string): string {
  let result = '';
  let inString = false;
  let i = 0;

  while (i < raw.length) {
    const ch = raw[i];

    if (!inString) {
      if (ch === '"') {
        inString = true;
        result += ch;
        i++;
      } else if (ch === ',') {
        // Peek ahead to strip trailing commas before ']' or '}'
        let j = i + 1;
        while (
          j < raw.length &&
          (raw[j] === ' ' || raw[j] === '\t' || raw[j] === '\n' || raw[j] === '\r')
        ) {
          j++;
        }
        if (j < raw.length && (raw[j] === ']' || raw[j] === '}')) {
          i++; // Skip trailing comma
        } else {
          result += ch;
          i++;
        }
      } else {
        result += ch;
        i++;
      }
      continue;
    }

    // Inside a string literal
    if (ch === '"') {
      inString = false;
      result += ch;
      i++;
      continue;
    }

    // Control characters (< 0x20) inside strings must be escaped in JSON
    if (ch.charCodeAt(0) < 32) {
      if (ch === '\n') {
        result += '\\n';
      } else if (ch === '\r') {
        result += '\\r';
      } else if (ch === '\t') {
        result += '\\t';
      } else if (ch === '\b') {
        result += '\\b';
      } else if (ch === '\f') {
        result += '\\f';
      } else {
        result += '\\u' + ch.charCodeAt(0).toString(16).padStart(4, '0');
      }
      i++;
      continue;
    }

    if (ch === '\\') {
      const next = raw[i + 1];
      const afterNext = raw[i + 2];

      // Case 1: Escaped quote \"
      if (next === '"') {
        result += '\\"';
        i += 2;
        continue;
      }

      // Case 2: Already escaped backslash \\
      if (next === '\\') {
        result += '\\\\';
        i += 2;
        continue;
      }

      // Case 3: \/
      if (next === '/') {
        result += '\\/';
        i += 2;
        continue;
      }

      // Case 4: Unicode escape \uXXXX
      if (next === 'u' && /^[0-9a-fA-F]{4}$/.test(raw.slice(i + 2, i + 6))) {
        result += raw.slice(i, i + 6);
        i += 6;
        continue;
      }

      // Case 5: Standard JSON control escapes \n, \r, \t
      // If followed by letters (e.g. \times, \frac, \neq, \right, \text), it's a LaTeX command!
      // In that case, double the backslash so KaTeX/math renders it correctly!
      if (next === 'n' && (!afterNext || !/[a-zA-Z]/.test(afterNext))) {
        result += '\\n';
        i += 2;
        continue;
      }
      if (next === 'r' && (!afterNext || !/[a-zA-Z]/.test(afterNext))) {
        result += '\\r';
        i += 2;
        continue;
      }
      if (next === 't' && (!afterNext || !/[a-zA-Z]/.test(afterNext))) {
        result += '\\t';
        i += 2;
        continue;
      }

      // Any other backslash (e.g. \frac, \times, \ge, \le, \cdot, \overline, \sqrt, \pm, \alpha, etc.)
      // Double the backslash so JSON.parse receives valid \\
      result += '\\\\';
      i += 1;
      continue;
    }

    result += ch;
    i++;
  }

  return result;
}

