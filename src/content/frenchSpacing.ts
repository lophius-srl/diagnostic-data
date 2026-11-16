/**
 * Typographie française : espace insécable avant « : ; ? ! » et à l'intérieur des guillemets « »,
 * pour qu'un signe ne se retrouve jamais seul en début de ligne.
 */
export function frenchSpacing(text: string): string {
  return text.replace(/ ([:;?!»])/g, '\u00a0$1').replace(/« /g, '«\u00a0');
}

export function typeset<T>(value: T): T {
  if (typeof value === 'string') return frenchSpacing(value) as T;
  if (Array.isArray(value)) return value.map(typeset) as T;
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, typeset(v)])) as T;
  }
  return value;
}
