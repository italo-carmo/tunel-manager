import { generateSlug } from "random-word-slugs";
import type { LigoloInterfaces } from "@/types/interfaces.ts";

const MAC_TUN_PREFIX = "utun";
const MAX_INTERFACE_NAME_LENGTH = 15;

function getBrowserPlatform(): string {
  if (typeof navigator === "undefined") return "";

  return `${navigator.platform ?? ""} ${navigator.userAgent ?? ""}`;
}

export function isDarwinPlatform(platform = getBrowserPlatform()): boolean {
  return /mac|darwin/i.test(platform);
}

export function generateLigoloInterfaceName(
  interfaces?: LigoloInterfaces | null,
  platform?: string,
): string {
  const existingNames = new Set(Object.keys(interfaces ?? {}));

  if (isDarwinPlatform(platform)) {
    for (let index = 0; index < 256; index += 1) {
      const candidate = `${MAC_TUN_PREFIX}${index}`;
      if (!existingNames.has(candidate)) return candidate;
    }

    return `${MAC_TUN_PREFIX}${Date.now() % 1000}`;
  }

  return generateSlug(2)
    .replace(/-/g, "")
    .substring(0, MAX_INTERFACE_NAME_LENGTH);
}

export function getAvailableTunnelInterfaceNames(
  interfaces?: LigoloInterfaces | null,
): string[] {
  return Object.entries(interfaces ?? {})
    .filter(([, iface]) => iface?.Active === false)
    .map(([name]) => name)
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
}
