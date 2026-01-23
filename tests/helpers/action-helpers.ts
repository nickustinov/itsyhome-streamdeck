import { vi } from "vitest";

export function createMockAction() {
  return {
    id: "test-action-id",
    setImage: vi.fn().mockResolvedValue(undefined),
    setTitle: vi.fn().mockResolvedValue(undefined),
    setState: vi.fn().mockResolvedValue(undefined),
    showAlert: vi.fn().mockResolvedValue(undefined),
    showOk: vi.fn().mockResolvedValue(undefined),
    getSettings: vi.fn().mockResolvedValue({}),
  };
}

export function createWillAppearEvent(settings: Record<string, unknown> = {}) {
  const action = createMockAction();
  return {
    action,
    payload: { settings },
  };
}

export function createWillDisappearEvent(actionId = "test-action-id") {
  return {
    action: { id: actionId },
    payload: { settings: {} },
  };
}

export function createKeyDownEvent(settings: Record<string, unknown> = {}) {
  const action = createMockAction();
  return {
    action,
    payload: { settings },
  };
}

export function createDidReceiveSettingsEvent(settings: Record<string, unknown> = {}) {
  const action = createMockAction();
  return {
    action,
    payload: { settings },
  };
}

export function createMockClient() {
  return {
    getDeviceInfo: vi.fn(),
    toggle: vi.fn(),
    setBrightness: vi.fn(),
    setPosition: vi.fn(),
    executeScene: vi.fn(),
    listDevices: vi.fn(),
    listScenes: vi.fn(),
    listGroups: vi.fn(),
    turnOn: vi.fn(),
    turnOff: vi.fn(),
    isAvailable: vi.fn(),
  };
}
