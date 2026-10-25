// La aplicación: el menú y la partida contra la IA (las partidas online llegan en otra fase).
import { useCallback, useState } from 'react';
import { cargarLocal, guardarLocal, nuevaLocal, usePartidaLocal, type ConfigLocal, type Guardada } from './local';
import { Menu } from './Menu';
import { Partida } from './partida/Partida';

const CONFIG_INICIAL: ConfigLocal = { humano: 'P', nivel: 'normal' };

function PartidaLocal({ inicial, onSalir, onRevancha }: { inicial: Guardada; onSalir: () => void; onRevancha: () => void }) {
  const p = usePartidaLocal(inicial);
  return <Partida {...p} v={p.vista} onSalir={onSalir} onRevancha={onRevancha} />;
}

export function App() {
  const [guardada, setGuardada] = useState<Guardada | null>(() => cargarLocal());
  const [jugando, setJugando] = useState(false);
  const [clave, setClave] = useState(0);

  const empezar = useCallback((config: ConfigLocal) => {
    const g = nuevaLocal(config);
    guardarLocal(g);
    setGuardada(g);
    setClave((k) => k + 1);
    setJugando(true);
  }, []);

  if (jugando && guardada) {
    return (
      <PartidaLocal
        key={clave}
        inicial={guardada}
        onSalir={() => { setGuardada(cargarLocal()); setJugando(false); }}
        onRevancha={() => empezar(guardada.config)}
      />
    );
  }
  return (
    <Menu
      inicial={guardada?.config ?? CONFIG_INICIAL}
      hayGuardada={!!guardada && !guardada.estado.ganador}
      onEmpezar={empezar}
      onContinuar={() => { setGuardada(cargarLocal()); setClave((k) => k + 1); setJugando(true); }}
    />
  );
}
