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

const ICON_COLOR = "#ffffff"; // All icons white, tinted at runtime

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

  // Both variants in white, tinted at runtime
  const regularWhite = colorize(regularSvg, ICON_COLOR);
  const fillWhite = colorize(fillSvg || regularSvg, ICON_COLOR);

  const promises = [];

  for (const { canvas, icon, suffix } of SIZES) {
    const offset = Math.floor((canvas - icon) / 2);

    // Regular (outline) variant
    promises.push(
      sharp(Buffer.from(regularWhite), { density: 300 })
        .resize(icon, icon)
        .extend({
          top: offset,
          bottom: canvas - icon - offset,
          left: offset,
          right: canvas - icon - offset,
          background: { r: 0, g: 0, b: 0, alpha: 0 },
        })
        .png({ compressionLevel: 9 })
        .toFile(join(OUTPUT_PATH, `${iconName}-regular${suffix}.png`))
    );

    // Fill (solid) variant
    promises.push(
      sharp(Buffer.from(fillWhite), { density: 300 })
        .resize(icon, icon)
        .extend({
          top: offset,
          bottom: canvas - icon - offset,
          left: offset,
          right: canvas - icon - offset,
          background: { r: 0, g: 0, b: 0, alpha: 0 },
        })
        .png({ compressionLevel: 9 })
        .toFile(join(OUTPUT_PATH, `${iconName}-fill${suffix}.png`))
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

  // Copy default action icons
  await copyActionDefaults();
}

/**
 * Generate action default icons (both list icons and button states).
 */
async function copyActionDefaults() {
  const actionsPath = join(__dirname, "../com.nickustinov.itsyhome.sdPlugin/imgs/actions");
  const phosphorRegular = join(PHOSPHOR_PATH, "regular");

  const GRAY = "#8e8e93";
  const ORANGE = "#ff9500";
  const WHITE = "#ffffff";

  // Action list icons (28x28, 56x56 @2x) - [svg name, dest folder, color]
  const listIcons = [
    ["lightbulb", "toggle", WHITE],
    ["sparkle", "scene", WHITE],
    ["lightbulb", "brightness", WHITE],
    ["lock", "lock", WHITE],
    ["garage", "garage-door", WHITE],
    ["arrows-out-line-vertical", "blinds", WHITE],
    ["thermometer", "thermostat", WHITE],
    ["info", "status", WHITE],
  ];

  // Generate action list icons from SVG
  for (const [iconName, folder, color] of listIcons) {
    const svgPath = join(phosphorRegular, `${iconName}.svg`);
    const svg = await readFile(svgPath, "utf8");
    const coloredSvg = colorize(svg, color);

    // 28x28 for icon.png
    await sharp(Buffer.from(coloredSvg), { density: 300 })
      .resize(28, 28)
      .png({ compressionLevel: 9 })
      .toFile(join(actionsPath, folder, "icon.png"));

    // 56x56 for icon@2x.png
    await sharp(Buffer.from(coloredSvg), { density: 300 })
      .resize(56, 56)
      .png({ compressionLevel: 9 })
      .toFile(join(actionsPath, folder, "icon@2x.png"));
  }

  // Button state icons (72x72, 144x144 @2x) - [source, dest, color]
  // ON = fill (solid), OFF = regular (outline)
  const GREEN = "#30d158";
  const buttonIcons = [
    // Toggle - lightbulb: OFF=regular+gray, ON=fill+orange
    ["lightbulb-regular.png", "toggle/key-off.png", GRAY],
    ["lightbulb-regular@2x.png", "toggle/key-off@2x.png", GRAY],
    ["lightbulb-fill.png", "toggle/key-on.png", ORANGE],
    ["lightbulb-fill@2x.png", "toggle/key-on@2x.png", ORANGE],
    // Scene - sparkle (always "on" style = fill)
    ["sparkle-fill.png", "scene/key.png", ORANGE],
    ["sparkle-fill@2x.png", "scene/key@2x.png", ORANGE],
    // Brightness - lightbulb: OFF=regular+gray, ON=fill+orange
    ["lightbulb-regular.png", "brightness/key-off.png", GRAY],
    ["lightbulb-regular@2x.png", "brightness/key-off@2x.png", GRAY],
    ["lightbulb-fill.png", "brightness/key-on.png", ORANGE],
    ["lightbulb-fill@2x.png", "brightness/key-on@2x.png", ORANGE],
    // Lock: unlocked=regular+orange (attention), locked=fill+green (secure)
    ["lock-regular.png", "lock/key-unlocked.png", ORANGE],
    ["lock-regular@2x.png", "lock/key-unlocked@2x.png", ORANGE],
    ["lock-fill.png", "lock/key-locked.png", GREEN],
    ["lock-fill@2x.png", "lock/key-locked@2x.png", GREEN],
    // Garage door: closed=regular+gray, open=fill+orange
    ["garage-regular.png", "garage-door/key-closed.png", GRAY],
    ["garage-regular@2x.png", "garage-door/key-closed@2x.png", GRAY],
    ["garage-fill.png", "garage-door/key-open.png", ORANGE],
    ["garage-fill@2x.png", "garage-door/key-open@2x.png", ORANGE],
    // Blinds: closed=regular+gray, open=fill+orange
    ["arrows-out-line-vertical-regular.png", "blinds/key-closed.png", GRAY],
    ["arrows-out-line-vertical-regular@2x.png", "blinds/key-closed@2x.png", GRAY],
    ["arrows-out-line-vertical-fill.png", "blinds/key-open.png", ORANGE],
    ["arrows-out-line-vertical-fill@2x.png", "blinds/key-open@2x.png", ORANGE],
    // Thermostat: OFF=regular+gray, ON=fill+orange
    ["thermometer-regular.png", "thermostat/key-off.png", GRAY],
    ["thermometer-regular@2x.png", "thermostat/key-off@2x.png", GRAY],
    ["thermometer-fill.png", "thermostat/key-on.png", ORANGE],
    ["thermometer-fill@2x.png", "thermostat/key-on@2x.png", ORANGE],
    // Status (always uses fill style for visibility)
    ["info-fill.png", "status/key.png", GRAY],
    ["info-fill@2x.png", "status/key@2x.png", GRAY],
  ];

  for (const [src, dest, color] of buttonIcons) {
    await tintIcon(join(OUTPUT_PATH, src), join(actionsPath, dest), color);
  }

  console.log(`Generated ${listIcons.length * 2} action list icons and ${buttonIcons.length} button state icons`);
}

/**
 * Tint a white PNG icon to a specific color using color matrix.
 */
async function tintIcon(srcPath, destPath, hexColor) {
  const r = parseInt(hexColor.slice(1, 3), 16) / 255;
  const g = parseInt(hexColor.slice(3, 5), 16) / 255;
  const b = parseInt(hexColor.slice(5, 7), 16) / 255;

  await sharp(srcPath)
    .recomb([
      [r, 0, 0],
      [0, g, 0],
      [0, 0, b],
    ])
    .toFile(destPath);
}

main().catch(console.error);
