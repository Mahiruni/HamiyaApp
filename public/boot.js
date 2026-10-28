// Recovery still works when the React module itself cannot be downloaded.
// Capture only the static HTML element. A late deferred script must never mutate
// the React splash, even if it missed the module's booted event.
const initialSplash = document.getElementById('hamiya-startup');
const bootTimer = setTimeout(() => {
  const splash = initialSplash;
  if (!splash?.isConnected || splash.querySelector('.startup-recovery')) return;
  let language = 'en';
  try {
    language = JSON.parse(localStorage.getItem('hamiya-language')) || 'en';
  } catch {
    /* optional storage */
  }
  const copy = {
    en: ['HAMIYA could not start. Check your connection and try again.', 'Try again'],
    am: ['ሀሚያ መጀመር አልቻለም። ግንኙነትዎን ያረጋግጡና እንደገና ይሞክሩ።', 'እንደገና ይሞክሩ'],
    om: [
      'HAMIYA jalqabuu hin dandeenye. Walqunnamtii kee mirkaneessiitii irra deebiʼii yaali.',
      'Irra deebiʼii yaali',
    ],
  }[language] || ['HAMIYA could not start. Check your connection and try again.', 'Try again'];
  splash.querySelector('.startup-progress')?.remove();
  const recovery = document.createElement('div');
  recovery.className = 'startup-recovery';
  recovery.setAttribute('role', 'alert');
  const message = document.createElement('p');
  message.textContent = copy[0];
  const retry = document.createElement('button');
  retry.textContent = copy[1];
  retry.addEventListener('click', () => location.reload());
  recovery.append(message, retry);
  splash.append(recovery);
}, 20000);
window.addEventListener('hamiya:booted', () => clearTimeout(bootTimer), { once: true });
