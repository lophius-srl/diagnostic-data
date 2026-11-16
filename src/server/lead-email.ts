import type { Content } from '../content/schema';
import { selected, type Answers } from '../engine/conditions';
import type { DiagnosticResult } from '../engine/diagnostic';
import { questionText, visibleQuestions } from '../engine/flow';
import { escapeXml } from '../diagram/svg';
import type { LeadContact } from '../lead/validate';

export interface EmailMessage {
  subject: string;
  html: string;
  text: string;
  replyTo: { email: string; name: string };
}

const euro = (n: number) => `${new Intl.NumberFormat('fr-BE', { maximumFractionDigits: 0 }).format(n)} €`;

/** Réponses en clair, dans l'ordre du parcours : « question → réponse(s) ». */
export function readableAnswers(content: Content, answers: Answers): { question: string; answer: string }[] {
  return visibleQuestions(content, answers)
    .filter((q) => answers[q.id] !== undefined)
    .map((q) => ({
      question: questionText(q, answers),
      answer: q.options
        .filter((o) => selected(answers, q.id).includes(o.id))
        .map((o) => o.label)
        .join(', '),
    }));
}

/** E-mail de notification envoyé à Antoine pour préparer l'appel. */
export function leadEmail(
  content: Content,
  contact: LeadContact,
  answers: Answers,
  result: DiagnosticResult,
  shareLink: string,
): EmailMessage {
  const { score } = result;
  const dims = content.dimensions.map((d) => ({
    label: d.label,
    score: score.dimensions.find((x) => x.id === d.id)?.score ?? null,
  }));
  const qa = readableAnswers(content, answers);
  const cost = result.hiddenCost ? euro(result.hiddenCost.yearlyCost) : '—';
  const name = `${contact.firstName} ${contact.lastName}`;
  const subject = `Nouveau lead diagnostic : ${contact.company} — ${score.level.label} (${score.global}/100)`;

  const contactRows: [string, string][] = [
    ['Nom', name],
    ['Entreprise', contact.company],
    ['E-mail', contact.email],
    ['Téléphone', contact.phone || '—'],
    ['N° BCE', contact.bce || '—'],
  ];

  const e = escapeXml;
  const row = (k: string, v: string) =>
    `<tr><td style="padding:4px 12px 4px 0;color:#5B6270">${e(k)}</td><td style="padding:4px 0"><strong>${e(v)}</strong></td></tr>`;
  const html = [
    `<div style="font-family:Arial,sans-serif;color:#1C2A4A;max-width:640px">`,
    `<h1 style="font-size:20px;color:#324B84">${e(subject)}</h1>`,
    `<table>${contactRows.map(([k, v]) => row(k, v)).join('')}</table>`,
    `<h2 style="font-size:16px">Résultat</h2>`,
    `<p>Score global <strong>${score.global}/100</strong> — niveau <strong>${e(score.level.label)}</strong>${score.cappedFrom ? ` (plafonné, le score seul donnerait « ${e(score.cappedFrom.label)} »)` : ''}.<br>Coût caché estimé : <strong>${e(cost)} par an</strong>.</p>`,
    `<p>${e(result.summary)}</p>`,
    `<table>${dims.map((d) => row(d.label, d.score === null ? 'non évalué' : `${d.score}/100`)).join('')}</table>`,
    `<h2 style="font-size:16px">Quick wins proposés</h2><ol>${result.quickWins.map((q) => `<li>${e(q.title)}</li>`).join('')}</ol>`,
    `<h2 style="font-size:16px">Forfaits recommandés</h2><ul>${result.offers.map((o) => `<li>${e(o.title)}</li>`).join('')}</ul>`,
    `<h2 style="font-size:16px">Réponses complètes</h2><table>${qa.map((x) => row(x.question, x.answer)).join('')}</table>`,
    `<p><a href="${e(shareLink)}">Voir le diagnostic complet</a></p>`,
    `</div>`,
  ].join('');

  const text = [
    subject,
    '',
    ...contactRows.map(([k, v]) => `${k} : ${v}`),
    '',
    `Score : ${score.global}/100 — ${score.level.label}`,
    `Coût caché : ${cost} par an`,
    result.summary,
    '',
    ...dims.map((d) => `${d.label} : ${d.score ?? 'non évalué'}`),
    '',
    'Quick wins :',
    ...result.quickWins.map((q, i) => `${i + 1}. ${q.title}`),
    '',
    'Réponses :',
    ...qa.map((x) => `- ${x.question} → ${x.answer}`),
    '',
    shareLink,
  ].join('\n');

  return { subject, html, text, replyTo: { email: contact.email, name } };
}
