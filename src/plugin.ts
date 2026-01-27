import streamDeck from "@elgato/streamdeck";

import { ToggleDeviceAction } from "./actions/toggle-device";
import { ExecuteSceneAction } from "./actions/execute-scene";
import { LightAction } from "./actions/light";
import { LockAction } from "./actions/lock";
import { ThermostatAction } from "./actions/thermostat";
import { StatusAction } from "./actions/status";
import { BlindsAction } from "./actions/blinds";
import { GarageDoorAction } from "./actions/garage-door";

streamDeck.actions.registerAction(new ToggleDeviceAction());
streamDeck.actions.registerAction(new ExecuteSceneAction());
streamDeck.actions.registerAction(new LightAction());
streamDeck.actions.registerAction(new LockAction());
streamDeck.actions.registerAction(new ThermostatAction());
streamDeck.actions.registerAction(new StatusAction());
streamDeck.actions.registerAction(new BlindsAction());
streamDeck.actions.registerAction(new GarageDoorAction());

streamDeck.connect();
