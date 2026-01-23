#!/bin/bash
# Generates device-type icon PNGs from Phosphor Icons SVGs.
# Requires: rsvg-convert (librsvg)

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
PHOSPHOR_DIR="$PROJECT_DIR/node_modules/@phosphor-icons/core/assets/fill"
OUTPUT_DIR="$PROJECT_DIR/com.nickustinov.itsyhome.sdPlugin/imgs/device-types"

# Colors
ORANGE="#FFA726"
AMBER="#FFB74D"
YELLOW="#FFCA28"
BLUE="#42A5F5"
PINK="#EC407A"
RED="#EF5350"
TEAL="#26A69A"
GREEN="#66BB6A"
GRAY="#9E9E9E"
PURPLE="#AB47BC"

# Icon definitions: output-name:phosphor-svg:on-color:off-color
# Use "same" for off-color to use same as on-color (for always-on icons)
ICONS=(
  # Toggle icons (off = gray)
  "light:lightbulb:$ORANGE:$GRAY"
  "switch:power:$ORANGE:$GRAY"
  "outlet:plug:$ORANGE:$GRAY"
  "fan:fan:$BLUE:$GRAY"
  "group:squares-four:$ORANGE:$GRAY"
  "lightbulb-filament:lightbulb-filament:$AMBER:$GRAY"
  "lamp:lamp:$YELLOW:$GRAY"
  "lamp-pendant:lamp-pendant:$YELLOW:$GRAY"
  "sun-dim:sun-dim:$YELLOW:$GRAY"
  "television:television:$BLUE:$GRAY"
  "speaker-hifi:speaker-hifi:$PURPLE:$GRAY"
  "house-simple:house-simple:$ORANGE:$GRAY"
  "power:power:$ORANGE:$GRAY"
  "toggle-right:toggle-right:$ORANGE:$GRAY"

  # Lock icons (on/locked = green, off/unlocked = orange)
  "lock:lock:$GREEN:$ORANGE"
  "lock-key:lock-key:$GREEN:$ORANGE"
  "key:key:$GREEN:$ORANGE"
  "shield-check:shield-check:$GREEN:$ORANGE"
  "door:door:$GREEN:$ORANGE"

  # Garage icons (off = green)
  "garage-door:car-simple:$ORANGE:$GREEN"
  "garage:garage:$ORANGE:$GREEN"

  # Scene icons (pink, always on)
  "sparkle:sparkle:$PINK:$PINK"
  "star:star:$PINK:$PINK"
  "moon:moon:$PINK:$PINK"
  "moon-stars:moon-stars:$PINK:$PINK"
  "sun:sun:$PINK:$PINK"
  "sun-horizon:sun-horizon:$PINK:$PINK"
  "couch:couch:$PINK:$PINK"
  "play:play:$PINK:$PINK"
  "magic-wand:magic-wand:$PINK:$PINK"
  "bed:bed:$PINK:$PINK"
  "music-notes:music-notes:$PINK:$PINK"

  # Status icons (various colors, always on)
  "thermometer-simple:thermometer-simple:$RED:$RED"
  "gauge:gauge:$TEAL:$TEAL"
)

# Special cases: lock-off uses lock-open SVG
LOCK_OFF_OVERRIDE="lock-open"

generate_icon() {
  local output_name="$1"
  local phosphor_name="$2"
  local color="$3"
  local state="$4"  # "on" or "off"
  local size="$5"   # 72 or 144
  local scale suffix tx ty

  if [ "$size" -eq 144 ]; then
    scale="0.3125"
    tx="32"
    ty="22"
    suffix="@2x"
  else
    scale="0.15625"
    tx="16"
    ty="11"
    suffix=""
  fi

  local svg_file="$PHOSPHOR_DIR/${phosphor_name}-fill.svg"
  if [ ! -f "$svg_file" ]; then
    echo "ERROR: $svg_file not found"
    return 1
  fi

  # Extract the path data from the SVG
  local path_data
  path_data=$(sed -n 's/.*<path d="\([^"]*\)".*/\1/p' "$svg_file")

  local tmp_svg="/tmp/icon-${output_name}-${state}-${size}.svg"
  cat > "$tmp_svg" << EOF
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <g transform="translate(${tx}, ${ty}) scale(${scale})">
    <path fill="${color}" d="${path_data}"/>
  </g>
</svg>
EOF

  local output_file="$OUTPUT_DIR/${output_name}-${state}${suffix}.png"
  rsvg-convert "$tmp_svg" -o "$output_file"
  rm "$tmp_svg"
}

echo "Generating icons..."
count=0

for entry in "${ICONS[@]}"; do
  IFS=: read -r output_name phosphor_name color_on color_off <<< "$entry"

  # On state
  generate_icon "$output_name" "$phosphor_name" "$color_on" "on" 144
  generate_icon "$output_name" "$phosphor_name" "$color_on" "on" 72

  # Off state (lock uses lock-open SVG)
  off_svg="$phosphor_name"
  if [ "$output_name" = "lock" ] && [ -n "$LOCK_OFF_OVERRIDE" ]; then
    off_svg="$LOCK_OFF_OVERRIDE"
  fi
  generate_icon "$output_name" "$off_svg" "$color_off" "off" 144
  generate_icon "$output_name" "$off_svg" "$color_off" "off" 72

  count=$((count + 1))
  echo "  [$count/${#ICONS[@]}] $output_name"
done

# Special: drop icon (blue, same for on/off)
echo "  [drop] blue"
drop_path=$(sed -n 's/.*<path d="\([^"]*\)".*/\1/p' "$PHOSPHOR_DIR/drop-fill.svg")
for size_info in "144:0.3125:32:22:@2x" "72:0.15625:16:11:"; do
  IFS=: read -r size scale tx ty suffix <<< "$size_info"
  tmp="/tmp/icon-drop.svg"
  cat > "$tmp" << EOF
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <g transform="translate(${tx}, ${ty}) scale(${scale})">
    <path fill="${BLUE}" d="${drop_path}"/>
  </g>
</svg>
EOF
  rsvg-convert "$tmp" -o "$OUTPUT_DIR/drop-on${suffix}.png"
  rsvg-convert "$tmp" -o "$OUTPUT_DIR/drop-off${suffix}.png"
  rm "$tmp"
done

echo "Done! Generated $((count * 4 + 4)) icon files."
