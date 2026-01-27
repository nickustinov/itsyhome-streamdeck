import streamDeck, {
  action,
  DidReceiveSettingsEvent,
  KeyDownEvent,
  SingletonAction,
  WillAppearEvent,
  WillDisappearEvent,
} from "@elgato/streamdeck";
import { ItsyhomeClient, type DeviceState } from "../api/itsyhome-client";
import { renderIcon } from "../icon-renderer";

const DEFAULT_OFF_COLOR = "#8e8e93"; // Gray
const DEFAULT_ON_COLOR = "#ff9500"; // Orange

type BrightnessSettings = {
  target: string;
  brightness: number;
  port: number;
  label: string;
  offColor?: string;
  onColor?: string;
};

const POLL_INTERVAL_MS = 3000;

@action({ UUID: "com.nickustinov.itsyhome.brightness" })
export class SetBrightnessAction extends SingletonAction<BrightnessSettings> {
  private client = new ItsyhomeClient();
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private activeContexts = new Set<string>();

  override async onWillAppear(ev: WillAppearEvent<BrightnessSettings>): Promise<void> {
    const { target, port } = ev.payload.settings;
    this.activeContexts.add(ev.action.id);

    if (port) {
      this.client = new ItsyhomeClient(undefined, port);
    }

    if (target) {
      await this.updateDisplay(ev.action, target, ev.payload.settings);
    }

    this.startPolling();
  }

  override onWillDisappear(ev: WillDisappearEvent<BrightnessSettings>): void {
    this.activeContexts.delete(ev.action.id);
    if (this.activeContexts.size === 0) {
      this.stopPolling();
    }
  }

  override async onDidReceiveSettings(ev: DidReceiveSettingsEvent<BrightnessSettings>): Promise<void> {
    const { target, port } = ev.payload.settings;

    if (port) {
      this.client = new ItsyhomeClient(undefined, port);
    }

    if (target) {
      await this.updateDisplay(ev.action, target, ev.payload.settings);
    }
  }

  override async onKeyDown(ev: KeyDownEvent<BrightnessSettings>): Promise<void> {
    const { target, brightness } = ev.payload.settings;

    if (!target || brightness == null) {
      await ev.action.showAlert();
      return;
    }

    try {
      const result = await this.client.setBrightness(target, brightness);
      if (result.status === "error") {
        streamDeck.logger.error(`Brightness failed: ${result.message}`);
        await ev.action.showAlert();
        return;
      }

      await ev.action.showOk();
      await this.updateDisplay(ev.action, target, ev.payload.settings);
    } catch (err) {
      streamDeck.logger.error(`Brightness error: ${err}`);
      await ev.action.showAlert();
    }
  }

  private startPolling(): void {
    if (this.pollTimer) return;

    this.pollTimer = setInterval(async () => {
      for (const action of this.actions) {
        const settings = await action.getSettings<BrightnessSettings>();
        if (settings.target) {
          await this.updateDisplay(action, settings.target, settings);
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

  private async updateDisplay(
    action: { setTitle(title: string): Promise<void>; setImage(image: string): Promise<void> },
    target: string,
    settings: BrightnessSettings,
  ): Promise<void> {
    try {
      const info = await this.client.getDeviceInfo(target);
      const device = Array.isArray(info) ? info[0] : info;
      if (!device) return;

      const state = device.state as DeviceState | undefined;
      const isOn = state?.on ?? (state?.brightness != null && state.brightness > 0);
      const currentBrightness = state?.brightness;
      const value = currentBrightness != null ? `${currentBrightness}%` : `${settings.brightness}%`;
      const label = settings.label;
      const title = label && value ? `${label}\n${value}` : label || value;

      const iconName = device.icon ?? "lightbulb";
      const color = isOn
        ? (settings.onColor || DEFAULT_ON_COLOR)
        : (settings.offColor || DEFAULT_OFF_COLOR);
      const icon = await renderIcon(iconName, color, isOn);
      await action.setImage(icon);
      await action.setTitle(title);
    } catch {
      const value = `${settings.brightness}%`;
      const label = settings.label;
      await action.setTitle(label && value ? `${label}\n${value}` : label || value);
    }
  }
}
