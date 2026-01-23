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

type GarageDoorSettings = {
  target: string;
  port: number;
  iconStyle?: string;
};

const POLL_INTERVAL_MS = 3000;

@action({ UUID: "com.nickustinov.itsyhome.garage-door" })
export class GarageDoorAction extends SingletonAction<GarageDoorSettings> {
  private client = new ItsyhomeClient();
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private activeContexts = new Set<string>();
  private stateCache = new Map<string, string>();
  private optimisticUntil = new Map<string, number>();

  override async onWillAppear(ev: WillAppearEvent<GarageDoorSettings>): Promise<void> {
    const { target, port, iconStyle } = ev.payload.settings;
    this.activeContexts.add(ev.action.id);

    if (port) {
      this.client = new ItsyhomeClient(undefined, port);
    }

    // Show closed state until first poll confirms actual state
    await this.applyVisualState(ev.action as KeyAction<GarageDoorSettings>, "closed", iconStyle);

    if (target) {
      await this.updateState(ev.action as KeyAction<GarageDoorSettings>, target, iconStyle);
    }

    this.startPolling();
  }

  override onWillDisappear(ev: WillDisappearEvent<GarageDoorSettings>): void {
    this.activeContexts.delete(ev.action.id);
    if (this.activeContexts.size === 0) {
      this.stopPolling();
    }
  }

  override async onDidReceiveSettings(ev: DidReceiveSettingsEvent<GarageDoorSettings>): Promise<void> {
    const { target, port, iconStyle } = ev.payload.settings;

    if (port) {
      this.client = new ItsyhomeClient(undefined, port);
    }

    if (target) {
      await this.updateState(ev.action as KeyAction<GarageDoorSettings>, target, iconStyle);
    } else {
      await this.applyVisualState(ev.action as KeyAction<GarageDoorSettings>, "closed", iconStyle);
    }
  }

  override async onKeyDown(ev: KeyDownEvent<GarageDoorSettings>): Promise<void> {
    const { target, iconStyle } = ev.payload.settings;

    if (!target) {
      await ev.action.showAlert();
      return;
    }

    try {
      const result = await this.client.toggle(target);
      if (result.status === "error") {
        streamDeck.logger.error(`Garage door toggle failed: ${result.message}`);
        await ev.action.showAlert();
        return;
      }

      // Optimistic update — hold for 30s (garage doors are slow)
      const currentState = this.stateCache.get(target) ?? "closed";
      const newState = currentState === "closed" || currentState === "closing" ? "open" : "closed";
      this.stateCache.set(target, newState);
      this.optimisticUntil.set(target, Date.now() + 30000);
      await this.applyVisualState(ev.action as KeyAction<GarageDoorSettings>, newState, iconStyle);
    } catch (err) {
      streamDeck.logger.error(`Garage door toggle error: ${err}`);
      await ev.action.showAlert();
    }
  }

  private startPolling(): void {
    if (this.pollTimer) return;

    this.pollTimer = setInterval(async () => {
      for (const action of this.actions) {
        if (!("setState" in action)) continue;
        const settings = await action.getSettings<GarageDoorSettings>();
        if (settings.target) {
          await this.updateState(action as KeyAction<GarageDoorSettings>, settings.target, settings.iconStyle);
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

  private async updateState(action: KeyAction<GarageDoorSettings>, target: string, iconStyle?: string): Promise<void> {
    try {
      const holdUntil = this.optimisticUntil.get(target);
      if (holdUntil && Date.now() < holdUntil) return;
      this.optimisticUntil.delete(target);

      const info = await this.client.getDeviceInfo(target);
      const device = Array.isArray(info) ? info[0] : info;
      if (!device) return;

      const state = device.state as DeviceState | undefined;
      const doorState = state?.doorState ?? "closed";
      this.stateCache.set(target, doorState);
      await this.applyVisualState(action, doorState, iconStyle);
    } catch {
      // Server might not be running
    }
  }

  private async applyVisualState(action: KeyAction<GarageDoorSettings>, doorState: string, iconStyle?: string): Promise<void> {
    const isOpen = doorState === "open" || doorState === "opening";
    const icon = iconStyle || "garage-door";
    await action.setImage(`imgs/device-types/${icon}-${isOpen ? "on" : "off"}.png`);
    await action.setState(isOpen ? 1 : 0);
  }
}
