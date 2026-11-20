const UNAMBIGUOUS_TEX_N_CMD =
  /^n(?:eq|otin|abla|cong|exists|mid|parallel|rightarrow|leftarrow|leftrightarrow|Rightarrow|Leftarrow|Leftrightarrow|leq|geq|less|gtr|sim|shortmid|shortparallel|succ|prec|subseteq|supseteq|vdash|vDash|Vdash|warrow|earrow|otag|onumber)$/;
const MATH_ONLY_TEX_N_CMD = /^n(?:e|i|u|ot|atural|ewline|ormalsize)$/;

const UNAMBIGUOUS_TEX_R_CMD =
  /^(?:r(?:ight(?:arrow|harpoonup|harpoondown|leftharpoons)?|angle|ceil|floor|ho|oot|ule|atio)|Rightarrow|Rho)$/;
const MATH_ONLY_TEX_R_CMD = /^rm$/;

const UNAMBIGUOUS_TEX_T_CMD =
  /^(?:t(?:imes|ext(?:bf|it|rm|tt|sf|normal)?|heta|au|anh?|riangle(?:down|left|right)?|herefore|frac|binom|hickapprox|hicksim|woheadrightarrow|ilde)|Theta)$/;
const MATH_ONLY_TEX_T_CMD = /^t(?:o|op|iny)$/;

const INLINE_TEX_N_AFTER_BS =
  /^(?:eq(?![a-zA-Z])|e(?![a-zA-Z])|otin(?![a-zA-Z])|ot(?![a-zA-Z])|u(?![a-zA-Z])|abla(?![a-zA-Z])|atural(?![a-zA-Z])|cong(?![a-zA-Z])|exists(?![a-zA-Z])|i(?![a-zA-Z])|mid(?![a-zA-Z])|parallel(?![a-zA-Z])|rightarrow(?![a-zA-Z])|leftarrow(?![a-zA-Z])|leftrightarrow(?![a-zA-Z])|Rightarrow(?![a-zA-Z])|Leftarrow(?![a-zA-Z])|Leftrightarrow(?![a-zA-Z])|leq(?![a-zA-Z])|geq(?![a-zA-Z])|less(?![a-zA-Z])|gtr(?![a-zA-Z])|sim(?![a-zA-Z])|shortmid(?![a-zA-Z])|shortparallel(?![a-zA-Z])|succ(?![a-zA-Z])|prec(?![a-zA-Z])|subseteq(?![a-zA-Z])|supseteq(?![a-zA-Z])|vdash(?![a-zA-Z])|vDash(?![a-zA-Z])|Vdash(?![a-zA-Z])|warrow(?![a-zA-Z])|earrow(?![a-zA-Z])|ewline(?![a-zA-Z])|ormalsize(?![a-zA-Z])|onumber(?![a-zA-Z])|otag(?![a-zA-Z]))/;

function isUnescapedLatexCommand(
  kind: 'n' | 'r' | 't',
  raw: string,
  backslashIdx: number,
  inMath: boolean,
): boolean {
  const wordMatch = raw.slice(backslashIdx + 1).match(/^[a-zA-Z]+/);
  if (!wordMatch) return false;
  const word = wordMatch[0];

  if (kind === 'n') {
    if (UNAMBIGUOUS_TEX_N_CMD.test(word)) return true;
    return inMath && MATH_ONLY_TEX_N_CMD.test(word);
  }
  if (kind === 'r') {
    if (UNAMBIGUOUS_TEX_R_CMD.test(word)) return true;
    return inMath && MATH_ONLY_TEX_R_CMD.test(word);
  }
  if (UNAMBIGUOUS_TEX_T_CMD.test(word)) return true;
  return inMath && MATH_ONLY_TEX_T_CMD.test(word);
}

/**
 * Converts stray literal `\n` / `\r\n` sequences that LLMs sometimes double-escape
 * inside Markdown prose back into real newlines, while leaving math spans,
 * fenced blocks, inline code, and LaTeX commands (`\neq`, `\nu`, etc.) intact.
 */
export function normalizeEscapedProseNewlines(text: string): string {
  if (!text || (!text.includes('\\n') && !text.includes('\\r'))) {
    return text;
  }

  const replaceEscapedChunk = (chunk: string, baseOffset: number): string =>
    chunk.replace(/\\r\\n|\\n/g, (match, localOffset: number) => {
      const offset = baseOffset + localOffset;
      const after = text.slice(offset + match.length);
      if (match === '\\n' && INLINE_TEX_N_AFTER_BS.test(after)) {
        return match;
      }

      const prevChar = offset > 0 ? text[offset - 1] : '';
      const nextChar = after[0] || '';
      if (offset === 0 || !after) {
        return '';
      }
      if (prevChar === '\n' || nextChar === '\n') {
        return '\n';
      }
      if (/^\s*(?:[|>]|\d+\.\s|[-*+]\s)/.test(after)) {
        return '\n';
      }
      return '\n\n';
    });

  const tokenRegex =
    /```[\s\S]*?```|`[^`\n]+`|\\\\|\\\$|\$\$[\s\S]*?\$\$|\\\[[\s\S]*?\\\]|\\\([\s\S]*?\\\)|\$[^$\n]+?\$|\\r\\n|\\n/g;

  return text
    .replace(tokenRegex, (token, offset: number) => {
      if (token.startsWith('$') && !token.startsWith('$$')) {
        // Guard against two currency signs on one line (`$5\nAnd $3`) masking a literal newline
        const inner = token.slice(1, -1);
        const replaced = replaceEscapedChunk(inner, offset + 1);
        if (replaced !== inner) {
          return '$' + replaced + '$';
        }
        return token;
      }

      if (token === '\\r\\n' || token === '\\n') {
        return replaceEscapedChunk(token, offset);
      }

      return token;
    })
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Sanitizes JSON text returned by LLMs (e.g. Gemini) before JSON.parse.
 *
 * Specifically handles:
 * 1. LaTeX backslashes inside math formulas (e.g. \frac, \times, \ge, \le, \cdot, \overline, \sqrt).
 *    JSON strictly disallows unescaped backslashes (\g, \c, \o, etc.) and misinterprets \f as formfeed
 *    and \t as tab when part of LaTeX commands like \frac or \times.
 * 2. Unescaped control characters (< 0x20) inside string literals (such as raw unescaped newlines or tabs).
 * 3. Trailing commas before ']' or '}'.
 * 4. Preserves legitimate JSON escape sequences (\", \\, \/, \uXXXX, and \n, \r, \t when not a LaTeX command).
 */
export function sanitizeJson(raw: string): string {
  let result = '';
  let inString = false;
  let inMath: 'inline' | 'display' | 'paren' | 'bracket' | null = null;
  let skipNextDollar = false;
  let i = 0;

  while (i < raw.length) {
    const ch = raw[i];

    if (!inString) {
      if (ch === '"') {
        inString = true;
        inMath = null;
        skipNextDollar = false;
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
      inMath = null;
      skipNextDollar = false;
      result += ch;
      i++;
      continue;
    }

    // Control characters (< 0x20) inside strings must be escaped in JSON
    if (ch.charCodeAt(0) < 32) {
      if (ch === '\n') {
        if (inMath === 'inline' && raw[i + 1] === '\n') {
          inMath = null;
        }
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

    if (ch === '$') {
      if (skipNextDollar) {
        skipNextDollar = false;
        result += ch;
        i++;
        continue;
      }
      if (raw[i + 1] === '$') {
        inMath =
          inMath === 'display' ? null : inMath === null ? 'display' : inMath;
        result += '$$';
        i += 2;
        continue;
      }
      if (inMath === 'inline') {
        inMath = null;
      } else if (inMath === null && raw[i + 1] && raw[i + 1] !== ' ') {
        inMath = 'inline';
      }
      result += ch;
      i++;
      continue;
    }

    skipNextDollar = false;

    if (ch === '\\') {
      const next = raw[i + 1];

      // Case 1: Escaped quote \"
      if (next === '"') {
        result += '\\"';
        i += 2;
        continue;
      }

      // Case 2: Already escaped backslash \\
      if (next === '\\') {
        const after = raw[i + 2];
        if (after === '$') {
          skipNextDollar = true;
        } else if (after === '[' && inMath === null) {
          inMath = 'bracket';
        } else if (after === ']' && inMath === 'bracket') {
          inMath = null;
        } else if (after === '(' && inMath === null) {
          inMath = 'paren';
        } else if (after === ')' && inMath === 'paren') {
          inMath = null;
        }
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

      // Track single-backslash LaTeX delimiters if LLM omitted JSON escaping
      if (next === '$') {
        result += '\\\\$';
        i += 2;
        continue;
      }
      if (next === '[') {
        if (inMath === null) inMath = 'bracket';
        result += '\\\\[';
        i += 2;
        continue;
      }
      if (next === ']') {
        if (inMath === 'bracket') inMath = null;
        result += '\\\\]';
        i += 2;
        continue;
      }
      if (next === '(') {
        if (inMath === null) inMath = 'paren';
        result += '\\\\(';
        i += 2;
        continue;
      }
      if (next === ')') {
        if (inMath === 'paren') inMath = null;
        result += '\\\\)';
        i += 2;
        continue;
      }

      // Case 5: Standard JSON control escapes \n, \r, \t.
      // Preserve real JSON escapes (like \nAdd, \nThis, \nLet's) unless the
      // following identifier is a known LaTeX command (like \neq, \times, \right).
      if (
        (next === 'n' || next === 'r' || next === 't') &&
        !isUnescapedLatexCommand(next, raw, i, inMath !== null)
      ) {
        if (next === 'n' && inMath === 'inline' && raw.slice(i + 2, i + 4) === '\\n') {
          inMath = null;
        }
        result += '\\' + next;
        i += 2;
        continue;
      }

      // Any other backslash (e.g. \frac, \times, \neq, \beta, \ge, \sqrt, etc.)
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

