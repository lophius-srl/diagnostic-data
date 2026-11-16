import { z } from 'zod';

/** Identifiant technique : minuscules, chiffres et `_`. */
const Id = z.string().regex(/^[a-z][a-z0-9_]*$/, 'identifiant : minuscules, chiffres et _');

/**
 * Condition (mini-langage sans `eval`) partagée par les questions, retours, recommandations et schémas.
 *  - { all: [...] } / { any: [...] } / { not: ... }
 *  - { q: <question>, is: <option> }            réponse unique égale à
 *  - { q: <question>, in: [<options>] }         réponse unique parmi
 *  - { q: <question>, has: <option> }           case cochée (question à choix multiples)
 *  - { q: <question>, hasAny: [<options>] }     au moins une de ces cases cochées
 *  - { q: <question>, countAtLeast: n, exclude: [...] }  au moins n cases cochées (hors exclusions)
 *  - { fact: <fait> }                           un fait métier déduit des réponses
 * Une condition qui porte sur une question sans réponse est fausse.
 */
export type Condition =
  | { all: Condition[] }
  | { any: Condition[] }
  | { not: Condition }
  | { fact: string }
  | {
      q: string;
      is?: string;
      in?: string[];
      has?: string;
      hasAny?: string[];
      countAtLeast?: number;
      exclude?: string[];
    };

export const ConditionSchema: z.ZodType<Condition> = z.lazy(() =>
  z.union([
    z.object({ all: z.array(ConditionSchema).min(1) }).strict(),
    z.object({ any: z.array(ConditionSchema).min(1) }).strict(),
    z.object({ not: ConditionSchema }).strict(),
    z.object({ fact: Id }).strict(),
    z
      .object({
        q: Id,
        is: Id.optional(),
        in: z.array(Id).min(1).optional(),
        has: Id.optional(),
        hasAny: z.array(Id).min(1).optional(),
        countAtLeast: z.number().int().min(1).optional(),
        exclude: z.array(Id).optional(),
      })
      .strict()
      .refine((c) => [c.is, c.in, c.has, c.hasAny, c.countAtLeast].filter((v) => v !== undefined).length === 1, {
        message: 'une condition sur une question utilise exactement un opérateur',
      }),
  ]),
);

const Points = z.number().int().min(0).max(3);

export const OptionSchema = z
  .object({
    id: Id,
    label: z.string().min(1),
    /** Points (0 à 3) apportés à chaque dimension. */
    scores: z.record(Id, Points).default({}),
    /** Faits métier déduits de cette réponse (ex. double_saisie). */
    facts: z.array(Id).default([]),
    /** Case exclusive : cochée seule (ex. « Je ne sais pas »). */
    exclusive: z.boolean().default(false),
    /** Outil du catalogue représenté par cette case (questions de type tools). */
    tool: Id.optional(),
  })
  .strict();

export const QuestionSchema = z
  .object({
    id: Id,
    text: z.string().min(1),
    textVariants: z.array(z.object({ when: ConditionSchema, text: z.string().min(1) }).strict()).default([]),
    /** Aide courte sous la question (facultative). */
    hint: z.string().optional(),
    type: z.enum(['single', 'multi', 'tools']),
    showIf: ConditionSchema.optional(),
    options: z.array(OptionSchema).min(2),
  })
  .strict();

export const DimensionSchema = z
  .object({
    id: Id,
    label: z.string(),
    /** Libellé technique, réservé au rapport PDF (toujours expliqué). */
    technicalLabel: z.string(),
    description: z.string(),
    /** Forme utilisée dans une phrase (« la fiabilité de vos chiffres »). */
    phrase: z.string(),
    /** Peut être cité comme point fort dans la synthèse (faux pour un axe trop facile à « réussir »). */
    strengthCandidate: z.boolean().default(true),
    weight: z.number().positive(),
  })
  .strict();

export const LevelSchema = z
  .object({
    id: Id,
    label: z.string(),
    min: z.number().min(0).max(100),
    summary: z.string(),
    /** Plafond : si cette condition est vraie, le niveau n'est pas atteint, quel que soit le score. */
    blockedBy: ConditionSchema.optional(),
    /** Explication affichée quand le plafond s'applique. */
    blockedReason: z.string().optional(),
  })
  .strict()
  .refine((l) => !l.blockedBy || l.blockedReason, { message: 'blockedReason requis avec blockedBy' });

export const ToolSchema = z
  .object({
    id: Id,
    name: z.string(),
    category: z.enum(['tableur', 'compta', 'gestion', 'crm', 'ecommerce', 'caisse', 'metier', 'externe', 'inconnu']),
    /** Chemin du logo dans public/ (facultatif : sinon pastille avec initiales). */
    logo: z.string().optional(),
    /** Nom court pour les schémas (sinon `name`). */
    shortName: z.string().max(18).optional(),
  })
  .strict();

export const FeedbackSchema = z
  .object({
    id: Id,
    after: Id,
    when: ConditionSchema,
    text: z.string().min(1),
    priority: z.number().int().default(0),
  })
  .strict();

export const BenchmarkSchema = z
  .object({
    id: Id,
    text: z.string(),
    source: z.string().nullable(),
    enabled: z.boolean().default(false),
  })
  .strict()
  .refine((b) => !b.enabled || (b.source !== null && b.source.trim() !== ''), {
    message: 'un repère ne peut être activé sans source',
  });

const Level3 = z.enum(['faible', 'moyen', 'eleve']);

/**
 * Variable de texte : première règle dont la condition est vraie (ex. outil de tableau de bord
 * selon la réponse Microsoft). Utilisable dans les textes sous la forme {id}.
 */
export const VariableSchema = z
  .object({
    id: Id,
    rules: z.array(z.object({ when: ConditionSchema.optional(), value: z.string() }).strict()).min(1),
  })
  .strict()
  .refine((v) => v.rules.at(-1)?.when === undefined, {
    message: 'la dernière règle doit être sans condition (défaut)',
  });

/**
 * Action recommandée (quick win ou étape de feuille de route).
 * `requiresTools` : chaque trou {clé} est rempli avec les outils cochés parmi la liste ;
 * si aucun n'est coché, l'action n'est pas proposée (jamais de recommandation sur un outil absent).
 */
export const ActionSchema = z
  .object({
    id: Id,
    title: z.string().min(1),
    detail: z.string().min(1),
    when: ConditionSchema.optional(),
    excludeIf: ConditionSchema.optional(),
    requiresTools: z.record(Id, z.array(Id).min(1)).default({}),
    dimension: Id,
    effort: Level3,
    impact: Level3,
    boostIf: ConditionSchema.optional(),
    /** Action de secours (toujours possible), choisie seulement s'il manque des quick wins. */
    fallback: z.boolean().default(false),
  })
  .strict();

export const RoadmapActionSchema = z
  .object({
    id: Id,
    title: z.string().min(1),
    detail: z.string().min(1),
    when: ConditionSchema.optional(),
    excludeIf: ConditionSchema.optional(),
    requiresTools: z.record(Id, z.array(Id).min(1)).default({}),
    /** Étape omise si ce quick win est déjà proposé (pas de doublon). */
    unlessQuickWin: Id.optional(),
  })
  .strict();

export const RoadmapPhaseSchema = z
  .object({
    id: Id,
    label: z.string(),
    title: z.string(),
    /** Nombre maximal d'étapes affichées dans la phase (quick wins compris pour la première). */
    max: z.number().int().min(1).max(6),
    actions: z.array(RoadmapActionSchema),
  })
  .strict();

export const RecommendationsSchema = z
  .object({
    variables: z.array(VariableSchema),
    quickWins: z.array(ActionSchema).min(3),
    roadmap: z.array(RoadmapPhaseSchema).length(3),
  })
  .strict();

export const OfferSchema = z
  .object({
    id: Id,
    title: z.string(),
    duration: z.string(),
    price: z.string(),
    summary: z.string(),
    deliverables: z.array(z.string()).min(1),
    /** Raison affichée quand le forfait est recommandé (peut utiliser les variables). */
    why: z.string(),
    recommendIf: ConditionSchema.optional(),
    /** Recommandé aussi si le score global est sous ce seuil. */
    recommendBelowScore: z.number().min(0).max(100).optional(),
    /** Passe en tête quand cette condition est vraie (ex. priorité déclarée par le gérant). */
    preferredIf: ConditionSchema.optional(),
    priority: z.number().int().default(0),
  })
  .strict();

export const OffersSchema = z
  .object({
    maxRecommended: z.number().int().min(1).max(3),
    offers: z.array(OfferSchema).min(1),
    cheques: z.object({ title: z.string(), text: z.string() }).strict(),
  })
  .strict();

const LabelDetail = z.object({ label: z.string(), detail: z.string() }).strict();
const ConditionalText = z.object({ when: ConditionSchema.optional(), text: z.string() }).strict();

export const ArchitectureSchema = z
  .object({
    legend: z.object({ auto: z.string(), manual: z.string() }).strict(),
    today: z
      .object({
        title: z.string(),
        subtitle: z.string(),
        unknownTools: z.string(),
        silo: z.object({ when: ConditionSchema, text: z.string() }).strict(),
        toolNotes: z.array(ConditionalText.extend({ tools: z.array(Id).min(1) }).strict()),
        /** Lien vers la fiduciaire dessiné « automatique » si cette condition est vraie. */
        externalAutoWhen: ConditionSchema,
        excel: LabelDetail.extend({ notes: z.array(ConditionalText) }).strict(),
        people: z
          .object({ label: z.string(), autoWhen: ConditionSchema, detailManual: z.string(), detailAuto: z.string() })
          .strict(),
      })
      .strict(),
    target: z
      .object({
        title: z.string(),
        subtitle: z.string(),
        unknownTools: z.string(),
        excelSource: LabelDetail,
        integration: LabelDetail,
        base: LabelDetail,
        outputs: z.array(
          LabelDetail.extend({ when: ConditionSchema.optional(), requiresTools: z.array(Id).optional() }).strict(),
        ),
        people: LabelDetail,
      })
      .strict(),
  })
  .strict();

export const PrivacySchema = z
  .object({
    title: z.string(),
    updated: z.string(),
    sections: z.array(z.object({ title: z.string(), paragraphs: z.array(z.string()).min(1) }).strict()).min(1),
  })
  .strict();

export const SettingsSchema = z
  .object({
    locale: z.string(),
    contentVersion: z.string(),
    estimatedMinutes: z.number().int().positive(),
    feedbackMinGap: z.number().int().min(1),
    hiddenCost: z
      .object({
        question: Id,
        hoursPerWeek: z.record(Id, z.number().min(0)),
        weeksPerYear: z.number().int().min(1).max(52),
        defaultHourlyRate: z.number().positive(),
        roundTo: z.number().int().positive(),
      })
      .strict(),
    links: z
      .object({
        site: z.string().url(),
        contact: z.string(),
        booking: z.string(),
        baseUrl: z.string(),
      })
      .strict(),
    features: z
      .object({
        testimonials: z.boolean(),
        chequesEntreprises: z.boolean(),
        analytics: z.boolean(),
        /** Rapport complet (détails, schéma cible, feuille de route, forfaits, PDF) débloqué contre les coordonnées. */
        leadGate: z.boolean(),
      })
      .strict(),
    lead: z
      .object({
        /** Version du texte de consentement, stockée avec chaque lead (à changer si le texte change). */
        consentVersion: z.string().min(1),
        /** Délai minimal (ms) entre l'affichage du formulaire et l'envoi : en dessous, c'est un robot. */
        minFillMs: z.number().int().min(0),
        maxPerEmailPerHour: z.number().int().min(1),
      })
      .strict(),
  })
  .strict();

export const ContentSchema = z
  .object({
    settings: SettingsSchema,
    dimensions: z.array(DimensionSchema).min(1),
    levels: z.array(LevelSchema).min(2),
    tools: z.array(ToolSchema),
    questions: z.array(QuestionSchema).min(1),
    feedbacks: z.array(FeedbackSchema),
    benchmarks: z.array(BenchmarkSchema),
    recommendations: RecommendationsSchema,
    offers: OffersSchema,
    architecture: ArchitectureSchema,
    privacy: PrivacySchema,
    ui: z.record(z.string(), z.string()),
  })
  .strict();

export type Content = z.infer<typeof ContentSchema>;
export type Question = Content['questions'][number];
export type Option = Question['options'][number];
export type Dimension = Content['dimensions'][number];
export type Level = Content['levels'][number];
export type Feedback = Content['feedbacks'][number];
export type Tool = Content['tools'][number];
export type Action = Content['recommendations']['quickWins'][number];
export type RoadmapAction = Content['recommendations']['roadmap'][number]['actions'][number];
export type Offer = Content['offers']['offers'][number];

/** Fichiers YAML attendus dans content/<langue>/ et la clé qu'ils alimentent. */
export const CONTENT_FILES = {
  settings: 'settings.yaml',
  dimensions: 'dimensions.yaml',
  levels: 'levels.yaml',
  tools: 'tools.yaml',
  questions: 'questions.yaml',
  feedbacks: 'feedbacks.yaml',
  benchmarks: 'benchmarks.yaml',
  recommendations: 'recommendations.yaml',
  offers: 'offers.yaml',
  architecture: 'architecture.yaml',
  privacy: 'privacy.yaml',
  ui: 'ui.yaml',
} as const satisfies Record<keyof Content, string>;
