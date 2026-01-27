import { describe, it, expect } from "vitest";
import {
  getIconFromName,
  getDeviceIcon,
  getThermostatIcon,
  getGroupIcon,
  getSceneIcon,
  getLockIcon,
  getGarageDoorIcon,
} from "../src/icons";

describe("getIconFromName", () => {
  it("returns correct on icon path", () => {
    expect(getIconFromName("lightbulb", true)).toBe("imgs/icons/lightbulb-on.png");
  });

  it("returns correct off icon path", () => {
    expect(getIconFromName("lightbulb", false)).toBe("imgs/icons/lightbulb-off.png");
  });
});

describe("getDeviceIcon", () => {
  const fallbackMappings = [
    { type: "light", icon: "lightbulb" },
    { type: "switch", icon: "switch" },
    { type: "outlet", icon: "plug" },
    { type: "fan", icon: "fan" },
    { type: "thermostat", icon: "thermometer" },
    { type: "heater-cooler", icon: "thermometer" },
    { type: "lock", icon: "lock" },
    { type: "blinds", icon: "venetian-mask" },
    { type: "garage-door", icon: "garage" },
    { type: "temperature-sensor", icon: "thermometer-simple" },
    { type: "humidity-sensor", icon: "drop" },
    { type: "security-system", icon: "shield-check" },
  ];

  it.each(fallbackMappings)("returns fallback icon for $type", ({ type, icon }) => {
    expect(getDeviceIcon(type, true)).toBe(`imgs/icons/${icon}-on.png`);
    expect(getDeviceIcon(type, false)).toBe(`imgs/icons/${icon}-off.png`);
  });

  it("falls back to question for unknown device type", () => {
    expect(getDeviceIcon("unknown-device", true)).toBe("imgs/icons/question-on.png");
    expect(getDeviceIcon("unknown-device", false)).toBe("imgs/icons/question-off.png");
  });

  it("uses API icon when provided", () => {
    expect(getDeviceIcon("light", true, "lamp")).toBe("imgs/icons/lamp-on.png");
    expect(getDeviceIcon("light", false, "lamp")).toBe("imgs/icons/lamp-off.png");
  });
});

describe("getThermostatIcon", () => {
  it("returns thermometer icon for thermostat type", () => {
    expect(getThermostatIcon("thermostat", true, undefined)).toBe("imgs/icons/thermometer-on.png");
    expect(getThermostatIcon("thermostat", false, undefined)).toBe("imgs/icons/thermometer-off.png");
  });

  it("returns thermometer icon for heater-cooler type", () => {
    expect(getThermostatIcon("heater-cooler", true, "heat")).toBe("imgs/icons/thermometer-on.png");
    expect(getThermostatIcon("heater-cooler", false, "cool")).toBe("imgs/icons/thermometer-off.png");
  });

  it("uses API icon when provided", () => {
    expect(getThermostatIcon("thermostat", true, undefined, "snowflake")).toBe("imgs/icons/snowflake-on.png");
    expect(getThermostatIcon("heater-cooler", false, undefined, "fire")).toBe("imgs/icons/fire-off.png");
  });
});

describe("getGroupIcon", () => {
  it("returns squares-four icon for group", () => {
    expect(getGroupIcon(true)).toBe("imgs/icons/squares-four-on.png");
    expect(getGroupIcon(false)).toBe("imgs/icons/squares-four-off.png");
  });

  it("uses API icon when provided", () => {
    expect(getGroupIcon(true, "house")).toBe("imgs/icons/house-on.png");
    expect(getGroupIcon(false, "house")).toBe("imgs/icons/house-off.png");
  });
});

describe("getSceneIcon", () => {
  it("returns sparkle icon by default", () => {
    expect(getSceneIcon()).toBe("imgs/icons/sparkle-on.png");
  });

  it("uses API icon when provided", () => {
    expect(getSceneIcon("moon")).toBe("imgs/icons/moon-on.png");
  });
});

describe("getLockIcon", () => {
  it("returns lock icon by default", () => {
    expect(getLockIcon(true)).toBe("imgs/icons/lock-on.png");
    expect(getLockIcon(false)).toBe("imgs/icons/lock-off.png");
  });

  it("uses API icon when provided", () => {
    expect(getLockIcon(true, "shield")).toBe("imgs/icons/shield-on.png");
    expect(getLockIcon(false, "shield")).toBe("imgs/icons/shield-off.png");
  });
});

describe("getGarageDoorIcon", () => {
  it("returns garage icon by default", () => {
    expect(getGarageDoorIcon(true)).toBe("imgs/icons/garage-on.png");
    expect(getGarageDoorIcon(false)).toBe("imgs/icons/garage-off.png");
  });

  it("uses API icon when provided", () => {
    expect(getGarageDoorIcon(true, "car")).toBe("imgs/icons/car-on.png");
    expect(getGarageDoorIcon(false, "car")).toBe("imgs/icons/car-off.png");
  });
});
