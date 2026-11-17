// Neon Salvage's entry program (Node 22, standard library only). The game itself is this
// directory's game/ folder — plain static files a desktop browser plays offline — and this
// program hands it in: it copies game/ and screenshots/ from beside this file to /output and
// writes /output/dossier.json, the summary the judge reads, with the vendored make.fun library.
//
// Outside the grader's container, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

// The caps are the scorer's own: at most 4 screenshots of 256 KiB each, at most 993 entries
// and 48 MiB under game/, no path under game/ longer than 1000 bytes, and the dossier's text
// capped at 160 KiB. buildDossier refuses an entry the scorer would refuse.
const DOSSIER_CAPS = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
};

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

mkdirSync(out, { recursive: true });
cpSync(join(here, 'game'), join(out, 'game'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(join(here, 'screenshots'))) {
  cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });
}

const dossierPath = join(out, 'dossier.json');
writeFileSync(dossierPath, buildDossier(out, DOSSIER_CAPS));
console.log(`Neon Salvage handed in: dossier.json ${statSync(dossierPath).size} bytes at ${dossierPath}`);
