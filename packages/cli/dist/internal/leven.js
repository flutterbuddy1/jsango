/**
 * Calculates the Levenshtein distance between two strings.
 */
export function levenshteinDistance(a, b) {
    if (a === b)
        return 0;
    if (a.length === 0)
        return b.length;
    if (b.length === 0)
        return a.length;
    const matrix = [];
    for (let i = 0; i <= b.length; i++) {
        matrix[i] = [i];
    }
    for (let j = 0; j <= a.length; j++) {
        matrix[0][j] = j;
    }
    for (let i = 1; i <= b.length; i++) {
        for (let j = 1; j <= a.length; j++) {
            if (b.charAt(i - 1) === a.charAt(j - 1)) {
                matrix[i][j] = matrix[i - 1][j - 1];
            }
            else {
                matrix[i][j] = Math.min(matrix[i - 1][j - 1] + 1, // substitution
                matrix[i][j - 1] + 1, // insertion
                matrix[i - 1][j] + 1 // deletion
                );
            }
        }
    }
    return matrix[b.length][a.length];
}
/**
 * Finds the closest matching candidate string for a target string.
 */
export function findClosest(target, candidates, maxDistance = 3) {
    let closest;
    let minDistance = maxDistance + 1;
    for (const candidate of candidates) {
        const distance = levenshteinDistance(target.toLowerCase(), candidate.toLowerCase());
        if (distance < minDistance) {
            minDistance = distance;
            closest = candidate;
        }
    }
    return minDistance <= maxDistance ? closest : undefined;
}
//# sourceMappingURL=leven.js.map