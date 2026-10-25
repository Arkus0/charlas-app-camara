// Empaqueta la lógica del servidor online (motor, vistas, cartas y avisos push) en un solo módulo ESM para la
// Edge Function de Supabase: supabase/functions/partida/motor.js. Se ejecuta antes de desplegar la función.
// Uso: npm run empaquetar
import { build } from 'esbuild';
import { statSync } from 'node:fs';

const salida = 'supabase/functions/partida/motor.js';
await build({
  entryPoints: ['src/online/paquete.ts'],
  bundle: true,
  format: 'esm',
  platform: 'neutral',
  target: 'es2022',
  minify: true,
  legalComments: 'none',
  outfile: salida,
  banner: { js: '// Generado por scripts/empaquetar-motor.mjs: no editar a mano.' },
});
console.log(`${salida}: ${(statSync(salida).size / 1024).toFixed(0)} KB`);
