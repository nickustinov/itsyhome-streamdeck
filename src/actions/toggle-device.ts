import streamDeck, {
  action,
  DidReceiveSettingsEvent,
  KeyDownEvent,
  SingletonAction,
  WillAppearEvent,
  WillDisappearEvent,
  type KeyAction,
} from "@elgato/streamdeck";
import { ItsyhomeClient, type DeviceState } from "../api/itsyhome-client";
import { renderIcon } from "../icon-renderer";

const DEFAULT_OFF_COLOR = "#8e8e93"; // Gray
const DEFAULT_ON_COLOR = "#ff9500"; // Orange

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

type ToggleSettings = {
  target: string;
  port: number;
  label?: string;
  offColor?: string;
  onColor?: string;
};

const POLL_INTERVAL_MS = 3000;

type DeviceCache = {
  type: string;
  isOn: boolean;
  icon?: string;
};

@action({ UUID: "com.nickustinov.itsyhome.toggle" })
export class ToggleDeviceAction extends SingletonAction<ToggleSettings> {
  private client = new ItsyhomeClient();
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private activeContexts = new Set<string>();
  private deviceCache = new Map<string, DeviceCache>();

  override async onWillAppear(ev: WillAppearEvent<ToggleSettings>): Promise<void> {
    const { target, port } = ev.payload.settings;
    this.activeContexts.add(ev.action.id);

    if (port) {
      this.client = new ItsyhomeClient(undefined, port);
    }

    if (target) {
      await this.updateState(ev.action as KeyAction<ToggleSettings>, target, ev.payload.settings);
    }

    this.startPolling();
  }

  override onWillDisappear(ev: WillDisappearEvent<ToggleSettings>): void {
    this.activeContexts.delete(ev.action.id);
    if (this.activeContexts.size === 0) {
      this.stopPolling();
    }
  }

  override async onDidReceiveSettings(ev: DidReceiveSettingsEvent<ToggleSettings>): Promise<void> {
    const { target, port } = ev.payload.settings;

    if (port) {
      this.client = new ItsyhomeClient(undefined, port);
    }

    if (target) {
      await this.updateState(ev.action as KeyAction<ToggleSettings>, target, ev.payload.settings);
    }
  }

  override async onKeyDown(ev: KeyDownEvent<ToggleSettings>): Promise<void> {
    const { target } = ev.payload.settings;

    if (!target) {
      await ev.action.showAlert();
      await ev.action.setState(0);
      return;
    }

    const cached = this.deviceCache.get(target);

    try {
      const result = await this.client.toggle(target);
      if (result.status === "error") {
        streamDeck.logger.error(`Toggle failed: ${result.message}`);
        await ev.action.showAlert();
        await ev.action.setState(cached?.isOn ? 1 : 0);
        return;
      }

      // Optimistic update: flip the cached state immediately
      if (cached) {
        const newIsOn = !cached.isOn;
        this.deviceCache.set(target, { ...cached, isOn: newIsOn });
        await this.applyVisualState(ev.action as KeyAction<ToggleSettings>, target, cached.type, newIsOn, cached.icon, ev.payload.settings);
        await ev.action.setTitle(ev.payload.settings.label || "");
      }
    } catch (err) {
      streamDeck.logger.error(`Toggle error: ${err}`);
      await ev.action.showAlert();
      await ev.action.setState(cached?.isOn ? 1 : 0);
    }
  }

  private startPolling(): void {
    if (this.pollTimer) return;

    this.pollTimer = setInterval(async () => {
      for (const action of this.actions) {
        if (!("setState" in action)) continue;
        const settings = await action.getSettings<ToggleSettings>();
        if (settings.target) {
          await this.updateState(action as KeyAction<ToggleSettings>, settings.target, settings);
        }
      }
    }, POLL_INTERVAL_MS);
  }

  private stopPolling(): void {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }

  private async updateState(action: KeyAction<ToggleSettings>, target: string, settings: ToggleSettings): Promise<void> {
    try {
      const info = await this.client.getDeviceInfo(target);
      const device = Array.isArray(info) ? info[0] : info;
      if (!device) return;

      const state = device.state as DeviceState | undefined;
      const isOn = state?.on ?? false;
      const icon = device.icon;

      this.deviceCache.set(target, { type: device.type, isOn, icon });
      await this.applyVisualState(action, target, device.type, isOn, icon, settings);
      await action.setTitle(settings.label || "");
    } catch {
      // Server might not be running — silently ignore
    }
  }

  private async applyVisualState(
    action: KeyAction<ToggleSettings>,
    target: string,
    deviceType: string,
    isOn: boolean,
    apiIcon?: string,
    settings?: ToggleSettings,
  ): Promise<void> {
    // Determine icon name
    const isGroup = target.startsWith("group.") || target.includes("/group.");
    const iconName = apiIcon ?? (isGroup ? "squares-four" : DEVICE_TYPE_FALLBACK[deviceType]) ?? "question";

    // Get color based on state
    const color = isOn
      ? (settings?.onColor || DEFAULT_ON_COLOR)
      : (settings?.offColor || DEFAULT_OFF_COLOR);

    // Render tinted icon
    const icon = await renderIcon(iconName, color, isOn);

    await action.setImage(icon);
    await action.setState(isOn ? 1 : 0);
  }
}
