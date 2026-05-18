import crypto from "node:crypto";

export function verifyCronHmac(opts: {
  secret: string;
  timestampHeader: string | undefined;
  signatureHeader: string | undefined;
  skewSeconds: number;
}): boolean {
  const ts = Number(opts.timestampHeader);
  if (!opts.signatureHeader || !Number.isFinite(ts)) return false;
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - ts) > opts.skewSeconds) return false;
  const expected = crypto
    .createHmac("sha256", opts.secret)
    .update(String(ts))
    .digest("hex");
  const sig = opts.signatureHeader.toLowerCase();
  if (sig.length !== expected.length) return false;
  try {
    return crypto.timingSafeEqual(
      Buffer.from(expected, "utf8"),
      Buffer.from(sig, "utf8")
    );
  } catch {
    return false;
  }
}
