/**
 * Maps device types (as returned by the Itsyhome webhook API) to icon paths.
 * Icons are Phosphor Icons (MIT licensed), bundled as white-on-transparent PNGs.
 */

const DEVICE_TYPE_ICONS: Record<string, string> = {
  "light": "light",
  "switch": "switch",
  "outlet": "outlet",
  "fan": "fan",
  "thermostat": "thermostat",
  "heater-cooler": "heater-cooler",
  "lock": "lock",
  "blinds": "blinds",
  "garage-door": "garage-door",
  "temperature-sensor": "temperature-sensor",
  "humidity-sensor": "humidity-sensor",
  "security-system": "security-system",
};

const DEFAULT_ICON = "light";

export function getDeviceIcon(deviceType: string, isOn: boolean): string {
  const base = DEVICE_TYPE_ICONS[deviceType] ?? DEFAULT_ICON;
  const state = isOn ? "on" : "off";
  return `imgs/device-types/${base}-${state}.png`;
}

export function getThermostatIcon(deviceType: string, isOn: boolean, mode: string | undefined): string {
  const base = deviceType === "heater-cooler" ? "heater-cooler" : "thermostat";
  const isMode = mode === "heat" || mode === "cool" || mode === "auto";
  if (isOn && isMode) {
    return `imgs/device-types/${base}-${mode}.png`;
  }
  if (!isOn && isMode) {
    return `imgs/device-types/${base}-${mode}-off.png`;
  }
  return `imgs/device-types/${base}-off.png`;
}

export function getSceneIcon(): string {
  return "imgs/device-types/scene-on.png";
}

export function getGroupIcon(isOn: boolean): string {
  const state = isOn ? "on" : "off";
  return `imgs/device-types/group-${state}.png`;
}
