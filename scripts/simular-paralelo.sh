#!/usr/bin/env bash
# Lanza N simulaciones en 4 procesos: scripts/simular-paralelo.sh 100 normal normal [semillaInicial]
N=${1:-40}; P=${2:-normal}; C=${3:-normal}; S0=${4:-1}; POR=$(( (N + 3) / 4 ))
for i in 0 1 2 3; do npx tsx scripts/simular.ts $POR $P $C $(( S0 + i * POR )) > /tmp/sim_$i.json & done
wait
node -e '
const fs=require("fs"); const r=[0,1,2,3].map(i=>JSON.parse(fs.readFileSync("/tmp/sim_"+i+".json","utf8")));
const t={partidas:0,P:0,C:0,empate:0,turno:0,ventaja:0,esc:0,motivos:{}};
for(const x of r){t.partidas+=x.partidas;t.P+=x.victorias.P;t.C+=x.victorias.C;t.empate+=x.victorias.empate;t.turno+=x.turnoMedio*x.partidas;t.ventaja+=x.ventajaMedia*x.partidas;t.esc+=x.escanosPPVoxMedios*x.partidas;for(const[k,v]of Object.entries(x.motivos))t.motivos[k]=(t.motivos[k]||0)+v;}
console.log(JSON.stringify({partidas:t.partidas,pctProgresista:+(100*t.P/t.partidas).toFixed(1),P:t.P,C:t.C,empate:t.empate,turnoMedio:+(t.turno/t.partidas).toFixed(2),ventajaMedia:+(t.ventaja/t.partidas).toFixed(2),escanosPPVox:+(t.esc/t.partidas).toFixed(1),motivos:t.motivos},null,1));'
