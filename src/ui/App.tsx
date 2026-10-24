import { useCallback, useState } from 'react';
import type { Nivel } from '../ai/bot';
import { crearPartida } from '../engine/motor';
import type { Bando, Escenario, Estado } from '../engine/tipos';
import { Menu } from './Menu';
import { Partida } from './Partida';

export interface Config {
  modo: 'ia' | 'dos';
  humano: Bando;
  nivel: Nivel;
  escenario: Escenario;
}

interface Guardada {
  config: Config;
  estado: Estado;
}

const CLAVE = '176-29n-partida-v1';
const CONFIG_INICIAL: Config = { modo: 'ia', humano: 'P', nivel: 'normal', escenario: 'abierto' };

function cargar(): Guardada | null {
  try {
    const s = localStorage.getItem(CLAVE);
    if (!s) return null;
    const g = JSON.parse(s) as Guardada;
    return g?.estado?.version === 1 ? g : null;
  } catch {
    return null;
  }
}

function guardar(g: Guardada | null) {
  try {
    if (g) localStorage.setItem(CLAVE, JSON.stringify(g));
    else localStorage.removeItem(CLAVE);
  } catch {
    /* sin almacenamiento: la partida sigue en memoria */
  }
}

export function App() {
  const [guardada, setGuardada] = useState<Guardada | null>(() => cargar());
  const [enPartida, setEnPartida] = useState(false);

  const empezar = useCallback((config: Config) => {
    const g = { config, estado: crearPartida((Math.random() * 2 ** 31) | 0, config.escenario) };
    setGuardada(g);
    guardar(g);
    setEnPartida(true);
  }, []);

  const onEstado = useCallback((estado: Estado) => {
    setGuardada((g) => {
      if (!g) return g;
      const n = { ...g, estado };
      guardar(n);
      return n;
    });
  }, []);

  if (enPartida && guardada) {
    return (
      <Partida
        key={guardada.config.modo + guardada.config.humano}
        config={guardada.config}
        estado={guardada.estado}
        onEstado={onEstado}
        onMenu={() => setEnPartida(false)}
        onNueva={() => setEnPartida(false)}
      />
    );
  }
  return (
    <Menu
      inicial={guardada?.config ?? CONFIG_INICIAL}
      hayGuardada={!!guardada && !guardada.estado.ganador}
      onEmpezar={empezar}
      onContinuar={() => setEnPartida(true)}
    />
  );
}
