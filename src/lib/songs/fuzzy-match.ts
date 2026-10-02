function normalizeTitle(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("en")
    .replace(/[^\p{L}\p{N}]+/gu, "")
    .trim();
}

function similarity(left: string, right: string): number {
  if (!left || !right) return 0;
  const previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let row = 1; row <= left.length; row += 1) {
    let diagonal = previous[0];
    previous[0] = row;
    for (let column = 1; column <= right.length; column += 1) {
      const above = previous[column];
      previous[column] = Math.min(
        previous[column] + 1,
        previous[column - 1] + 1,
        diagonal + (left[row - 1] === right[column - 1] ? 0 : 1),
      );
      diagonal = above;
    }
  }
  return 1 - previous[right.length] / Math.max(left.length, right.length);
}

function tokenCoverage(source: string[], target: string[]): number {
  const totalLength = source.reduce((sum, token) => sum + token.length, 0);
  if (!totalLength) return 0;
  return source.reduce((sum, token) => {
    const best = Math.max(...target.map((candidate) => similarity(token, candidate)), 0);
    return sum + (best >= 0.4 ? best * token.length : 0);
  }, 0) / totalLength;
}

function titleMatchScore(requested: string, candidate: string): number {
  const requestedNormalized = normalizeTitle(requested);
  const candidateNormalized = normalizeTitle(candidate);
  const requestedTokens = requested.toLocaleLowerCase("en").match(/[\p{L}\p{N}]+/gu) ?? [];
  const candidateTokens = candidate.toLocaleLowerCase("en").match(/[\p{L}\p{N}]+/gu) ?? [];
  const forward = tokenCoverage(requestedTokens, candidateTokens);
  const reverse = tokenCoverage(candidateTokens, requestedTokens);
  const tokenF1 = forward + reverse > 0 ? (2 * forward * reverse) / (forward + reverse) : 0;
  return Math.max(similarity(requestedNormalized, candidateNormalized), tokenF1);
}

/** Return a song only when its fuzzy title score clears both the threshold and runner-up margin. */
export function matchSongTitle<T extends { title: string }>(requested: string, candidates: T[]): T | null {
  const variants = requested.split(/\r?\n/).map((value) => value.trim()).filter((value) => normalizeTitle(value).length >= 4);
  if (variants.length === 0) return null;

  const ranked = candidates
    .map((candidate) => ({
      candidate,
      score: Math.max(...variants.map((variant) => titleMatchScore(variant, candidate.title))),
    }))
    .sort((left, right) => right.score - left.score);
  const best = ranked[0];
  if (!best || best.score < 0.72) return null;
  if (ranked[1] && best.score - ranked[1].score < 0.08) return null;
  return best.candidate;
}

/** Distinctive OCR words used to fetch a small candidate set from the catalog. */
export function songTitleSearchTerms(value: string): string[] {
  const terms: string[] = [];
  for (const variant of value.split(/\r?\n/)) {
    const variantTerms = [...new Set(variant.toLocaleLowerCase("en").match(/[\p{L}\p{N}]+/gu) ?? [])]
      .map((term) => term.replace(/[^\p{L}\p{N}]/gu, ""))
      .filter((term) => term.length >= 3 || /^\d{4,}$/.test(term))
      .sort((left, right) => right.length - left.length);
    for (const term of variantTerms) {
      if (!terms.includes(term)) terms.push(term);
    }
  }
  return terms.slice(0, 8);
}
