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

const DEFAULT_CLOSED_COLOR = "#8e8e93"; // Gray
const DEFAULT_OPEN_COLOR = "#ff9500"; // Orange

type BlindsSettings = {
  target: string;
  direction: "open" | "close";
  label: string;
  port: number;
  closedColor?: string;
  openColor?: string;
};

const POLL_INTERVAL_MS = 3000;

@action({ UUID: "com.nickustinov.itsyhome.blinds" })
export class BlindsAction extends SingletonAction<BlindsSettings> {
  private client = new ItsyhomeClient();
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private activeContexts = new Set<string>();

  override async onWillAppear(ev: WillAppearEvent<BlindsSettings>): Promise<void> {
    const { target, port } = ev.payload.settings;
    this.activeContexts.add(ev.action.id);

    if (port) {
      this.client = new ItsyhomeClient(undefined, port);
    }

    if (target) {
      await this.updateDisplay(ev.action, target, ev.payload.settings);
    } else {
      await this.applyDirectionIcon(ev.action, ev.payload.settings);
    }

    this.startPolling();
  }

  override onWillDisappear(ev: WillDisappearEvent<BlindsSettings>): void {
    this.activeContexts.delete(ev.action.id);
    if (this.activeContexts.size === 0) {
      this.stopPolling();
    }
  }

  override async onDidReceiveSettings(ev: DidReceiveSettingsEvent<BlindsSettings>): Promise<void> {
    const { target, port } = ev.payload.settings;

    if (port) {
      this.client = new ItsyhomeClient(undefined, port);
    }

    if (target) {
      await this.updateDisplay(ev.action, target, ev.payload.settings);
    } else {
      await this.applyDirectionIcon(ev.action, ev.payload.settings);
    }
  }

  override async onKeyDown(ev: KeyDownEvent<BlindsSettings>): Promise<void> {
    const { target } = ev.payload.settings;
    const direction = ev.payload.settings.direction || "open";

    if (!target) {
      await ev.action.showAlert();
      return;
    }

    const position = direction === "open" ? 100 : 0;

    try {
      const result = await this.client.setPosition(target, position);
      if (result.status === "error") {
        streamDeck.logger.error(`Blinds ${direction} failed: ${result.message}`);
        await ev.action.showAlert();
        return;
      }

      await ev.action.showOk();
    } catch (err) {
      streamDeck.logger.error(`Blinds error: ${err}`);
      await ev.action.showAlert();
    }
  }

  private startPolling(): void {
    if (this.pollTimer) return;

    this.pollTimer = setInterval(async () => {
      for (const action of this.actions) {
        const settings = await action.getSettings<BlindsSettings>();
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

  private async applyDirectionIcon(
    action: { setImage(image: string): Promise<void> },
    settings: BlindsSettings,
    apiIcon?: string,
  ): Promise<void> {
    const direction = settings.direction || "open";
    const isOpen = direction === "open";
    const iconName = apiIcon ?? "arrows-out-line-vertical";
    const color = isOpen
      ? (settings.openColor || DEFAULT_OPEN_COLOR)
      : (settings.closedColor || DEFAULT_CLOSED_COLOR);
    const icon = await renderIcon(iconName, color, isOpen);
    await action.setImage(icon);
  }

  private async updateDisplay(
    action: { setTitle(title: string): Promise<void>; setImage(image: string): Promise<void> },
    target: string,
    settings: BlindsSettings,
  ): Promise<void> {
    try {
      const info = await this.client.getDeviceInfo(target);
      const device = Array.isArray(info) ? info[0] : info;
      if (!device) return;

      const state = device.state as DeviceState | undefined;
      const position = state?.position;

      await this.applyDirectionIcon(action, settings, device.icon);
      const posStr = position != null ? `${position}%` : "";
      const label = settings.label;
      const title = label && posStr ? `${label}\n${posStr}` : label || posStr;
      await action.setTitle(title);
    } catch {
      // Server might not be running
    }
  }
}
