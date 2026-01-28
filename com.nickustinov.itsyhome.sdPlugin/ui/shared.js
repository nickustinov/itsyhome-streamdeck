/**
 * Shared utilities for Itsyhome Property Inspector pages.
 * Communicates with the Itsyhome webhook server to populate device/scene lists.
 */

const DEFAULT_PORT = 8423;

function getBaseUrl(port) {
  return `http://127.0.0.1:${port || DEFAULT_PORT}`;
}

async function fetchDevices(port) {
  const response = await fetch(`${getBaseUrl(port)}/list/devices`);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

async function fetchScenes(port) {
  const response = await fetch(`${getBaseUrl(port)}/list/scenes`);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

async function fetchGroups(port) {
  const response = await fetch(`${getBaseUrl(port)}/list/groups`);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

/**
 * Populate a <select> element with devices and groups from the webhook API.
 * Options use "Room/Device" format for devices, "group.Name" for groups.
 * @param {object} options
 * @param {string[]} [options.types] - Only show devices of these types (e.g. ["light"])
 * @param {boolean} [options.showGroups] - Whether to show groups (default: true)
 * @param {boolean} [options.groupsOnly] - Only show groups, hide devices (default: false)
 */
async function populateTargetSelect(selectElement, port, currentValue, options) {
  const types = options && options.types;
  const showGroups = !options || options.showGroups !== false;
  const groupsOnly = options && options.groupsOnly === true;

  selectElement.innerHTML = '<option value="">Loading...</option>';

  try {
    const fetches = groupsOnly ? [Promise.resolve([]), fetchGroups(port)] : [fetchDevices(port)];
    if (showGroups && !groupsOnly) fetches.push(fetchGroups(port));
    const [devices, groups] = await Promise.all(fetches);
    cachedDevices = devices || [];
    cachedGroups = groups || [];

    selectElement.innerHTML = groupsOnly ? '<option value="">Select a group...</option>' : '<option value="">Select a device...</option>';

    if ((showGroups || groupsOnly) && groups && groups.length > 0) {
      const groupOptgroup = document.createElement("optgroup");
      groupOptgroup.label = "Groups";
      for (const group of groups) {
        const option = document.createElement("option");
        // Room-scoped groups use "Room/group.Name" format, global groups use "group.Name"
        option.value = group.room ? `${group.room}/group.${group.name}` : `group.${group.name}`;
        const roomLabel = group.room ? ` (${group.room})` : " (global)";
        option.textContent = `${group.icon} ${group.name}${roomLabel} — ${group.devices} devices`;
        if (currentValue === option.value) option.selected = true;
        groupOptgroup.appendChild(option);
      }
      selectElement.appendChild(groupOptgroup);
    }

    // Skip devices if groupsOnly mode
    if (!groupsOnly) {
      // Filter by type if specified
      const filtered = types ? devices.filter(d => types.includes(d.type)) : devices;

      // Group devices by room
      const byRoom = {};
      for (const device of filtered) {
        const room = device.room || "No room";
        if (!byRoom[room]) byRoom[room] = [];
        byRoom[room].push(device);
      }

      for (const [room, roomDevices] of Object.entries(byRoom)) {
        const optgroup = document.createElement("optgroup");
        optgroup.label = room;
        for (const device of roomDevices) {
          const option = document.createElement("option");
          option.value = device.room ? `${device.room}/${device.name}` : device.name;
          option.textContent = `${device.name} (${device.type})`;
          if (currentValue === option.value) option.selected = true;
          optgroup.appendChild(option);
        }
        selectElement.appendChild(optgroup);
      }
    }
  } catch (err) {
    selectElement.innerHTML = '<option value="">Error: Is Itsyhome running?</option>';
    showConnectionError();
  }
}

/**
 * Populate a <select> element with scenes from the webhook API.
 */
async function populateSceneSelect(selectElement, port, currentValue) {
  selectElement.innerHTML = '<option value="">Loading...</option>';

  try {
    const scenes = await fetchScenes(port);

    selectElement.innerHTML = '<option value="">Select a scene...</option>';

    for (const scene of scenes) {
      const option = document.createElement("option");
      option.value = scene.name;
      option.textContent = scene.name;
      if (currentValue === option.value) option.selected = true;
      selectElement.appendChild(option);
    }
  } catch (err) {
    selectElement.innerHTML = '<option value="">Error: Is Itsyhome running?</option>';
    showConnectionError();
  }
}

// Device and group cache for lookups
let cachedDevices = [];
let cachedGroups = [];

function showConnectionError() {
  const notice = document.getElementById("connection-error");
  if (notice) notice.style.display = "block";
}

function hideConnectionError() {
  const notice = document.getElementById("connection-error");
  if (notice) notice.style.display = "none";
}

/**
 * Color picker component for icon colors.
 * Creates a row of preset color swatches with an optional custom color input.
 */
const COLOR_PRESETS = [
  { name: "Gray", value: "#8e8e93" },
  { name: "White", value: "#ffffff" },
  { name: "Orange", value: "#ff9500" },
  { name: "Yellow", value: "#ffcc00" },
  { name: "Lime", value: "#32d74b" },
  { name: "Teal", value: "#30b0c7" },
  { name: "Blue", value: "#007aff" },
  { name: "Indigo", value: "#5856d6" },
  { name: "Purple", value: "#af52de" },
  { name: "Pink", value: "#ff2d55" },
  { name: "Red", value: "#ff3b30" },
  { name: "Brown", value: "#a2845e" },
];

/**
 * Initialize a color picker component.
 * @param {string} containerId - ID of the container element
 * @param {string} settingKey - Settings key to save the color to (e.g. "onColor")
 * @param {string} defaultColor - Default color if none set
 * @param {function} onSave - Callback to save settings
 * @param {function} getSettings - Callback to get current settings
 */
function initColorPicker(containerId, settingKey, defaultColor, onSave, getSettings) {
  const container = document.getElementById(containerId);
  if (!container) return;

  // Create swatches
  const swatchesDiv = document.createElement("div");
  swatchesDiv.className = "color-swatches";

  for (const preset of COLOR_PRESETS) {
    const swatch = document.createElement("button");
    swatch.className = "color-swatch";
    swatch.style.backgroundColor = preset.value;
    swatch.title = preset.name;
    swatch.dataset.color = preset.value;
    swatch.addEventListener("click", () => selectColor(preset.value));
    swatchesDiv.appendChild(swatch);
  }

  container.appendChild(swatchesDiv);

  function selectColor(color) {
    // Update UI
    swatchesDiv.querySelectorAll(".color-swatch").forEach(s => {
      s.classList.toggle("selected", s.dataset.color.toLowerCase() === color.toLowerCase());
    });

    // Save
    onSave({ [settingKey]: color });
  }

  // Set initial value
  function setInitialValue() {
    const settings = getSettings();
    const color = settings[settingKey] || defaultColor;
    swatchesDiv.querySelectorAll(".color-swatch").forEach(s => {
      s.classList.toggle("selected", s.dataset.color.toLowerCase() === color.toLowerCase());
    });
  }

  // Return function to update when settings load
  return { setInitialValue };
}
