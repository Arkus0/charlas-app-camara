// Pistas de música. Cada canal es una tira de pasos (semicorcheas):
// una nota (la3 = a3, sostenido con #), «-» la alarga, «.» es silencio y «|» solo separa compases.
// En la percusión: b bombo, c caja, p palmas, h plato.

export interface Pista {
  bpm: number;
  bucle: boolean;
  canales: { inst: string; vol: number; notas: string }[];
}

const x2 = (s: string) => `${s} | ${s}`;

export const PISTAS: Record<string, Pista> = {
  pueblo: {
    bpm: 104, bucle: true,
    canales: [
      { inst: 'guitarra', vol: 0.5, notas: x2('a3 - e4 - a4 - c5 - e4 - a4 - c5 - e4 - | g3 - d4 - g4 - b4 - d4 - g4 - b4 - d4 - | f3 - c4 - f4 - a4 - c4 - f4 - a4 - c4 - | e3 - b3 - e4 - g#4 - b3 - e4 - g#4 - b3 -') },
      { inst: 'bajo', vol: 0.7, notas: x2('a2 - - - - - a2 - - - - - e3 - - - | g2 - - - - - g2 - - - - - d3 - - - | f2 - - - - - f2 - - - - - c3 - - - | e2 - - - - - e2 - - - - - b2 - e2 -') },
      { inst: 'flauta', vol: 0.55, notas: 'e5 - - - d5 - c5 - b4 - c5 - a4 - - - | b4 - - - d5 - b4 - g4 - - - . . g4 a4 | a4 - - - c5 - a4 - f4 - - - . . f4 g4 | g#4 - - - b4 - - - e4 - - - - - . . | a5 - - - g5 - e5 - c5 - e5 - a4 - - - | g5 - - - f5 - d5 - b4 - d5 - g4 - - - | f5 - - - e5 - c5 - a4 - c5 - f4 - a4 - | e5 - - - - - d5 c5 b4 - g#4 - e4 - - -' },
      { inst: 'bateria', vol: 0.5, notas: x2('b . . p . . p . . . p . p . . . | b . . p . . p . . . p . p . p . | b . . p . . p . . . p . p . . . | b . . p . . p . b . p . p p p .') },
    ],
  },
  bar: {
    bpm: 92, bucle: true,
    canales: [
      { inst: 'guitarra', vol: 0.45, notas: 'd3 - a3 - d4 - f4 - a3 - d4 - f4 - a3 - | g3 - b3 - d4 - f4 - b3 - d4 - f4 - b3 - | c3 - g3 - c4 - e4 - g3 - c4 - e4 - g3 - | a2 - e3 - a3 - c#4 - e3 - a3 - c#4 - e3 -' },
      { inst: 'bajo', vol: 0.6, notas: 'd2 - - - - - a2 - d2 - - - a2 - - - | g2 - - - - - d3 - g2 - - - b2 - - - | c2 - - - - - g2 - c2 - - - e2 - - - | a2 - - - - - e2 - a2 - - - c#3 - - -' },
      { inst: 'flauta', vol: 0.45, notas: 'f5 - - e5 d5 - a4 - - - - - . . . . | f5 - - e5 d5 - b4 - - - - - . . . . | e5 - - d5 c5 - g4 - - - - - . . g4 a4 | c#5 - - - e5 - - - a4 - - - - - - -' },
      { inst: 'bateria', vol: 0.3, notas: 'b . . . h . . . b . h . h . . . | b . . . h . . . b . h . h . p .' },
    ],
  },
  casa: {
    bpm: 60, bucle: true,
    canales: [
      { inst: 'koto', vol: 0.6, notas: 'e4 - - - f4 - - - a4 - - - - - - - | b4 - - - c5 - - - b4 - a4 - f4 - - - | e4 - - - - - a4 - b4 - - - e5 - - - | c5 - b4 - a4 - f4 - e4 - - - - - - -' },
      { inst: 'cuerdas', vol: 0.25, notas: 'a2 - - - - - - - - - - - - - - - | f2 - - - - - - - - - - - - - - - | e2 - - - - - - - - - - - - - - - | e2 - - - - - - - - - - - - - - -' },
    ],
  },
  titulo: {
    bpm: 72, bucle: true,
    canales: [
      { inst: 'koto', vol: 0.5, notas: 'a3 - e4 - a4 - c5 - e5 - c5 - a4 - e4 - | f3 - c4 - f4 - a4 - c5 - a4 - f4 - c4 - | c3 - g3 - c4 - e4 - g4 - e4 - c4 - g3 - | e3 - b3 - e4 - g#4 - b4 - g#4 - e4 - b3 -' },
      { inst: 'flauta', vol: 0.5, notas: 'e5 - - - - - - - c5 - - - d5 - - - | c5 - - - - - - - a4 - - - - - - - | g4 - - - - - c5 - e5 - - - - - d5 - | e5 - - - - - - - - - - - . . . .' },
      { inst: 'cuerdas', vol: 0.3, notas: 'a2 - - - - - - - - - - - - - - - | f2 - - - - - - - - - - - - - - - | c3 - - - - - - - - - - - - - - - | e2 - - - - - - - - - - - - - - -' },
    ],
  },
  mazmorra: {
    bpm: 84, bucle: true,
    canales: [
      { inst: 'bajo', vol: 0.7, notas: 'e2 - - - . . e2 - f2 - - - . . e2 - | e2 - - - . . g2 - f2 - - - e2 - - - | e2 - - - . . e2 - f2 - - - . . e2 - | e2 - - - . . d2 - f2 - - - e2 - - -' },
      { inst: 'koto', vol: 0.45, notas: 'b4 - - - - - - - c5 - - - b4 - - - | . . . . e5 - - - d5 - - - c5 - b4 - | b4 - - - - - - - g#4 - - - b4 - - - | . . . . f5 - - - e5 - - - d5 - c5 -' },
      { inst: 'cuerdas', vol: 0.22, notas: 'e3 - - - - - - - f3 - - - - - - - | e3 - - - - - - - f3 - - - e3 - - - | e3 - - - - - - - f3 - - - - - - - | e3 - - - - - - - d3 - - - e3 - - -' },
      { inst: 'bateria', vol: 0.35, notas: 'b . . . . . . . . . h . . . . . | b . . . . . . . . . h . . . p .' },
    ],
  },
  jefe: {
    bpm: 148, bucle: true,
    canales: [
      { inst: 'bajo', vol: 0.75, notas: 'e2 - e2 - e3 - e2 - e2 - e3 - e2 - d3 - | f2 - f2 - f3 - f2 - f2 - f3 - f2 - e3 - | g2 - g2 - g3 - g2 - g2 - g3 - g2 - f3 - | f2 - f2 - f3 - f2 - e2 - e3 - e2 - b2 -' },
      { inst: 'koto', vol: 0.5, notas: 'e5 f5 e5 d5 e5 - b4 - e5 f5 g#5 f5 e5 - - - | f5 g5 f5 e5 f5 - c5 - f5 g5 a5 g5 f5 - - - | g5 a5 g5 f5 g5 - d5 - g5 a5 b5 a5 g5 - - - | a5 g5 f5 e5 f5 e5 d5 c5 b4 - g#4 - e4 - - -' },
      { inst: 'cuerdas', vol: 0.2, notas: 'e3 - - - - - - - - - - - - - - - | f3 - - - - - - - - - - - - - - - | g3 - - - - - - - - - - - - - - - | f3 - - - - - - - e3 - - - - - - -' },
      { inst: 'bateria', vol: 0.55, notas: 'b . p . c . p . b b p . c . p p | b . p . c . p . b b p . c . c c' },
    ],
  },
  muerte: {
    bpm: 66, bucle: false,
    canales: [
      { inst: 'flauta', vol: 0.5, notas: 'e4 - - - d4 - - - c4 - - - b3 - - - | a3 - - - - - - - - - - - - - - -' },
      { inst: 'cuerdas', vol: 0.3, notas: 'a2 - - - - - - - - - - - - - - - | a2 - - - - - - - - - - - - - - -' },
    ],
  },
  creditos: {
    bpm: 100, bucle: true,
    canales: [
      { inst: 'guitarra', vol: 0.5, notas: 'a3 - e4 - a4 - c#5 - e4 - a4 - c#5 - e4 - | e3 - b3 - e4 - g#4 - b3 - e4 - g#4 - b3 - | f#3 - c#4 - f#4 - a4 - c#4 - f#4 - a4 - c#4 - | d3 - a3 - d4 - f#4 - a3 - d4 - f#4 - a3 -' },
      { inst: 'bajo', vol: 0.65, notas: 'a2 - - - - - a2 - - - - - e3 - - - | e2 - - - - - e2 - - - - - b2 - - - | f#2 - - - - - f#2 - - - - - c#3 - - - | d2 - - - - - d2 - - - - - a2 - - -' },
      { inst: 'flauta', vol: 0.5, notas: 'c#5 - - - e5 - - - a5 - - - g#5 - e5 - | g#5 - - - e5 - - - b4 - - - - - . . | a5 - - - f#5 - - - c#5 - - - e5 - f#5 - | f#5 - - - - - e5 d5 e5 - - - - - . .' },
      { inst: 'bateria', vol: 0.45, notas: 'b . . p . . p . . . p . p . . . | b . . p . . p . b . p . p . p .' },
    ],
  },
};
