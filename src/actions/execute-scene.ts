import streamDeck, {
  action,
  DidReceiveSettingsEvent,
  KeyDownEvent,
  SingletonAction,
  WillAppearEvent,
  WillDisappearEvent,
  type KeyAction,
} from "@elgato/streamdeck";
import { ItsyhomeClient, type SceneInfo, type SceneState } from "../api/itsyhome-client";
import { renderIcon } from "../icon-renderer";

const DEFAULT_ON_COLOR = "#ff9500"; // Orange
const DEFAULT_OFF_COLOR = "#8e8e93"; // Gray

const POLL_INTERVAL_MS = 3000;

type SceneSettings = {
  scene: string;
  port: number;
  label?: string;
  /** Legacy single-colour setting, still honoured as the "on" colour. */
  color?: string;
  onColor?: string;
  offColor?: string;
  /** When true, pressing an active scene deactivates it instead of re-firing it. */
  toggle?: boolean;
};

type SceneCache = {
  /** undefined = scene reports no state, so the key stays fire-only. */
  isOn?: boolean;
  icon?: string;
};

@action({ UUID: "com.nickustinov.itsyhome.scene" })
export class ExecuteSceneAction extends SingletonAction<SceneSettings> {
  private client = new ItsyhomeClient();
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private activeContexts = new Set<string>();
  private sceneCache = new Map<string, SceneCache>();

  override async onWillAppear(ev: WillAppearEvent<SceneSettings>): Promise<void> {
    const { scene, port } = ev.payload.settings;
    this.activeContexts.add(ev.action.id);

    if (port) {
      this.client = new ItsyhomeClient(undefined, port);
    }

    if (scene) {
      await this.updateState(ev.action as KeyAction<SceneSettings>, scene, ev.payload.settings);
    } else {
      await this.setDefaultIcon(ev.action as KeyAction<SceneSettings>, ev.payload.settings);
    }
    await ev.action.setTitle(ev.payload.settings.label || scene || "");

    this.startPolling();
  }

  override onWillDisappear(ev: WillDisappearEvent<SceneSettings>): void {
    this.activeContexts.delete(ev.action.id);
    if (this.activeContexts.size === 0) {
      this.stopPolling();
    }
  }

  override async onDidReceiveSettings(ev: DidReceiveSettingsEvent<SceneSettings>): Promise<void> {
    const { scene, port } = ev.payload.settings;

    if (port) {
      this.client = new ItsyhomeClient(undefined, port);
    }

    if (scene) {
      await this.updateState(ev.action as KeyAction<SceneSettings>, scene, ev.payload.settings);
    } else {
      await this.setDefaultIcon(ev.action as KeyAction<SceneSettings>, ev.payload.settings);
    }
    await ev.action.setTitle(ev.payload.settings.label || scene || "");
  }

  override async onKeyDown(ev: KeyDownEvent<SceneSettings>): Promise<void> {
    const { scene, toggle } = ev.payload.settings;

    if (!scene) {
      await ev.action.showAlert();
      return;
    }

    const cached = this.sceneCache.get(scene);
    // Only deactivate when the user opted in AND the scene actually reports a state.
    const shouldDeactivate = toggle === true && cached?.isOn === true;

    try {
      const result = shouldDeactivate
        ? await this.client.deactivateScene(scene)
        : await this.client.executeScene(scene);

      if (result.status === "error") {
        streamDeck.logger.error(`Scene ${shouldDeactivate ? "deactivation" : "execution"} failed: ${result.message}`);
        await ev.action.showAlert();
        return;
      }

      await ev.action.showOk();

      // Optimistic update: scenes take a moment to settle, so reflect the
      // intended state immediately instead of waiting for the next poll.
      if (cached?.isOn !== undefined) {
        const newIsOn = !shouldDeactivate;
        this.sceneCache.set(scene, { ...cached, isOn: newIsOn });
        await this.applyVisualState(ev.action as KeyAction<SceneSettings>, newIsOn, cached.icon, ev.payload.settings);
        await ev.action.setTitle(ev.payload.settings.label || scene || "");
      }
    } catch (err) {
      streamDeck.logger.error(`Scene action error: ${err}`);
      await ev.action.showAlert();
    }
  }

  private startPolling(): void {
    if (this.pollTimer) return;

    this.pollTimer = setInterval(async () => {
      for (const action of this.actions) {
        if (!("setState" in action)) continue;
        const settings = await action.getSettings<SceneSettings>();
        if (settings.scene) {
          await this.updateState(action as KeyAction<SceneSettings>, settings.scene, settings);
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

  private async updateState(
    action: KeyAction<SceneSettings>,
    sceneName: string,
    settings: SceneSettings,
  ): Promise<void> {
    try {
      const scenes = await this.client.listScenes();
      const scene = scenes.find((s: SceneInfo) => s.name === sceneName);
      if (!scene) {
        await this.setDefaultIcon(action, settings);
        return;
      }

      const state: SceneState | undefined = scene.state;
      const isOn = state?.on;

      this.sceneCache.set(sceneName, { isOn, icon: scene.icon });
      await this.applyVisualState(action, isOn, scene.icon, settings);
      await action.setTitle(settings.label || sceneName || "");
    } catch {
      // Server not running or unreachable: keep the pre-existing behaviour of
      // showing the neutral scene icon rather than leaving the key blank.
      await this.setDefaultIcon(action, settings);
    }
  }

  private async setDefaultIcon(action: KeyAction<SceneSettings>, settings: SceneSettings): Promise<void> {
    const color = this.onColor(settings);
    const icon = await renderIcon("sparkle", color, true);
    await action.setImage(icon);
  }

  private onColor(settings: SceneSettings): string {
    // `color` predates the on/off split; keep honouring it so existing keys
    // don't silently lose their colour after an update.
    return settings.onColor || settings.color || DEFAULT_ON_COLOR;
  }

  private async applyVisualState(
    action: KeyAction<SceneSettings>,
    isOn: boolean | undefined,
    apiIcon?: string,
    settings?: SceneSettings,
  ): Promise<void> {
    const iconName = apiIcon ?? "sparkle";

    // Scenes without a reported state stay fire-only: always rendered "active"
    // so they look exactly as they did before state display existed.
    const hasState = isOn !== undefined;
    const active = hasState ? isOn : true;

    const color = active
      ? this.onColor(settings ?? ({} as SceneSettings))
      : (settings?.offColor || DEFAULT_OFF_COLOR);

    const icon = await renderIcon(iconName, color, active, undefined, "sparkle");

    await action.setImage(icon);
    await action.setState(active ? 1 : 0);
  }
}
