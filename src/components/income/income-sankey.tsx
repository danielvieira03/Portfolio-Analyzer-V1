"use client";

import { useState } from "react";
import { ResponsiveContainer, Sankey, Tooltip } from "recharts";
import { ChartTooltipBox, ChartTooltipRow } from "@/components/charts/chart-tooltip";
import { formatCurrency } from "@/lib/format";
import type { FlowLink, FlowNode } from "@/lib/portfolio/income";

const AMBER = "var(--primary)";
const MARGIN = { top: 18, right: 135, bottom: 10, left: 175 };

interface NodeShape {
  x: number;
  y: number;
  width: number;
  height: number;
  index: number;
  payload: FlowNode & { sourceNodes?: number[] };
}

interface LinkShape {
  sourceX: number;
  targetX: number;
  sourceY: number;
  targetY: number;
  sourceControlX: number;
  targetControlX: number;
  linkWidth: number;
  index: number;
}

/** Where the income comes from: top holdings of each category -> the category -> total annual income. Ribbons are amber and as thick as the income. */
export function IncomeSankey({ nodes, links }: { nodes: FlowNode[]; links: FlowLink[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const renderNode = (p: NodeShape) => {
    const { x, y, width, height, payload: n } = p;
    const isTotal = n.kind === "total";
    const isCategory = n.kind === "category";
    return (
      <g>
        <rect x={x} y={y} width={width} height={Math.max(height, 1)} rx={2} fill={AMBER} fillOpacity={isTotal || isCategory ? 1 : 0.85} />
        {isCategory ? (
          <text x={x + width / 2} y={y - 6} textAnchor="middle" fontSize={11} fontWeight={600} fill="var(--foreground)">
            {n.name}
          </text>
        ) : isTotal ? (
          <>
            <text x={x + width + 8} y={y + height / 2 - 2} textAnchor="start" fontSize={11} fontWeight={600} fill="var(--foreground)">
              {n.name}
            </text>
            <text x={x + width + 8} y={y + height / 2 + 12} textAnchor="start" fontSize={11} fill="var(--primary)" className="num">
              {formatCurrency(n.value)}
            </text>
          </>
        ) : (
          <text x={x - 8} y={y + height / 2 - 2} textAnchor="end" fontSize={11} fill="var(--foreground)">
            {n.name}
            <tspan x={x - 8} dy={13} fill="var(--muted-foreground)" className="num">
              {formatCurrency(n.value)}
            </tspan>
          </text>
        )}
      </g>
    );
  };

  const renderLink = (p: LinkShape) => {
    const { sourceX, targetX, sourceY, targetY, sourceControlX, targetControlX, linkWidth, index } = p;
    const half = linkWidth / 2;
    const d =
      `M${sourceX},${sourceY + half} C${sourceControlX},${sourceY + half} ${targetControlX},${targetY + half} ${targetX},${targetY + half}` +
      ` L${targetX},${targetY - half} C${targetControlX},${targetY - half} ${sourceControlX},${sourceY - half} ${sourceX},${sourceY - half} Z`;
    return (
      <path
        d={d}
        fill={AMBER}
        fillOpacity={hover === index ? 0.8 : 0.5}
        stroke="none"
        onMouseEnter={() => setHover(index)}
        onMouseLeave={() => setHover(null)}
      />
    );
  };

  return (
    <div className="overflow-x-auto">
      <div className="h-[400px] min-w-[600px]">
        <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 900, height: 400 }}>
          <Sankey
            data={{ nodes, links }}
            node={renderNode as never}
            link={renderLink as never}
            nodeWidth={10}
            nodePadding={32}
            linkCurvature={0.5}
            margin={MARGIN}
            iterations={64}
          >
            <Tooltip content={<FlowTooltip nodes={nodes} />} />
          </Sankey>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

/** What Recharts hands the tooltip: for a block `{ name, value }` of the node; for a ribbon `{ name: "From - To", value }`. */
interface TooltipEntry {
  payload?: { name?: string; value?: number };
}

function FlowTooltip({ active, payload, nodes }: { active?: boolean; payload?: TooltipEntry[]; nodes: FlowNode[] }) {
  const p = payload?.[0]?.payload;
  if (!active || !p?.name) return null;

  // A block: a holding, an "Other" group, a category or the total.
  const node = nodes.find((n) => n.name === p.name);
  if (node) {
    return (
      <ChartTooltipBox title={node.name}>
        {node.detail && <p className="text-muted-foreground">{node.detail}</p>}
        {node.range ? (
          <>
            <ChartTooltipRow label="Low" value={formatCurrency(node.range.low)} />
            <ChartTooltipRow label="Expected" value={formatCurrency(node.range.expected)} />
            <ChartTooltipRow label="High" value={formatCurrency(node.range.high)} />
          </>
        ) : (
          <ChartTooltipRow label="Expected annual income" value={formatCurrency(node.value)} />
        )}
      </ChartTooltipBox>
    );
  }

  // A ribbon, named "From - To" by Recharts: "AAPL → Equities".
  const cut = p.name.lastIndexOf(" - ");
  if (cut < 0) return null;
  const from = p.name.slice(0, cut);
  const to = p.name.slice(cut + 3);
  const source = nodes.find((n) => n.name === from);
  return (
    <ChartTooltipBox title={`${from} → ${to}`}>
      {source?.detail && <p className="text-muted-foreground">{source.detail}</p>}
      <ChartTooltipRow label="Expected annual income" value={formatCurrency(p.value ?? 0)} />
    </ChartTooltipBox>
  );
}
