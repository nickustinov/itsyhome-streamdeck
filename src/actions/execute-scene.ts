import streamDeck, {
  action,
  DidReceiveSettingsEvent,
  KeyDownEvent,
  SingletonAction,
  WillAppearEvent,
} from "@elgato/streamdeck";
import { ItsyhomeClient, type SceneInfo } from "../api/itsyhome-client";
import { renderIcon } from "../icon-renderer";

const DEFAULT_COLOR = "#ff9500"; // Orange

type SceneSettings = {
  scene: string;
  port: number;
  label?: string;
  color?: string;
};

@action({ UUID: "com.nickustinov.itsyhome.scene" })
export class ExecuteSceneAction extends SingletonAction<SceneSettings> {
  private client = new ItsyhomeClient();

  override async onWillAppear(ev: WillAppearEvent<SceneSettings>): Promise<void> {
    const { scene, port } = ev.payload.settings;

    if (port) {
      this.client = new ItsyhomeClient(undefined, port);
    }

    if (scene) {
      await this.updateSceneIcon(ev.action, scene, ev.payload.settings);
    } else {
      await this.setDefaultIcon(ev.action, ev.payload.settings);
    }
    await ev.action.setTitle(ev.payload.settings.label || scene || "");
  }

  override async onDidReceiveSettings(ev: DidReceiveSettingsEvent<SceneSettings>): Promise<void> {
    const { scene, port } = ev.payload.settings;

    if (port) {
      this.client = new ItsyhomeClient(undefined, port);
    }

    if (scene) {
      await this.updateSceneIcon(ev.action, scene, ev.payload.settings);
    } else {
      await this.setDefaultIcon(ev.action, ev.payload.settings);
    }
    await ev.action.setTitle(ev.payload.settings.label || scene || "");
  }

  private async setDefaultIcon(
    action: { setImage(image: string): Promise<void> },
    settings: SceneSettings,
  ): Promise<void> {
    const color = settings.color || DEFAULT_COLOR;
    const icon = await renderIcon("sparkle", color, true);
    await action.setImage(icon);
  }

  private async updateSceneIcon(
    action: { setImage(image: string): Promise<void> },
    sceneName: string,
    settings: SceneSettings,
  ): Promise<void> {
    try {
      const scenes = await this.client.listScenes();
      const scene = scenes.find((s: SceneInfo) => s.name === sceneName);
      const iconName = scene?.icon ?? "sparkle";
      const color = settings.color || DEFAULT_COLOR;
      const icon = await renderIcon(iconName, color, true);
      await action.setImage(icon);
    } catch {
      // Fallback to default icon if API unavailable
      await this.setDefaultIcon(action, settings);
    }
  }

  override async onKeyDown(ev: KeyDownEvent<SceneSettings>): Promise<void> {
    const { scene } = ev.payload.settings;

    if (!scene) {
      await ev.action.showAlert();
      return;
    }

    try {
      const result = await this.client.executeScene(scene);
      if (result.status === "error") {
        streamDeck.logger.error(`Scene execution failed: ${result.message}`);
        await ev.action.showAlert();
        return;
      }

      await ev.action.showOk();
    } catch (err) {
      streamDeck.logger.error(`Scene execution error: ${err}`);
      await ev.action.showAlert();
    }
  }
}
