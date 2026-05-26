import { open } from "node:fs/promises";

/**
 * Read up to `maxLines` from the end of a text file (tail of last ~256KB).
 */
export async function readLastLines(
  filePath: string,
  maxLines: number
): Promise<string[]> {
  const fh = await open(filePath, "r");
  try {
    const st = await fh.stat();
    if (!st.isFile()) return [];
    const size = st.size;
    const chunkSize = Math.min(size, 256 * 1024);
    const buf = Buffer.alloc(chunkSize);
    await fh.read(buf, 0, chunkSize, size - chunkSize);
    const text = buf.toString("utf8");
    const firstNl = text.indexOf("\n");
    const body = firstNl >= 0 ? text.slice(firstNl + 1) : text;
    const lines = body.split(/\r?\n/).filter((l) => l.length > 0);
    return lines.slice(-maxLines);
  } finally {
    await fh.close();
  }
}
