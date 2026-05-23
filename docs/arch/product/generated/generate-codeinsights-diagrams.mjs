import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const outDir = path.dirname(fileURLToPath(import.meta.url));

const STYLE_SETS = [
  {
    slug: "style-1-flat-icon",
    label: "Style 1 Flat Icon",
    colors: {
      bg: "#F8FAFC",
      card: "#FFFFFF",
      card2: "#F1F5F9",
      ink: "#0F172A",
      muted: "#475569",
      soft: "#94A3B8",
      line: "#CBD5E1",
      agent: "#2563EB",
      agentFill: "#EFF6FF",
      agentStroke: "#BFDBFE",
      pipeline: "#059669",
      pipelineFill: "#ECFDF5",
      pipelineStroke: "#A7F3D0",
      review: "#D97706",
      reviewFill: "#FFFBEB",
      reviewStroke: "#FDE68A",
      artifact: "#7C3AED",
      artifactFill: "#F5F3FF",
      artifactStroke: "#DDD6FE",
      danger: "#DC2626",
      dangerFill: "#FEF2F2",
      dangerStroke: "#FECACA",
      shadowOpacity: "0.08",
    },
  },
  {
    slug: "style-2-dark-terminal",
    label: "Style 2 Dark Terminal",
    colors: {
      bg: "#0F0F1A",
      card: "#0F172A",
      card2: "#111827",
      ink: "#E2E8F0",
      muted: "#94A3B8",
      soft: "#64748B",
      line: "#334155",
      agent: "#3B82F6",
      agentFill: "#1E3A5F",
      agentStroke: "#3B82F6",
      pipeline: "#10B981",
      pipelineFill: "#052E16",
      pipelineStroke: "#059669",
      review: "#F97316",
      reviewFill: "#1C1917",
      reviewStroke: "#EA580C",
      artifact: "#A855F7",
      artifactFill: "#1E1B4B",
      artifactStroke: "#7C3AED",
      danger: "#EF4444",
      dangerFill: "#2A1114",
      dangerStroke: "#EF4444",
      shadowOpacity: "0.35",
    },
  },
  {
    slug: "style-3-blueprint",
    label: "Style 3 Blueprint",
    colors: {
      bg: "#0A1628",
      card: "#0D1F3C",
      card2: "#102A4C",
      ink: "#CAF0F8",
      muted: "#90E0EF",
      soft: "#48CAE4",
      line: "#00B4D8",
      agent: "#48CAE4",
      agentFill: "#0D1F3C",
      agentStroke: "#00B4D8",
      pipeline: "#06D6A0",
      pipelineFill: "#063B35",
      pipelineStroke: "#06D6A0",
      review: "#F77F00",
      reviewFill: "#3A250A",
      reviewStroke: "#F77F00",
      artifact: "#90E0EF",
      artifactFill: "#08263D",
      artifactStroke: "#48CAE4",
      danger: "#F77F00",
      dangerFill: "#3A1908",
      dangerStroke: "#F77F00",
      grid: true,
      shadowOpacity: "0.18",
    },
  },
  {
    slug: "style-4-notion-clean",
    label: "Style 4 Notion Clean",
    colors: {
      bg: "#FFFFFF",
      card: "#F9FAFB",
      card2: "#FFFFFF",
      ink: "#111827",
      muted: "#374151",
      soft: "#9CA3AF",
      line: "#E5E7EB",
      agent: "#3B82F6",
      agentFill: "#FFFFFF",
      agentStroke: "#E5E7EB",
      pipeline: "#3B82F6",
      pipelineFill: "#FFFFFF",
      pipelineStroke: "#E5E7EB",
      review: "#6B7280",
      reviewFill: "#FFFFFF",
      reviewStroke: "#E5E7EB",
      artifact: "#6B7280",
      artifactFill: "#FFFFFF",
      artifactStroke: "#E5E7EB",
      danger: "#6B7280",
      dangerFill: "#FFFFFF",
      dangerStroke: "#E5E7EB",
      shadowOpacity: "0",
    },
  },
  {
    slug: "style-5-glassmorphism",
    label: "Style 5 Glassmorphism",
    colors: {
      bg: "#0D1117",
      card: "#161B22",
      card2: "#1F2937",
      ink: "#F0F6FC",
      muted: "#8B949E",
      soft: "#6E7681",
      line: "#30363D",
      agent: "#58A6FF",
      agentFill: "#0D2847",
      agentStroke: "#58A6FF",
      pipeline: "#3FB950",
      pipelineFill: "#0F2F1A",
      pipelineStroke: "#3FB950",
      review: "#F78166",
      reviewFill: "#321A16",
      reviewStroke: "#F78166",
      artifact: "#BC8CFF",
      artifactFill: "#271948",
      artifactStroke: "#BC8CFF",
      danger: "#FF7B72",
      dangerFill: "#311416",
      dangerStroke: "#FF7B72",
      glow: true,
      shadowOpacity: "0.45",
    },
  },
  {
    slug: "style-6-claude-official",
    label: "Style 6 Claude Official",
    colors: {
      bg: "#F8F6F3",
      card: "#FFFDF8",
      card2: "#E8E6E3",
      ink: "#1A1A1A",
      muted: "#6A6A6A",
      soft: "#8C8C8C",
      line: "#4A4A4A",
      agent: "#457B9D",
      agentFill: "#A8C5E6",
      agentStroke: "#4A4A4A",
      pipeline: "#2F7D6F",
      pipelineFill: "#9DD4C7",
      pipelineStroke: "#4A4A4A",
      review: "#8A5A00",
      reviewFill: "#F4E4C1",
      reviewStroke: "#4A4A4A",
      artifact: "#5A5A5A",
      artifactFill: "#E8E6E3",
      artifactStroke: "#4A4A4A",
      danger: "#8F3A32",
      dangerFill: "#F4D0C8",
      dangerStroke: "#4A4A4A",
      shadowOpacity: "0.12",
    },
  },
  {
    slug: "style-7-openai",
    label: "Style 7 OpenAI Official",
    colors: {
      bg: "#FFFFFF",
      card: "#FFFFFF",
      card2: "#F7F7F8",
      ink: "#0D0D0D",
      muted: "#6E6E80",
      soft: "#71717A",
      line: "#E5E5E5",
      agent: "#1D4ED8",
      agentFill: "#FFFFFF",
      agentStroke: "#E5E5E5",
      pipeline: "#10A37F",
      pipelineFill: "#FFFFFF",
      pipelineStroke: "#E5E5E5",
      review: "#F97316",
      reviewFill: "#FFFFFF",
      reviewStroke: "#E5E5E5",
      artifact: "#71717A",
      artifactFill: "#FFFFFF",
      artifactStroke: "#E5E5E5",
      danger: "#F97316",
      dangerFill: "#FFFFFF",
      dangerStroke: "#E5E5E5",
      shadowOpacity: "0",
    },
  },
];

let C = STYLE_SETS[0].colors;

function esc(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function svgShell(width, height, title, body) {
  const extraDefs = `${C.grid ? `
    <pattern id="grid" width="30" height="30" patternUnits="userSpaceOnUse">
      <path d="M 30 0 L 0 0 0 30" fill="none" stroke="#112240" stroke-width="0.5"/>
    </pattern>` : ""}
    ${C.glow ? `
    <radialGradient id="glow-blue" cx="30%" cy="28%" r="45%">
      <stop offset="0%" stop-color="${C.agent}" stop-opacity="0.18"/>
      <stop offset="100%" stop-color="${C.agent}" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="glow-purple" cx="72%" cy="62%" r="40%">
      <stop offset="0%" stop-color="${C.artifact}" stop-opacity="0.14"/>
      <stop offset="100%" stop-color="${C.artifact}" stop-opacity="0"/>
    </radialGradient>` : ""}`;
  const extraBackground = `${C.grid ? `\n  <rect width="${width}" height="${height}" fill="url(#grid)" opacity="0.65"/>` : ""}${C.glow ? `\n  <rect width="${width}" height="${height}" fill="url(#glow-blue)"/>\n  <rect width="${width}" height="${height}" fill="url(#glow-purple)"/>` : ""}`;
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" role="img" aria-labelledby="title desc">
  <title id="title">${esc(title)}</title>
  <desc id="desc">CodeInsights homepage architecture diagram generated from product source materials.</desc>
  <style>
    text { font-family: -apple-system, BlinkMacSystemFont, "Helvetica Neue", Helvetica, Arial, "PingFang SC", "Microsoft YaHei", sans-serif; letter-spacing: 0; }
    .mono { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace; }
    .title { fill: ${C.ink}; font-size: 28px; font-weight: 700; }
    .subtitle { fill: ${C.muted}; font-size: 15px; }
    .label { fill: ${C.ink}; font-size: 15px; font-weight: 650; }
    .body { fill: ${C.muted}; font-size: 13px; }
    .tiny { fill: ${C.muted}; font-size: 11px; }
    .chip { fill: ${C.ink}; font-size: 12px; font-weight: 650; }
  </style>
  <defs>
    <filter id="shadow" x="-15%" y="-15%" width="130%" height="130%">
      <feDropShadow dx="0" dy="8" stdDeviation="8" flood-color="#0F172A" flood-opacity="${C.shadowOpacity ?? "0.08"}"/>
    </filter>
    ${extraDefs}
    <marker id="arrow-blue" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
      <polygon points="0 0, 10 3.5, 0 7" fill="${C.agent}"/>
    </marker>
    <marker id="arrow-green" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
      <polygon points="0 0, 10 3.5, 0 7" fill="${C.pipeline}"/>
    </marker>
    <marker id="arrow-orange" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
      <polygon points="0 0, 10 3.5, 0 7" fill="${C.review}"/>
    </marker>
    <marker id="arrow-purple" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
      <polygon points="0 0, 10 3.5, 0 7" fill="${C.artifact}"/>
    </marker>
    <marker id="arrow-gray" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
      <polygon points="0 0, 10 3.5, 0 7" fill="${C.soft}"/>
    </marker>
  </defs>
  <rect width="${width}" height="${height}" fill="${C.bg}"/>${extraBackground}
${body}
</svg>
`;
}

function textBlock(x, y, lines, opts = {}) {
  const {
    cls = "body",
    color,
    size,
    weight,
    anchor = "start",
    leading = 18,
  } = opts;
  const attrs = [
    `x="${x}"`,
    `y="${y}"`,
    `text-anchor="${anchor}"`,
    `class="${cls}"`,
  ];
  if (color) attrs.push(`fill="${color}"`);
  if (size) attrs.push(`font-size="${size}"`);
  if (weight) attrs.push(`font-weight="${weight}"`);
  return lines
    .map((line, index) => {
      const lineAttrs = attrs.map((attr) => {
        if (attr.startsWith('y="')) {
          return `y="${y + index * leading}"`;
        }
        return attr;
      });
      return `<text ${lineAttrs.join(" ")}>${esc(line)}</text>`;
    })
    .join("\n");
}

function card(x, y, w, h, opts = {}) {
  const {
    fill = C.card,
    stroke = C.line,
    rx = 16,
    shadow = true,
    dash,
    opacity = 1,
  } = opts;
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" fill="${fill}" stroke="${stroke}" stroke-width="1.4"${dash ? ` stroke-dasharray="${dash}"` : ""} opacity="${opacity}"${shadow ? ' filter="url(#shadow)"' : ""}/>`;
}

function header(x, y, title, subtitle) {
  return `${textBlock(x, y, [title], { cls: "title", leading: 32 })}
${textBlock(x, y + 30, [subtitle], { cls: "subtitle", leading: 20 })}`;
}

function sectionLabel(x, y, label, color) {
  return `<g transform="translate(${x} ${y})">
    <rect x="0" y="-16" width="${label.length * 9 + 24}" height="24" rx="12" fill="${color}" opacity="0.12"/>
    <circle cx="12" cy="-4" r="4" fill="${color}"/>
    <text x="24" y="0" class="tiny" fill="${color}" font-weight="700">${esc(label)}</text>
  </g>`;
}

function chip(x, y, label, fill, stroke, color = C.ink) {
  const width = Math.max(72, label.length * 8 + 28);
  return `<g transform="translate(${x} ${y})">
    <rect x="0" y="0" width="${width}" height="28" rx="14" fill="${fill}" stroke="${stroke}" stroke-width="1"/>
    <text x="${width / 2}" y="18" text-anchor="middle" class="chip" fill="${color}">${esc(label)}</text>
  </g>`;
}

function arrowLine(x1, y1, x2, y2, color = C.agent, marker = "arrow-blue", opts = {}) {
  const dash = opts.dash ? ` stroke-dasharray="${opts.dash}"` : "";
  return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${color}" stroke-width="${opts.width || 2}" fill="none" marker-end="url(#${marker})"${dash}/>`;
}

function arrowPath(d, color = C.agent, marker = "arrow-blue", opts = {}) {
  const dash = opts.dash ? ` stroke-dasharray="${opts.dash}"` : "";
  return `<path d="${d}" stroke="${color}" stroke-width="${opts.width || 2}" fill="none" marker-end="url(#${marker})"${dash}/>`;
}

function badge(cx, cy, label, fill, opts = {}) {
  const r = opts.r || 24;
  return `<g>
    <circle cx="${cx}" cy="${cy}" r="${r}" fill="${fill}"/>
    <circle cx="${cx}" cy="${cy}" r="${r + 2}" fill="none" stroke="${fill}" stroke-width="1" opacity="0.35"/>
    <text x="${cx}" y="${cy + 4}" text-anchor="middle" fill="${opts.text || "#FFFFFF"}" font-size="${opts.size || 10}" font-weight="750">${esc(label)}</text>
  </g>`;
}

function stageBox(x, y, w, h, number, title, lines, fill, stroke, color) {
  return `<g>
    ${card(x, y, w, h, { fill, stroke, rx: 14, shadow: true })}
    <circle cx="${x + 28}" cy="${y + 30}" r="15" fill="${color}"/>
    <text x="${x + 28}" y="${y + 35}" text-anchor="middle" fill="#FFFFFF" font-size="13" font-weight="750">${number}</text>
    ${textBlock(x + 54, y + 28, [title], { cls: "label", color, size: 16, leading: 20 })}
    ${textBlock(x + 22, y + 66, lines, { cls: "body", leading: 17 })}
  </g>`;
}

function diamond(cx, cy, label, fill = C.reviewFill, stroke = C.reviewStroke, color = C.review) {
  return `<g>
    <polygon points="${cx},${cy - 30} ${cx + 38},${cy} ${cx},${cy + 30} ${cx - 38},${cy}" fill="${fill}" stroke="${stroke}" stroke-width="1.5"/>
    <text x="${cx}" y="${cy - 2}" text-anchor="middle" fill="${color}" font-size="12" font-weight="750">${esc(label)}</text>
    <text x="${cx}" y="${cy + 14}" text-anchor="middle" fill="${C.muted}" font-size="10">human</text>
  </g>`;
}

function productOverview() {
  const body = `
  ${header(60, 54, "CodeInsights 产品架构总览", "运行时接入层 + 工程工作流层：不重写通用 Agent 内核，把成熟 coding agent 放进真实贡献流程。")}

  ${card(60, 126, 240, 102, { fill: C.card, stroke: C.line })}
  ${badge(96, 174, "User", C.agent, { size: 10 })}
  ${textBlock(132, 160, ["开源贡献者 / 维护者"], { cls: "label" })}
  ${textBlock(132, 184, ["目标、判断、质量边界"], { cls: "body" })}

  ${card(430, 116, 340, 124, { fill: C.card, stroke: C.agentStroke })}
  ${sectionLabel(456, 148, "CORE", C.agent)}
  ${textBlock(456, 182, ["CodeInsights"], { cls: "title", size: 28 })}
  ${textBlock(456, 210, ["Runtime Access + Engineering Workflow"], { cls: "subtitle" })}
  ${textBlock(456, 230, ["本地优先工作台 / gate / artifacts / checkpoint"], { cls: "tiny" })}

  ${card(910, 126, 230, 102, { fill: C.card, stroke: C.pipelineStroke })}
  ${badge(946, 174, "OSS", C.pipeline, { size: 10 })}
  ${textBlock(982, 160, ["贡献材料就绪"], { cls: "label" })}
  ${textBlock(982, 184, ["patch / PR notes / artifacts"], { cls: "body" })}

  ${arrowLine(300, 177, 420, 177, C.agent, "arrow-blue")}
  ${arrowLine(770, 177, 900, 177, C.pipeline, "arrow-green")}

  ${arrowPath("M 600 240 C 470 270 270 268 230 305", C.agent, "arrow-blue")}
  ${arrowPath("M 600 240 C 600 275 600 278 600 305", C.pipeline, "arrow-green")}
  ${arrowPath("M 600 240 C 735 270 945 268 970 305", C.artifact, "arrow-purple")}

  ${card(60, 306, 330, 268, { fill: C.card, stroke: C.agentStroke })}
  ${sectionLabel(86, 340, "AGENT MODE", C.agent)}
  ${textBlock(86, 378, ["完整运行时接入"], { cls: "label", color: C.agent })}
  ${textBlock(86, 405, ["调用 agent 运行时，而不是把能力", "弱化成普通聊天或薄工具层。"], { cls: "body", leading: 18 })}
  ${chip(86, 455, "当前：Claude Agent SDK", C.agentFill, C.agentStroke, C.agent)}
  ${chip(86, 493, "Anthropic 兼容渠道", C.agentFill, C.agentStroke, C.agent)}
  ${chip(86, 531, "方向：更多 coding runtime", C.card2, C.line, C.muted)}

  ${card(435, 306, 330, 268, { fill: C.card, stroke: C.pipelineStroke })}
  ${sectionLabel(461, 340, "PIPELINE MODE", C.pipeline)}
  ${textBlock(461, 378, ["人类设计流程，AI 完成节点"], { cls: "label", color: C.pipeline })}
  ${textBlock(461, 405, ["Explorer -> Planner -> Developer", "-> Reviewer -> Tester"], { cls: "body", leading: 18 })}
  ${chip(461, 455, "Explorer / Planner / Tester", C.pipelineFill, C.pipelineStroke, C.pipeline)}
  ${chip(461, 493, "Developer / Reviewer: Codex", C.agentFill, C.agentStroke, C.agent)}
  ${chip(461, 531, "人工 gate + 返工闭环", C.reviewFill, C.reviewStroke, C.review)}

  ${card(810, 306, 330, 268, { fill: C.card, stroke: C.artifactStroke })}
  ${sectionLabel(836, 340, "PLATFORM LAYER", C.artifact)}
  ${textBlock(836, 378, ["一站式贡献工作台"], { cls: "label", color: C.artifact })}
  ${textBlock(836, 405, ["工作区、权限、MCP、Skills、记录", "和阶段产物都在同一处管理。"], { cls: "body", leading: 18 })}
  ${chip(836, 455, "本地 JSON / JSONL", C.artifactFill, C.artifactStroke, C.artifact)}
  ${chip(836, 493, "artifacts / checkpoint", C.artifactFill, C.artifactStroke, C.artifact)}
  ${chip(836, 531, "safe / ask / allow", C.reviewFill, C.reviewStroke, C.review)}

  ${card(60, 616, 1080, 96, { fill: C.card, stroke: C.line, rx: 18 })}
  ${textBlock(92, 650, ["核心主张"], { cls: "label", color: C.ink })}
  ${textBlock(92, 675, ["人类工程经验负责流程、边界和质量门禁；AI 负责节点内搜索、修改、审查支持和验证。"], { cls: "body", size: 14 })}
  ${chip(918, 636, "不自研通用内核", C.dangerFill, C.dangerStroke, C.danger)}
  ${chip(918, 672, "复用成熟运行时", C.agentFill, C.agentStroke, C.agent)}
  `;
  return svgShell(1200, 740, "CodeInsights 产品架构总览", body);
}

function runtimeAccessBoundary() {
  const body = `
  ${header(60, 54, "运行时接入边界", "连接成熟 coding agent，不重写它们：CodeInsights 负责工作区、权限、记录和编排。")}

  ${card(60, 130, 260, 470, { fill: C.card, stroke: C.dangerStroke })}
  ${sectionLabel(88, 166, "WHY NOT", C.danger)}
  ${textBlock(88, 205, ["通用内核 / Skills 堆叠的不稳定层"], { cls: "label", color: C.danger })}
  ${card(88, 244, 204, 70, { fill: C.dangerFill, stroke: C.dangerStroke, rx: 12, shadow: false })}
  ${textBlock(110, 270, ["自研通用 Agent 内核"], { cls: "label", size: 14 })}
  ${textBlock(110, 292, ["持续追逐模型和 CLI 变化"], { cls: "tiny" })}
  ${card(88, 334, 204, 70, { fill: C.reviewFill, stroke: C.reviewStroke, rx: 12, shadow: false })}
  ${textBlock(110, 360, ["只堆 Skills"], { cls: "label", size: 14 })}
  ${textBlock(110, 382, ["依赖语义稳定和任务边界"], { cls: "tiny" })}
  ${card(88, 424, 204, 70, { fill: C.card2, stroke: C.line, rx: 12, shadow: false })}
  ${textBlock(110, 450, ["单 Agent 长任务"], { cls: "label", size: 14 })}
  ${textBlock(110, 472, ["过程难审计，返工成本高"], { cls: "tiny" })}
  ${textBlock(88, 542, ["CodeInsights 的选择：", "把专业运行时放进工程流程。"], { cls: "body", leading: 18 })}

  ${arrowPath("M 320 366 C 355 366 370 366 400 366", C.soft, "arrow-gray", { dash: "6 5" })}

  ${card(410, 120, 370, 500, { fill: C.card, stroke: C.agentStroke, rx: 22 })}
  <rect x="434" y="154" width="322" height="430" rx="18" fill="${C.agentFill}" stroke="${C.agent}" stroke-width="1.6" stroke-dasharray="8 6" opacity="0.95"/>
  ${sectionLabel(460, 185, "CODEINSIGHTS BOUNDARY", C.agent)}
  ${textBlock(460, 224, ["接入层，不实现通用 Agent 内核"], { cls: "label", color: C.agent, size: 18 })}
  ${textBlock(460, 252, ["保留底层运行时能力；CodeInsights 只管理工程外壳。"], { cls: "body" })}
  ${card(460, 292, 250, 46, { fill: C.card, stroke: C.line, rx: 10, shadow: false })}
  ${textBlock(480, 321, ["Workspace: cwd / project files"], { cls: "body", size: 13 })}
  ${card(460, 354, 250, 46, { fill: C.card, stroke: C.line, rx: 10, shadow: false })}
  ${textBlock(480, 383, ["MCP / Skills: 可选增强层"], { cls: "body", size: 13 })}
  ${card(460, 416, 250, 46, { fill: C.card, stroke: C.reviewStroke, rx: 10, shadow: false })}
  ${textBlock(480, 445, ["Permission policy + human confirm"], { cls: "body", size: 13 })}
  ${card(460, 478, 250, 46, { fill: C.card, stroke: C.artifactStroke, rx: 10, shadow: false })}
  ${textBlock(480, 507, ["Local records: JSONL / artifacts"], { cls: "body", size: 13 })}
  ${textBlock(460, 558, ["完整运行时调用：stream / tools / terminal / file ops / permission requests"], { cls: "tiny" })}

  ${card(870, 112, 270, 520, { fill: C.card, stroke: C.pipelineStroke })}
  ${sectionLabel(900, 150, "CONNECTED RUNTIMES", C.pipeline)}
  ${textBlock(900, 188, ["成熟 coding agent 运行时"], { cls: "label", color: C.pipeline })}
  ${badge(928, 246, "Claude", "#D97757", { size: 9, r: 25 })}
  ${textBlock(970, 236, ["当前 Agent 模式"], { cls: "label", size: 14 })}
  ${textBlock(970, 258, ["Claude Agent SDK"], { cls: "body" })}
  ${badge(928, 328, "API", C.agent, { size: 10, r: 24 })}
  ${textBlock(970, 318, ["Anthropic 兼容渠道"], { cls: "label", size: 14 })}
  ${textBlock(970, 340, ["按版本标注支持范围"], { cls: "body" })}
  ${badge(928, 410, "Codex", "#10A37F", { size: 9, r: 25 })}
  ${textBlock(970, 400, ["Pipeline 节点"], { cls: "label", size: 14 })}
  ${textBlock(970, 422, ["Developer / Reviewer"], { cls: "body" })}
  ${badge(928, 492, "Next", C.soft, { size: 10, r: 24 })}
  ${textBlock(970, 482, ["路线图"], { cls: "label", size: 14 })}
  ${textBlock(970, 504, ["Codex Agent / Custom Runtime"], { cls: "body" })}

  ${arrowPath("M 756 246 C 806 246 822 246 872 246", C.agent, "arrow-blue")}
  ${arrowPath("M 756 328 C 806 328 822 328 872 328", C.agent, "arrow-blue")}
  ${arrowPath("M 756 410 C 806 410 822 410 872 410", C.pipeline, "arrow-green")}
  ${arrowPath("M 756 492 C 806 492 822 492 872 492", C.soft, "arrow-gray", { dash: "7 5" })}

  ${card(60, 650, 1080, 54, { fill: C.card, stroke: C.line, rx: 16 })}
  ${textBlock(88, 684, ["上游 agent 升级后，CodeInsights 在已接入运行时范围内优先继承能力，减少二次封装适配成本。"], { cls: "body", size: 14 })}
  `;
  return svgShell(1200, 740, "CodeInsights 运行时接入边界", body);
}

function pipelineContributionLoop() {
  const startX = 60;
  const y = 286;
  const w = 165;
  const h = 128;
  const gap = 80;
  const xs = [startX, startX + w + gap, startX + 2 * (w + gap), startX + 3 * (w + gap), startX + 4 * (w + gap)];
  const gates = xs.slice(0, 4).map((x) => x + w + gap / 2);
  const body = `
  ${header(60, 54, "Pipeline 模式：贡献闭环", "人类工程经验设计阶段和 gate，AI 在节点内部完成探索、计划、开发、审核支持和验证。")}

  ${card(60, 124, 1160, 86, { fill: C.card, stroke: C.reviewStroke, rx: 18 })}
  ${sectionLabel(92, 158, "HUMAN JUDGMENT", C.review)}
  ${textBlock(92, 188, ["方向确认、风险判断、继续 / 重跑 / 反馈返工"], { cls: "label", color: C.review })}
  ${chip(828, 151, "Approve", C.pipelineFill, C.pipelineStroke, C.pipeline)}
  ${chip(936, 151, "Rerun", C.reviewFill, C.reviewStroke, C.review)}
  ${chip(1028, 151, "Feedback", C.agentFill, C.agentStroke, C.agent)}

  <rect x="44" y="250" width="1188" height="210" rx="24" fill="${C.card}" stroke="${C.line}" stroke-width="1.2" filter="url(#shadow)"/>
  ${sectionLabel(72, 274, "AI-EXECUTED STAGES", C.pipeline)}

  ${stageBox(xs[0], y, w, h, "1", "Explorer", ["读上下文", "发现贡献点", "报告"], C.pipelineFill, C.pipelineStroke, C.pipeline)}
  ${stageBox(xs[1], y, w, h, "2", "Planner", ["拆计划", "列风险", "定验证"], C.pipelineFill, C.pipelineStroke, C.pipeline)}
  ${stageBox(xs[2], y, w, h, "3", "Developer", ["改代码", "补测试", "写摘要"], C.agentFill, C.agentStroke, C.agent)}
  ${stageBox(xs[3], y, w, h, "4", "Reviewer", ["查正确性", "找回归", "给反馈"], C.reviewFill, C.reviewStroke, C.review)}
  ${stageBox(xs[4], y, w, h, "5", "Tester", ["跑验证", "记结果", "列阻塞"], C.artifactFill, C.artifactStroke, C.artifact)}

  ${diamond(gates[0], y + 64, "gate")}
  ${diamond(gates[1], y + 64, "gate")}
  ${diamond(gates[2], y + 64, "gate")}
  ${diamond(gates[3], y + 64, "gate")}

  ${arrowLine(xs[0] + w, y + 64, gates[0] - 38, y + 64, C.pipeline, "arrow-green")}
  ${arrowLine(gates[0] + 38, y + 64, xs[1], y + 64, C.pipeline, "arrow-green")}
  ${arrowLine(xs[1] + w, y + 64, gates[1] - 38, y + 64, C.pipeline, "arrow-green")}
  ${arrowLine(gates[1] + 38, y + 64, xs[2], y + 64, C.pipeline, "arrow-green")}
  ${arrowLine(xs[2] + w, y + 64, gates[2] - 38, y + 64, C.agent, "arrow-blue")}
  ${arrowLine(gates[2] + 38, y + 64, xs[3], y + 64, C.agent, "arrow-blue")}
  ${arrowLine(xs[3] + w, y + 64, gates[3] - 38, y + 64, C.review, "arrow-orange")}
  ${arrowLine(gates[3] + 38, y + 64, xs[4], y + 64, C.artifact, "arrow-purple")}

  ${arrowPath(`M ${xs[3] + 86} ${y + h + 18} C ${xs[3] + 30} ${y + h + 92}, ${xs[2] + 132} ${y + h + 92}, ${xs[2] + 86} ${y + h + 18}`, C.review, "arrow-orange")}
  ${card(xs[2] + 122, y + h + 70, 220, 36, { fill: C.card, stroke: C.reviewStroke, rx: 18, shadow: false })}
  ${textBlock(xs[2] + 232, y + h + 93, ["feedback / rework"], { cls: "tiny", anchor: "middle", color: C.review, weight: 700 })}

  ${arrowPath(`M ${xs[4] + w} ${y + 64} C ${xs[4] + w + 40} ${y + 64}, ${xs[4] + w + 50} 538, ${xs[4] + w - 6} 548`, C.artifact, "arrow-purple")}
  ${card(930, 548, 290, 118, { fill: C.card, stroke: C.artifactStroke, rx: 18 })}
  ${sectionLabel(958, 580, "OUTCOME", C.artifact)}
  ${textBlock(958, 617, ["提交材料汇总"], { cls: "label", color: C.artifact })}
  ${textBlock(958, 642, ["Patch / PR notes", "Artifacts / test records"], { cls: "body", leading: 20 })}

  ${card(60, 548, 820, 118, { fill: C.card, stroke: C.line, rx: 18 })}
  ${sectionLabel(92, 580, "BOUNDARY", C.agent)}
  ${textBlock(92, 617, ["不是一次性全自动跑完，也不是第六个自动 PR 阶段。"], { cls: "label", color: C.ink })}
  ${textBlock(92, 642, ["Pipeline 在关键阶段保留人工 gate；Tester 通过后进入材料准备和后续提交动作。"], { cls: "body", leading: 18 })}
  `;
  return svgShell(1280, 720, "CodeInsights Pipeline 贡献闭环", body);
}

function trustControlLayer() {
  const modules = [
    [70, 338, "Permission", "safe / ask / allow", C.review, C.reviewFill, C.reviewStroke],
    [250, 338, "Human Gate", "approve / rerun", C.review, C.reviewFill, C.reviewStroke],
    [430, 338, "JSONL Records", "replayable trace", C.artifact, C.artifactFill, C.artifactStroke],
    [610, 338, "Artifacts", "reports / manifest", C.artifact, C.artifactFill, C.artifactStroke],
    [790, 338, "Checkpoint", "resume state", C.pipeline, C.pipelineFill, C.pipelineStroke],
    [970, 338, "Local Workspace", "cwd + MCP + Skills", C.agent, C.agentFill, C.agentStroke],
  ];
  const moduleSvg = modules
    .map(([x, y, title, sub, color, fill, stroke], i) => {
      const icon = `<circle cx="${x + 80}" cy="${y + 34}" r="24" fill="${fill}" stroke="${stroke}" stroke-width="1.2"/>
        <text x="${x + 80}" y="${y + 39}" text-anchor="middle" fill="${color}" font-size="14" font-weight="800">${i + 1}</text>`;
      return `<g>
        ${card(x, y, 160, 114, { fill: C.card, stroke, rx: 16 })}
        ${icon}
        ${textBlock(x + 80, y + 78, [title], { cls: "label", color, size: 14, anchor: "middle" })}
        ${textBlock(x + 80, y + 100, [sub], { cls: "tiny", anchor: "middle" })}
      </g>`;
    })
    .join("\n");
  const body = `
  ${header(60, 54, "Trust & Control Layer", "让 AI 做更多节点内工作，但让工程师保留权限、gate、记录、恢复和验证控制权。")}

  ${card(88, 132, 300, 104, { fill: C.agentFill, stroke: C.agentStroke, rx: 18 })}
  ${badge(130, 184, "AI", C.agent, { size: 12 })}
  ${textBlock(176, 170, ["AI 执行力"], { cls: "label", color: C.agent })}
  ${textBlock(176, 194, ["搜索、修改、审查支持、验证"], { cls: "body" })}
  ${card(812, 132, 300, 104, { fill: C.reviewFill, stroke: C.reviewStroke, rx: 18 })}
  ${badge(854, 184, "Human", C.review, { size: 9 })}
  ${textBlock(900, 170, ["人类工程判断"], { cls: "label", color: C.review })}
  ${textBlock(900, 194, ["方向、边界、质量和最终决策"], { cls: "body" })}

  ${card(428, 118, 344, 138, { fill: C.card, stroke: C.line, rx: 22 })}
  ${sectionLabel(464, 154, "CONTROL BOUNDARY", C.pipeline)}
  ${textBlock(464, 192, ["CodeInsights 控制边界"], { cls: "title", size: 24 })}
  ${textBlock(464, 222, ["把执行力约束到可审计、可回退、可验证的贡献流程里。"], { cls: "body" })}

  ${arrowPath("M 388 184 C 405 184 410 184 428 184", C.agent, "arrow-blue")}
  ${arrowPath("M 812 184 C 795 184 790 184 772 184", C.review, "arrow-orange")}
  ${arrowPath("M 600 256 C 600 288 600 304 600 326", C.pipeline, "arrow-green")}

  <rect x="52" y="302" width="1096" height="186" rx="28" fill="${C.card}" stroke="${C.line}" stroke-width="1.2" filter="url(#shadow)"/>
  ${sectionLabel(84, 326, "PROOF LAYER", C.artifact)}
  ${moduleSvg}
  ${arrowLine(230, 395, 248, 395, C.soft, "arrow-gray")}
  ${arrowLine(410, 395, 428, 395, C.soft, "arrow-gray")}
  ${arrowLine(590, 395, 608, 395, C.soft, "arrow-gray")}
  ${arrowLine(770, 395, 788, 395, C.soft, "arrow-gray")}
  ${arrowLine(950, 395, 968, 395, C.soft, "arrow-gray")}

  ${card(100, 560, 1000, 88, { fill: C.card, stroke: C.pipelineStroke, rx: 20 })}
  ${textBlock(132, 596, ["结果"], { cls: "label", color: C.pipeline })}
  ${textBlock(132, 626, ["可审计 / 可恢复 / 可验证的开源贡献流程"], { cls: "title", size: 24 })}
  ${chip(860, 584, "非全自动", C.dangerFill, C.dangerStroke, C.danger)}
  ${chip(956, 584, "工程师控制", C.pipelineFill, C.pipelineStroke, C.pipeline)}
  `;
  return svgShell(1200, 700, "CodeInsights Trust and Control Layer", body);
}

const diagramFactories = [
  ["codeinsights-product-architecture-overview.svg", productOverview],
  ["codeinsights-runtime-access-boundary.svg", runtimeAccessBoundary],
  ["codeinsights-pipeline-contribution-loop.svg", pipelineContributionLoop],
  ["codeinsights-trust-control-layer.svg", trustControlLayer],
];

function writeDiagramSet(style, targetDir) {
  C = style.colors;
  fs.mkdirSync(targetDir, { recursive: true });
  for (const [name, createSvg] of diagramFactories) {
    fs.writeFileSync(path.join(targetDir, name), createSvg(), "utf8");
    console.log(`${style.slug}/${name}`);
  }
}

writeDiagramSet(STYLE_SETS[0], outDir);

for (const style of STYLE_SETS) {
  writeDiagramSet(style, path.join(outDir, "styles", style.slug));
}
