#!/usr/bin/env bash
set -euo pipefail
api_level="$(adb shell getprop ro.build.version.sdk | tr -d '\r')"
result_dir="android-window-results/api-$api_level"
mkdir -p "$result_dir"
apk_path="${1:-Hamiya.apk}"
adb install -r "$apk_path"
adb shell dumpsys package com.hamiyainvestmentgroup.customer | grep -E 'versionCode=|versionName='
for mode in no yes; do
  adb shell cmd uimode night "$mode"
  adb shell am force-stop com.hamiyainvestmentgroup.customer
  adb shell am start -W -n com.hamiyainvestmentgroup.customer/.MainActivity
  sleep 8
  adb shell uiautomator dump /sdcard/hamiya-window.xml
  adb pull /sdcard/hamiya-window.xml "$result_dir/window-$mode.xml"
  adb exec-out screencap -p > "$result_dir/window-$mode.png"
  adb shell dumpsys activity top > "$result_dir/activity-$mode.txt"
  python3 - "$mode" "$result_dir" <<'PY'
import sys
import xml.etree.ElementTree as ET
from pathlib import Path
root=ET.parse(Path(sys.argv[2]) / ('window-'+sys.argv[1]+'.xml'))
nodes=list(root.iter('node'))
labels=[n.get('text','') for n in nodes if n.get('text')]
print('Native Android visible labels:',labels)
bad=[n.attrib for n in nodes if
     n.get('resource-id','').rsplit('/',1)[-1] in ['action_bar','action_bar_container','action_bar_title','title_container'] or
     n.get('text','') == 'Hamiya Investment Group – HIG']
assert not bad, 'Native title/action bar still visible: '+str(bad)
assert any(n.get('class')=='android.webkit.WebView' for n in nodes), 'App WebView did not start'
print('PASS: installed app has no native title/action bar; mode='+sys.argv[1])
PY
done
