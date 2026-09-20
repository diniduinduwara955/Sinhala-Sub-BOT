import assert from 'node:assert/strict';
import fs from 'node:fs';
import { parseFilename, normalizeTitle } from './subtitle/parser.js';
import { readSubtitleFilesFromZip, isZipFile } from './subtitle/zip.js';

const archive = fs.readFileSync('/mnt/data/zip_test/sample.zip');
assert.equal(isZipFile('sample.zip', 'application/zip'), true);
const files = readSubtitleFilesFromZip(archive);
assert.equal(files.length, 2);

const a = parseFilename(files[0].fileName);
assert.equal(a.title, 'Avatar');
assert.equal(a.year, 2009);
assert.equal(a.normalizedTitle, 'avatar');

const b = parseFilename(files[1].fileName);
assert.equal(b.title, 'Avatar The Way of Water');
assert.equal(b.year, 2022);
assert.equal(b.normalizedTitle, 'avatar the way of water');

assert.equal(normalizeTitle('Avatar: The Way of Water (2022) Sinhala SRT'), 'avatar the way of water');
console.log('✅ ZIP + metadata mapping test passed.');
console.log(`   • ${files.length} subtitle files extracted from sample ZIP.`);
console.log('   • Movie titles, years and normalized search keys parsed correctly.');
