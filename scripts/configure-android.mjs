import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { resolve, join } from 'node:path';

// Run after cap add/sync. Replace the generated template's artwork with the approved logo.
const root = resolve(process.argv[2] || 'android');
const res = join(root, 'app/src/main/res');
const logo = resolve('public/brand/hamiya-food-icon-512.png');
const ns = 'xmlns:android="http://schemas.android.com/apk/res/android"';
const write = (path, content) => {
  mkdirSync(resolve(path, '..'), { recursive: true });
  writeFileSync(path, content);
};
mkdirSync(join(res, 'drawable-nodpi'), { recursive: true });
copyFileSync(logo, join(res, 'drawable-nodpi/hamiya_logo.png'));
for (const folder of readdirSync(res).filter((name) => name.startsWith('drawable'))) {
  for (const file of readdirSync(join(res, folder)).filter(
    (name) => name === 'splash.png' || name === 'splash.xml',
  ))
    rmSync(join(res, folder, file));
}
write(
  join(res, 'drawable/splash.xml'),
  `<layer-list ${ns}><item android:drawable="@color/hamiya_surface"/><item android:width="88dp" android:height="88dp" android:gravity="center" android:drawable="@drawable/hamiya_logo"/></layer-list>`,
);
write(
  join(res, 'values/hamiya.xml'),
  '<resources><color name="hamiya_surface">#ffffff</color></resources>',
);
write(
  join(res, 'drawable/hamiya_launcher_foreground.xml'),
  `<inset ${ns} android:inset="16dp"><bitmap android:src="@drawable/hamiya_logo" android:gravity="fill"/></inset>`,
);
for (const name of ['ic_launcher', 'ic_launcher_round']) {
  write(
    join(res, `mipmap-anydpi-v26/${name}.xml`),
    `<adaptive-icon ${ns}><background android:drawable="@color/hamiya_surface"/><foreground android:drawable="@drawable/hamiya_launcher_foreground"/></adaptive-icon>`,
  );
  for (const density of ['mdpi', 'hdpi', 'xhdpi', 'xxhdpi', 'xxxhdpi']) {
    const target = join(res, `mipmap-${density}/${name}.png`);
    mkdirSync(resolve(target, '..'), { recursive: true });
    copyFileSync(logo, target);
  }
}
const stylesPath = join(res, 'values/styles.xml');
let styles = readFileSync(stylesPath, 'utf8');
styles = styles.replace(
  'Theme.AppCompat.DayNight.NoActionBar',
  'Theme.AppCompat.Light.NoActionBar',
);
styles = styles.replace('Theme.AppCompat.Light.DarkActionBar', 'Theme.AppCompat.Light.NoActionBar');
styles = styles.replace(
  /(<style name="AppTheme.NoActionBar"[^>]*>)([\s\S]*?)(<\/style>)/,
  (_, start, body, end) =>
    start +
    body.replace(
      /<item name="android:(?:windowBackground|windowNoTitle|windowActionBar|windowActionBarOverlay)">[\s\S]*?<\/item>/g,
      '',
    ) +
    '<item name="android:windowBackground">@color/hamiya_surface</item><item name="android:windowNoTitle">true</item><item name="android:windowActionBar">false</item><item name="android:windowActionBarOverlay">false</item>' +
    end,
);
styles = styles.replace(
  /<style name="AppTheme.NoActionBarLaunch"[\s\S]*?<\/style>/,
  '<style name="AppTheme.NoActionBarLaunch" parent="Theme.SplashScreen"><item name="android:windowNoTitle">true</item><item name="android:windowActionBar">false</item><item name="android:windowActionBarOverlay">false</item><item name="windowNoTitle">true</item><item name="windowActionBar">false</item><item name="windowSplashScreenBackground">@color/hamiya_surface</item><item name="windowSplashScreenAnimatedIcon">@drawable/hamiya_launcher_foreground</item><item name="postSplashScreenTheme">@style/AppTheme.NoActionBar</item><item name="android:windowLightStatusBar">true</item><item name="android:windowLightNavigationBar">true</item></style>',
);
writeFileSync(stylesPath, styles);
const manifestPath = join(root, 'app/src/main/AndroidManifest.xml');
let manifest = readFileSync(manifestPath, 'utf8');
if (!manifest.includes('android:windowSoftInputMode='))
  manifest = manifest.replace(
    /<activity\b/,
    '<activity android:windowSoftInputMode="adjustResize" ',
  );
if (!manifest.includes('android:enableOnBackInvokedCallback='))
  manifest = manifest.replace(
    /<application\b/,
    '<application android:enableOnBackInvokedCallback="true" ',
  );
manifest = manifest.replace(/\sandroid:allowBackup="[^"]*"/g, '');
manifest = manifest.replace(/\sandroid:usesCleartextTraffic="[^"]*"/g, '');
manifest = manifest.replace(
  /<application\b/,
  '<application android:allowBackup="false" android:usesCleartextTraffic="false"',
);
if (!manifest.includes('android.permission.REQUEST_INSTALL_PACKAGES'))
  manifest = manifest.replace(
    '</manifest>',
    '<uses-permission android:name="android.permission.REQUEST_INSTALL_PACKAGES" /></manifest>',
  );
if (!manifest.includes('${applicationId}.updates'))
  manifest = manifest.replace(
    '</application>',
    '<provider android:name=".HamiyaUpdateFileProvider" android:authorities="${applicationId}.updates" android:exported="false" android:grantUriPermissions="true"><meta-data android:name="android.support.FILE_PROVIDER_PATHS" android:resource="@xml/hamiya_update_paths" /></provider></application>',
  );
write(
  join(res, 'xml/hamiya_update_paths.xml'),
  '<paths xmlns:android="http://schemas.android.com/apk/res/android"><cache-path name="verified_update" path="hamiya-updates/" /></paths>',
);
writeFileSync(manifestPath, manifest);
const findActivity = (path) => {
  for (const entry of readdirSync(path, { withFileTypes: true })) {
    const full = join(path, entry.name);
    if (entry.isDirectory()) {
      const found = findActivity(full);
      if (found) return found;
    } else if (entry.name === 'MainActivity.java') return full;
  }
};
const activityPath = findActivity(join(root, 'app/src/main/java'));
if (!activityPath) throw new Error('Generated MainActivity.java was not found.');
const packageName = readFileSync(activityPath, 'utf8').match(/package\s+([\w.]+);/)?.[1];
if (!packageName) throw new Error('Android activity package not found');
const sampleTest = join(
  root,
  'app/src/androidTest/java/com/getcapacitor/myapp/ExampleInstrumentedTest.java',
);
if (existsSync(sampleTest))
  writeFileSync(
    sampleTest,
    readFileSync(sampleTest, 'utf8').replace('"com.getcapacitor.app"', `"${packageName}"`),
  );
writeFileSync(
  join(resolve(activityPath, '..'), 'HamiyaUpdateFileProvider.java'),
  `package ${packageName};\npublic class HamiyaUpdateFileProvider extends androidx.core.content.FileProvider {}\n`,
);
writeFileSync(
  join(resolve(activityPath, '..'), 'HamiyaAppUpdatePlugin.java'),
  readFileSync('native/HamiyaAppUpdatePlugin.java', 'utf8').replace(
    'package com.hamiyainvestmentgroup.customer;',
    `package ${packageName};`,
  ),
);
write(
  join(
    root,
    'app/src/androidTest/java',
    packageName.replaceAll('.', '/'),
    'HamiyaAppUpdateTest.java',
  ),
  readFileSync('native/HamiyaAppUpdateTest.java', 'utf8').replace(
    'package com.hamiyainvestmentgroup.customer;',
    `package ${packageName};`,
  ),
);
writeFileSync(
  activityPath,
  `package ${packageName};

import android.os.Bundle;
import android.view.Window;
import androidx.activity.EdgeToEdge;
import androidx.activity.OnBackPressedCallback;
import androidx.core.view.ViewCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // SplashScreen's platform theme can otherwise create an android:id/action_bar,
        // independent of AppCompat's action bar. Remove both features before content exists.
        requestWindowFeature(Window.FEATURE_NO_TITLE);
        supportRequestWindowFeature(Window.FEATURE_NO_TITLE);
        // Android 15/16 enforce edge-to-edge. Capacitor SystemBars owns WindowInsets:
        // older WebViews get native padding + zero CSS insets; newer ones get real CSS insets.
        EdgeToEdge.enable(this);
        registerPlugin(HamiyaSystemUiPlugin.class);
        registerPlugin(HamiyaAppUpdatePlugin.class);
        super.onCreate(savedInstanceState);
        // The app supplies floating controls; never add a native title/action bar.
        if (getActionBar() != null) getActionBar().hide();
        if (getSupportActionBar() != null) getSupportActionBar().hide();
        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override public void handleOnBackPressed() {
                android.webkit.WebView webView = getBridge() == null ? null : getBridge().getWebView();
                if (webView != null && webView.canGoBack()) webView.goBack();
                else moveTaskToBack(true);
            }
        });
    }

    @Override
    public void onResume() {
        super.onResume();
        // Refresh display-cutout, gesture navigation and IME insets after returning to the app.
        ViewCompat.requestApplyInsets(getWindow().getDecorView());
        HamiyaSystemUiPlugin.applySurface(this);
    }

    @Override
    public void onConfigurationChanged(android.content.res.Configuration config) {
        super.onConfigurationChanged(config);
        HamiyaSystemUiPlugin.applySurface(this);
    }
}
`,
);
writeFileSync(
  join(resolve(activityPath, '..'), 'HamiyaSystemUiPlugin.java'),
  `package ${packageName};

import android.app.Activity;
import android.graphics.Color;
import android.view.HapticFeedbackConstants;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "HamiyaSystemUi")
public class HamiyaSystemUiPlugin extends Plugin {
    private static boolean darkSurface = false;
    @PluginMethod
    public void setSurface(PluginCall call) {
        darkSurface = call.getBoolean("dark", false);
        getActivity().runOnUiThread(() -> { applySurface(getActivity()); call.resolve(); });
    }
    @PluginMethod
    public void feedback(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            getBridge().getWebView().performHapticFeedback(
                android.os.Build.VERSION.SDK_INT >= 30
                    ? HapticFeedbackConstants.CONFIRM : HapticFeedbackConstants.VIRTUAL_KEY);
            call.resolve();
        });
    }
    public static void applySurface(Activity activity) {
        int color = Color.parseColor(darkSurface ? "#193b4d" : "#f6f8fa");
        activity.getWindow().getDecorView().setBackgroundColor(color);
        WindowInsetsControllerCompat controls = WindowCompat.getInsetsController(activity.getWindow(), activity.getWindow().getDecorView());
        controls.setAppearanceLightStatusBars(!darkSurface);
        controls.setAppearanceLightNavigationBars(!darkSurface);
        controls.show(WindowInsetsCompat.Type.systemBars());
        // Android 15/16 use the insets/decor surface. Earlier Android also needs bar colors.
        if (android.os.Build.VERSION.SDK_INT < 35) {
            activity.getWindow().setStatusBarColor(color);
            activity.getWindow().setNavigationBarColor(color);
        }
    }
}
`,
);
console.log('Hamiya native artwork, system launch theme, keyboard and Back navigation configured.');

const packageInfo = JSON.parse(readFileSync('package.json', 'utf8'));
const versionCode = 10000 + Number(process.env.GITHUB_RUN_NUMBER || 0);
if (!Number.isSafeInteger(versionCode) || versionCode < 10000)
  throw new Error('Invalid Android version code');
const gradlePath = join(root, 'app/build.gradle');
let gradle = readFileSync(gradlePath, 'utf8')
  .replace(/\bversionCode\s+\d+/, `versionCode ${versionCode}`)
  .replace(/\bversionName\s+['"][^'"]+['"]/, `versionName "${packageInfo.version}"`);
if (!gradle.includes('// HAMIYA_UPDATE_TESTS'))
  gradle += `
// HAMIYA_UPDATE_TESTS
android {
    testBuildType "release"
    defaultConfig { testInstrumentationRunner "androidx.test.runner.AndroidJUnitRunner" }
}
dependencies {
    androidTestImplementation 'androidx.test:runner:1.7.0'
    androidTestImplementation 'androidx.test.ext:junit:1.3.0'
}
`;
writeFileSync(gradlePath, gradle);
console.log(`Android version ${packageInfo.version}, build ${versionCode}`);
