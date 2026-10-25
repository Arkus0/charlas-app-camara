// El plató de cada fin de semana. Programa y personajes son ficticios: cámbialos aquí si quieres.
export interface Personaje {
  id: 'pres' | 'demo' | 'cons' | 'prog' | 'poli';
  nombre: string;
  rol: string;
}

export const PLATO = {
  programa: 'En Caliente',
  cadena: 'Canal 29',
  especial: 'Especial noche electoral',
  personajes: {
    pres: { id: 'pres', nombre: 'Javier Montalbán', rol: 'presentador' },
    demo: { id: 'demo', nombre: 'Inés Calvo', rol: 'demóscopa' },
    cons: { id: 'cons', nombre: 'Rafa Seguí', rol: 'columnista, mirada conservadora' },
    prog: { id: 'prog', nombre: 'Marta Ibarra', rol: 'columnista, mirada progresista' },
    poli: { id: 'poli', nombre: 'Álvaro Prieto', rol: 'politólogo' },
  } satisfies Record<Personaje['id'], Personaje>,
};
