import { copyFileSync, readFileSync } from 'node:fs';
if (!readFileSync('dist/app.html', 'utf8').includes('hamiya-startup'))
  throw new Error('Refusing to package a non-application entry as the Android shell');
copyFileSync('dist/app.html', 'dist/index.html');
console.log('Native web entry prepared; Android will open the customer app.');
