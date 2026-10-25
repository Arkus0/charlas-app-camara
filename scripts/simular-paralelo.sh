#!/usr/bin/env bash
# Lanza N simulaciones en 4 procesos: scripts/simular-paralelo.sh 100 normal normal [semillaInicial]
# (RITMO y SESGO se pasan a scripts/simular.ts)
N=${1:-40}; P=${2:-normal}; C=${3:-normal}; S0=${4:-1}; POR=$(( (N + 3) / 4 ))
TMP=$(mktemp -d)
for i in 0 1 2 3; do npx tsx scripts/simular.ts $POR $P $C $(( S0 + i * POR )) > "$TMP/sim_$i.json" & done
wait
node -e '
const fs=require("fs"); const dir=process.argv[1];
const r=[0,1,2,3].map(i=>JSON.parse(fs.readFileSync(dir+"/sim_"+i+".json","utf8")));
const n=r.reduce((a,x)=>a+x.partidas,0);
const media=(k)=>+(r.reduce((a,x)=>a+x[k]*x.partidas,0)/n).toFixed(1);
const suma=(f)=>{const t={};for(const x of r)for(const[k,v]of Object.entries(f(x)))t[k]=(t[k]||0)+v;return t;};
const v=suma(x=>x.victorias);
const modos=suma(x=>Object.fromEntries(Object.entries(x.modos).map(([k,p])=>[k,p*x.partidas/n])));
console.log(JSON.stringify({partidas:n,nivel:r[0].nivel,ritmo:r[0].ritmo,victorias:v,pctProgresista:+(100*v.P/n).toFixed(1),
  anticipadasPct:media("anticipadasPct"),decisionesPorJugador:media("decisionesPorJugador"),accionesPorJugador:media("accionesPorJugador"),
  modos:Object.fromEntries(Object.entries(modos).map(([k,p])=>[k,+p.toFixed(1)])),partidasConCartaAjenaPct:media("partidasConCartaAjenaPct"),
  maquinariaPorPartida:{P:+(r.reduce((a,x)=>a+x.maquinariaPorPartida.P*x.partidas,0)/n).toFixed(2),C:+(r.reduce((a,x)=>a+x.maquinariaPorPartida.C*x.partidas,0)/n).toFixed(2)},
  ventajaMedia:media("ventajaMedia"),escanosPPVox:media("escanosPPVox"),escanosPSOEFA:media("escanosPSOEFA"),
  msPorDecision:media("msPorDecision"),msMax:Math.max(...r.map(x=>x.msMax)),motivos:suma(x=>x.motivos)},null,1));' "$TMP"
rm -rf "$TMP"
