import type { Content, Tool } from '../content/schema';
import { evaluate, selected, type Answers } from './conditions';
import { fillTemplate, recoContext } from './recommend';

export type NodeKind = 'tool' | 'external' | 'excel' | 'layer' | 'base' | 'output' | 'people';

export interface ArchNode {
  id: string;
  kind: NodeKind;
  label: string;
  detail?: string;
  notes: string[];
  toolId?: string;
}

export interface ArchRow {
  nodes: ArchNode[];
  /** Ligne pleine largeur (couches de l'architecture cible). */
  fullWidth?: boolean;
  /** Légende au-dessus de la rangée, encadrée en pointillés (ex. outils qui ne se parlent pas). */
  caption?: string;
}

export interface ArchEdge {
  from: string;
  to: string;
  style: 'auto' | 'manual';
}

export interface ArchDiagram {
  id: 'today' | 'target';
  title: string;
  subtitle: string;
  rows: ArchRow[];
  edges: ArchEdge[];
}

/** Schémas « Aujourd'hui » et « Cible recommandée », à partir des seules réponses de la PME. */
export function buildArchitecture(content: Content, rawAnswers: Answers): { today: ArchDiagram; target: ArchDiagram } {
  const ctx = recoContext(content, rawAnswers);
  const { answers, facts } = ctx;
  const holds = (c: Parameters<typeof evaluate>[0] | undefined) => c === undefined || evaluate(c, answers, facts);
  const fill = (text: string) => fillTemplate(text, ctx.variables);
  const cfg = content.architecture;

  const toolOptions = content.questions.filter((q) => q.type === 'tools');
  const chosenToolIds = new Set(
    toolOptions.flatMap((q) =>
      selected(answers, q.id)
        .map((id) => q.options.find((o) => o.id === id)?.tool)
        .filter((t): t is string => t !== undefined),
    ),
  );
  const chosen = content.tools.filter((t) => chosenToolIds.has(t.id));
  const hasExcel = chosen.some((t) => t.category === 'tableur');
  const internal = chosen.filter((t) => t.category !== 'tableur' && t.category !== 'externe');
  const external = chosen.filter((t) => t.category === 'externe');

  const toolNode = (t: Tool, withNotes: boolean): ArchNode => {
    const note = withNotes ? cfg.today.toolNotes.find((n) => n.tools.includes(t.id) && holds(n.when)) : undefined;
    return {
      id: `tool_${t.id}`,
      kind: t.category === 'externe' ? 'external' : 'tool',
      label: t.shortName ?? t.name,
      ...(note && { detail: note.text }),
      notes: [],
      toolId: t.id,
    };
  };
  const unknownNode = (label: string): ArchNode => ({ id: 'tool_unknown', kind: 'tool', label, notes: [] });

  // ---------- Aujourd'hui ----------
  const todaySources =
    internal.length > 0
      ? internal.map((t) => toolNode(t, true))
      : hasExcel
        ? []
        : [unknownNode(cfg.today.unknownTools)];
  const todayTop: ArchRow = {
    nodes: todaySources,
    ...(holds(cfg.today.silo.when) && todaySources.length > 1 && { caption: cfg.today.silo.text }),
  };
  const todayRows: ArchRow[] = [];
  const todayEdges: ArchEdge[] = [];
  if (todayTop.nodes.length > 0) todayRows.push(todayTop);

  const peopleAuto = !hasExcel && holds(cfg.today.people.autoWhen);
  const people: ArchNode = {
    id: 'people',
    kind: 'people',
    label: cfg.today.people.label,
    detail: peopleAuto ? cfg.today.people.detailAuto : cfg.today.people.detailManual,
    notes: [],
  };

  if (hasExcel) {
    const excel: ArchNode = {
      id: 'excel',
      kind: 'excel',
      label: cfg.today.excel.label,
      detail: cfg.today.excel.detail,
      notes: cfg.today.excel.notes.filter((n) => holds(n.when)).map((n) => n.text),
    };
    todayRows.push({ nodes: [excel] });
    todaySources.forEach((n) => todayEdges.push({ from: n.id, to: 'excel', style: 'manual' }));
    todayEdges.push({ from: 'excel', to: 'people', style: 'manual' });
  } else {
    todaySources.forEach((n) => todayEdges.push({ from: n.id, to: 'people', style: peopleAuto ? 'auto' : 'manual' }));
  }
  // La fiduciaire reçoit les pièces : elle se place à côté de la direction, alimentée par la compta (ou Excel).
  const externalNodes = external.map((t) => toolNode(t, true));
  const feeder = hasExcel
    ? 'excel'
    : (todaySources.find((n) => content.tools.find((t) => t.id === n.toolId)?.category === 'compta') ?? todaySources[0])
        ?.id;
  if (feeder) {
    const style = holds(cfg.today.externalAutoWhen) ? 'auto' : 'manual';
    externalNodes.forEach((n) => todayEdges.push({ from: feeder, to: n.id, style }));
  }
  todayRows.push({ nodes: [people, ...externalNodes] });

  // ---------- Cible recommandée ----------
  const t = cfg.target;
  const targetSources: ArchNode[] = [
    ...(internal.length > 0 ? internal.map((tool) => toolNode(tool, false)) : [unknownNode(t.unknownTools)]),
    ...(hasExcel ? [{ id: 'excel_source', kind: 'excel' as const, ...t.excelSource, notes: [] }] : []),
  ];
  const outputs: ArchNode[] = t.outputs
    .filter((o) => holds(o.when) && (o.requiresTools ?? []).every((id) => chosenToolIds.has(id)))
    .map((o, i) => ({ id: `output_${i}`, kind: 'output', label: fill(o.label), detail: fill(o.detail), notes: [] }));

  const target: ArchDiagram = {
    id: 'target',
    title: t.title,
    subtitle: t.subtitle,
    rows: [
      { nodes: targetSources },
      { nodes: [{ id: 'integration', kind: 'layer', ...t.integration, notes: [] }], fullWidth: true },
      { nodes: [{ id: 'base', kind: 'base', ...t.base, notes: [] }], fullWidth: true },
      { nodes: outputs },
      { nodes: [{ id: 'people', kind: 'people', ...t.people, notes: [] }] },
    ],
    edges: [
      ...targetSources.map((n) => ({ from: n.id, to: 'integration', style: 'auto' as const })),
      { from: 'integration', to: 'base', style: 'auto' },
      ...outputs.map((o) => ({ from: 'base', to: o.id, style: 'auto' as const })),
      ...(outputs[0] ? [{ from: outputs[0].id, to: 'people', style: 'auto' as const }] : []),
    ],
  };

  return {
    today: { id: 'today', title: cfg.today.title, subtitle: cfg.today.subtitle, rows: todayRows, edges: todayEdges },
    target,
  };
}

/** Description textuelle d'un schéma (lecteurs d'écran, rapport PDF). */
export function describeDiagram(content: Content, d: ArchDiagram): string {
  const byId = new Map(d.rows.flatMap((r) => r.nodes).map((n) => [n.id, n]));
  const { legend } = content.architecture;
  const links = d.edges.map((e) => {
    const style = e.style === 'auto' ? legend.auto : legend.manual;
    return `${byId.get(e.from)?.label} → ${byId.get(e.to)?.label} (${style.toLowerCase()})`;
  });
  return `${d.title}. ${links.join(' ; ')}.`;
}
