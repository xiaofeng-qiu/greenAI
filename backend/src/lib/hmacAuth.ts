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

/**
 * Device ingest HMAC. Binds signature to the raw request body so payload
 * tampering is detected. Signed message = `ts + "\n" + sha256_hex(rawBody)`.
 */
export function verifyDeviceIngestHmac(opts: {
  secret: string;
  timestampHeader: string | undefined;
  signatureHeader: string | undefined;
  rawBody: string;
  skewSeconds: number;
}): boolean {
  const ts = Number(opts.timestampHeader);
  if (!opts.signatureHeader || !Number.isFinite(ts)) return false;
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - ts) > opts.skewSeconds) return false;

  const bodyHash = crypto
    .createHash("sha256")
    .update(opts.rawBody, "utf8")
    .digest("hex");
  const message = `${ts}\n${bodyHash}`;
  const expected = crypto
    .createHmac("sha256", opts.secret)
    .update(message)
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


