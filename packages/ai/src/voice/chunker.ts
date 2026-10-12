/**
 * Splits streamed LLM text into speakable pieces, so text-to-speech starts on the first clause
 * instead of waiting for the whole answer.
 */
export async function* sentences(tokens: AsyncIterable<string>): AsyncGenerator<string> {
  let buffer = '';
  let first = true;
  for await (const token of tokens) {
    buffer += token;
    while (true) {
      const cut = findCut(buffer, first);
      if (cut === -1) break;
      const piece = buffer.slice(0, cut).trim();
      buffer = buffer.slice(cut);
      if (piece) {
        first = false;
        yield piece;
      }
    }
  }
  if (buffer.trim()) yield buffer.trim();
}

function findCut(text: string, first: boolean): number {
  // End of a sentence: . ! ? (and CJK/Hindi danda) followed by whitespace, or a newline.
  const end = /[.!?।。！？](?=\s)|\n/.exec(text);
  if (end) return end.index + 1;
  // The first piece goes out early at a comma once it is long enough to sound natural.
  if (first && text.length >= 30) {
    const comma = text.search(/[,;:](?=\s)/);
    if (comma >= 15) return comma + 1;
  }
  // Very long run-on text: cut at the last space.
  if (text.length > 250) {
    const space = text.lastIndexOf(' ', 250);
    return space > 0 ? space : 250;
  }
  return -1;
}
