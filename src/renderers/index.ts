import type { ChartModel, ChartStyle } from '../models/index.js';
import {
  normalizeChartModel,
  type ChartModelInput,
} from '../config/defaults.js';
import { renderContributions } from './contributions.js';
import {
  renderArea,
  renderBar,
  renderLine,
  renderSparkline,
} from './charts.js';
import {
  renderGrid,
  renderStepLine,
  renderMilestoneScatter,
  renderMilestoneArea,
  renderClusteredBar,
  renderNeonGlow,
  renderNeonGlowStream,
  renderAsciiTerminal,
  renderHandDrawn,
} from './styled.js';

export type Renderer = (model: ChartModel) => string;

/**
 * Renderer registry. Add a new chart style by registering a renderer here; the
 * rest of the pipeline is style-agnostic.
 */
const REGISTRY: Record<ChartStyle, Renderer> = {
  contributions: renderContributions,
  line: renderLine,
  area: renderArea,
  bar: renderBar,
  sparkline: renderSparkline,
  grid: renderGrid,
  'step-line': renderStepLine,
  'milestone-scatter': renderMilestoneScatter,
  'milestone-area': renderMilestoneArea,
  'clustered-bar': renderClusteredBar,
  'neon-glow': renderNeonGlow,
  'neon-glow-stream': renderNeonGlowStream,
  'ascii-terminal': renderAsciiTerminal,
  'hand-drawn': renderHandDrawn,
};

/** Returns the registered renderer for a style. */
export function getRenderer(style: ChartStyle): Renderer {
  return REGISTRY[style];
}

/** Byte ceilings for produced SVGs. */
export const SIZE_LIMITS = {
  staticWarn: 100 * 1024,
  animatedWarn: 500 * 1024,
  hardMax: 3 * 1024 * 1024,
} as const;

export interface RenderOutput {
  readonly svg: string;
  readonly bytes: number;
}

/**
 * Renders the chart model to SVG and enforces the hard size ceiling. Callers
 * may inspect {@link RenderOutput.bytes} against the soft warning thresholds.
 *
 * Models supplied programmatically may omit block dimensions; they are
 * defaulted before the renderer runs.
 */
export function renderChart(input: ChartModelInput): RenderOutput {
  const model = normalizeChartModel(input);
  const renderer = getRenderer(model.config.style);
  const svg = renderer(model);
  const bytes = Buffer.byteLength(svg, 'utf8');
  if (bytes > SIZE_LIMITS.hardMax) {
    throw new Error(
      `Rendered SVG is ${bytes} bytes, exceeding the ` +
        `${SIZE_LIMITS.hardMax}-byte ceiling. Reduce columns/rows or ` +
        'disable animation.',
    );
  }
  return { svg, bytes };
}
