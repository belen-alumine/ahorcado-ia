import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const counterFile = join(__dirname, '.test-counter');
const screenshotsBase = join(__dirname, 'screenshots');

let counter = 0;
if (existsSync(counterFile)) {
  counter = parseInt(readFileSync(counterFile, 'utf-8').trim(), 10) || 0;
}
counter++;
writeFileSync(counterFile, String(counter), 'utf-8');

const dirName = `test_${counter}`;
const dirPath = join(screenshotsBase, dirName);
mkdirSync(dirPath, { recursive: true });

writeFileSync(join(__dirname, '.screenshot-dir'), dirPath, 'utf-8');
console.log(`Screenshots → ${dirPath}`);
