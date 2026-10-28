#!/usr/bin/env bash
set -euo pipefail
mkdir -p android-window-results
adb install -r Hamiya.apk
adb shell dumpsys package com.hamiyainvestmentgroup.customer | grep -E 'versionCode=|versionName='
for mode in no yes; do
  adb shell cmd uimode night "$mode"
  adb shell am force-stop com.hamiyainvestmentgroup.customer
  adb shell am start -W -n com.hamiyainvestmentgroup.customer/.MainActivity
  sleep 8
  adb shell uiautomator dump /sdcard/hamiya-window.xml
  adb pull /sdcard/hamiya-window.xml "android-window-results/window-$mode.xml"
  adb exec-out screencap -p > "android-window-results/window-$mode.png"
  adb shell dumpsys activity top > "android-window-results/activity-$mode.txt"
  python3 - "$mode" <<'PY'
import sys
import xml.etree.ElementTree as ET
from pathlib import Path
root=ET.parse(Path('android-window-results') / ('window-'+sys.argv[1]+'.xml'))
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
