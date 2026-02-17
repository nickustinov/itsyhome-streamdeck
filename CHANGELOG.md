# Changelog

## 1.1.0

Home Assistant compatibility and bug fixes.

- Fix switch/outlet default icon (was lightbulb, now plug)
- Fix garage door icon fill direction (filled when closed, outline when open)
- Add HomeKit-only note to security system action
- Update README with HA compatibility notes

## 1.0.0

Initial release.

- Switch/Outlet, Scene, Light, Fan, Humidifier, Lock, AC, Status, Blinds, Garage door, Security system, Group actions
- Color-coded icons per device type
- Dynamic state display (brightness, speed, humidity, temperature, position, security state, partial group counts)
- Mode-aware AC icons (heat/cool/auto)
- Optimistic updates with 30s hold for locks and garage doors
- Polling every 3s via localhost HTTP
- Custom labels and colors
- Device type filtering in property inspectors
