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
 */
async function populateTargetSelect(selectElement, port, currentValue, options) {
  const types = options && options.types;
  const showGroups = !options || options.showGroups !== false;

  selectElement.innerHTML = '<option value="">Loading...</option>';

  try {
    const fetches = [fetchDevices(port)];
    if (showGroups) fetches.push(fetchGroups(port));
    const [devices, groups] = await Promise.all(fetches);

    selectElement.innerHTML = '<option value="">Select a device...</option>';

    if (showGroups && groups && groups.length > 0) {
      const groupOptgroup = document.createElement("optgroup");
      groupOptgroup.label = "Groups";
      for (const group of groups) {
        const option = document.createElement("option");
        option.value = `group.${group.name}`;
        option.textContent = `${group.icon} ${group.name} (${group.devices} devices)`;
        if (currentValue === option.value) option.selected = true;
        groupOptgroup.appendChild(option);
      }
      selectElement.appendChild(groupOptgroup);
    }

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

function showConnectionError() {
  const notice = document.getElementById("connection-error");
  if (notice) notice.style.display = "block";
}

function hideConnectionError() {
  const notice = document.getElementById("connection-error");
  if (notice) notice.style.display = "none";
}
