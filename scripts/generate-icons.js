#!/usr/bin/env node

/**
 * Generate PNG icons from Phosphor SVGs for Stream Deck plugin.
 *
 * - Regular variants become "off" state (white fill)
 * - Fill variants become "on" state (yellow/orange fill, solid icon style)
 * - Icons are sized smaller to leave room for labels below
 * - Outputs at 72x72 and 144x144 (@2x) canvas sizes
 */

import sharp from "sharp";
import { readdir, readFile, mkdir, rm, stat } from "node:fs/promises";
import { join, basename } from "node:path";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const PHOSPHOR_PATH = join(__dirname, "../node_modules/@phosphor-icons/core/assets");
const OUTPUT_PATH = join(__dirname, "../com.nickustinov.itsyhome.sdPlugin/imgs/icons");

const OFF_COLOR = "#ffffff";
const ON_COLOR = "#f5a623"; // Yellow/orange accent

// Canvas sizes and icon sizes within them (centered)
const SIZES = [
  { canvas: 72, icon: 36, suffix: "" },
  { canvas: 144, icon: 72, suffix: "@2x" },
];

/**
 * Replace currentColor in SVG with the specified color.
 */
function colorize(svg, color) {
  return svg
    .replace(/currentColor/gi, color)
    .replace(/fill="none"/gi, `fill="${color}"`)
    .replace(/<svg([^>]*)>/, (match, attrs) => {
      if (!attrs.includes("fill=")) {
        return `<svg${attrs} fill="${color}">`;
      }
      return match.replace(/fill="[^"]*"/, `fill="${color}"`);
    });
}

/**
 * Process a single icon and generate all variants.
 */
async function processIcon(iconName, regularPath, fillPath) {
  const regularSvg = await readFile(regularPath, "utf8");
  const fillSvg = fillPath ? await readFile(fillPath, "utf8") : null;

  // Off state: regular (outline) variant, white color
  const offSvg = colorize(regularSvg, OFF_COLOR);
  // On state: fill (solid) variant, orange color
  const onSvg = colorize(fillSvg || regularSvg, ON_COLOR);

  const promises = [];

  for (const { canvas, icon, suffix } of SIZES) {
    const offset = Math.floor((canvas - icon) / 2);

    // Off state
    promises.push(
      sharp(Buffer.from(offSvg), { density: 300 })
        .resize(icon, icon)
        .extend({
          top: offset,
          bottom: canvas - icon - offset,
          left: offset,
          right: canvas - icon - offset,
          background: { r: 0, g: 0, b: 0, alpha: 0 },
        })
        .png({ compressionLevel: 9 })
        .toFile(join(OUTPUT_PATH, `${iconName}-off${suffix}.png`))
    );

    // On state
    promises.push(
      sharp(Buffer.from(onSvg), { density: 300 })
        .resize(icon, icon)
        .extend({
          top: offset,
          bottom: canvas - icon - offset,
          left: offset,
          right: canvas - icon - offset,
          background: { r: 0, g: 0, b: 0, alpha: 0 },
        })
        .png({ compressionLevel: 9 })
        .toFile(join(OUTPUT_PATH, `${iconName}-on${suffix}.png`))
    );
  }

  await Promise.all(promises);
}

/**
 * Main entry point.
 */
async function main() {
  console.log("Generating Stream Deck icons from Phosphor SVGs...\n");

  // Clean and recreate output directory
  try {
    await rm(OUTPUT_PATH, { recursive: true });
  } catch {
    // Directory might not exist
  }
  await mkdir(OUTPUT_PATH, { recursive: true });

  // Get list of regular icons
  const regularDir = join(PHOSPHOR_PATH, "regular");
  const fillDir = join(PHOSPHOR_PATH, "fill");
  const regularFiles = await readdir(regularDir);

  // Build fill lookup for fast access (fill files have -fill suffix)
  const fillFiles = new Set(await readdir(fillDir));

  let processed = 0;
  const total = regularFiles.filter(f => f.endsWith(".svg")).length;

  for (const file of regularFiles) {
    if (!file.endsWith(".svg")) continue;

    const iconName = basename(file, ".svg");
    const regularPath = join(regularDir, file);
    // Fill files have -fill suffix: lightbulb.svg -> lightbulb-fill.svg
    const fillFileName = `${iconName}-fill.svg`;
    const fillPath = fillFiles.has(fillFileName) ? join(fillDir, fillFileName) : null;

    try {
      await processIcon(iconName, regularPath, fillPath);
      processed++;
      if (processed % 100 === 0) {
        console.log(`Processed ${processed}/${total} icons...`);
      }
    } catch (err) {
      console.error(`Error processing ${iconName}: ${err.message}`);
    }
  }

  // Get output directory size
  const files = await readdir(OUTPUT_PATH);
  let totalSize = 0;
  for (const file of files) {
    const fileStat = await stat(join(OUTPUT_PATH, file));
    totalSize += fileStat.size;
  }
  const sizeMB = (totalSize / 1024 / 1024).toFixed(2);

  console.log(`\nGenerated ${files.length} icon files (${sizeMB} MB)`);
  console.log(`Output: ${OUTPUT_PATH}`);
}

main().catch(console.error);
