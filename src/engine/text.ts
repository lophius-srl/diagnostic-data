/** Liste lisible : « A », « A et B », « A, B et C », « A, B, C et 2 autres ». */
export function joinNames(names: readonly string[], max = 3): string {
  if (names.length <= 1) return names[0] ?? '';
  const rest = names.length - max;
  if (rest > 0) return `${names.slice(0, max).join(', ')} et ${rest} ${rest === 1 ? 'autre' : 'autres'}`;
  return `${names.slice(0, -1).join(', ')} et ${names[names.length - 1]}`;
}

export function fillTemplate(text: string, values: Record<string, string>): string {
  return text.replace(/\{(\w+)\}/g, (whole, key: string) => values[key] ?? whole);
}
