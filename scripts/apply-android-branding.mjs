import { access, cp } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const manifest = new URL('../android/app/src/main/AndroidManifest.xml', import.meta.url);
const source = new URL('../resources/android/', import.meta.url);
const target = new URL('../android/app/src/main/res/', import.meta.url);

try {
  await access(manifest);
} catch {
  throw new Error('Generate the Android project with Capacitor before applying HAMIYA branding.');
}
await cp(fileURLToPath(source), fileURLToPath(target), { recursive: true });
console.log('HAMIYA legacy, adaptive and themed launcher icons applied.');
