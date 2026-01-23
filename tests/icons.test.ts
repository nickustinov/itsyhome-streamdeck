import { describe, it, expect } from "vitest";
import { getDeviceIcon, getThermostatIcon, getGroupIcon } from "../src/icons";

describe("getDeviceIcon", () => {
  const knownTypes = [
    "light", "switch", "outlet", "fan", "thermostat",
    "heater-cooler", "lock", "blinds", "garage-door",
    "temperature-sensor", "humidity-sensor", "security-system",
  ];

  it.each(knownTypes)("returns correct on icon for %s", (type) => {
    expect(getDeviceIcon(type, true)).toBe(`imgs/device-types/${type}-on.png`);
  });

  it.each(knownTypes)("returns correct off icon for %s", (type) => {
    expect(getDeviceIcon(type, false)).toBe(`imgs/device-types/${type}-off.png`);
  });

  it("falls back to light for unknown device type", () => {
    expect(getDeviceIcon("unknown-device", true)).toBe("imgs/device-types/light-on.png");
    expect(getDeviceIcon("unknown-device", false)).toBe("imgs/device-types/light-off.png");
  });
});

describe("getThermostatIcon", () => {
  describe("thermostat type", () => {
    it("returns mode-specific icon when on with known mode", () => {
      expect(getThermostatIcon("thermostat", true, "heat")).toBe("imgs/device-types/thermostat-heat.png");
      expect(getThermostatIcon("thermostat", true, "cool")).toBe("imgs/device-types/thermostat-cool.png");
      expect(getThermostatIcon("thermostat", true, "auto")).toBe("imgs/device-types/thermostat-auto.png");
    });

    it("returns mode-off icon when off with known mode", () => {
      expect(getThermostatIcon("thermostat", false, "heat")).toBe("imgs/device-types/thermostat-heat-off.png");
      expect(getThermostatIcon("thermostat", false, "cool")).toBe("imgs/device-types/thermostat-cool-off.png");
      expect(getThermostatIcon("thermostat", false, "auto")).toBe("imgs/device-types/thermostat-auto-off.png");
    });

    it("returns off icon when off with no mode", () => {
      expect(getThermostatIcon("thermostat", false, undefined)).toBe("imgs/device-types/thermostat-off.png");
    });

    it("returns off icon when on with unknown mode", () => {
      expect(getThermostatIcon("thermostat", true, "unknown")).toBe("imgs/device-types/thermostat-off.png");
    });

    it("returns off icon when on with no mode", () => {
      expect(getThermostatIcon("thermostat", true, undefined)).toBe("imgs/device-types/thermostat-off.png");
    });
  });

  describe("heater-cooler type", () => {
    it("returns heater-cooler mode icon when on with known mode", () => {
      expect(getThermostatIcon("heater-cooler", true, "heat")).toBe("imgs/device-types/heater-cooler-heat.png");
      expect(getThermostatIcon("heater-cooler", true, "cool")).toBe("imgs/device-types/heater-cooler-cool.png");
      expect(getThermostatIcon("heater-cooler", true, "auto")).toBe("imgs/device-types/heater-cooler-auto.png");
    });

    it("returns heater-cooler mode-off icon when off with known mode", () => {
      expect(getThermostatIcon("heater-cooler", false, "heat")).toBe("imgs/device-types/heater-cooler-heat-off.png");
      expect(getThermostatIcon("heater-cooler", false, "cool")).toBe("imgs/device-types/heater-cooler-cool-off.png");
      expect(getThermostatIcon("heater-cooler", false, "auto")).toBe("imgs/device-types/heater-cooler-auto-off.png");
    });

    it("returns heater-cooler off icon with no mode", () => {
      expect(getThermostatIcon("heater-cooler", false, undefined)).toBe("imgs/device-types/heater-cooler-off.png");
    });
  });
});

describe("getGroupIcon", () => {
  it("returns group-on icon when on", () => {
    expect(getGroupIcon(true)).toBe("imgs/device-types/group-on.png");
  });

  it("returns group-off icon when off", () => {
    expect(getGroupIcon(false)).toBe("imgs/device-types/group-off.png");
  });
});
