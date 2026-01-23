/**
 * Property Inspector utilities for Stream Deck SDK v2.
 * Handles WebSocket connection and settings management.
 */

let websocket = null;
let pluginUUID = null;
let actionInfo = null;
let currentSettings = {};

function connectElgatoStreamDeckSocket(inPort, inPropertyInspectorUUID, inRegisterEvent, inInfo, inActionInfo) {
  pluginUUID = inPropertyInspectorUUID;
  actionInfo = JSON.parse(inActionInfo);
  currentSettings = actionInfo.payload.settings || {};

  websocket = new WebSocket(`ws://127.0.0.1:${inPort}`);

  websocket.onopen = () => {
    websocket.send(JSON.stringify({
      event: inRegisterEvent,
      uuid: inPropertyInspectorUUID,
    }));

    if (typeof onSettingsLoaded === "function") {
      onSettingsLoaded(currentSettings);
    }
  };

  websocket.onmessage = (event) => {
    const data = JSON.parse(event.data);
    if (data.event === "didReceiveSettings") {
      currentSettings = data.payload.settings || {};
      if (typeof onSettingsLoaded === "function") {
        onSettingsLoaded(currentSettings);
      }
    }
  };
}

function saveSettings(settings) {
  currentSettings = { ...currentSettings, ...settings };

  if (websocket && websocket.readyState === WebSocket.OPEN) {
    websocket.send(JSON.stringify({
      event: "setSettings",
      context: pluginUUID,
      payload: currentSettings,
    }));
  }
}

function getSettings() {
  return currentSettings;
}
