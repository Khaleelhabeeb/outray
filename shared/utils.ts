export function generateId(prefix: string = ""): string {
  const random = Math.random().toString(36).substring(2, 15);
  return prefix ? `${prefix}_${random}` : random;
}

export function extractSubdomain(
  host: string,
  baseDomain: string,
): string | null {
  const hostWithoutPort = host.split(":")[0];
  const hostLower = hostWithoutPort.toLowerCase();
  const baseLower = baseDomain.toLowerCase();

  if (hostLower.endsWith(`.${baseLower}`)) {
    return hostLower.slice(0, -(baseLower.length + 1));
  }

  return null;
}
