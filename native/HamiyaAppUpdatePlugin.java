package com.hamiyainvestmentgroup.customer;

import android.app.Activity;
import android.content.Intent;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.content.pm.Signature;
import android.net.Uri;
import android.os.Build;
import android.os.SystemClock;
import android.provider.Settings;
import androidx.activity.result.ActivityResult;
import androidx.core.content.FileProvider;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.net.URL;
import java.security.MessageDigest;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicBoolean;
import javax.net.ssl.HttpsURLConnection;
import org.json.JSONArray;
import org.json.JSONObject;

/** Downloads are private to HAMIYA. Only Android's installation approval leaves the app UI. */
@CapacitorPlugin(name = "HamiyaAppUpdate")
public class HamiyaAppUpdatePlugin extends Plugin {
    private static final String APP_ID = "com.hamiyainvestmentgroup.customer";
    private static final String REPOSITORY = "https://github.com/Mahiruni/HamiyaApp";
    private static final String LATEST = "https://api.github.com/repos/Mahiruni/HamiyaApp/releases/latest";
    private static final long MAX_BYTES = 50_000_000L;
    private final ExecutorService worker = Executors.newSingleThreadExecutor();
    private final AtomicBoolean installing = new AtomicBoolean(false);
    private final AtomicBoolean checking = new AtomicBoolean(false);
    private final AtomicBoolean cancelled = new AtomicBoolean(false);
    private File verifiedFile;

    static final class Release {
        String tag, url, checksum, version = "", publishedAt;
        long bytes, code;
    }

    @PluginMethod
    public void check(PluginCall call) {
        if (installing.get() || !checking.compareAndSet(false, true)) { call.reject("An update is already in progress", "UPDATE_BUSY"); return; }
        worker.execute(() -> {
            try {
                PackageInfo current = installed();
                Release release = latest();
                JSObject result = new JSObject();
                result.put("installedVersion", current.versionName);
                result.put("installedVersionCode", code(current));
                result.put("latestVersion", release.version);
                result.put("latestVersionCode", release.code);
                result.put("available", release.code > code(current));
                result.put("bytes", release.bytes);
                result.put("releasedAt", release.publishedAt);
                call.resolve(result);
            } catch (Exception error) {
                // Do not expose signed redirect URLs, downloaded content or account details.
                call.reject("Could not check for updates. Please try again.", "UPDATE_CHECK_FAILED");
            } finally { checking.set(false); }
        });
    }

    @PluginMethod
    public void install(PluginCall call) {
        if (!installing.compareAndSet(false, true)) {
            call.reject("An update is already in progress", "UPDATE_BUSY"); return;
        }
        cancelled.set(false);
        worker.execute(() -> {
            File partial = null;
            try {
                // The frontend cannot supply an arbitrary package, URL, checksum or version.
                Release release = latest();
                if (release.code <= code(installed())) throw new Exception("already_current");
                File directory = new File(getContext().getCacheDir(), "hamiya-updates");
                if (!directory.isDirectory() && !directory.mkdirs()) throw new Exception("storage");
                partial = new File(directory, "Hamiya.pending.apk");
                download(release, partial);
                progress(release.bytes, release.bytes, "verifying");
                verifyPackage(partial, release);
                File target = new File(directory, "Hamiya.apk");
                if (target.exists() && !target.delete()) throw new Exception("storage");
                if (!partial.renameTo(target)) throw new Exception("storage");
                verifiedFile = target;
                getActivity().runOnUiThread(() -> requestInstallation(call));
            } catch (Exception error) {
                if (partial != null) partial.delete();
                installing.set(false);
                call.reject(cancelled.get() ? "Update cancelled" : "The update could not be verified or installed. Please try again.",
                    cancelled.get() ? "UPDATE_CANCELLED" : "UPDATE_INSTALL_FAILED");
            }
        });
    }

    @PluginMethod
    public void cancel(PluginCall call) {
        cancelled.set(true);
        call.resolve();
    }

    private Release latest() throws Exception {
        JSONObject source = json(LATEST, 1_000_000);
        String tag = source.getString("tag_name");
        if (source.optBoolean("draft") || source.optBoolean("prerelease") || !tag.matches("android-build-[0-9]+"))
            throw new Exception("release");
        JSONArray assets = source.getJSONArray("assets");
        JSONObject apk = null, metadata = null;
        for (int i = 0; i < assets.length(); i++) {
            JSONObject asset = assets.getJSONObject(i);
            if ("Hamiya.apk".equals(asset.optString("name"))) apk = asset;
            if ("android-release.json".equals(asset.optString("name"))) metadata = asset;
        }
        if (apk == null || !"uploaded".equals(apk.optString("state"))) throw new Exception("release");
        Release release = new Release();
        release.tag = tag;
        release.url = REPOSITORY + "/releases/download/" + tag + "/Hamiya.apk";
        release.bytes = apk.getLong("size");
        String digest = apk.optString("digest");
        if (!release.url.equals(apk.optString("browser_download_url")) || release.bytes < 4 || release.bytes > MAX_BYTES || !digest.matches("sha256:[a-f0-9]{64}"))
            throw new Exception("release");
        release.checksum = digest.substring(7);
        release.publishedAt = source.getString("published_at");
        // Compatibility with the already-published releases; new releases carry explicit metadata.
        release.code = 10000L + Long.parseLong(tag.substring("android-build-".length()));
        if (metadata != null) {
            String expected = REPOSITORY + "/releases/download/" + tag + "/android-release.json";
            if (!expected.equals(metadata.optString("browser_download_url")) || metadata.getLong("size") > 16_384)
                throw new Exception("metadata");
            JSONObject value = json(expected, 16_384);
            if (value.getInt("schema") != 1 || !APP_ID.equals(value.getString("appId")) ||
                !tag.equals(value.getString("tag")) || !release.url.equals(value.getString("url")) ||
                !release.checksum.equals(value.getString("checksum")) || release.bytes != value.getLong("bytes") ||
                !value.getString("commit").matches("[a-f0-9]{40}") ||
                !value.getString("version").matches("[0-9]+\\.[0-9]+\\.[0-9]+")) throw new Exception("metadata");
            release.code = value.getLong("versionCode");
            release.version = value.getString("version");
        }
        if (release.code < 1 || release.code > 2_100_000_000L) throw new Exception("version");
        return release;
    }

    HttpsURLConnection open(String address, boolean releaseAsset) throws Exception {
        URL url = new URL(address);
        for (int redirects = 0; redirects < 4; redirects++) {
            boolean api = LATEST.equals(url.toString());
            boolean repository = url.getHost().equals("github.com") &&
                url.getPath().matches("/Mahiruni/HamiyaApp/releases/download/android-build-[0-9]+/(Hamiya\\.apk|android-release\\.json)") && url.getQuery() == null;
            boolean asset = url.getHost().equals("release-assets.githubusercontent.com") || url.getHost().equals("objects.githubusercontent.com");
            if (!"https".equals(url.getProtocol()) || url.getUserInfo() != null || url.getPort() != -1 ||
                url.getRef() != null || !(releaseAsset ? repository || asset : api)) throw new Exception("untrusted_url");
            HttpsURLConnection connection = (HttpsURLConnection) url.openConnection();
            connection.setInstanceFollowRedirects(false);
            connection.setConnectTimeout(15_000);
            connection.setReadTimeout(30_000);
            connection.setRequestProperty("User-Agent", "Hamiya-Android-Updater");
            connection.setRequestProperty("Accept", api ? "application/vnd.github+json" : "application/octet-stream");
            int status = connection.getResponseCode();
            if (status == 200) return connection;
            String location = connection.getHeaderField("Location");
            connection.disconnect();
            if (!releaseAsset || location == null || !(status == 301 || status == 302 || status == 303 || status == 307 || status == 308))
                throw new Exception("network");
            url = new URL(url, location);
        }
        throw new Exception("redirect_limit");
    }

    private JSONObject json(String address, int limit) throws Exception {
        HttpsURLConnection connection = open(address, !LATEST.equals(address));
        try (InputStream input = connection.getInputStream(); ByteArrayOutputStream output = new ByteArrayOutputStream()) {
            if (connection.getContentLengthLong() > limit) throw new Exception("metadata_size");
            byte[] buffer = new byte[8192];
            int size;
            while ((size = input.read(buffer)) != -1) {
                if (output.size() + size > limit) throw new Exception("metadata_size");
                output.write(buffer, 0, size);
            }
            return new JSONObject(output.toString("UTF-8"));
        } finally { connection.disconnect(); }
    }

    private void download(Release release, File target) throws Exception {
        HttpsURLConnection connection = open(release.url, true);
        try (InputStream input = connection.getInputStream(); FileOutputStream output = new FileOutputStream(target)) {
            long length = connection.getContentLengthLong();
            if (length != -1 && length != release.bytes) throw new Exception("length");
            long bytes = 0, deadline = SystemClock.elapsedRealtime() + 180_000;
            int previous = -1, count;
            byte[] buffer = new byte[64 * 1024];
            MessageDigest checksum = MessageDigest.getInstance("SHA-256");
            while ((count = input.read(buffer)) != -1) {
                if (cancelled.get() || Thread.currentThread().isInterrupted() || SystemClock.elapsedRealtime() > deadline)
                    throw new Exception("cancelled_or_timeout");
                bytes += count;
                if (bytes > release.bytes || bytes > MAX_BYTES) throw new Exception("length");
                checksum.update(buffer, 0, count);
                output.write(buffer, 0, count);
                int percent = (int) (100 * bytes / release.bytes);
                if (percent != previous) { progress(bytes, release.bytes, "downloading"); previous = percent; }
            }
            output.getFD().sync();
            if (bytes != release.bytes || !hex(checksum.digest()).equals(release.checksum)) throw new Exception("checksum");
        } finally { connection.disconnect(); }
    }

    void verifyPackage(File file, Release release) throws Exception {
        PackageManager manager = getContext().getPackageManager();
        int flags = Build.VERSION.SDK_INT >= 28 ? PackageManager.GET_SIGNING_CERTIFICATES : PackageManager.GET_SIGNATURES;
        PackageInfo archive = manager.getPackageArchiveInfo(file.getPath(), flags);
        PackageInfo current = manager.getPackageInfo(APP_ID, flags);
        if (archive == null || !APP_ID.equals(archive.packageName) || code(archive) != release.code ||
            code(archive) <= code(current) || (!release.version.isEmpty() && !release.version.equals(archive.versionName)))
            throw new Exception("package_or_version");
        Signature[] expected = signatures(current), actual = signatures(archive);
        if (expected == null || actual == null || expected.length == 0 || expected.length != actual.length)
            throw new Exception("signer");
        for (Signature signature : actual) {
            boolean matches = false;
            for (Signature trusted : expected) matches |= MessageDigest.isEqual(signature.toByteArray(), trusted.toByteArray());
            if (!matches) throw new Exception("signer");
        }
    }

    private Signature[] signatures(PackageInfo info) {
        return Build.VERSION.SDK_INT >= 28
            ? (info.signingInfo == null ? null : info.signingInfo.getApkContentsSigners()) : info.signatures;
    }

    private PackageInfo installed() throws Exception {
        return getContext().getPackageManager().getPackageInfo(APP_ID, 0);
    }

    private long code(PackageInfo info) {
        return Build.VERSION.SDK_INT >= 28 ? info.getLongVersionCode() : info.versionCode;
    }

    private static String hex(byte[] bytes) {
        StringBuilder value = new StringBuilder();
        for (byte item : bytes) value.append(String.format(java.util.Locale.ROOT, "%02x", item & 255));
        return value.toString();
    }

    private void progress(long bytes, long total, String phase) {
        JSObject event = new JSObject();
        event.put("bytes", bytes); event.put("total", total);
        event.put("percent", (int) (100 * bytes / total)); event.put("phase", phase);
        notifyListeners("progress", event);
    }

    private void requestInstallation(PluginCall call) {
        try {
            if (cancelled.get()) throw new Exception("cancelled");
            if (Build.VERSION.SDK_INT >= 26 && !getContext().getPackageManager().canRequestPackageInstalls()) {
                progress(1, 1, "permission");
                Intent permission = new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:" + APP_ID));
                startActivityForResult(call, permission, "installPermissionResult");
            } else launchInstaller(call);
        } catch (Exception error) {
            installing.set(false);
            call.reject("Android installation permission is required", "INSTALL_PERMISSION_REQUIRED");
        }
    }

    @ActivityCallback
    private void installPermissionResult(PluginCall call, ActivityResult result) {
        if (call == null) { installing.set(false); return; }
        if (Build.VERSION.SDK_INT >= 26 && !getContext().getPackageManager().canRequestPackageInstalls()) {
            installing.set(false);
            call.reject("Android installation permission was not granted", "INSTALL_PERMISSION_REQUIRED");
            return;
        }
        try { launchInstaller(call); }
        catch (Exception error) { installing.set(false); call.reject("Android could not open the installer", "INSTALL_FAILED"); }
    }

    Intent installationIntent(File file) {
        Uri uri = FileProvider.getUriForFile(getContext(), APP_ID + ".updates", file);
        Intent intent = new Intent(Intent.ACTION_INSTALL_PACKAGE);
        intent.setDataAndType(uri, "application/vnd.android.package-archive");
        intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
        intent.putExtra(Intent.EXTRA_RETURN_RESULT, true);
        return intent;
    }

    private void launchInstaller(PluginCall call) throws Exception {
        if (verifiedFile == null || !verifiedFile.isFile()) throw new Exception("missing_package");
        if (cancelled.get()) throw new Exception("cancelled");
        progress(1, 1, "installing");
        startActivityForResult(call, installationIntent(verifiedFile), "installationResult");
    }

    @ActivityCallback
    private void installationResult(PluginCall call, ActivityResult result) {
        installing.set(false);
        if (call == null) return;
        if (result.getResultCode() == Activity.RESULT_OK) {
            JSObject value = new JSObject(); value.put("installed", true); call.resolve(value);
        } else call.reject("Android installation was cancelled or could not finish", "INSTALL_CANCELLED");
    }

    @Override
    protected void handleOnDestroy() {
        cancelled.set(true);
        worker.shutdownNow();
    }
}
