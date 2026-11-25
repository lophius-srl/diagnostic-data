import type { Content, Question, Tool } from '../content/schema';
import { evaluate, selected, type Answers } from './conditions';
import { fillTemplate, joinNames, listWords, type ListWords } from './text';

/** Outils du catalogue cochés par la PME (question de type « tools »), dans l'ordre du catalogue. */
export function chosenTools(content: Content, answers: Answers): Tool[] {
  const toolQuestion = content.questions.find((q) => q.type === 'tools');
  if (!toolQuestion) return [];
  const ids = new Set(
    selected(answers, toolQuestion.id).flatMap((id) => toolQuestion.options.find((o) => o.id === id)?.tool ?? []),
  );
  return content.tools.filter((t) => ids.has(t.id));
}

/**
 * Remplace {outils} par les logiciels donnés (« Odoo et WinBooks »), nom court si défini.
 * Les partenaires externes (fiduciaire) ne sont pas des logiciels : ils ne sont pas cités.
 */
export function withToolNames(text: string, tools: readonly Tool[], words?: ListWords): string {
  const software = tools.filter((t) => t.category !== 'externe');
  return fillTemplate(text, {
    outils: joinNames(
      software.map((t) => t.shortName ?? t.name),
      words,
    ),
  });
}

export interface Suggestion {
  /** Réponse proposée. */
  option: string;
  /** Explication affichée, outils nommés. */
  reason: string;
}

/** Réponse déduite des outils cochés, ou `undefined` si rien ne permet de la déduire. */
export function suggestionFor(content: Content, question: Question, answers: Answers): Suggestion | undefined {
  const tools = chosenTools(content, answers);
  for (const rule of question.suggest) {
    if (rule.when && !evaluate(rule.when, answers)) continue;
    const concerned = rule.capability ? tools.filter((t) => t.capabilities.includes(rule.capability ?? '')) : tools;
    if (rule.capability && concerned.length === 0) continue;
    return { option: rule.option, reason: withToolNames(rule.reason, concerned, listWords(content)) };
  }
  return undefined;
}
