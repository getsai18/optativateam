export function newId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID().slice(0, 8)}`;
}

export function newUuid(): string {
  return crypto.randomUUID();
}

const REF_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/** Simulated payment reference, e.g. SIM-8F3K2A */
export function newPaymentReference(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  let out = '';
  bytes.forEach((b) => {
    out += REF_ALPHABET.charAt(b % REF_ALPHABET.length);
  });
  return `SIM-${out}`;
}
