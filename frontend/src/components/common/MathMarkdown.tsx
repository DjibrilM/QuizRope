import React, { useMemo } from "react";
import { StyleSheet, Text, View, Linking } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { EnrichedMarkdownText } from "react-native-enriched-markdown";
import { FONTS, UI_COLORS } from "../../constants/theme";
import {
  HomeworkDiagram,
  parseDiagramSpec,
  type HomeworkDiagramSpec,
} from "./HomeworkDiagram";

interface MathMarkdownProps {
  content: string;
  style?: any;
  isFitted?: boolean;
  isOption?: boolean;
  bgColor?: string;
  depth?: number;
}

type CalloutKind = "idea" | "tip" | "watchout" | "check" | "example";

interface CalloutTheme {
  accent: string;
  bg: string;
  border: string;
  icon: keyof typeof Ionicons.glyphMap;
  titleKey: string;
  defaultTitle: string;
}

const CALLOUT_THEMES: Record<CalloutKind, CalloutTheme> = {
  idea: {
    accent: "#A78BFA",
    bg: "rgba(167, 139, 250, 0.10)",
    border: "rgba(167, 139, 250, 0.34)",
    icon: "bulb",
    titleKey: "session.callouts.idea",
    defaultTitle: "Big Idea",
  },
  tip: {
    accent: "#34D399",
    bg: "rgba(52, 211, 153, 0.10)",
    border: "rgba(52, 211, 153, 0.34)",
    icon: "sparkles",
    titleKey: "session.callouts.tip",
    defaultTitle: "Helpful Tip",
  },
  watchout: {
    accent: "#FBBF24",
    bg: "rgba(251, 191, 36, 0.10)",
    border: "rgba(251, 191, 36, 0.34)",
    icon: "alert-circle",
    titleKey: "session.callouts.watchout",
    defaultTitle: "Watch Out!",
  },
  check: {
    accent: "#60A5FA",
    bg: "rgba(96, 165, 250, 0.10)",
    border: "rgba(96, 165, 250, 0.34)",
    icon: "checkmark-circle",
    titleKey: "session.callouts.check",
    defaultTitle: "Check Your Work",
  },
  example: {
    accent: "#F472B6",
    bg: "rgba(244, 114, 182, 0.10)",
    border: "rgba(244, 114, 182, 0.34)",
    icon: "rocket",
    titleKey: "session.callouts.example",
    defaultTitle: "Example",
  },
};

function mapCalloutTag(rawTag: string): CalloutKind {
  const upper = rawTag.trim().toUpperCase();
  if (upper === "TIP" || upper === "TRICK" || upper === "HINT") return "tip";
  if (
    upper === "WATCHOUT" ||
    upper === "WARNING" ||
    upper === "MISTAKE" ||
    upper === "CAUTION"
  ) {
    return "watchout";
  }
  if (upper === "CHECK" || upper === "SUMMARY" || upper === "RECAP") {
    return "check";
  }
  if (upper === "EXAMPLE" || upper === "ANALOGY" || upper === "TRY") {
    return "example";
  }
  return "idea";
}

type ContentSegment =
  | { kind: "markdown"; text: string }
  | { kind: "diagram"; spec: HomeworkDiagramSpec }
  | { kind: "callout"; variant: CalloutKind; title?: string; body: string };

const TEX_N_CMD_AFTER_BS =
  /^(?:eq(?![a-zA-Z])|e(?![a-zA-Z])|otin(?![a-zA-Z])|ot(?![a-zA-Z])|u(?![a-zA-Z])|abla(?![a-zA-Z])|atural(?![a-zA-Z])|cong(?![a-zA-Z])|exists(?![a-zA-Z])|i(?![a-zA-Z])|mid(?![a-zA-Z])|parallel(?![a-zA-Z])|rightarrow(?![a-zA-Z])|leftarrow(?![a-zA-Z])|leftrightarrow(?![a-zA-Z])|Rightarrow(?![a-zA-Z])|Leftarrow(?![a-zA-Z])|Leftrightarrow(?![a-zA-Z])|leq(?![a-zA-Z])|geq(?![a-zA-Z])|less(?![a-zA-Z])|gtr(?![a-zA-Z])|sim(?![a-zA-Z])|shortmid(?![a-zA-Z])|shortparallel(?![a-zA-Z])|succ(?![a-zA-Z])|prec(?![a-zA-Z])|subseteq(?![a-zA-Z])|supseteq(?![a-zA-Z])|vdash(?![a-zA-Z])|vDash(?![a-zA-Z])|Vdash(?![a-zA-Z])|warrow(?![a-zA-Z])|earrow(?![a-zA-Z])|ewline(?![a-zA-Z])|ormalsize(?![a-zA-Z])|onumber(?![a-zA-Z])|otag(?![a-zA-Z]))/;

/**
 * Converts stray literal `\n` / `\r\n` sequences in Markdown prose back into real
 * newlines while preserving math spans, code blocks, and LaTeX `\n*` commands.
 */
function normalizeEscapedNewlines(text: string): string {
  if (!text || (!text.includes("\\n") && !text.includes("\\r"))) {
    return text;
  }

  const replaceEscapedChunk = (chunk: string, baseOffset: number): string =>
    chunk.replace(/\\r\\n|\\n/g, (match, localOffset: number) => {
      const offset = baseOffset + localOffset;
      const after = text.slice(offset + match.length);
      if (match === "\\n" && TEX_N_CMD_AFTER_BS.test(after)) {
        return match;
      }

      const prevChar = offset > 0 ? text[offset - 1] : "";
      const nextChar = after[0] || "";
      if (offset === 0 || !after) {
        return "";
      }
      if (prevChar === "\n" || nextChar === "\n") {
        return "\n";
      }
      if (/^\s*(?:[|>]|\d+\.\s|[-*+]\s)/.test(after)) {
        return "\n";
      }
      return "\n\n";
    });

  const tokenRegex =
    /```[\s\S]*?```|`[^`\n]+`|\\\\|\\\$|\$\$[\s\S]*?\$\$|\\\[[\s\S]*?\\\]|\\\([\s\S]*?\\\)|\$[^$\n]+?\$|\\r\\n|\\n/g;

  return text
    .replace(tokenRegex, (token, offset: number) => {
      if (token.startsWith("$") && !token.startsWith("$$")) {
        const inner = token.slice(1, -1);
        const replaced = replaceEscapedChunk(inner, offset + 1);
        if (replaced !== inner) {
          return "$" + replaced + "$";
        }
        return token;
      }

      if (token === "\\r\\n" || token === "\\n") {
        return replaceEscapedChunk(token, offset);
      }

      return token;
    })
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Splits rich homework markdown into standard markdown chunks, structured diagrams/SVGs,
 * and kid-friendly pedagogical callout blocks.
 */
function parseRichSegments(raw: string, allowCallouts: boolean): ContentSegment[] {
  if (!raw) return [];

  const normalized = normalizeEscapedNewlines(raw);
  const lines = normalized.split(/\r?\n/);
  const stage1: ContentSegment[] = [];
  let mdBuffer: string[] = [];

  const flushMd = () => {
    const joined = mdBuffer.join("\n").trim();
    if (joined) stage1.push({ kind: "markdown", text: joined });
    mdBuffer = [];
  };

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const fenceMatch = line.match(/^\s{0,3}```(diagram|svg)\s*$/i);
    if (fenceMatch) {
      const lang = fenceMatch[1].toLowerCase();
      flushMd();
      const blockLines: string[] = [];
      i++;
      while (i < lines.length && !/^\s{0,3}```\s*$/.test(lines[i])) {
        blockLines.push(lines[i]);
        i++;
      }
      if (i < lines.length) i++; // consume closing ```

      const payload = blockLines.join("\n").trim();
      const spec =
        lang === "svg"
          ? ({ type: "svg", svg: payload } as HomeworkDiagramSpec)
          : parseDiagramSpec(payload);

      if (spec) {
        stage1.push({ kind: "diagram", spec });
      }
      continue;
    }

    mdBuffer.push(line);
    i++;
  }
  flushMd();

  if (!allowCallouts) return stage1;

  // Extract > [!TAG] callouts from markdown chunks
  const finalSegments: ContentSegment[] = [];
  for (const seg of stage1) {
    if (seg.kind !== "markdown") {
      finalSegments.push(seg);
      continue;
    }

    const segLines = seg.text.split("\n");
    let plainBuf: string[] = [];
    const flushPlain = () => {
      const joined = plainBuf.join("\n").trim();
      if (joined) finalSegments.push({ kind: "markdown", text: joined });
      plainBuf = [];
    };

    let idx = 0;
    while (idx < segLines.length) {
      const calloutStart = segLines[idx].match(
        /^\s*>\s*\[!([A-Za-z_]+)\](?:\s+(.*))?$/,
      );
      if (calloutStart) {
        flushPlain();
        const variant = mapCalloutTag(calloutStart[1]);
        const inlineRest = calloutStart[2]?.trim() || "";
        const bodyLines: string[] = [];
        idx++;
        while (idx < segLines.length && /^\s*>/.test(segLines[idx])) {
          bodyLines.push(segLines[idx].replace(/^\s*>\s?/, ""));
          idx++;
        }
        let customTitle: string | undefined;
        let body = bodyLines.join("\n").trim();

        if (!body && inlineRest) {
          const splitMatch = inlineRest.match(
            /^([^:—\n]{2,44}?)\s*(?:—|:)\s+([\s\S]+)$/,
          );
          if (splitMatch) {
            customTitle = splitMatch[1].trim();
            body = splitMatch[2].trim();
          } else if (inlineRest.length > 48) {
            body = inlineRest;
          } else {
            customTitle = inlineRest;
          }
        } else if (inlineRest) {
          customTitle = inlineRest;
        }

        if (body || customTitle) {
          finalSegments.push({
            kind: "callout",
            variant,
            title: customTitle,
            body,
          });
        }
        continue;
      }

      plainBuf.push(segLines[idx]);
      idx++;
    }
    flushPlain();
  }

  return finalSegments;
}

/**
 * Strips fenced diagram/SVG JSON payloads into readable labels before copying to clipboard.
 */
export function formatCopyableMarkdown(raw: string): string {
  if (!raw) return "";
  return normalizeEscapedNewlines(raw)
    .replace(/```diagram\s*([\s\S]*?)```/gi, (_, jsonStr) => {
      const parsed = parseDiagramSpec(jsonStr);
      return parsed?.title ? `[Diagram: ${parsed.title}]` : "[Diagram]";
    })
    .replace(/```svg[\s\S]*?```/gi, "[Illustration]")
    .replace(/^\s*>\s*\[![A-Za-z_]+\]\s*/gm, "> ")
    .trim();
}

function CalloutCard({
  variant,
  title,
  body,
  mdStyle,
  depth,
}: {
  variant: CalloutKind;
  title?: string;
  body: string;
  mdStyle?: any;
  depth: number;
}) {
  const { t } = useTranslation("homework");
  const theme = CALLOUT_THEMES[variant];
  const resolvedTitle =
    title || t(theme.titleKey, { defaultValue: theme.defaultTitle });

  return (
    <View style={[calloutStyles.card, { backgroundColor: theme.bg }]}>
      <View style={calloutStyles.header}>
        <View
          style={[
            calloutStyles.iconWrap,
            { backgroundColor: `${theme.accent}24` },
          ]}
        >
          <Ionicons name={theme.icon} size={15} color={theme.accent} />
        </View>
        <Text style={[calloutStyles.title, { color: theme.accent }]}>
          {resolvedTitle}
        </Text>
      </View>

      {body ? (
        <MathMarkdown
          content={body}
          style={mdStyle}
          depth={depth + 1}
        />
      ) : null}
    </View>
  );
}

/**
 * Normalizes alternate LaTeX delimiters and wraps math expressions with explicit color.
 */
export function formatMathMarkdown(
  text: string,
  mathColor = "#FFFFFF",
  options?: { isolateBlocks?: boolean },
): string {
  if (!text) return "";

  const isolateBlocks = options?.isolateBlocks ?? false;
  const wrapExpr = (expr: string) => {
    const trimmed = expr.trim();
    if (!trimmed) return "";
    if (/^\\color\{/.test(trimmed)) return trimmed;
    return `\\color{${mathColor}}{${trimmed}}`;
  };

  return normalizeEscapedNewlines(text)
    .replace(/\\\[([\s\S]*?)\\\]/g, (_, expr) => `\n\n$$${expr.trim()}$$\n\n`)
    .replace(/\\\(([\s\S]*?)\\\)/g, (_, expr) => `$${expr.trim()}$`)
    .replace(/\$\$([\s\S]*?)\$\$|\$([^$\n]+?)\$/g, (_, blockExpr, inlineExpr) => {
      if (blockExpr !== undefined) {
        const wrapped = wrapExpr(blockExpr);
        if (!wrapped) return "";
        return isolateBlocks ? `\n\n$$${wrapped}$$\n\n` : `$$${wrapped}$$`;
      }
      const wrapped = wrapExpr(inlineExpr);
      return wrapped ? `$${wrapped}$` : "";
    })
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function MathMarkdown({
  content,
  style,
  isFitted,
  isOption = false,
  bgColor = "transparent",
  depth = 0,
}: MathMarkdownProps) {
  void isOption;
  const mathColor = style?.math?.color || style?.body?.color || "#FFFFFF";

  const segments = useMemo(
    () => parseRichSegments(content, depth === 0),
    [content, depth],
  );

  // Map incoming style to complete matte-obsidian defaults for EnrichedMarkdownText
  const markdownStyle = useMemo(() => {
    const baseColor = style?.body?.color || style?.paragraph?.color || "#FFFFFF";
    const baseFontSize =
      style?.body?.fontSize || style?.paragraph?.fontSize || 15;
    const baseFontFamily =
      style?.body?.fontFamily || style?.paragraph?.fontFamily || FONTS.body;

    return {
      paragraph: {
        color: baseColor,
        fontSize: baseFontSize,
        fontFamily: baseFontFamily,
        marginBottom: 8,
        lineHeight: baseFontSize * 1.55,
        textAlign: isFitted ? ("center" as const) : ("left" as const),
        ...(style?.paragraph || {}),
      },
      h1: {
        color: "#FFFFFF",
        fontSize: baseFontSize + 7,
        fontWeight: "700" as const,
        fontFamily: FONTS.bodyExtraBold,
        marginBottom: 8,
        marginTop: 12,
        ...(style?.h1 || {}),
      },
      h2: {
        color: "#FFFFFF",
        fontSize: baseFontSize + 4.5,
        fontWeight: "700" as const,
        fontFamily: FONTS.bodyBold,
        marginBottom: 8,
        marginTop: 12,
        ...(style?.h2 || {}),
      },
      h3: {
        color: "#E2D9F3",
        fontSize: baseFontSize + 2,
        fontWeight: "700" as const,
        fontFamily: FONTS.bodyBold,
        marginBottom: 6,
        marginTop: 10,
        ...(style?.h3 || {}),
      },
      strong: {
        color: "#FFFFFF",
        fontWeight: "bold" as const,
        fontFamily: FONTS.bodyBold,
        ...(style?.strong || {}),
      },
      em: {
        color: "#E2D9F3",
        fontStyle: "italic" as const,
        fontFamily: baseFontFamily,
        ...(style?.em || {}),
      },
      list: {
        color: baseColor,
        bulletColor: "#A78BFA",
        markerColor: "#A78BFA",
        fontSize: baseFontSize,
        lineHeight: baseFontSize * 1.55,
        marginBottom: 10,
        marginLeft: 18,
        gapWidth: 8,
        ...(style?.list || {}),
      },
      code: {
        backgroundColor: "rgba(255, 255, 255, 0.12)",
        color: "#E2D9F3",
        fontSize: baseFontSize - 1,
        ...(style?.code || {}),
      },
      codeBlock: {
        backgroundColor: "#0D0B14",
        borderColor: "rgba(255, 255, 255, 0.09)",
        borderRadius: 12,
        borderWidth: 1,
        padding: 12,
        marginVertical: 8,
        color: "#E2D9F3",
        fontSize: baseFontSize - 1.5,
        ...(style?.codeBlock || {}),
      },
      blockquote: {
        borderColor: "rgba(167, 139, 250, 0.35)",
        borderWidth: 2,
        gapWidth: 12,
        backgroundColor: "rgba(167, 139, 250, 0.08)",
        color: "#E2D9F3",
        fontSize: baseFontSize,
        fontFamily: baseFontFamily,
        lineHeight: baseFontSize * 1.5,
        marginTop: 4,
        marginBottom: 12,
        ...(style?.blockquote || {}),
      },
      table: {
        fontSize: Math.max(12.5, baseFontSize - 1.5),
        fontFamily: baseFontFamily,
        color: UI_COLORS.textPrimary,
        lineHeight: Math.max(18, (baseFontSize - 1) * 1.4),
        headerFontFamily: FONTS.bodyBold,
        headerBackgroundColor: "#241C36",
        headerTextColor: "#FFFFFF",
        rowEvenBackgroundColor: "#141020",
        rowOddBackgroundColor: "#1B1629",
        borderColor: "rgba(255, 255, 255, 0.10)",
        borderWidth: 1,
        borderRadius: 12,
        cellPaddingHorizontal: 10,
        cellPaddingVertical: 8,
        marginTop: 6,
        marginBottom: 14,
        ...(style?.table || {}),
      },
      thematicBreak: {
        color: "rgba(255, 255, 255, 0.09)",
        height: 1,
        marginTop: 14,
        marginBottom: 14,
        ...(style?.thematicBreak || {}),
      },
      taskList: {
        checkedColor: UI_COLORS.mint,
        borderColor: "rgba(255, 255, 255, 0.30)",
        checkboxSize: 15,
        checkboxBorderRadius: 4,
        checkmarkColor: "#0D0B14",
        checkedTextColor: UI_COLORS.textSecondary,
        checkedStrikethrough: false,
        ...(style?.taskList || {}),
      },
      link: {
        color: "#A78BFA",
        underline: true,
        ...(style?.link || {}),
      },
      math: {
        color: mathColor,
        backgroundColor: "transparent",
        fontSize: baseFontSize + 2,
        textAlign: "center" as const,
        marginBottom: 12,
        marginTop: 6,
        padding: 4,
        ...(style?.math || {}),
      },
      inlineMath: {
        color: mathColor,
        ...(style?.inlineMath || {}),
      },
    };
  }, [style, isFitted, mathColor]);

  if (!content) return null;

  return (
    <View style={{ width: "100%", backgroundColor: bgColor }}>
      {segments.map((seg, idx) => {
        if (seg.kind === "diagram") {
          return <HomeworkDiagram key={`diag-${idx}`} spec={seg.spec} />;
        }
        if (seg.kind === "callout") {
          return (
            <CalloutCard
              key={`call-${idx}`}
              variant={seg.variant}
              title={seg.title}
              body={seg.body}
              mdStyle={style}
              depth={depth}
            />
          );
        }

        const formatted = formatMathMarkdown(seg.text, mathColor, {
          isolateBlocks: true,
        });
        if (!formatted) return null;

        return (
          <EnrichedMarkdownText
            key={`md-${idx}`}
            flavor="github"
            markdown={formatted}
            onLinkPress={({ url }) => Linking.openURL(url)}
            markdownStyle={markdownStyle}
          />
        );
      })}
    </View>
  );
}

const calloutStyles = StyleSheet.create({
  card: {
    borderRadius: 18,
    borderCurve: "continuous",
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginVertical: 8,
    gap: 8,
    width: "100%",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  iconWrap: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    flex: 1,
    fontFamily: FONTS.bodyExtraBold,
    fontSize: 13.5,
    lineHeight: 19,
    letterSpacing: 0.2,
  },
});
