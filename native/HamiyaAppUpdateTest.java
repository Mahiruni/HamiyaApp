package com.hamiyainvestmentgroup.customer;

import static org.junit.Assert.*;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageInfo;
import android.os.SystemClock;
import android.view.KeyEvent;
import android.view.accessibility.AccessibilityNodeInfo;
import androidx.core.content.FileProvider;
import androidx.test.core.app.ActivityScenario;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import org.junit.After;
import org.junit.Before;
import org.junit.Test;
import org.junit.runner.RunWith;

@RunWith(AndroidJUnit4.class)
public class HamiyaAppUpdateTest {
    private ActivityScenario<MainActivity> scenario;
    private HamiyaAppUpdatePlugin updater;
    private Context context;
    private File valid, wrongSigner;
    private HamiyaAppUpdatePlugin.Release release;

    @Before public void prepare() throws Exception {
        context = InstrumentationRegistry.getInstrumentation().getTargetContext();
        scenario = ActivityScenario.launch(MainActivity.class);
        scenario.onActivity(activity -> updater = (HamiyaAppUpdatePlugin) activity.getBridge().getPlugin("HamiyaAppUpdate").getInstance());
        valid = asset("hamiya-valid.apk");
        wrongSigner = asset("hamiya-wrong-signer.apk");
        PackageInfo info = context.getPackageManager().getPackageArchiveInfo(valid.getPath(), 0);
        assertNotNull(info);
        release = new HamiyaAppUpdatePlugin.Release();
        release.code = info.getLongVersionCode();
        release.version = info.versionName;
    }

    private File asset(String name) throws Exception {
        File directory = new File(context.getCacheDir(), "hamiya-updates");
        directory.mkdirs();
        File file = new File(directory, name);
        try (InputStream input = InstrumentationRegistry.getInstrumentation().getContext().getAssets().open(name);
             FileOutputStream output = new FileOutputStream(file)) {
            byte[] bytes = new byte[64 * 1024]; int count;
            while ((count = input.read(bytes)) != -1) output.write(bytes, 0, count);
        }
        return file;
    }

    @After public void cleanup() {
        if (scenario != null) scenario.close();
        if (valid != null) valid.delete();
        if (wrongSigner != null) wrongSigner.delete();
    }

    @Test public void acceptsNewVersionWithTheExistingProductionSigner() throws Exception {
        updater.verifyPackage(valid, release);
        long expected = release.code;
        release.code++;
        assertThrows(Exception.class, () -> updater.verifyPackage(valid, release));
        release.code = expected;
        release.version = "0.0.0";
        assertThrows(Exception.class, () -> updater.verifyPackage(valid, release));
    }

    @Test public void rejectsOtherSignersPackagesAndDowngrades() throws Exception {
        assertThrows(Exception.class, () -> updater.verifyPackage(wrongSigner, release));
        File testPackage = new File(InstrumentationRegistry.getInstrumentation().getContext().getApplicationInfo().sourceDir);
        assertThrows(Exception.class, () -> updater.verifyPackage(testPackage, release));
        PackageInfo current = context.getPackageManager().getPackageInfo(context.getPackageName(), 0);
        release.code = current.getLongVersionCode(); release.version = current.versionName;
        assertThrows(Exception.class, () -> updater.verifyPackage(new File(context.getApplicationInfo().sourceDir), release));
    }

    @Test public void rejectsUntrustedUpdateAddressesBeforeMakingRequests() {
        for (String url : new String[]{"http://github.com/Mahiruni/HamiyaApp/releases/download/android-build-1/Hamiya.apk", "https://evil.test/Hamiya.apk", "https://github.com/another/repo/Hamiya.apk", "https://user:secret@github.com/Mahiruni/HamiyaApp/releases/download/android-build-1/Hamiya.apk", "https://github.com:8443/Mahiruni/HamiyaApp/releases/download/android-build-1/Hamiya.apk"})
            assertThrows(Exception.class, () -> updater.open(url, true));
    }

    @Test public void installerUsesAPrivateContentUriAndDoesNotOpenABrowser() throws Exception {
        updater.verifyPackage(valid, release);
        Intent intent = updater.installationIntent(valid);
        assertEquals(Intent.ACTION_INSTALL_PACKAGE, intent.getAction());
        assertEquals("content", intent.getData().getScheme());
        assertEquals(context.getPackageName() + ".updates", intent.getData().getAuthority());
        assertEquals("application/vnd.android.package-archive", intent.getType());
        assertTrue((intent.getFlags() & Intent.FLAG_GRANT_READ_URI_PERMISSION) != 0);
        File outside = new File(context.getCacheDir(), "private-document.pdf");
        assertThrows(IllegalArgumentException.class, () -> FileProvider.getUriForFile(context, context.getPackageName() + ".updates", outside));
        scenario.onActivity(activity -> activity.startActivity(intent));
        String foreground = "";
        long deadline = SystemClock.elapsedRealtime() + 15_000;
        while (SystemClock.elapsedRealtime() < deadline) {
            AccessibilityNodeInfo root = InstrumentationRegistry.getInstrumentation().getUiAutomation().getRootInActiveWindow();
            if (root != null && root.getPackageName() != null) foreground = root.getPackageName().toString();
            if (foreground.contains("packageinstaller")) break;
            SystemClock.sleep(250);
        }
        try { assertTrue("Expected Android installer, observed " + foreground, foreground.contains("packageinstaller")); }
        finally { InstrumentationRegistry.getInstrumentation().sendKeyDownUpSync(KeyEvent.KEYCODE_BACK); }
    }
}
