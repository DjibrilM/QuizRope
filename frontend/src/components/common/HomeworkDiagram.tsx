import React, { useMemo, useState } from "react";
import {
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import Svg, {
  Circle,
  Defs,
  G,
  Line,
  Marker,
  Path,
  Polygon,
  Rect,
  SvgXml,
  TSpan,
  Text as SvgText,
} from "react-native-svg";
import { FONTS, UI_COLORS, UI_RADII } from "../../constants/theme";
import { hapticsService } from "../../services/haptics";

export type DiagramAccent =
  | "purple"
  | "mint"
  | "blue"
  | "amber"
  | "pink"
  | "red";

interface AccentStyle {
  solid: string;
  tint: string;
  border: string;
}

const ACCENTS: Record<DiagramAccent, AccentStyle> = {
  purple: {
    solid: "#A78BFA",
    tint: "rgba(167, 139, 250, 0.16)",
    border: "rgba(167, 139, 250, 0.42)",
  },
  mint: {
    solid: "#34D399",
    tint: "rgba(52, 211, 153, 0.15)",
    border: "rgba(52, 211, 153, 0.40)",
  },
  blue: {
    solid: "#60A5FA",
    tint: "rgba(96, 165, 250, 0.15)",
    border: "rgba(96, 165, 250, 0.40)",
  },
  amber: {
    solid: "#FBBF24",
    tint: "rgba(251, 191, 36, 0.15)",
    border: "rgba(251, 191, 36, 0.40)",
  },
  pink: {
    solid: "#F472B6",
    tint: "rgba(244, 114, 182, 0.15)",
    border: "rgba(244, 114, 182, 0.40)",
  },
  red: {
    solid: "#F87171",
    tint: "rgba(248, 113, 113, 0.15)",
    border: "rgba(248, 113, 113, 0.40)",
  },
};

const COLOR_CYCLE: DiagramAccent[] = [
  "purple",
  "mint",
  "blue",
  "amber",
  "pink",
];

function getAccent(color?: string, fallbackIdx = 0): AccentStyle {
  if (color && color in ACCENTS) {
    return ACCENTS[color as DiagramAccent];
  }
  const key = COLOR_CYCLE[fallbackIdx % COLOR_CYCLE.length];
  return ACCENTS[key];
}

function asFinite(val: unknown, fallback: number): number {
  const num = Number(val);
  return Number.isFinite(num) ? num : fallback;
}

export interface FlowchartNode {
  id: string;
  label: string;
  detail?: string;
  color?: string;
}

export interface FlowchartEdge {
  from: string;
  to: string;
  label?: string;
  color?: string;
}

export interface NumberLinePoint {
  value: number;
  label?: string;
  color?: string;
  open?: boolean;
}

export interface NumberLineHop {
  from: number;
  to: number;
  label?: string;
  color?: string;
}

export interface NumberLineRange {
  from: number;
  to: number;
  fromOpen?: boolean;
  toOpen?: boolean;
  arrowLeft?: boolean;
  arrowRight?: boolean;
  color?: string;
}

export interface FractionOrBarRow {
  label?: string;
  total?: number;
  filled?: number;
  color?: string;
  segments?: { units: number; label?: string; color?: string }[];
}

export interface CoordinatePoint {
  x: number;
  y: number;
  label?: string;
  color?: string;
}

export interface CoordinateLine {
  points: [number, number][];
  label?: string;
  color?: string;
  dashed?: boolean;
}

export interface BarChartItem {
  label: string;
  value: number;
  color?: string;
}

export interface TimelineEvent {
  date: string;
  title: string;
  description?: string;
  color?: string;
}

export interface VennSet {
  title: string;
  items: string[];
  color?: string;
}

export type HomeworkDiagramSpec =
  | {
      type: "flowchart" | "cycle" | "hierarchy" | "process";
      title?: string;
      caption?: string;
      layout?: "vertical" | "horizontal" | "cycle" | "tree" | "branch";
      nodes: FlowchartNode[];
      edges?: FlowchartEdge[];
    }
  | {
      type: "number_line";
      title?: string;
      caption?: string;
      min?: number;
      max?: number;
      step?: number;
      points?: NumberLinePoint[];
      hops?: NumberLineHop[];
      range?: NumberLineRange;
    }
  | {
      type: "fraction_model" | "bar_model";
      title?: string;
      caption?: string;
      rows: FractionOrBarRow[];
    }
  | {
      type: "geometry";
      title?: string;
      caption?: string;
      shape:
        | "right_triangle"
        | "triangle"
        | "isosceles"
        | "equilateral"
        | "rectangle"
        | "square"
        | "circle"
        | "angle";
      degrees?: number;
      labels?: Record<string, string>;
    }
  | {
      type: "coordinate_grid";
      title?: string;
      caption?: string;
      xMin?: number;
      xMax?: number;
      yMin?: number;
      yMax?: number;
      points?: CoordinatePoint[];
      lines?: CoordinateLine[];
    }
  | {
      type: "bar_chart";
      title?: string;
      caption?: string;
      unit?: string;
      bars: BarChartItem[];
    }
  | {
      type: "timeline";
      title?: string;
      caption?: string;
      events: TimelineEvent[];
    }
  | {
      type: "venn";
      title?: string;
      caption?: string;
      sets: VennSet[];
      overlap?: { title?: string; items?: string[] };
    }
  | {
      type: "svg";
      title?: string;
      caption?: string;
      svg: string;
    };

export function parseDiagramSpec(raw: string): HomeworkDiagramSpec | null {
  if (!raw?.trim()) return null;

  const trimmed = raw.trim();
  if (trimmed.startsWith("<svg")) {
    return { type: "svg", svg: trimmed };
  }

  try {
    const parsed = JSON.parse(trimmed);
    if (parsed && typeof parsed === "object" && typeof parsed.type === "string") {
      return parsed as HomeworkDiagramSpec;
    }
  } catch {
    try {
      // Recover common trailing-comma mistakes in LLM JSON blocks
      const cleaned = trimmed.replace(/,\s*([}\]])/g, "$1");
      const parsed = JSON.parse(cleaned);
      if (parsed && typeof parsed === "object" && typeof parsed.type === "string") {
        return parsed as HomeworkDiagramSpec;
      }
    } catch {
      return null;
    }
  }
  return null;
}

function sanitizeSvgXml(raw: string): { xml: string; aspectRatio: number } | null {
  const match = raw.match(/<svg[\s\S]*?<\/svg>/i);
  if (!match) return null;

  let xml = match[0]
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<foreignObject[\s\S]*?<\/foreignObject>/gi, "")
    .replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*')/gi, "")
    .replace(/javascript:/gi, "");

  let vbWidth = 340;
  let vbHeight = 220;

  const vbMatch = xml.match(/viewBox\s*=\s*["']\s*([^"']+)\s*["']/i);
  if (vbMatch) {
    const parts = vbMatch[1].trim().split(/[\s,]+/).map(Number);
    if (parts.length === 4 && parts[2] > 0 && parts[3] > 0) {
      vbWidth = parts[2];
      vbHeight = parts[3];
    }
  } else {
    const wMatch = xml.match(/\bwidth\s*=\s*["'](\d+(?:\.\d+)?)["']/i);
    const hMatch = xml.match(/\bheight\s*=\s*["'](\d+(?:\.\d+)?)["']/i);
    if (wMatch) vbWidth = Math.max(80, Number(wMatch[1]));
    if (hMatch) vbHeight = Math.max(80, Number(hMatch[1]));
    xml = xml.replace(/<svg\b/i, `<svg viewBox="0 0 ${vbWidth} ${vbHeight}"`);
  }

  const aspectRatio = Math.min(2.4, Math.max(0.55, vbWidth / vbHeight));
  return { xml, aspectRatio };
}

function splitSvgWords(text: string, maxChars: number): string[] {
  const words = text.trim().split(/\s+/);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    if (!current) {
      current = word;
    } else if (current.length + 1 + word.length <= maxChars) {
      current += ` ${word}`;
    } else {
      lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines.slice(0, 3);
}

// ── Flowchart / Process / Cycle / Tree Renderer ─────────────────────────────

function FlowchartRenderer({
  spec,
}: {
  spec: Extract<
    HomeworkDiagramSpec,
    { type: "flowchart" | "cycle" | "hierarchy" | "process" }
  >;
}) {
  const { t } = useTranslation("homework");
  const nodes = Array.isArray(spec.nodes) ? spec.nodes : [];
  const edges = Array.isArray(spec.edges) ? spec.edges : [];
  if (nodes.length === 0) return null;

  const layout =
    spec.type === "cycle"
      ? "cycle"
      : spec.type === "hierarchy"
        ? "tree"
        : spec.layout || "vertical";

  // ── Cycle layout (circular arrow flow) ──
  if (layout === "cycle" && nodes.length >= 3 && nodes.length <= 6) {
    const W = 340;
    const H = 290;
    const cx = W / 2;
    const cy = H / 2;
    const rx = 104;
    const ry = 88;
    const count = nodes.length;

    const placed = nodes.map((node, i) => {
      const angle = -Math.PI / 2 + (2 * Math.PI * i) / count;
      return {
        node,
        x: cx + rx * Math.cos(angle),
        y: cy + ry * Math.sin(angle),
        angle,
        accent: getAccent(node.color, i),
      };
    });

    return (
      <View style={diagramStyles.svgFrame}>
        <Svg viewBox={`0 0 ${W} ${H}`} width="100%" height={260}>
          <Defs>
            {placed.map((item, idx) => (
              <Marker
                key={`mk-${idx}`}
                id={`cycleArrow-${idx}`}
                markerWidth="8"
                markerHeight="8"
                refX="6"
                refY="4"
                orient="auto"
              >
                <Path d="M0,1 L7,4 L0,7 Z" fill={item.accent.solid} />
              </Marker>
            ))}
          </Defs>

          {/* Subtle center halo */}
          <Circle
            cx={cx}
            cy={cy}
            r={34}
            fill="rgba(167, 139, 250, 0.10)"
            stroke="rgba(167, 139, 250, 0.25)"
            strokeWidth={1.5}
          />
          <SvgText
            x={cx}
            y={cy + 4}
            fill="#E2D9F3"
            fontSize={11}
            fontWeight="700"
            textAnchor="middle"
          >
            {t("session.cycle", { defaultValue: "CYCLE" })}
          </SvgText>

          {/* Curved arrows along perimeter */}
          {placed.map((fromItem, i) => {
            const toItem = placed[(i + 1) % count];
            const midAngle =
              fromItem.angle + ((2 * Math.PI) / count) * 0.5;
            const crx = rx * 1.12;
            const cry = ry * 1.12;
            const mx = cx + crx * Math.cos(midAngle);
            const my = cy + cry * Math.sin(midAngle);

            // Shorten start & end points away from box centers
            const dx = toItem.x - fromItem.x;
            const dy = toItem.y - fromItem.y;
            const dist = Math.hypot(dx, dy) || 1;
            const pad = 34;
            const sx = fromItem.x + (dx / dist) * pad;
            const sy = fromItem.y + (dy / dist) * pad;
            const ex = toItem.x - (dx / dist) * pad;
            const ey = toItem.y - (dy / dist) * pad;

            return (
              <Path
                key={`arc-${i}`}
                d={`M ${sx} ${sy} Q ${mx} ${my} ${ex} ${ey}`}
                fill="none"
                stroke={fromItem.accent.solid}
                strokeWidth={2.2}
                strokeOpacity={0.75}
                markerEnd={`url(#cycleArrow-${i})`}
              />
            );
          })}

          {/* Node pills */}
          {placed.map(({ node, x, y, accent }, i) => {
            const lines = splitSvgWords(node.label, 13);
            const boxW = 104;
            const boxH = Math.max(38, lines.length * 14 + 14);
            const boxX = Math.max(6, Math.min(W - boxW - 6, x - boxW / 2));
            const boxY = Math.max(6, Math.min(H - boxH - 6, y - boxH / 2));
            return (
              <G key={node.id || i}>
                <Rect
                  x={boxX}
                  y={boxY}
                  width={boxW}
                  height={boxH}
                  rx={12}
                  fill="#211B30"
                  stroke={accent.border}
                  strokeWidth={1.5}
                />
                <SvgText
                  x={boxX + boxW / 2}
                  y={boxY + 17 + (lines.length === 1 ? 6 : 0)}
                  fill="#FFFFFF"
                  fontSize={11.5}
                  fontWeight="700"
                  textAnchor="middle"
                >
                  {lines.map((line, li) => (
                    <TSpan
                      key={li}
                      x={boxX + boxW / 2}
                      dy={li === 0 ? 0 : 14}
                    >
                      {line}
                    </TSpan>
                  ))}
                </SvgText>
              </G>
            );
          })}
        </Svg>
      </View>
    );
  }

  // ── Tree / Branching hierarchy ──
  if ((layout === "tree" || layout === "branch") && nodes.length >= 2) {
    const childMap = new Map<string, FlowchartNode[]>();
    const hasParent = new Set<string>();
    const nodeById = new Map(nodes.map((n) => [n.id, n]));

    for (const edge of edges) {
      const child = nodeById.get(edge.to);
      if (!child) continue;
      hasParent.add(edge.to);
      const existing = childMap.get(edge.from) || [];
      existing.push(child);
      childMap.set(edge.from, existing);
    }

    const roots = nodes.filter((n) => !hasParent.has(n.id));
    const root = roots[0] || nodes[0];
    const children = childMap.get(root.id) || nodes.slice(1);
    const rootAccent = getAccent(root.color, 0);

    return (
      <View style={diagramStyles.treeWrap}>
        <View
          style={[
            diagramStyles.flowCard,
            diagramStyles.treeRootCard,
            {
              borderColor: rootAccent.border,
              backgroundColor: rootAccent.tint,
            },
          ]}
        >
          <Text style={diagramStyles.flowTitle}>{root.label}</Text>
          {root.detail ? (
            <Text style={diagramStyles.flowDetail}>{root.detail}</Text>
          ) : null}
        </View>

        {children.length > 0 ? (
          <>
            <Svg width="100%" height={26} viewBox="0 0 200 26">
              <Line
                x1={100}
                y1={0}
                x2={100}
                y2={13}
                stroke="rgba(255,255,255,0.28)"
                strokeWidth={2}
              />
              {children.length > 1 ? (
                <Line
                  x1={42}
                  y1={13}
                  x2={158}
                  y2={13}
                  stroke="rgba(255,255,255,0.28)"
                  strokeWidth={2}
                />
              ) : null}
              {children.length > 1 ? (
                <>
                  <Line
                    x1={42}
                    y1={13}
                    x2={42}
                    y2={26}
                    stroke="rgba(255,255,255,0.28)"
                    strokeWidth={2}
                  />
                  <Line
                    x1={158}
                    y1={13}
                    x2={158}
                    y2={26}
                    stroke="rgba(255,255,255,0.28)"
                    strokeWidth={2}
                  />
                </>
              ) : (
                <Line
                  x1={100}
                  y1={13}
                  x2={100}
                  y2={26}
                  stroke="rgba(255,255,255,0.28)"
                  strokeWidth={2}
                />
              )}
            </Svg>

            <View style={diagramStyles.treeChildrenGrid}>
              {children.map((child, idx) => {
                const accent = getAccent(child.color, idx + 1);
                const grandChildren = childMap.get(child.id) || [];
                const edgeLabel = edges.find(
                  (e) => e.from === root.id && e.to === child.id,
                )?.label;

                return (
                  <View
                    key={child.id || idx}
                    style={[
                      diagramStyles.treeChildCol,
                      children.length === 1 && diagramStyles.treeChildSingle,
                    ]}
                  >
                    {edgeLabel ? (
                      <View style={diagramStyles.edgeBadge}>
                        <Text style={diagramStyles.edgeBadgeText}>
                          {edgeLabel}
                        </Text>
                      </View>
                    ) : null}
                    <View
                      style={[
                        diagramStyles.flowCard,
                        { borderColor: accent.border },
                      ]}
                    >
                      <View
                        style={[
                          diagramStyles.stepDot,
                          { backgroundColor: accent.solid },
                        ]}
                      />
                      <View style={diagramStyles.flexText}>
                        <Text style={diagramStyles.flowTitle}>
                          {child.label}
                        </Text>
                        {child.detail ? (
                          <Text style={diagramStyles.flowDetail}>
                            {child.detail}
                          </Text>
                        ) : null}
                      </View>
                    </View>

                    {grandChildren.length > 0 ? (
                      <View style={diagramStyles.grandChildList}>
                        {grandChildren.map((gc, gIdx) => (
                          <View
                            key={gc.id || gIdx}
                            style={diagramStyles.grandChildPill}
                          >
                            <Text style={diagramStyles.grandChildText}>
                              {gc.label}
                            </Text>
                            {gc.detail ? (
                              <Text style={diagramStyles.flowDetail}>
                                {gc.detail}
                              </Text>
                            ) : null}
                          </View>
                        ))}
                      </View>
                    ) : null}
                  </View>
                );
              })}
            </View>
          </>
        ) : null}
      </View>
    );
  }

  // ── Linear Vertical Step Flow (default — clearest for mobile reading) ──
  return (
    <View style={diagramStyles.flowList}>
      {nodes.map((node, index) => {
        const accent = getAccent(node.color, index);
        const nextNode = nodes[index + 1];
        const edge = nextNode
          ? edges.find(
              (e) => e.from === node.id && e.to === nextNode.id,
            ) || edges[index]
          : undefined;

        return (
          <React.Fragment key={node.id || index}>
            <View
              style={[
                diagramStyles.flowCard,
                { borderColor: accent.border },
              ]}
            >
              <View
                style={[
                  diagramStyles.flowStepBadge,
                  { backgroundColor: accent.tint },
                ]}
              >
                <Text
                  style={[diagramStyles.flowStepNum, { color: accent.solid }]}
                >
                  {index + 1}
                </Text>
              </View>
              <View style={diagramStyles.flexText}>
                <Text style={diagramStyles.flowTitle}>{node.label}</Text>
                {node.detail ? (
                  <Text style={diagramStyles.flowDetail}>{node.detail}</Text>
                ) : null}
              </View>
            </View>

            {index < nodes.length - 1 ? (
              <View style={diagramStyles.flowConnector}>
                <Ionicons
                  name="arrow-down"
                  size={15}
                  color={accent.solid}
                />
                {edge?.label ? (
                  <View
                    style={[
                      diagramStyles.edgeBadge,
                      { borderColor: accent.border },
                    ]}
                  >
                    <Text
                      style={[
                        diagramStyles.edgeBadgeText,
                        { color: accent.solid },
                      ]}
                    >
                      {edge.label}
                    </Text>
                  </View>
                ) : null}
              </View>
            ) : null}
          </React.Fragment>
        );
      })}
    </View>
  );
}

// ── Number Line Renderer ─────────────────────────────────────────────────────

function NumberLineRenderer({
  spec,
}: {
  spec: Extract<HomeworkDiagramSpec, { type: "number_line" }>;
}) {
  const points = Array.isArray(spec.points) ? spec.points : [];
  const hops = Array.isArray(spec.hops) ? spec.hops : [];

  const allValues: number[] = [
    ...points.map((p) => asFinite(p.value, 0)),
    ...hops.flatMap((h) => [asFinite(h.from, 0), asFinite(h.to, 0)]),
    ...(spec.range
      ? [asFinite(spec.range.from, 0), asFinite(spec.range.to, 5)]
      : []),
  ];

  let min =
    spec.min !== undefined
      ? asFinite(spec.min, 0)
      : allValues.length
        ? Math.floor(Math.min(...allValues)) - 1
        : 0;
  let max =
    spec.max !== undefined
      ? asFinite(spec.max, 10)
      : allValues.length
        ? Math.ceil(Math.max(...allValues)) + 1
        : 10;

  if (max <= min) {
    max = min + 10;
  }

  const span = max - min;
  const rawStep = asFinite(spec.step, Math.max(1, Math.ceil(span / 10)));
  const step = Math.max(span / 12, rawStep > 0 ? rawStep : 1);

  const ticks: number[] = [];
  for (let v = min; v <= max + 0.0001; v += step) {
    ticks.push(Number(v.toFixed(2)));
  }

  const W = 340;
  const hasHops = hops.length > 0;
  const hasPointLabels = points.some((p) => Boolean(p.label));
  const axisY = hasHops ? 82 : 42;
  const H = axisY + (hasPointLabels ? 56 : 36);
  const padX = 24;
  const lineW = W - padX * 2;
  const toX = (val: number) =>
    padX + (Math.max(min, Math.min(max, val)) - min) / span * lineW;

  return (
    <Svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H}>
      {/* Main axis */}
      <Line
        x1={padX - 10}
        y1={axisY}
        x2={W - padX + 10}
        y2={axisY}
        stroke="#FFFFFF"
        strokeWidth={2.2}
      />
      <Polygon
        points={`${padX - 14},${axisY} ${padX - 6},${axisY - 4} ${padX - 6},${axisY + 4}`}
        fill="#FFFFFF"
      />
      <Polygon
        points={`${W - padX + 14},${axisY} ${W - padX + 6},${axisY - 4} ${W - padX + 6},${axisY + 4}`}
        fill="#FFFFFF"
      />

      {/* Interval / inequality highlight */}
      {spec.range ? (() => {
        const rangeAccent = getAccent(spec.range.color || "mint");
        const x1 = spec.range.arrowLeft ? padX - 8 : toX(spec.range.from);
        const x2 = spec.range.arrowRight
          ? W - padX + 8
          : toX(spec.range.to);
        return (
          <G>
            <Line
              x1={x1}
              y1={axisY}
              x2={x2}
              y2={axisY}
              stroke={rangeAccent.solid}
              strokeWidth={5}
              strokeLinecap="round"
            />
            {!spec.range.arrowLeft ? (
              <Circle
                cx={x1}
                cy={axisY}
                r={5.5}
                fill={spec.range.fromOpen ? "#1B1626" : rangeAccent.solid}
                stroke={rangeAccent.solid}
                strokeWidth={2.4}
              />
            ) : null}
            {!spec.range.arrowRight ? (
              <Circle
                cx={x2}
                cy={axisY}
                r={5.5}
                fill={spec.range.toOpen ? "#1B1626" : rangeAccent.solid}
                stroke={rangeAccent.solid}
                strokeWidth={2.4}
              />
            ) : null}
          </G>
        );
      })() : null}

      {/* Ticks */}
      {ticks.map((val, idx) => {
        const tx = toX(val);
        return (
          <G key={`t-${idx}`}>
            <Line
              x1={tx}
              y1={axisY - 5}
              x2={tx}
              y2={axisY + 5}
              stroke="rgba(255,255,255,0.5)"
              strokeWidth={1.5}
            />
            <SvgText
              x={tx}
              y={axisY + 20}
              fill="rgba(255,255,255,0.72)"
              fontSize={10.5}
              fontWeight="600"
              textAnchor="middle"
            >
              {val}
            </SvgText>
          </G>
        );
      })}

      {/* Bunny hops above axis */}
      {hops.map((hop, idx) => {
        const x1 = toX(hop.from);
        const x2 = toX(hop.to);
        const midX = (x1 + x2) / 2;
        const arcH = Math.min(48, Math.max(22, Math.abs(x2 - x1) * 0.35));
        const ctrlY = axisY - arcH * 1.45 - (idx % 2) * 8;
        const accent = getAccent(hop.color || "purple", idx);
        const dir = x2 >= x1 ? 1 : -1;

        return (
          <G key={`hop-${idx}`}>
            <Path
              d={`M ${x1} ${axisY - 6} Q ${midX} ${ctrlY} ${x2} ${axisY - 7}`}
              fill="none"
              stroke={accent.solid}
              strokeWidth={2.2}
              strokeDasharray="4 2"
            />
            <Polygon
              points={`${x2},${axisY - 6} ${x2 - 5 * dir},${axisY - 12} ${x2 + 2 * dir},${axisY - 12}`}
              fill={accent.solid}
            />
            {hop.label ? (
              <G>
                <Rect
                  x={midX - 20}
                  y={ctrlY * 0.45 + axisY * 0.55 - 24}
                  width={40}
                  height={18}
                  rx={9}
                  fill="#241E36"
                  stroke={accent.border}
                  strokeWidth={1.2}
                />
                <SvgText
                  x={midX}
                  y={ctrlY * 0.45 + axisY * 0.55 - 11}
                  fill={accent.solid}
                  fontSize={10.5}
                  fontWeight="700"
                  textAnchor="middle"
                >
                  {hop.label}
                </SvgText>
              </G>
            ) : null}
          </G>
        );
      })}

      {/* Plotted points */}
      {points.map((pt, idx) => {
        const px = toX(pt.value);
        const accent = getAccent(pt.color || "mint", idx);
        return (
          <G key={`pt-${idx}`}>
            <Circle
              cx={px}
              cy={axisY}
              r={6}
              fill={pt.open ? "#1B1626" : accent.solid}
              stroke={accent.solid}
              strokeWidth={2.4}
            />
            {pt.label ? (
              <SvgText
                x={px}
                y={axisY + 38}
                fill={accent.solid}
                fontSize={11}
                fontWeight="700"
                textAnchor="middle"
              >
                {pt.label}
              </SvgText>
            ) : null}
          </G>
        );
      })}
    </Svg>
  );
}

// ── Fraction Strips & Singapore Bar Models ──────────────────────────────────

function FractionBarRenderer({
  spec,
}: {
  spec: Extract<HomeworkDiagramSpec, { type: "fraction_model" | "bar_model" }>;
}) {
  const rows = Array.isArray(spec.rows) ? spec.rows : [];
  if (rows.length === 0) return null;

  return (
    <View style={diagramStyles.barsContainer}>
      {rows.map((row, rIdx) => {
        const rowAccent = getAccent(row.color, rIdx);

        if (Array.isArray(row.segments) && row.segments.length > 0) {
          return (
            <View key={`row-${rIdx}`} style={diagramStyles.barRowBlock}>
              {row.label ? (
                <Text style={diagramStyles.barRowLabel}>{row.label}</Text>
              ) : null}
              <View style={diagramStyles.barTrack}>
                {row.segments.map((seg, sIdx) => {
                  const accent = getAccent(seg.color, rIdx + sIdx);
                  return (
                    <View
                      key={`seg-${sIdx}`}
                      style={[
                        diagramStyles.barSegment,
                        {
                          flex: Math.max(0.2, asFinite(seg.units, 1)),
                          backgroundColor: accent.tint,
                          borderColor: accent.border,
                        },
                      ]}
                    >
                      {seg.label ? (
                        <Text
                          style={[
                            diagramStyles.barSegmentText,
                            { color: accent.solid },
                          ]}
                          numberOfLines={1}
                        >
                          {seg.label}
                        </Text>
                      ) : null}
                    </View>
                  );
                })}
              </View>
            </View>
          );
        }

        const total = Math.max(1, Math.min(16, Math.round(asFinite(row.total, 4))));
        const filled = Math.max(0, Math.min(total, Math.round(asFinite(row.filled, 1))));

        return (
          <View key={`row-${rIdx}`} style={diagramStyles.barRowBlock}>
            <View style={diagramStyles.barLabelRow}>
              <Text style={diagramStyles.barRowLabel}>
                {row.label || `${filled}/${total}`}
              </Text>
            </View>
            <View style={diagramStyles.barTrack}>
              {Array.from({ length: total }).map((_, uIdx) => {
                const isFilled = uIdx < filled;
                return (
                  <View
                    key={`u-${uIdx}`}
                    style={[
                      diagramStyles.fractionCell,
                      isFilled
                        ? {
                            backgroundColor: rowAccent.tint,
                            borderColor: rowAccent.border,
                          }
                        : diagramStyles.fractionCellEmpty,
                    ]}
                  >
                    <Text
                      style={[
                        diagramStyles.fractionCellText,
                        {
                          color: isFilled
                            ? rowAccent.solid
                            : UI_COLORS.textMuted,
                        },
                      ]}
                    >
                      1/{total}
                    </Text>
                  </View>
                );
              })}
            </View>
          </View>
        );
      })}
    </View>
  );
}

// ── Geometry Shape Renderer ──────────────────────────────────────────────────

function GeometryRenderer({
  spec,
}: {
  spec: Extract<HomeworkDiagramSpec, { type: "geometry" }>;
}) {
  const labels = spec.labels || {};
  const shape = spec.shape || "triangle";

  if (shape === "circle") {
    const rLabel = labels.radius || labels.r;
    const dLabel = labels.diameter || labels.d;
    const cLabel = labels.center || labels.area || labels.circumference;
    return (
      <Svg viewBox="0 0 320 200" width="100%" height={190}>
        <Circle
          cx={160}
          cy={100}
          r={68}
          fill="rgba(167, 139, 250, 0.14)"
          stroke="#A78BFA"
          strokeWidth={2.5}
        />
        <Circle cx={160} cy={100} r={3.5} fill="#FFFFFF" />

        {dLabel ? (
          <G>
            <Line
              x1={92}
              y1={100}
              x2={228}
              y2={100}
              stroke="#60A5FA"
              strokeWidth={2}
              strokeDasharray="5 3"
            />
            <SvgText
              x={160}
              y={118}
              fill="#60A5FA"
              fontSize={12}
              fontWeight="700"
              textAnchor="middle"
            >
              {dLabel}
            </SvgText>
          </G>
        ) : null}

        {rLabel || !dLabel ? (
          <G>
            <Line
              x1={160}
              y1={100}
              x2={228}
              y2={100}
              stroke="#34D399"
              strokeWidth={2.4}
            />
            <SvgText
              x={194}
              y={92}
              fill="#34D399"
              fontSize={12}
              fontWeight="700"
              textAnchor="middle"
            >
              {rLabel || "r"}
            </SvgText>
          </G>
        ) : null}

        {cLabel ? (
          <SvgText
            x={160}
            y={186}
            fill="#FFFFFF"
            fontSize={12}
            fontWeight="700"
            textAnchor="middle"
          >
            {cLabel}
          </SvgText>
        ) : null}
      </Svg>
    );
  }

  if (shape === "rectangle" || shape === "square") {
    const w = shape === "square" ? 132 : 186;
    const h = shape === "square" ? 132 : 108;
    const x = (320 - w) / 2;
    const y = (190 - h) / 2;
    const topL = labels.top || labels.width || labels.length || labels.side;
    const leftL = labels.left || labels.height || labels.a || labels.b;
    const rightL = labels.right;
    const bottomL = labels.bottom;
    const centerL = labels.area || labels.center;

    return (
      <Svg viewBox="0 0 320 195" width="100%" height={185}>
        <Rect
          x={x}
          y={y}
          width={w}
          height={h}
          rx={4}
          fill="rgba(96, 165, 250, 0.14)"
          stroke="#60A5FA"
          strokeWidth={2.5}
        />
        {/* Right-angle mark */}
        <Path
          d={`M ${x} ${y + h - 14} L ${x + 14} ${y + h - 14} L ${x + 14} ${y + h}`}
          fill="none"
          stroke="rgba(255,255,255,0.55)"
          strokeWidth={1.5}
        />
        {topL ? (
          <SvgText
            x={160}
            y={y - 10}
            fill="#FFFFFF"
            fontSize={12.5}
            fontWeight="700"
            textAnchor="middle"
          >
            {topL}
          </SvgText>
        ) : null}
        {bottomL ? (
          <SvgText
            x={160}
            y={y + h + 18}
            fill="#FFFFFF"
            fontSize={12.5}
            fontWeight="700"
            textAnchor="middle"
          >
            {bottomL}
          </SvgText>
        ) : null}
        {leftL ? (
          <SvgText
            x={x - 10}
            y={y + h / 2 + 4}
            fill="#34D399"
            fontSize={12.5}
            fontWeight="700"
            textAnchor="end"
          >
            {leftL}
          </SvgText>
        ) : null}
        {rightL ? (
          <SvgText
            x={x + w + 10}
            y={y + h / 2 + 4}
            fill="#34D399"
            fontSize={12.5}
            fontWeight="700"
            textAnchor="start"
          >
            {rightL}
          </SvgText>
        ) : null}
        {centerL ? (
          <SvgText
            x={160}
            y={y + h / 2 + 5}
            fill="#E2D9F3"
            fontSize={12}
            fontWeight="700"
            textAnchor="middle"
          >
            {centerL}
          </SvgText>
        ) : null}
      </Svg>
    );
  }

  if (shape === "angle") {
    const deg = Math.max(10, Math.min(170, asFinite(spec.degrees, 55)));
    const rad = (deg * Math.PI) / 180;
    const vx = 110;
    const vy = 152;
    const len = 135;
    const ex = vx + len * Math.cos(rad);
    const ey = vy - len * Math.sin(rad);
    const arcR = 40;
    const ax = vx + arcR * Math.cos(rad);
    const ay = vy - arcR * Math.sin(rad);

    return (
      <Svg viewBox="0 0 320 185" width="100%" height={175}>
        <Line
          x1={vx}
          y1={vy}
          x2={vx + len}
          y2={vy}
          stroke="#60A5FA"
          strokeWidth={2.6}
          strokeLinecap="round"
        />
        <Line
          x1={vx}
          y1={vy}
          x2={ex}
          y2={ey}
          stroke="#A78BFA"
          strokeWidth={2.6}
          strokeLinecap="round"
        />
        <Path
          d={`M ${vx + arcR} ${vy} A ${arcR} ${arcR} 0 0 0 ${ax} ${ay}`}
          fill="none"
          stroke="#34D399"
          strokeWidth={2.2}
        />
        <Circle cx={vx} cy={vy} r={4} fill="#FFFFFF" />
        <SvgText
          x={vx + 56}
          y={vy - 18}
          fill="#34D399"
          fontSize={13}
          fontWeight="700"
        >
          {labels.angle || `${deg}°`}
        </SvgText>
      </Svg>
    );
  }

  // Right triangle or general triangle
  const isRight = shape === "right_triangle";
  const p1 = isRight ? { x: 85, y: 155 } : { x: 75, y: 155 };
  const p2 = isRight ? { x: 235, y: 155 } : { x: 245, y: 155 };
  const p3 = isRight ? { x: 85, y: 36 } : { x: 152, y: 36 };

  const sideLeft = labels.left || labels.a || labels.height;
  const sideBottom = labels.bottom || labels.b || labels.base;
  const sideRight = labels.right || labels.c || labels.hypotenuse;

  return (
    <Svg viewBox="0 0 320 190" width="100%" height={180}>
      <Polygon
        points={`${p1.x},${p1.y} ${p2.x},${p2.y} ${p3.x},${p3.y}`}
        fill="rgba(167, 139, 250, 0.14)"
        stroke="#A78BFA"
        strokeWidth={2.5}
      />
      {isRight ? (
        <Path
          d={`M ${p1.x} ${p1.y - 16} L ${p1.x + 16} ${p1.y - 16} L ${p1.x + 16} ${p1.y}`}
          fill="none"
          stroke="#FFFFFF"
          strokeWidth={1.6}
        />
      ) : labels.height ? (
        <Line
          x1={p3.x}
          y1={p3.y}
          x2={p3.x}
          y2={p1.y}
          stroke="#34D399"
          strokeWidth={1.8}
          strokeDasharray="4 4"
        />
      ) : null}

      {sideLeft ? (
        <SvgText
          x={p1.x - 10}
          y={(p1.y + p3.y) / 2 + 4}
          fill="#34D399"
          fontSize={12.5}
          fontWeight="700"
          textAnchor="end"
        >
          {sideLeft}
        </SvgText>
      ) : null}
      {sideBottom ? (
        <SvgText
          x={(p1.x + p2.x) / 2}
          y={p1.y + 20}
          fill="#FFFFFF"
          fontSize={12.5}
          fontWeight="700"
          textAnchor="middle"
        >
          {sideBottom}
        </SvgText>
      ) : null}
      {sideRight ? (
        <SvgText
          x={(p2.x + p3.x) / 2 + 12}
          y={(p2.y + p3.y) / 2}
          fill="#60A5FA"
          fontSize={12.5}
          fontWeight="700"
          textAnchor="start"
        >
          {sideRight}
        </SvgText>
      ) : null}
      {labels.angle ? (
        <SvgText
          x={p2.x - 36}
          y={p2.y - 8}
          fill="#FBBF24"
          fontSize={11.5}
          fontWeight="700"
        >
          {labels.angle}
        </SvgText>
      ) : null}
    </Svg>
  );
}

// ── Coordinate Grid Renderer ─────────────────────────────────────────────────

function CoordinateGridRenderer({
  spec,
}: {
  spec: Extract<HomeworkDiagramSpec, { type: "coordinate_grid" }>;
}) {
  const xMin = asFinite(spec.xMin, -5);
  const xMax = Math.max(xMin + 2, asFinite(spec.xMax, 5));
  const yMin = asFinite(spec.yMin, -5);
  const yMax = Math.max(yMin + 2, asFinite(spec.yMax, 5));

  const W = 280;
  const H = 250;
  const pad = 26;
  const plotW = W - pad * 2;
  const plotH = H - pad * 2;

  const toX = (x: number) => pad + ((x - xMin) / (xMax - xMin)) * plotW;
  const toY = (y: number) => H - pad - ((y - yMin) / (yMax - yMin)) * plotH;

  const xStep = Math.max(1, Math.ceil((xMax - xMin) / 10));
  const yStep = Math.max(1, Math.ceil((yMax - yMin) / 10));

  const xTicks: number[] = [];
  for (let x = Math.ceil(xMin); x <= Math.floor(xMax); x += xStep) {
    xTicks.push(x);
  }
  const yTicks: number[] = [];
  for (let y = Math.ceil(yMin); y <= Math.floor(yMax); y += yStep) {
    yTicks.push(y);
  }

  const originX = toX(Math.max(xMin, Math.min(xMax, 0)));
  const originY = toY(Math.max(yMin, Math.min(yMax, 0)));

  return (
    <Svg viewBox={`0 0 ${W} ${H}`} width="100%" height={235}>
      {xTicks.map((x) => (
        <Line
          key={`gx-${x}`}
          x1={toX(x)}
          y1={pad}
          x2={toX(x)}
          y2={H - pad}
          stroke="rgba(255,255,255,0.08)"
          strokeWidth={1}
        />
      ))}
      {yTicks.map((y) => (
        <Line
          key={`gy-${y}`}
          x1={pad}
          y1={toY(y)}
          x2={W - pad}
          y2={toY(y)}
          stroke="rgba(255,255,255,0.08)"
          strokeWidth={1}
        />
      ))}

      {/* Axes */}
      <Line
        x1={pad}
        y1={originY}
        x2={W - pad}
        y2={originY}
        stroke="rgba(255,255,255,0.55)"
        strokeWidth={1.6}
      />
      <Line
        x1={originX}
        y1={pad}
        x2={originX}
        y2={H - pad}
        stroke="rgba(255,255,255,0.55)"
        strokeWidth={1.6}
      />

      {xTicks.map((x) =>
        x !== 0 ? (
          <SvgText
            key={`tx-${x}`}
            x={toX(x)}
            y={Math.min(H - 8, originY + 13)}
            fill="rgba(255,255,255,0.55)"
            fontSize={9.5}
            textAnchor="middle"
          >
            {x}
          </SvgText>
        ) : null,
      )}
      {yTicks.map((y) =>
        y !== 0 ? (
          <SvgText
            key={`ty-${y}`}
            x={Math.max(12, originX - 6)}
            y={toY(y) + 3}
            fill="rgba(255,255,255,0.55)"
            fontSize={9.5}
            textAnchor="end"
          >
            {y}
          </SvgText>
        ) : null,
      )}

      {/* Plotted lines */}
      {(spec.lines || []).map((line, idx) => {
        if (!Array.isArray(line.points) || line.points.length < 2) return null;
        const accent = getAccent(line.color, idx);
        const pts = line.points
          .map(([x, y]) => `${toX(x)},${toY(y)}`)
          .join(" ");
        const last = line.points[line.points.length - 1];
        return (
          <G key={`l-${idx}`}>
            <Path
              d={`M ${pts.split(" ").join(" L ")}`}
              fill="none"
              stroke={accent.solid}
              strokeWidth={2.4}
              strokeDasharray={line.dashed ? "5 4" : undefined}
            />
            {line.label ? (
              <SvgText
                x={Math.min(W - 34, toX(last[0]))}
                y={Math.max(14, toY(last[1]) - 8)}
                fill={accent.solid}
                fontSize={10.5}
                fontWeight="700"
                textAnchor="middle"
              >
                {line.label}
              </SvgText>
            ) : null}
          </G>
        );
      })}

      {/* Plotted points */}
      {(spec.points || []).map((pt, idx) => {
        const px = toX(pt.x);
        const py = toY(pt.y);
        const accent = getAccent(pt.color || "mint", idx);
        return (
          <G key={`p-${idx}`}>
            <Circle
              cx={px}
              cy={py}
              r={5}
              fill={accent.solid}
              stroke="#1B1626"
              strokeWidth={1.8}
            />
            <SvgText
              x={px + (pt.x >= xMax - 1 ? -8 : 8)}
              y={py - 8}
              fill="#FFFFFF"
              fontSize={10.5}
              fontWeight="700"
              textAnchor={pt.x >= xMax - 1 ? "end" : "start"}
            >
              {pt.label || `(${pt.x}, ${pt.y})`}
            </SvgText>
          </G>
        );
      })}
    </Svg>
  );
}

// ── Bar Chart Renderer ───────────────────────────────────────────────────────

function BarChartRenderer({
  spec,
}: {
  spec: Extract<HomeworkDiagramSpec, { type: "bar_chart" }>;
}) {
  const bars = Array.isArray(spec.bars) ? spec.bars : [];
  if (bars.length === 0) return null;

  const maxVal = Math.max(1, ...bars.map((b) => Math.max(0, asFinite(b.value, 0))));
  const unit = spec.unit ? ` ${spec.unit}` : "";

  return (
    <View style={diagramStyles.barsContainer}>
      {bars.map((bar, idx) => {
        const accent = getAccent(bar.color, idx);
        const pct = Math.max(4, Math.min(100, (asFinite(bar.value, 0) / maxVal) * 100));
        return (
          <View key={`bc-${idx}`} style={diagramStyles.chartRow}>
            <View style={diagramStyles.barLabelRow}>
              <Text style={diagramStyles.barRowLabel}>{bar.label}</Text>
              <Text style={[diagramStyles.chartVal, { color: accent.solid }]}>
                {bar.value}
                {unit}
              </Text>
            </View>
            <View style={diagramStyles.chartTrack}>
              <View
                style={[
                  diagramStyles.chartFill,
                  {
                    width: `${pct}%`,
                    backgroundColor: accent.solid,
                  },
                ]}
              />
            </View>
          </View>
        );
      })}
    </View>
  );
}

// ── Timeline Renderer ────────────────────────────────────────────────────────

function TimelineRenderer({
  spec,
}: {
  spec: Extract<HomeworkDiagramSpec, { type: "timeline" }>;
}) {
  const events = Array.isArray(spec.events) ? spec.events : [];
  if (events.length === 0) return null;

  return (
    <View style={diagramStyles.timelineList}>
      {events.map((ev, idx) => {
        const accent = getAccent(ev.color, idx);
        const isLast = idx === events.length - 1;
        return (
          <View key={`tl-${idx}`} style={diagramStyles.timelineRow}>
            <View style={diagramStyles.timelineRailCol}>
              <View
                style={[
                  diagramStyles.timelineDot,
                  { backgroundColor: accent.solid },
                ]}
              />
              {!isLast ? <View style={diagramStyles.timelineRail} /> : null}
            </View>
            <View
              style={[
                diagramStyles.timelineCard,
                { borderColor: accent.border },
              ]}
            >
              <View
                style={[
                  diagramStyles.datePill,
                  { backgroundColor: accent.tint },
                ]}
              >
                <Text style={[diagramStyles.dateText, { color: accent.solid }]}>
                  {ev.date}
                </Text>
              </View>
              <Text style={diagramStyles.flowTitle}>{ev.title}</Text>
              {ev.description ? (
                <Text style={diagramStyles.flowDetail}>{ev.description}</Text>
              ) : null}
            </View>
          </View>
        );
      })}
    </View>
  );
}

// ── Venn Diagram Renderer ────────────────────────────────────────────────────

function VennRenderer({
  spec,
}: {
  spec: Extract<HomeworkDiagramSpec, { type: "venn" }>;
}) {
  const { t } = useTranslation("homework");
  const sets = Array.isArray(spec.sets) ? spec.sets.slice(0, 2) : [];
  if (sets.length < 2) return null;

  const left = sets[0];
  const right = sets[1];
  const leftAccent = getAccent(left.color || "purple");
  const rightAccent = getAccent(right.color || "mint");
  const overlapItems = spec.overlap?.items || [];
  const bothLabel =
    spec.overlap?.title || t("session.vennBoth", { defaultValue: "Both" });
  const commonLabel =
    spec.overlap?.title ||
    t("session.vennCommon", { defaultValue: "In Common" });

  return (
    <View style={diagramStyles.vennWrap}>
      <Svg viewBox="0 0 320 130" width="100%" height={120}>
        <Circle
          cx={118}
          cy={66}
          r={52}
          fill={leftAccent.solid}
          fillOpacity={0.18}
          stroke={leftAccent.solid}
          strokeWidth={2}
        />
        <Circle
          cx={202}
          cy={66}
          r={52}
          fill={rightAccent.solid}
          fillOpacity={0.18}
          stroke={rightAccent.solid}
          strokeWidth={2}
        />
        <SvgText
          x={96}
          y={66}
          fill="#FFFFFF"
          fontSize={11}
          fontWeight="700"
          textAnchor="middle"
        >
          {left.title.slice(0, 14)}
        </SvgText>
        <SvgText
          x={160}
          y={66}
          fill="#E2D9F3"
          fontSize={10}
          fontWeight="700"
          textAnchor="middle"
        >
          {bothLabel}
        </SvgText>
        <SvgText
          x={224}
          y={66}
          fill="#FFFFFF"
          fontSize={11}
          fontWeight="700"
          textAnchor="middle"
        >
          {right.title.slice(0, 14)}
        </SvgText>
      </Svg>

      <View style={diagramStyles.vennCols}>
        <View style={[diagramStyles.vennBox, { borderColor: leftAccent.border }]}>
          <Text style={[diagramStyles.vennBoxTitle, { color: leftAccent.solid }]}>
            {left.title}
          </Text>
          {left.items.map((item, i) => (
            <Text key={i} style={diagramStyles.vennItem}>
              • {item}
            </Text>
          ))}
        </View>
        <View style={[diagramStyles.vennBox, { borderColor: rightAccent.border }]}>
          <Text style={[diagramStyles.vennBoxTitle, { color: rightAccent.solid }]}>
            {right.title}
          </Text>
          {right.items.map((item, i) => (
            <Text key={i} style={diagramStyles.vennItem}>
              • {item}
            </Text>
          ))}
        </View>
      </View>

      {overlapItems.length > 0 ? (
        <View style={diagramStyles.vennOverlapBox}>
          <Text style={diagramStyles.vennOverlapTitle}>{commonLabel}</Text>
          {overlapItems.map((item, i) => (
            <Text key={i} style={diagramStyles.vennItem}>
              • {item}
            </Text>
          ))}
        </View>
      ) : null}
    </View>
  );
}

// ── Custom SVG Illustration Renderer ────────────────────────────────────────

function SvgIllustrationRenderer({ rawSvg }: { rawSvg: string }) {
  const safe = useMemo(() => sanitizeSvgXml(rawSvg), [rawSvg]);
  if (!safe) return null;

  return (
    <View style={[diagramStyles.customSvgWrap, { aspectRatio: safe.aspectRatio }]}>
      <SvgXml xml={safe.xml} width="100%" height="100%" />
    </View>
  );
}

// ── Main Expandable Obsidian Diagram Card ───────────────────────────────────

export function HomeworkDiagram({ spec }: { spec: HomeworkDiagramSpec }) {
  const { t } = useTranslation("homework");
  const [expanded, setExpanded] = useState(false);
  const { width: winW } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  const resolvedTitle =
    spec.title || t("session.visualGuide", { defaultValue: "Visual Guide" });

  const body = (() => {
    switch (spec.type) {
      case "flowchart":
      case "cycle":
      case "hierarchy":
      case "process":
        return <FlowchartRenderer spec={spec} />;
      case "number_line":
        return <NumberLineRenderer spec={spec} />;
      case "fraction_model":
      case "bar_model":
        return <FractionBarRenderer spec={spec} />;
      case "geometry":
        return <GeometryRenderer spec={spec} />;
      case "coordinate_grid":
        return <CoordinateGridRenderer spec={spec} />;
      case "bar_chart":
        return <BarChartRenderer spec={spec} />;
      case "timeline":
        return <TimelineRenderer spec={spec} />;
      case "venn":
        return <VennRenderer spec={spec} />;
      case "svg":
        return <SvgIllustrationRenderer rawSvg={spec.svg} />;
      default:
        return null;
    }
  })();

  if (!body) return null;

  return (
    <>
      <TouchableOpacity
        activeOpacity={0.92}
        onPress={() => {
          hapticsService.selection();
          setExpanded(true);
        }}
        accessibilityRole="button"
        accessibilityLabel={resolvedTitle}
        style={diagramStyles.card}
      >
        <View style={diagramStyles.header}>
          <View style={diagramStyles.titleRow}>
            <View style={diagramStyles.iconBadge}>
              <Ionicons name="shapes-outline" size={13} color="#A78BFA" />
            </View>
            <Text style={diagramStyles.title} numberOfLines={2}>
              {resolvedTitle}
            </Text>
          </View>
          <View style={diagramStyles.expandBtn}>
            <Ionicons
              name="expand-outline"
              size={14}
              color={UI_COLORS.textSecondary}
            />
          </View>
        </View>

        <View style={diagramStyles.stage}>{body}</View>

        {spec.caption ? (
          <Text style={diagramStyles.caption}>{spec.caption}</Text>
        ) : null}
      </TouchableOpacity>

      <Modal
        visible={expanded}
        animationType="fade"
        transparent
        onRequestClose={() => setExpanded(false)}
      >
        <SafeAreaView style={diagramStyles.modalBackdrop}>
          <View
            style={[
              diagramStyles.modalHeader,
              { paddingTop: Math.max(insets.top, 12) },
            ]}
          >
            <Text style={diagramStyles.modalTitle} numberOfLines={2}>
              {resolvedTitle}
            </Text>
            <TouchableOpacity
              onPress={() => setExpanded(false)}
              activeOpacity={0.8}
              style={diagramStyles.modalClose}
              accessibilityRole="button"
            >
              <Ionicons name="close" size={20} color="#FFFFFF" />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={diagramStyles.modalScroll}
            contentContainerStyle={diagramStyles.modalContent}
            maximumZoomScale={3}
            minimumZoomScale={1}
            showsVerticalScrollIndicator={false}
          >
            <View
              style={[
                diagramStyles.modalCard,
                { width: Math.min(winW - 24, 620) },
              ]}
            >
              {body}
              {spec.caption ? (
                <Text style={diagramStyles.modalCaption}>{spec.caption}</Text>
              ) : null}
            </View>
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </>
  );
}

const diagramStyles = StyleSheet.create({
  card: {
    backgroundColor: "#141020",
    borderRadius: 18,
    borderCurve: "continuous",
    padding: 14,
    marginVertical: 8,
    gap: 10,
    width: "100%",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  titleRow: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  iconBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "rgba(167, 139, 250, 0.16)",
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    flex: 1,
    fontFamily: FONTS.bodyBold,
    fontSize: 13.5,
    color: "#FFFFFF",
  },
  expandBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: UI_COLORS.surfaceSubtle,
    alignItems: "center",
    justifyContent: "center",
  },
  stage: {
    width: "100%",
  },
  svgFrame: {
    width: "100%",
    alignItems: "center",
  },
  customSvgWrap: {
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  caption: {
    fontFamily: FONTS.body,
    fontSize: 12.5,
    lineHeight: 18,
    color: UI_COLORS.textSecondary,
    paddingTop: 2,
  },
  flowList: {
    gap: 4,
  },
  flowCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: UI_COLORS.surfaceElevated,
    borderRadius: 14,
    borderCurve: "continuous",
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  flowStepBadge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  flowStepNum: {
    fontFamily: FONTS.bodyExtraBold,
    fontSize: 12.5,
  },
  flexText: {
    flex: 1,
    gap: 2,
  },
  flowTitle: {
    fontFamily: FONTS.bodyBold,
    fontSize: 13.5,
    lineHeight: 19,
    color: "#FFFFFF",
  },
  flowDetail: {
    fontFamily: FONTS.body,
    fontSize: 12.5,
    lineHeight: 18,
    color: UI_COLORS.textSecondary,
  },
  flowConnector: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 2,
  },
  edgeBadge: {
    backgroundColor: UI_COLORS.surfaceSubtle,
    borderRadius: UI_RADII.pill,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
    paddingHorizontal: 9,
    paddingVertical: 2,
    alignSelf: "center",
    marginBottom: 4,
  },
  edgeBadgeText: {
    fontFamily: FONTS.bodyBold,
    fontSize: 11,
    color: "#E2D9F3",
  },
  treeWrap: {
    alignItems: "center",
  },
  treeRootCard: {
    flexDirection: "column",
    alignItems: "center",
    width: "85%",
  },
  treeChildrenGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    width: "100%",
  },
  treeChildCol: {
    flex: 1,
    minWidth: "46%",
    gap: 6,
  },
  treeChildSingle: {
    minWidth: "100%",
  },
  stepDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  grandChildList: {
    gap: 4,
    paddingLeft: 10,
    borderLeftWidth: 2,
    borderLeftColor: "rgba(255, 255, 255, 0.12)",
  },
  grandChildPill: {
    backgroundColor: UI_COLORS.surfaceSubtle,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  grandChildText: {
    fontFamily: FONTS.bodySemiBold,
    fontSize: 12.5,
    color: "#FFFFFF",
  },
  barsContainer: {
    gap: 10,
  },
  barRowBlock: {
    gap: 5,
  },
  barLabelRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  barRowLabel: {
    fontFamily: FONTS.bodyBold,
    fontSize: 13,
    color: "#FFFFFF",
  },
  barTrack: {
    flexDirection: "row",
    gap: 4,
    width: "100%",
  },
  barSegment: {
    minHeight: 34,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 6,
  },
  barSegmentText: {
    fontFamily: FONTS.bodyBold,
    fontSize: 12,
  },
  fractionCell: {
    flex: 1,
    minHeight: 32,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 2,
  },
  fractionCellEmpty: {
    backgroundColor: UI_COLORS.surfaceSubtle,
    borderColor: "rgba(255, 255, 255, 0.08)",
  },
  fractionCellText: {
    fontFamily: FONTS.bodyBold,
    fontSize: 11,
  },
  chartRow: {
    gap: 5,
  },
  chartVal: {
    fontFamily: FONTS.bodyExtraBold,
    fontSize: 13,
  },
  chartTrack: {
    height: 12,
    borderRadius: 6,
    backgroundColor: UI_COLORS.surfaceSubtle,
    overflow: "hidden",
  },
  chartFill: {
    height: "100%",
    borderRadius: 6,
  },
  timelineList: {
    gap: 0,
  },
  timelineRow: {
    flexDirection: "row",
    gap: 10,
  },
  timelineRailCol: {
    width: 16,
    alignItems: "center",
  },
  timelineDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginTop: 14,
  },
  timelineRail: {
    flex: 1,
    width: 2,
    backgroundColor: "rgba(255, 255, 255, 0.14)",
    marginVertical: 2,
  },
  timelineCard: {
    flex: 1,
    backgroundColor: UI_COLORS.surfaceElevated,
    borderRadius: 14,
    borderWidth: 1,
    padding: 10,
    marginBottom: 8,
    gap: 4,
  },
  datePill: {
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: UI_RADII.pill,
  },
  dateText: {
    fontFamily: FONTS.bodyExtraBold,
    fontSize: 11,
  },
  vennWrap: {
    gap: 10,
  },
  vennCols: {
    flexDirection: "row",
    gap: 8,
  },
  vennBox: {
    flex: 1,
    backgroundColor: UI_COLORS.surfaceElevated,
    borderRadius: 14,
    borderWidth: 1,
    padding: 10,
    gap: 4,
  },
  vennBoxTitle: {
    fontFamily: FONTS.bodyBold,
    fontSize: 12.5,
    marginBottom: 2,
  },
  vennItem: {
    fontFamily: FONTS.body,
    fontSize: 12.5,
    lineHeight: 17,
    color: UI_COLORS.textPrimary,
  },
  vennOverlapBox: {
    backgroundColor: "rgba(167, 139, 250, 0.10)",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(167, 139, 250, 0.28)",
    padding: 10,
    gap: 4,
  },
  vennOverlapTitle: {
    fontFamily: FONTS.bodyBold,
    fontSize: 12.5,
    color: "#E2D9F3",
    marginBottom: 2,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(10, 8, 16, 0.96)",
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 18,
    paddingBottom: 12,
    gap: 12,
  },
  modalTitle: {
    flex: 1,
    fontFamily: FONTS.bodyBold,
    fontSize: 16,
    color: "#FFFFFF",
  },
  modalClose: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: UI_COLORS.surfaceElevated,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  modalScroll: {
    flex: 1,
  },
  modalContent: {
    flexGrow: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 12,
  },
  modalCard: {
    backgroundColor: "#141020",
    borderRadius: 24,
    borderCurve: "continuous",
    borderWidth: 1,
    borderColor: "rgba(167, 139, 250, 0.28)",
    padding: 18,
    gap: 14,
  },
  modalCaption: {
    fontFamily: FONTS.body,
    fontSize: 14,
    lineHeight: 20,
    color: UI_COLORS.textSecondary,
  },
});
