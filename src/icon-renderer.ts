/**
 * Runtime icon renderer that tints white PNG icons using SVG filters.
 * Loads white PNGs and applies color via feColorMatrix.
 */

import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ICONS_PATH = join(__dirname, "../imgs/icons");

// Cache for rendered icons
const iconCache = new Map<string, string>();

/**
 * Parse hex color to RGB values (0-1 range).
 */
function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const clean = hex.replace("#", "");
  const r = parseInt(clean.substring(0, 2), 16) / 255;
  const g = parseInt(clean.substring(2, 4), 16) / 255;
  const b = parseInt(clean.substring(4, 6), 16) / 255;
  return { r, g, b };
}

/**
 * Create an SVG that wraps a PNG with a color tint filter.
 */
function createTintedSvg(pngBase64: string, color: string, size: number): string {
  const { r, g, b } = hexToRgb(color);

  // feColorMatrix multiplies each channel - white (1,1,1) becomes (r,g,b)
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">
  <defs>
    <filter id="tint" color-interpolation-filters="sRGB">
      <feColorMatrix type="matrix" values="${r} 0 0 0 0  0 ${g} 0 0 0  0 0 ${b} 0 0  0 0 0 1 0"/>
    </filter>
  </defs>
  <image href="data:image/png;base64,${pngBase64}" width="${size}" height="${size}" filter="url(#tint)"/>
</svg>`;
}

/**
 * Render an icon with the specified color.
 * @param iconName - Phosphor icon name (e.g., "lightbulb")
 * @param color - Hex color (e.g., "#ff9500")
 * @param isOn - true = fill (solid) variant, false = regular (outline) variant
 * @returns SVG data URI for setImage()
 */
export async function renderIcon(
  iconName: string,
  color: string,
  isOn = false
): Promise<string> {
  // ON = fill (solid), OFF = regular (outline)
  const variant = isOn ? "fill" : "regular";
  const cacheKey = `${iconName}:${variant}:${color}`;

  const cached = iconCache.get(cacheKey);
  if (cached) return cached;

  try {
    // Load the @2x version for better quality
    const fileName = `${iconName}-${variant}@2x.png`;
    const pngPath = join(ICONS_PATH, fileName);
    const pngBuffer = await readFile(pngPath);
    const pngBase64 = pngBuffer.toString("base64");

    const svg = createTintedSvg(pngBase64, color, 144);
    const dataUri = `data:image/svg+xml,${encodeURIComponent(svg)}`;

    iconCache.set(cacheKey, dataUri);
    return dataUri;
  } catch {
    // Fallback to question mark icon
    if (iconName !== "question") {
      return renderIcon("question", color, isOn);
    }
    // Ultimate fallback - empty transparent image
    return `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="144" height="144"/>')}`;
  }
}

/**
 * Clear the icon cache.
 */
export function clearIconCache(): void {
  iconCache.clear();
}
