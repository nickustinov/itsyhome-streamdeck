/**
 * Icon utilities for Stream Deck buttons.
 * Icons are Phosphor Icons (MIT licensed), bundled as PNGs.
 * Uses icons synced from the macOS host app via API.
 */

/**
 * Fallback icons when API doesn't return an icon.
 * Maps device type to Phosphor icon name.
 */
const DEVICE_TYPE_FALLBACK: Record<string, string> = {
  "light": "lightbulb",
  "switch": "switch",
  "outlet": "plug",
  "fan": "fan",
  "thermostat": "thermometer",
  "heater-cooler": "thermometer",
  "lock": "lock",
  "blinds": "venetian-mask",
  "garage-door": "garage",
  "temperature-sensor": "thermometer-simple",
  "humidity-sensor": "drop",
  "security-system": "shield-check",
};

const DEFAULT_ICON = "question";

/**
 * Get icon path from a Phosphor icon name.
 */
export function getIconFromName(iconName: string, isOn: boolean): string {
  const state = isOn ? "on" : "off";
  return `imgs/icons/${iconName}-${state}.png`;
}

/**
 * Get device icon, using API icon if available, otherwise fallback.
 */
export function getDeviceIcon(deviceType: string, isOn: boolean, apiIcon?: string): string {
  const iconName = apiIcon ?? DEVICE_TYPE_FALLBACK[deviceType] ?? DEFAULT_ICON;
  return getIconFromName(iconName, isOn);
}

/**
 * Get thermostat/AC icon based on mode.
 * Falls back to the API icon if available.
 */
export function getThermostatIcon(deviceType: string, isOn: boolean, mode: string | undefined, apiIcon?: string): string {
  const iconName = apiIcon ?? DEVICE_TYPE_FALLBACK[deviceType] ?? "thermometer";
  return getIconFromName(iconName, isOn);
}

/**
 * Get group icon, using API icon if available.
 */
export function getGroupIcon(isOn: boolean, apiIcon?: string): string {
  const iconName = apiIcon ?? "squares-four";
  return getIconFromName(iconName, isOn);
}

/**
 * Get scene icon, using API icon if available.
 */
export function getSceneIcon(apiIcon?: string): string {
  const iconName = apiIcon ?? "sparkle";
  return getIconFromName(iconName, true);
}

/**
 * Get lock icon.
 */
export function getLockIcon(isLocked: boolean, apiIcon?: string): string {
  const iconName = apiIcon ?? "lock";
  return getIconFromName(iconName, isLocked);
}

/**
 * Get garage door icon.
 */
export function getGarageDoorIcon(isOpen: boolean, apiIcon?: string): string {
  const iconName = apiIcon ?? "garage";
  return getIconFromName(iconName, isOpen);
}
