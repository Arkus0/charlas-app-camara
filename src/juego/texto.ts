// Medida y partido de texto con la fuente pixel del juego (Tiny5 a 8 px).
// Los anchos están tabulados para que la lógica no dependa del navegador.

export const ANCHOS: Record<string, number> = {"0":4,"1":4,"2":4,"3":4,"4":4,"5":4,"6":4,"7":4,"8":4,"9":4," ":2,"!":2,"\"":4,"#":6,"$":4,"%":5,"&":5,"'":2,"(":3,")":3,"*":4,"+":4,",":3,"-":4,".":2,"/":3,":":2,";":3,"<":4,"=":4,">":4,"?":4,"@":5,"A":5,"B":5,"C":5,"D":5,"E":5,"F":5,"G":5,"H":5,"I":2,"J":4,"K":5,"L":4,"M":6,"N":5,"O":5,"P":5,"Q":5,"R":5,"S":5,"T":4,"U":5,"V":4,"W":6,"X":4,"Y":4,"Z":4,"[":3,"\\":3,"]":3,"^":4,"_":4,"`":3,"a":4,"b":4,"c":4,"d":4,"e":4,"f":3,"g":4,"h":4,"i":2,"j":2,"k":4,"l":2,"m":6,"n":4,"o":4,"p":4,"q":4,"r":3,"s":4,"t":3,"u":4,"v":4,"w":6,"x":4,"y":4,"z":4,"{":4,"|":2,"}":4,"~":3,"á":4,"é":4,"í":2,"ó":4,"ú":4,"ü":4,"ñ":4,"Á":5,"É":5,"Í":2,"Ó":5,"Ú":5,"Ü":5,"Ñ":5,"¿":4,"¡":2,"«":6,"»":6,"—":6,"…":6,"º":4,"ª":4,"€":5,"·":2,"ç":4,"Ç":5};

export function medir(texto: string): number {
  let n = 0;
  for (const ch of texto) n += ANCHOS[ch] ?? 4;
  return n;
}

/** Parte un texto en líneas que caben en `ancho` píxeles. Respeta los saltos de línea explícitos. */
export function partir(texto: string, ancho: number): string[] {
  const lineas: string[] = [];
  for (const parrafo of texto.split('\n')) {
    let linea = '';
    for (const palabra of parrafo.split(' ')) {
      const prueba = linea ? linea + ' ' + palabra : palabra;
      if (medir(prueba) > ancho && linea) { lineas.push(linea); linea = palabra; } else linea = prueba;
    }
    lineas.push(linea);
  }
  return lineas;
}
