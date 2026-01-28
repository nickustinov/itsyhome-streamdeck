# Itsyhome Stream Deck plugin

[![Tests](https://github.com/nickustinov/itsyhome-streamdeck/actions/workflows/test.yml/badge.svg)](https://github.com/nickustinov/itsyhome-streamdeck/actions/workflows/test.yml)

Stream Deck plugin for [Itsyhome](https://itsyhome.app) — control your HomeKit devices directly from your Elgato Stream Deck.

![Itsyhome Stream Deck plugin](itsyhome-streamdeck.png)

Requires **Itsyhome Pro** with the webhook server enabled (runs on `localhost:8423`).

## Actions

| Action | Description |
|--------|-------------|
| **Switch/Outlet** | Toggle a switch or outlet on/off |
| **Execute scene** | Trigger a HomeKit scene |
| **Light** | Toggle a light on/off. Optional target brightness when turning on. Shows current brightness |
| **Fan** | Toggle a fan on/off. Shows current speed level |
| **Humidifier** | Toggle a humidifier/dehumidifier on/off. Shows current humidity % |
| **Lock** | Lock/unlock a door lock. Green locked icon, orange unlocked icon. 30s optimistic hold |
| **AC** | Toggle thermostat or AC on/off. Mode-aware icon (flame/snowflake/thermometer). Shows temperature |
| **Status** | Display-only — shows current temperature or humidity from sensors |
| **Blinds** | Open or close blinds. Direction-specific arrow icon. Shows current position % |
| **Garage door** | Open/close a garage door. Green car (closed), orange car (open). 30s optimistic hold |
| **Security system** | Arm/disarm a security system. User selects arm mode (Stay/Away/Night). Shows current state |
| **Group** | Turn on/off a device group. Shows partial count (e.g. "3/5") when some devices are on |

## Features

- **Color-coded icons** — device-type-specific colors (gold for lights, blue for fans, teal for humidifiers, green for locks, orange for garage/groups, etc.)
- **Dynamic state display** — brightness %, speed level, humidity %, temperature, position %, security state, partial group counts
- **Mode-aware AC icons** — flame for heating, snowflake for cooling, thermometer for auto
- **Optimistic updates** — instant visual feedback on toggle. Locks and garage doors hold state for 30s while hardware catches up
- **Polling** — state updates every 3 seconds via localhost HTTP (negligible system impact)
- **Custom labels** — optional label field for multi-button setups (shows as `Label\nData`)
- **Custom colors** — configurable on/off colors via color pickers in settings
- **Device type filtering** — each action's property inspector only shows relevant devices

## Requirements

- macOS 14.0+
- Stream Deck software 6.5+
- Itsyhome with Pro subscription and webhook server enabled

## Development

### Setup

```sh
npm install
```

### Build

```sh
npm run build
```

### Watch mode

```sh
npm run watch
```

### Tests

```sh
npm test
```

### Install for development

Symlink the plugin bundle into the Stream Deck plugins directory:

```sh
ln -sf "$(pwd)/com.nickustinov.itsyhome.sdPlugin" \
  ~/Library/Application\ Support/com.elgato.StreamDeck/Plugins/com.nickustinov.itsyhome.sdPlugin
```

Then restart the Stream Deck app to load the plugin.

## Architecture

```
src/
  plugin.ts              — Entry point, registers all actions
  icon-renderer.ts       — Renders Phosphor icons as colored PNGs
  api/
    itsyhome-client.ts   — HTTP client for the Itsyhome webhook API
  actions/
    toggle-device.ts     — Toggle switch/outlet on/off
    execute-scene.ts     — Execute a HomeKit scene
    light.ts             — Light toggle with optional target brightness
    fan.ts               — Fan toggle with speed display
    humidifier.ts        — Humidifier toggle with humidity display
    lock.ts              — Lock/unlock with 30s optimistic hold
    thermostat.ts        — AC/thermostat with mode icons and temperature
    status.ts            — Read-only temperature/humidity display
    blinds.ts            — Open/close blinds with direction icons
    garage-door.ts       — Open/close garage door with 30s optimistic hold
    security-system.ts   — Arm/disarm security system with mode selection
    group.ts             — Group on/off with partial device count

com.nickustinov.itsyhome.sdPlugin/
  manifest.json          — Plugin manifest (actions, icons, SDK version)
  bin/plugin.js          — Built plugin bundle (generated)
  ui/                    — Property Inspector HTML files
  imgs/
    icons/               — Pre-rendered Phosphor icons (generated)
    actions/             — Per-action list icons and default key images
```

### Webhook API

The plugin communicates with Itsyhome's webhook server via HTTP on `localhost:8423`:

| Endpoint | Purpose |
|----------|---------|
| `GET /list/devices` | List all devices with type info |
| `GET /list/scenes` | List all scenes |
| `GET /list/groups` | List all device groups |
| `GET /info/{target}` | Get device state (on, brightness, temperature, mode, etc.) |
| `GET /toggle/{target}` | Toggle a device |
| `GET /on/{target}` | Turn on a device or group |
| `GET /off/{target}` | Turn off a device or group |
| `GET /scene/{target}` | Execute a scene |
| `GET /brightness/{value}/{target}` | Set brightness (0–100) |
| `GET /position/{value}/{target}` | Set position for blinds (0–100) |
| `GET /security/arm/{mode}/{target}` | Arm security system (mode: 0=Stay, 1=Away, 2=Night) |
| `GET /security/disarm/{target}` | Disarm security system |

### Icons

Icons are from [Phosphor Icons](https://phosphoricons.com/) (MIT licensed), rendered as colored PNGs with padding for title visibility:

- **On state**: Device-type-specific color (gold, blue, green, orange, etc.)
- **Off state**: Gray (`#606060`)
- **Canvas**: 80px icon on 144x144 canvas (@2x), offset from top for title room
- **Action list icons**: White monochrome, 20x20 / 40x40

### Build tooling

- **TypeScript** with TC39 decorators (Stream Deck SDK v2 pattern)
- **Rollup** bundles to a single `plugin.js`
- **Vitest** for unit tests

## Icon color reference

| Device type | Color | Icon |
|-------------|-------|------|
| Light, switch, outlet | `#F5C542` | Lightbulb / Power / Plug |
| Fan | `#007AFF` on / `#8E8E93` off | Fan |
| Humidifier | `#30B0C7` on / `#8E8E93` off | Drop |
| Thermostat, temperature sensor | `#FF8A65` | Thermometer |
| Lock | `#66BB6A` locked / `#FFA726` unlocked | Lock / Lock-open |
| Garage door | `#66BB6A` closed / `#FFA726` open | Car |
| Blinds | `#90A4AE` | Arrow up / Arrow down |
| Scene | `#CE93D8` | Sparkle |
| Security system | `#66BB6A` armed / `#8E8E93` disarmed / `#EF5350` alarm | Shield-check |
| Group | `#FF9500` on / `#8E8E93` off | Squares-four |
| AC heat mode | `#FF6D3A` | Flame |
| AC cool mode | `#4FC3F7` | Snowflake |
| AC auto mode | `#AB47BC` | Thermometer |
