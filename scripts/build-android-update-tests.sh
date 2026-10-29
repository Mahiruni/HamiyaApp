#!/usr/bin/env bash
set -euo pipefail
# Only test APKs use the temporary rejection certificate. Production keeps its existing key.
fixture_dir="$RUNNER_TEMP/hamiya-update-tests"
asset_dir="android/app/src/androidTest/assets"
mkdir -p "$fixture_dir" "$asset_dir"
cp android/app/build.gradle "$fixture_dir/build.gradle"
cp android/app/build/outputs/apk/release/app-release.apk "$fixture_dir/production.apk"
restore_release() {
  cp "$fixture_dir/build.gradle" android/app/build.gradle
  cp "$fixture_dir/production.apk" android/app/build/outputs/apk/release/app-release.apk
}
trap restore_release EXIT
node --input-type=module <<'JS'
import { readFileSync, writeFileSync } from 'node:fs';
const path = 'android/app/build.gradle';
writeFileSync(path, readFileSync(path, 'utf8').replace(/\bversionCode\s+(\d+)/, (_, value) => `versionCode ${Number(value) + 1}`));
JS
(cd android && ./gradlew --no-daemon assembleRelease)
cp android/app/build/outputs/apk/release/app-release.apk "$asset_dir/hamiya-valid.apk"
keytool -genkeypair -keystore "$fixture_dir/rejection-only.jks" -storepass changeit -keypass changeit -alias rejection-only -keyalg RSA -validity 1 -dname 'CN=Hamiya Test Only' -noprompt
apksigner_path="$(find "$ANDROID_HOME/build-tools" -name apksigner | sort -V | tail -n 1)"
"$apksigner_path" sign --ks "$fixture_dir/rejection-only.jks" --ks-key-alias rejection-only --ks-pass pass:changeit --out "$asset_dir/hamiya-wrong-signer.apk" "$asset_dir/hamiya-valid.apk"
restore_release
(cd android && ./gradlew --no-daemon assembleReleaseAndroidTest)
test -s android/app/build/outputs/apk/androidTest/release/app-release-androidTest.apk
