# HAMIYA launcher assets

The interface and PWA share `public/icon.svg`. Its two PNG exports are used by the web manifest. The mark remains provisional pending an official company logo.

`android/` contains legacy launcher bitmaps for five densities, adaptive foreground/background vectors, and Android 13 themed-icon resources. The vectors use a 108 dp canvas and keep the mark inside the central safe area described in the [Android adaptive icon guidelines](https://developer.android.com/develop/ui/compose/system/icon_design_adaptive).

After `pnpm exec cap add android` and `pnpm exec cap sync android`, run `pnpm android:brand`. This copies the launcher resources into the generated native project, preserving unrelated native resources. The signed release workflow runs this step automatically. Do not commit generated Android projects or signing material.
