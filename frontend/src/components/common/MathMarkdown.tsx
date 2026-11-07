import React, { useMemo } from "react";
import { View, Linking } from "react-native";
import { EnrichedMarkdownText } from "react-native-enriched-markdown";
import { FORTNITE_COLORS, FONTS } from "../../constants/theme";

interface MathMarkdownProps {
  content: string;
  style?: any;
  isFitted?: boolean;
  isOption?: boolean;
  bgColor?: string;
}

/**
 * Brightens math by forcing a specific KaTeX color.
 * This matches the logic used in QuestionCard for the game session.
 */
const brightenMath = (text: string) => {
  if (!text) return "";

  return (
    text
      // block math $$...$$
      .replace(/\$\$(.*?)\$\$/gs, (_, expr) => {
        return `$$\\color{#fab143}{${expr}}$$`;
      })
      // inline math $...$
      .replace(/\$(.*?)\$/g, (_, expr) => {
        return `$\\color{#fab143}{${expr}}$`;
      })
  );
};

export function MathMarkdown({
  content,
  style,
  isFitted,
  isOption = false,
  bgColor = "transparent",
}: MathMarkdownProps) {
  const processedMarkdown = useMemo(() => {
    return brightenMath(content);
  }, [content]);

  // Map the incoming style object to EnrichedMarkdownText's markdownStyle
  // We prioritize the properties passed in 'style' while providing sensible defaults
  const markdownStyle = useMemo(() => {
    const baseColor = style?.body?.color || style?.paragraph?.color || "#FFFFFF";
    const baseFontSize = style?.body?.fontSize || style?.paragraph?.fontSize || 15;
    const baseFontFamily = style?.body?.fontFamily || style?.paragraph?.fontFamily || FONTS.body;

    return {
      paragraph: {
        color: baseColor,
        fontSize: baseFontSize,
        fontFamily: baseFontFamily,
        marginBottom: 8,
        lineHeight: baseFontSize * 1.5,
        textAlign: isFitted ? ("center" as const) : ("left" as const),
        ...(style?.paragraph || {}),
      },
      h1: {
        color: "#FFFFFF",
        fontSize: baseFontSize + 8,
        fontWeight: "700" as const,
        marginBottom: 8,
        marginTop: 12,
        ...(style?.h1 || {}),
      },
      h2: {
        color: "#FFFFFF",
        fontSize: baseFontSize + 6,
        fontWeight: "700" as const,
        marginBottom: 8,
        marginTop: 10,
        ...(style?.h2 || {}),
      },
      h3: {
        color: "#E2D9F3",
        fontSize: baseFontSize + 4,
        fontWeight: "600" as const,
        marginBottom: 6,
        marginTop: 8,
        ...(style?.h3 || {}),
      },
      strong: {
        color: "#FFFFFF",
        fontWeight: "bold" as const,
        fontFamily: FONTS.bodyBold,
        ...(style?.strong || {}),
      },
      em: {
        color: "#FFFFFF",
        fontStyle: "italic" as const,
        fontFamily: baseFontFamily,
        ...(style?.em || {}),
      },
      list: {
        color: "#FFFFFF",
        bulletColor: "#A78BFA",
        markerColor: "#A78BFA",
        fontSize: baseFontSize,
        lineHeight: baseFontSize * 1.5,
        marginBottom: 8,
        marginLeft: 16,
        gapWidth: 8,
        ...(style?.list || {}),
      },
      listItem: {
        color: "#FFFFFF",
        marginBottom: 4,
        ...(style?.listItem || {}),
      },
      code: {
        backgroundColor: "rgba(255, 255, 255, 0.12)",
        color: "#A78BFA",
        borderRadius: 4,
        paddingHorizontal: 4,
        fontSize: baseFontSize - 1,
        ...(style?.code || {}),
      },
      codeBlock: {
        backgroundColor: "#0D0B14",
        borderColor: "#2D233D",
        borderRadius: 8,
        borderWidth: 1,
        padding: 10,
        marginVertical: 6,
        color: "#A78BFA",
        fontSize: baseFontSize - 1,
        ...(style?.codeBlock || {}),
      },
      blockquote: {
        borderLeftWidth: 3,
        borderLeftColor: "#6C5CE7",
        paddingLeft: 10,
        marginVertical: 6,
        color: "#D4C5E4",
        backgroundColor: "transparent",
        gapWidth: 10,
        ...(style?.blockquote || {}),
      },
      link: {
        color: "#A78BFA",
        underline: true,
        ...(style?.link || {}),
      },
      math: {
        color: "#fab143",
        backgroundColor: "transparent",
        fontSize: baseFontSize + 2,
        textAlign: "center" as const,
        marginBottom: 8,
        marginTop: 4,
        ...(style?.math || {}),
      },
      inlineMath: {
        color: "#fab143",
        ...(style?.inlineMath || {}),
      },
    };
  }, [style, isFitted]);

  if (!content) return null;

  return (
    <View style={{ width: "100%", backgroundColor: bgColor }}>
      <EnrichedMarkdownText
        flavor="github"
        markdown={processedMarkdown}
        onLinkPress={({ url }) => Linking.openURL(url)}
        markdownStyle={markdownStyle}
      />
    </View>
  );
}
