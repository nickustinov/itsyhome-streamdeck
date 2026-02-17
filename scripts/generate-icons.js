#!/usr/bin/env node

/**
 * Generate PNG icons from Phosphor SVGs for Stream Deck plugin.
 *
 * Only generates icons from the suggested icon sets in the Itsyhome macOS app
 * (per accessory type, scene, and group). Custom icons outside this set fall
 * back to the default icon for the device type at runtime.
 *
 * - Regular variants become "off" state (white fill)
 * - Fill variants become "on" state (yellow/orange fill, solid icon style)
 * - Icons are sized smaller to leave room for labels below
 * - Outputs at 144x144 (@2x) canvas size only
 */

import sharp from "sharp";
import { readFile, mkdir, rm, stat, readdir, access } from "node:fs/promises";
import { join, basename } from "node:path";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const PHOSPHOR_PATH = join(__dirname, "../node_modules/@phosphor-icons/core/assets");
const OUTPUT_PATH = join(__dirname, "../com.nickustinov.itsyhome.sdPlugin/imgs/icons");

const ICON_COLOR = "#ffffff"; // All icons white, tinted at runtime

// Canvas sizes and icon sizes within them (moved up from center)
// Only generate @2x — Stream Deck downscales for standard displays
const SIZES = [
  { canvas: 144, icon: 104, verticalOffset: -16, suffix: "@2x" },
];

// Only bundle icons from the suggested sets in the Itsyhome macOS app.
// Matches accessoryIconConfigs, suggestedSceneIcons, and suggestedGroupIcons
// from PhosphorIcon.swift. Icons outside this set fall back to defaults.
const SUGGESTED_ICONS = new Set([
  // Lightbulb
  "lightbulb", "lightbulb-filament", "sun", "lamp", "lamp-pendant", "headlights",
  // Switch
  "power", "toggle-left", "toggle-right", "plug", "plug-charging", "plugs",
  // Thermostat / AC
  "thermometer", "thermometer-cold", "thermometer-hot", "thermometer-simple",
  "snowflake", "fire", "fire-simple", "arrows-left-right",
  // Lock
  "lock", "lock-key", "lock-simple", "lock-laminated", "keyhole", "key", "lock-open",
  // Fan
  "fan", "wind",
  // Blinds / window covering
  "arrows-out-line-vertical", "caret-up-down", "list",
  // Door / window
  "door-open", "door", "browser", "frame-corners",
  // Garage door
  "garage", "car", "car-profile", "car-simple", "warning",
  // Humidifier
  "drop-half", "drop", "drop-simple", "drop-half-bottom",
  // Air purifier / valve / faucet
  "pipe", "shower",
  // Slats
  "equals", "rows",
  // Security system
  "shield", "shield-check", "shield-star", "shield-warning",
  // Scenes
  "sparkle", "sun-horizon", "moon", "moon-stars",
  "house", "airplane-takeoff", "film-strip", "confetti", "coffee",
  "briefcase", "fork-knife", "book-open", "heart",
  "game-controller", "music-notes", "television", "bed",
  // Groups
  "squares-four", "grid-four", "stack", "folder", "tag", "couch",
  // Status
  "info",
  // Fallback
  "question",
]);

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

  for (const { canvas, icon, verticalOffset = 0, suffix } of SIZES) {
    const hOffset = Math.floor((canvas - icon) / 2);
    const vOffset = Math.floor((canvas - icon) / 2) + verticalOffset;
    const top = Math.max(0, vOffset);
    const bottom = Math.max(0, canvas - icon - vOffset);
    const left = hOffset;
    const right = canvas - icon - hOffset;

    // Regular (outline) variant
    promises.push(
      sharp(Buffer.from(regularWhite), { density: 300 })
        .resize(icon, icon)
        .extend({
          top,
          bottom,
          left,
          right,
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
          top,
          bottom,
          left,
          right,
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
  console.log(`Generating ${SUGGESTED_ICONS.size} suggested icons from Phosphor SVGs...\n`);

  // Clean and recreate output directory
  try {
    await rm(OUTPUT_PATH, { recursive: true });
  } catch {
    // Directory might not exist
  }
  await mkdir(OUTPUT_PATH, { recursive: true });

  const regularDir = join(PHOSPHOR_PATH, "regular");
  const fillDir = join(PHOSPHOR_PATH, "fill");

  // Build fill lookup for fast access (fill files have -fill suffix)
  const fillFiles = new Set(await readdir(fillDir));

  let processed = 0;
  const total = SUGGESTED_ICONS.size;

  for (const iconName of SUGGESTED_ICONS) {
    const regularPath = join(regularDir, `${iconName}.svg`);
    const fillFileName = `${iconName}-fill.svg`;
    const fillPath = fillFiles.has(fillFileName) ? join(fillDir, fillFileName) : null;

    try {
      await processIcon(iconName, regularPath, fillPath);
      processed++;
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
    ["plug", "toggle", WHITE],
    ["sparkle", "scene", WHITE],
    ["lightbulb", "brightness", WHITE],
    ["fan", "fan", WHITE],
    ["drop", "humidifier", WHITE],
    ["shield-check", "security-system", WHITE],
    ["lock", "lock", WHITE],
    ["garage", "garage-door", WHITE],
    ["arrows-out-line-vertical", "blinds", WHITE],
    ["thermometer", "thermostat", WHITE],
    ["info", "status", WHITE],
    ["squares-four", "group", WHITE],
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
  const BLUE = "#007aff";
  const TEAL = "#30b0c7";
  // All source icons are @2x only; 1x action defaults are resized from @2x
  const buttonIcons = [
    // Toggle - plug: OFF=regular+gray, ON=fill+orange
    ["plug-regular@2x.png", "toggle/key-off.png", GRAY, 72],
    ["plug-regular@2x.png", "toggle/key-off@2x.png", GRAY],
    ["plug-fill@2x.png", "toggle/key-on.png", ORANGE, 72],
    ["plug-fill@2x.png", "toggle/key-on@2x.png", ORANGE],
    // Scene - sparkle (always "on" style = fill)
    ["sparkle-fill@2x.png", "scene/key.png", ORANGE, 72],
    ["sparkle-fill@2x.png", "scene/key@2x.png", ORANGE],
    // Brightness - lightbulb: OFF=regular+gray, ON=fill+orange
    ["lightbulb-regular@2x.png", "brightness/key-off.png", GRAY, 72],
    ["lightbulb-regular@2x.png", "brightness/key-off@2x.png", GRAY],
    ["lightbulb-fill@2x.png", "brightness/key-on.png", ORANGE, 72],
    ["lightbulb-fill@2x.png", "brightness/key-on@2x.png", ORANGE],
    // Fan: OFF=regular+gray, ON=fill+blue
    ["fan-regular@2x.png", "fan/key-off.png", GRAY, 72],
    ["fan-regular@2x.png", "fan/key-off@2x.png", GRAY],
    ["fan-fill@2x.png", "fan/key-on.png", BLUE, 72],
    ["fan-fill@2x.png", "fan/key-on@2x.png", BLUE],
    // Humidifier: OFF=regular+gray, ON=fill+teal
    ["drop-regular@2x.png", "humidifier/key-off.png", GRAY, 72],
    ["drop-regular@2x.png", "humidifier/key-off@2x.png", GRAY],
    ["drop-fill@2x.png", "humidifier/key-on.png", TEAL, 72],
    ["drop-fill@2x.png", "humidifier/key-on@2x.png", TEAL],
    // Security System: disarmed=regular+gray, armed=fill+green
    ["shield-check-regular@2x.png", "security-system/key-off.png", GRAY, 72],
    ["shield-check-regular@2x.png", "security-system/key-off@2x.png", GRAY],
    ["shield-check-fill@2x.png", "security-system/key-on.png", GREEN, 72],
    ["shield-check-fill@2x.png", "security-system/key-on@2x.png", GREEN],
    // Lock: unlocked=regular+orange (attention), locked=fill+green (secure)
    ["lock-regular@2x.png", "lock/key-unlocked.png", ORANGE, 72],
    ["lock-regular@2x.png", "lock/key-unlocked@2x.png", ORANGE],
    ["lock-fill@2x.png", "lock/key-locked.png", GREEN, 72],
    ["lock-fill@2x.png", "lock/key-locked@2x.png", GREEN],
    // Garage door: closed=regular+gray, open=fill+orange
    ["garage-regular@2x.png", "garage-door/key-closed.png", GRAY, 72],
    ["garage-regular@2x.png", "garage-door/key-closed@2x.png", GRAY],
    ["garage-fill@2x.png", "garage-door/key-open.png", ORANGE, 72],
    ["garage-fill@2x.png", "garage-door/key-open@2x.png", ORANGE],
    // Blinds: closed=regular+gray, open=fill+orange
    ["arrows-out-line-vertical-regular@2x.png", "blinds/key-closed.png", GRAY, 72],
    ["arrows-out-line-vertical-regular@2x.png", "blinds/key-closed@2x.png", GRAY],
    ["arrows-out-line-vertical-fill@2x.png", "blinds/key-open.png", ORANGE, 72],
    ["arrows-out-line-vertical-fill@2x.png", "blinds/key-open@2x.png", ORANGE],
    // Thermostat: OFF=regular+gray, ON=fill+orange
    ["thermometer-regular@2x.png", "thermostat/key-off.png", GRAY, 72],
    ["thermometer-regular@2x.png", "thermostat/key-off@2x.png", GRAY],
    ["thermometer-fill@2x.png", "thermostat/key-on.png", ORANGE, 72],
    ["thermometer-fill@2x.png", "thermostat/key-on@2x.png", ORANGE],
    // Status (always uses fill style for visibility)
    ["info-fill@2x.png", "status/key.png", GRAY, 72],
    ["info-fill@2x.png", "status/key@2x.png", GRAY],
    // Group: OFF=regular+gray, ON=fill+orange
    ["squares-four-regular@2x.png", "group/key-off.png", GRAY, 72],
    ["squares-four-regular@2x.png", "group/key-off@2x.png", GRAY],
    ["squares-four-fill@2x.png", "group/key-on.png", ORANGE, 72],
    ["squares-four-fill@2x.png", "group/key-on@2x.png", ORANGE],
  ];

  for (const [src, dest, color, resizeTo] of buttonIcons) {
    await tintIcon(join(OUTPUT_PATH, src), join(actionsPath, dest), color, resizeTo);
  }

  console.log(`Generated ${listIcons.length * 2} action list icons and ${buttonIcons.length} button state icons`);
}

/**
 * Tint a white PNG icon to a specific color using color matrix.
 */
async function tintIcon(srcPath, destPath, hexColor, resizeTo) {
  const r = parseInt(hexColor.slice(1, 3), 16) / 255;
  const g = parseInt(hexColor.slice(3, 5), 16) / 255;
  const b = parseInt(hexColor.slice(5, 7), 16) / 255;

  let pipeline = sharp(srcPath)
    .recomb([
      [r, 0, 0],
      [0, g, 0],
      [0, 0, b],
    ]);

  if (resizeTo) {
    pipeline = pipeline.resize(resizeTo, resizeTo);
  }

  await pipeline.toFile(destPath);
}

main().catch(console.error);
