"""Validate the actual installed APK's window and accessible control bounds."""
import re
import sys
import xml.etree.ElementTree as ET
from pathlib import Path

stage, result_dir = sys.argv[1:]
directory = Path(result_dir)
nodes = list(ET.parse(directory / f"window-{stage}.xml").iter("node"))
windows = (directory / f"insets-{stage}.txt").read_text()
bad = [node.attrib for node in nodes if
       node.get("resource-id", "").rsplit("/", 1)[-1] in
       ("action_bar", "action_bar_container", "action_bar_title", "title_container") or
       node.get("text", "") == "Hamiya Investment Group – HIG"]
assert not bad, f"Native action bar covers the app: {bad}"
assert any(node.get("class") == "android.webkit.WebView" for node in nodes), "App WebView did not start"

status_sources = [line for line in windows.splitlines()
                  if re.search(r"\b(?:mType|type)\s*=\s*statusBars\b", line)
                  and re.search(r"\b(?:mVisible|visible)\s*=\s*true\b", line)]
assert status_sources, "Android status bar is not reported visible"
bottoms = []
for line in status_sources:
    frame = re.search(r"\b(?:mFrame|frame)=\[\s*\d+,\s*\d+\]\[\s*\d+,\s*(\d+)\]", line)
    if frame:
        bottoms.append(int(frame[1]))
assert bottoms, "Could not measure the Android status-bar frame"
safe_top = max(bottoms)
controls = []
for node in nodes:
    if node.get("package") != "com.hamiyainvestmentgroup.customer":
        continue
    if node.get("class") not in ("android.widget.Button", "android.widget.EditText", "android.widget.Spinner"):
        continue
    bounds = [int(value) for value in re.findall(r"\d+", node.get("bounds", ""))]
    if len(bounds) == 4 and bounds[2] > bounds[0] and bounds[3] > bounds[1]:
        controls.append(bounds)
        assert bounds[1] >= safe_top, f"App control overlaps Android status bar: {node.attrib}"
assert controls, "No accessible app controls were found"
if stage.startswith("keyboard"):
    assert any(re.search(r"\b(?:mType|type)\s*=\s*ime\b", line)
               and re.search(r"\b(?:mVisible|visible)\s*=\s*true\b", line)
               for line in windows.splitlines()), "Keyboard did not open"
print(f"PASS: {stage}; status area={safe_top}px; {len(controls)} controls below system icons")
