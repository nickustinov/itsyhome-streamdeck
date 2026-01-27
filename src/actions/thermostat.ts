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

type ThermostatSettings = {
  target: string;
  port: number;
  label: string;
  display: "current-target" | "current" | "target";
  offColor?: string;
  onColor?: string;
};

type ThermostatCache = {
  isOn: boolean;
  deviceType: string;
  mode?: string;
  icon?: string;
};

const POLL_INTERVAL_MS = 3000;

@action({ UUID: "com.nickustinov.itsyhome.thermostat" })
export class ThermostatAction extends SingletonAction<ThermostatSettings> {
  private client = new ItsyhomeClient();
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private activeContexts = new Set<string>();
  private stateCache = new Map<string, ThermostatCache>();

  override async onWillAppear(ev: WillAppearEvent<ThermostatSettings>): Promise<void> {
    const { target, port } = ev.payload.settings;
    this.activeContexts.add(ev.action.id);

    if (port) {
      this.client = new ItsyhomeClient(undefined, port);
    }

    if (target) {
      await this.updateState(ev.action as KeyAction<ThermostatSettings>, target, ev.payload.settings);
    }

    this.startPolling();
  }

  override onWillDisappear(ev: WillDisappearEvent<ThermostatSettings>): void {
    this.activeContexts.delete(ev.action.id);
    if (this.activeContexts.size === 0) {
      this.stopPolling();
    }
  }

  override async onDidReceiveSettings(ev: DidReceiveSettingsEvent<ThermostatSettings>): Promise<void> {
    const { target, port } = ev.payload.settings;

    if (port) {
      this.client = new ItsyhomeClient(undefined, port);
    }

    if (target) {
      await this.updateState(ev.action as KeyAction<ThermostatSettings>, target, ev.payload.settings);
    }
  }

  override async onKeyDown(ev: KeyDownEvent<ThermostatSettings>): Promise<void> {
    const { target } = ev.payload.settings;

    if (!target) {
      await ev.action.showAlert();
      return;
    }

    try {
      const result = await this.client.toggle(target);
      if (result.status === "error") {
        streamDeck.logger.error(`Thermostat toggle failed: ${result.message}`);
        await ev.action.showAlert();
        return;
      }

      // Optimistic update
      const cached = this.stateCache.get(target);
      if (cached) {
        const newIsOn = !cached.isOn;
        this.stateCache.set(target, { ...cached, isOn: newIsOn });
        await this.applyVisualState(
          ev.action as KeyAction<ThermostatSettings>,
          newIsOn,
          cached.icon,
          ev.payload.settings,
        );
      }
    } catch (err) {
      streamDeck.logger.error(`Thermostat toggle error: ${err}`);
      await ev.action.showAlert();
    }
  }

  private startPolling(): void {
    if (this.pollTimer) return;

    this.pollTimer = setInterval(async () => {
      for (const action of this.actions) {
        if (!("setState" in action)) continue;
        const settings = await action.getSettings<ThermostatSettings>();
        if (settings.target) {
          await this.updateState(action as KeyAction<ThermostatSettings>, settings.target, settings);
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

  private async updateState(action: KeyAction<ThermostatSettings>, target: string, settings: ThermostatSettings): Promise<void> {
    try {
      const info = await this.client.getDeviceInfo(target);
      const device = Array.isArray(info) ? info[0] : info;
      if (!device) return;

      const state = device.state as DeviceState | undefined;
      const isOn = state?.on ?? false;
      const mode = state?.mode;
      const current = state?.temperature;
      const targetTemp = state?.targetTemperature;
      const display = settings.display || "current-target";

      const icon = device.icon;
      this.stateCache.set(target, { isOn, deviceType: device.type, mode, icon });

      let tempStr = "";
      if (display === "current-target" && current != null && targetTemp != null) {
        tempStr = `${Math.round(current)}°/${Math.round(targetTemp)}°`;
      } else if (display === "current-target" && current != null) {
        tempStr = `${Math.round(current)}°`;
      } else if (display === "current" && current != null) {
        tempStr = `${Math.round(current)}°`;
      } else if (display === "target" && targetTemp != null) {
        tempStr = `${Math.round(targetTemp)}°`;
      }

      const label = settings.label;
      const title = label && tempStr ? `${label}\n${tempStr}` : label || tempStr;

      await this.applyVisualState(action, isOn, icon, settings);
      await action.setTitle(title);
    } catch {
      // Server might not be running
    }
  }

  private async applyVisualState(
    action: KeyAction<ThermostatSettings>,
    isOn: boolean,
    apiIcon?: string,
    settings?: ThermostatSettings,
  ): Promise<void> {
    const iconName = apiIcon ?? "thermometer";
    const color = isOn
      ? (settings?.onColor || DEFAULT_ON_COLOR)
      : (settings?.offColor || DEFAULT_OFF_COLOR);
    const icon = await renderIcon(iconName, color, isOn);
    await action.setImage(icon);
    await action.setState(isOn ? 1 : 0);
  }
}
