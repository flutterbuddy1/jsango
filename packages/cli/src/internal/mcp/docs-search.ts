import * as fs from 'node:fs';

/** One searchable piece of the docs: a markdown section under its heading path. */
interface Chunk {
  readonly source: string;
  readonly heading: string;
  readonly text: string;
  readonly terms: Map<string, number>;
}

const STOP = new Set('a an and are as at be by can do does for from how i in is it of on or the to use using what when with you your'.split(' '));

function terms(text: string): string[] {
  return (text.toLowerCase().match(/[a-z0-9_$]+/g) ?? []).filter((t) => t.length > 1 && !STOP.has(t));
}

/**
 * Keyword search over the jsango guides bundled with the CLI (docs/llms-full.txt), so answers match
 * the installed version and work offline.
 */
export class DocsSearch {
  private readonly chunks: Chunk[] = [];

  public constructor(llmsFull: string) {
    let source = 'jsango docs';
    let headings: string[] = [];
    let current: string[] = [];
    let inCode = false;
    const flush = () => {
      const text = current.join('\n').replace(/^\s*---\s*$/gm, '').trim();
      if (text.length > 40) {
        const counts = new Map<string, number>();
        for (const t of terms(text)) counts.set(t, (counts.get(t) ?? 0) + 1);
        for (const t of terms(headings.join(' '))) counts.set(t, (counts.get(t) ?? 0) + 5); // headings weigh more
        this.chunks.push({ source, heading: headings.join(' › '), text, terms: counts });
      }
      current = [];
    };
    for (const line of llmsFull.split('\n')) {
      // Each guide starts with `<!-- source: docs/x.md (Title) -->` (see scripts/build-llms.mjs).
      const src = /^<!-- source: (\S+)/.exec(line);
      if (src) {
        flush();
        source = src[1]!;
        headings = [];
        continue;
      }
      if (line.startsWith('```')) inCode = !inCode;
      const h = !inCode && /^(#{1,3})\s+(.*)/.exec(line);
      if (h) {
        flush();
        headings = [...headings.slice(0, h[1]!.length - 1), h[2]!.trim()];
      }
      current.push(line);
    }
    flush();
  }

  public static load(file: string): DocsSearch | undefined {
    return fs.existsSync(file) ? new DocsSearch(fs.readFileSync(file, 'utf8')) : undefined;
  }

  public get size(): number {
    return this.chunks.length;
  }

  public search(query: string, limit = 4): string {
    const q = [...new Set(terms(query))];
    if (q.length === 0) return 'Give a few keywords, e.g. "soft delete restore" or "refresh token rotation".';
    // TF-IDF-ish: rare query terms count more; sections matching more distinct terms rank first.
    const df = new Map(q.map((t) => [t, this.chunks.filter((c) => c.terms.has(t)).length]));
    const scored = this.chunks
      .map((c) => {
        let score = 0;
        let matched = 0;
        for (const t of q) {
          const tf = c.terms.get(t) ?? 0;
          if (tf > 0) {
            matched++;
            score += (1 + Math.log(tf)) * Math.log(1 + this.chunks.length / (df.get(t)! || 1));
          }
        }
        return { c, score: score * matched };
      })
      .filter((r) => r.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
    if (scored.length === 0) return `No docs match "${query}". Try other words, or get_api for exact signatures.`;
    return scored
      .map(({ c }) => `### ${c.heading || c.source}\n(source: ${c.source})\n\n${c.text.length > 3500 ? c.text.slice(0, 3500) + '\n…' : c.text}`)
      .join('\n\n---\n\n');
  }
}
