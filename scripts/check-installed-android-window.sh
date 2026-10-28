#!/usr/bin/env bash
set -euo pipefail
api_level="$(adb shell getprop ro.build.version.sdk | tr -d '\r')"
result_dir="android-window-results/api-$api_level"
mkdir -p "$result_dir"
apk_path="${1:-Hamiya.apk}"
adb install -r "$apk_path"
adb shell dumpsys package com.hamiyainvestmentgroup.customer | grep -E 'versionCode=|versionName='
adb shell settings put system accelerometer_rotation 0
adb shell settings put secure show_ime_with_hard_keyboard 1
launcher_component="$(adb shell cmd package resolve-activity --brief -a android.intent.action.MAIN -c android.intent.category.HOME | tr -d '\r' | tail -n 1)"
launcher_package="${launcher_component%%/*}"
[[ "$launcher_package" =~ ^[a-zA-Z0-9_.]+$ ]] || { echo 'Could not resolve the emulator home activity'; exit 1; }
wait_for_focus() {
  local package="$1"
  local focus=''
  for attempt in {1..20}; do
    focus="$(adb shell dumpsys window | awk '/mCurrentFocus/ {print}')"
    if [[ "$focus" == *"$package/"* ]]; then
      return 0
    fi
    sleep 0.25
  done
  echo "Expected foreground window for $package; observed: $focus"
  return 1
}
capture_window() {
  local stage="$1"
  # UiAutomation enables WebView accessibility asynchronously. Its first dump can
  # contain only the WebView container even when the rendered form is ready.
  # Wait for actual controls; the final verifier still rejects missing controls.
  for attempt in 1 2 3 4 5 6; do
    adb shell uiautomator dump /sdcard/hamiya-window.xml
    adb pull /sdcard/hamiya-window.xml "$result_dir/window-$stage.xml"
    if python3 - "$result_dir/window-$stage.xml" <<'PY'
import sys
import xml.etree.ElementTree as ET
nodes = ET.parse(sys.argv[1]).iter('node')
ready = any(n.get('class') in ('android.widget.Button', 'android.widget.EditText', 'android.widget.Spinner')
            and n.get('package') == 'com.hamiyainvestmentgroup.customer' for n in nodes)
sys.exit(0 if ready else 1)
PY
    then
      break
    fi
    echo "Waiting for WebView accessibility controls: $stage, attempt $attempt/6"
    sleep 2
  done
  adb exec-out screencap -p > "$result_dir/window-$stage.png"
  adb shell dumpsys activity top > "$result_dir/activity-$stage.txt"
  adb shell dumpsys window > "$result_dir/insets-$stage.txt"
  python3 scripts/verify-android-window.py "$stage" "$result_dir"
}
for mode in no yes; do
  adb shell settings put system user_rotation 0
  adb shell cmd uimode night "$mode"
  adb shell am force-stop com.hamiyainvestmentgroup.customer
  adb shell am start -W -n com.hamiyainvestmentgroup.customer/.MainActivity
  sleep 8
  capture_window "portrait-$mode"
  read -r input_x input_y < <(python3 - "$result_dir/window-portrait-$mode.xml" <<'PY'
import re
import sys
import xml.etree.ElementTree as ET
nodes = ET.parse(sys.argv[1]).iter('node')
field = next(n for n in nodes if n.get('class') == 'android.widget.EditText')
x1, y1, x2, y2 = map(int, re.findall(r'\d+', field.get('bounds', '')))
print((x1 + x2) // 2, (y1 + y2) // 2)
PY
  )
  adb shell input tap "$input_x" "$input_y"
  sleep 2
  capture_window "keyboard-$mode"
  adb shell input keyevent KEYCODE_BACK
  adb shell input keyevent KEYCODE_HOME
  # Home dispatch is asynchronous, especially on Android 16. Relaunching before
  # the launcher owns focus lets its pending transition hide the resumed app.
  wait_for_focus "$launcher_package"
  adb shell am start -W -n com.hamiyainvestmentgroup.customer/.MainActivity
  wait_for_focus com.hamiyainvestmentgroup.customer
  sleep 2
  capture_window "resume-$mode"
  adb shell settings put system user_rotation 1
  sleep 2
  capture_window "landscape-$mode"
done
adb shell settings put system user_rotation 0
