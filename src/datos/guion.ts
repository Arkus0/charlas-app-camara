// Guion: personajes, tiendas, historias secundarias, jefes y escenas.
import type { Dir, Ent, Paso } from '../tipos';
import type { Juego } from '../juego/juego';

export interface DefPnj {
  nombre: string;
  pal: string;
  dir?: Dir;
  /** solo aparece si se cumple */
  si?: (j: Juego) => boolean;
  habla: (j: Juego) => Paso[];
}

export interface DefMarca {
  spr: string;
  solido?: boolean;
  si?: (j: Juego) => boolean;
  usar: (j: Juego, e: Ent) => Paso[];
}

const PIEZAS = [
  'las olas del puerto, a la altura de los riñones',
  'un clavel negro sobre el omóplato izquierdo',
  'una carpa que remonta la corriente por el costado',
  'un toro de lidia en el omóplato derecho',
  'el dragón de los Tachibana, enroscado en la columna',
  'el sol saliendo sobre el Mediterráneo, entre los hombros',
];

function comprar(j: Juego, precio: number, hecho: () => Paso[]): Paso[] {
  if (j.p.dinero < precio) { j.sfx('no'); return ['No te llega el dinero.']; }
  j.p.dinero -= precio;
  return hecho();
}

export const PNJS: Record<string, DefPnj> = {
  maruja: {
    nombre: 'Maruja', pal: 'maruja',
    habla: (j) => {
      const M = 'Maruja';
      const tapa: Paso[] = [
        [M, '¿Te pongo algo, hijo?'],
        {
          op: ['Caña y tapa (150 pts)', 'Nada, gracias'],
          r: (i) => (i === 0 ? comprar(j, 150, () => { j.p.vida = j.p.vidaMax; j.sfx('cura'); return [[M, 'Ensaladilla de la casa. Receta de Hideo, aunque él le echaba wasabi.'], 'Has recuperado todas las fuerzas.']; }) : [[M, 'Aquí estaré.']]),
        },
      ];
      if (!j.p.bate) {
        return [
          [M, '¡Rai! Madre mía, el Ahijado… Cinco años sin una postal, sinvergüenza.'],
          [M, 'Lo enterramos el martes. «Un infarto», dijo el médico. Hideo, que subía al faro corriendo todas las mañanas.'],
          [M, 'Esa misma noche el sello del clan apareció partido en tres. El Percebe se quedó la Lonja, la Faraona las bodegas y el Miura la plaza de toros. Cada uno con su trozo.'],
          [M, 'Sin el sello entero no hay Clavel Negro, y sin el Clavel Negro este pueblo se lo come el primero que traiga un maletín.'],
          [M, 'Ten. Era el bate con el que tu padrino espantaba a los borrachos. Empieza por el Percebe: la Lonja está en el muelle.'],
          { f: () => j.dar('bate') },
          [M, 'Y otra cosa: cuando pegas con rabia se te llena el DUENDE. Con la barra a tope, carga el golpe y suéltalo. Ya verás, ya.'],
        ];
      }
      if (!j.ban('jefe:percebe')) return [[M, 'El Percebe no sale de la Lonja. Entra por el muelle y no te fíes de las cajas: allí todo se mueve.'], ...tapa];
      if (!j.ban('jefe:faraona')) return [[M, 'La Faraona tapió la entrada de las bodegas, en el casco viejo. Pero ese muro está más agrietado que mi paciencia. Con algo que haga ¡pum!…'], ...tapa];
      if (!j.ban('jefe:miura')) return [[M, 'El Miura duerme en la plaza de toros, al norte de la plaza. Ha atrancado la puerta con tablones. La madera arde, hijo.'], ...tapa];
      if (!j.p.katana) return [[M, 'Los tres trozos… Llévalos a casa de Hideo, en la plaza. El altar tiene tres huecos. Él sabía que volverías.'], ...tapa];
      if (!j.ban('fin')) return [[M, 'Fermín. Treinta años a su mesa… Está en lo alto del Gran Sol, por el paseo hacia el este. Vuelve entero, Rai.'], ...tapa];
      return [[M, 'El clan no es de nadie, dices. Pues la ronda sí: esta la pago yo.'], ...tapa];
    },
  },
  parroquiano: {
    nombre: 'Parroquiano', pal: 'abuelo',
    habla: (j) => [
      ['Parroquiano', j.p.capote
        ? 'El capote en pleno salto, chaval. Así cruzaba el Litri las zanjas cuando le perseguían los acreedores.'
        : 'Tres golpes seguidos y, si mantienes pulsado, un giro. Don Hideo lo llamaba «el molinillo». Tumbaba a seis.'],
      ['Parroquiano', 'La tragaperras del fondo no da un duro desde el Mundial del 82. Yo sigo echando.'],
    ],
  },
  chema: {
    nombre: 'Chema', pal: 'chema', dir: 0,
    habla: (j) => {
      const C = 'Chema';
      if (j.ban('chema')) return [[C, 'Con esta caña saqué una dorada de cuatro kilos el día de mi boda. No la solté ni para el vals.']];
      if (j.ban('cana')) {
        j.pon('chema');
        j.p.dinero += 1000;
        return [[C, '¡MI CAÑA! ¡La Carmela! Ay, que lloro… Toma, toma, mil pesetas y el bocata de mi mujer. No, no me des las gracias.'], { f: () => j.dar('bocata') }];
      }
      return [
        [C, 'Los del Percebe me quitaron la caña de la suerte. «Aquí solo pesca el patrón», me dijeron. Estará tirada en algún cuarto de la Lonja.'],
        [C, 'Si la ves… Yo sin la Carmela no saco ni un mújol.'],
      ];
    },
  },
  turista: {
    nombre: 'Mr. Higgins', pal: 'turista',
    habla: (j) => {
      const H = 'Mr. Higgins';
      if (j.ban('turista')) return [[H, 'Wonderful! Ya he visto a tres señores pegarse con sillas. ¡Qué folclore más auténtico!']];
      return [
        [H, 'Excuse me! Busco el espectáculo típico: flamenco, paella y toro, todo a la vez. La guía dice «very authentic».'],
        {
          op: ['Eso es en las bodegas', 'Eso es en la plaza de toros', 'Eso no existe, míster'],
          r: (i) => {
            j.pon('turista'); j.p.dinero += 300; j.sfx('moneda');
            return [
              [H, i === 2 ? 'Ha, ha! Humor español. Me encanta. Tome, por la visita guiada.' : 'Marvellous! Allá voy. Tome, por la visita guiada.'],
              'Te ha dado 300 pesetas de propina. No sabes muy bien por qué.',
            ];
          },
        },
      ];
    },
  },
  kevin: {
    nombre: 'Kevin', pal: 'kevin',
    habla: (j) => {
      const K = 'Kevin';
      if (j.ban('kevin')) return [[K, '¡Tengo la colección entera! Bueno, me falta Mostovoi. Siempre falta Mostovoi.']];
      if (j.p.cromos >= 3) {
        j.pon('kevin'); j.p.cromos -= 3;
        return [
          [K, '¡¿Tres?! ¡Y uno es el del escudo brillante! Eres el mejor mayor que conozco.'],
          [K, 'Toma. Se le cayó al señor de los tatuajes y yo no sé para qué sirve.'],
          { f: () => j.dar('tinta') },
        ];
      }
      return [
        [K, 'Me faltan tres cromos para acabar el álbum de la Liga. Los mayores los guardan en cofres, que yo lo he visto.'],
        [K, `Si encuentras cromos, tráemelos. ${j.p.cromos ? `¿Ya llevas ${j.p.cromos}? ¡Faltan ${3 - j.p.cromos}!` : 'Te doy una cosa rara a cambio.'}`],
      ];
    },
  },
  frutera: {
    nombre: 'La Trini', pal: 'frutera',
    habla: (j) => [
      ['La Trini', j.ban('jefe:percebe')
        ? 'Dicen que el Percebe ha amanecido con la cara como un tomate de los míos. Algo habrás tenido que ver, que te conozco.'
        : 'Desde que falta Don Hideo aquí cobra «protección» todo el que tiene dos manos. Y yo vendo melones, no oro.'],
    ],
  },
  abuelo: {
    nombre: 'El tío Anselmo', pal: 'abuelo',
    habla: (j) => [
      ['El tío Anselmo', j.p.tracas
        ? 'Tú llevas pólvora encima, que lo huelo. Esa pared de ahí lleva agrietada desde la riada del 57. No digo más.'
        : 'Detrás de esa pared agrietada estaba la puerta de las bodegas. La Faraona la tapió. Haría falta una buena traca para abrirla.'],
    ],
  },
  remedios: {
    nombre: 'Doña Remedios', pal: 'remedios',
    habla: (j) => {
      const R = 'Doña Remedios';
      if (j.ban('remedios')) return [[R, 'Sashimi ya no sale del brasero. Tu padrino le puso el nombre, que conste.']];
      if (j.ban('gato')) {
        j.pon('remedios');
        return [
          [R, '¡Sashimi! ¡Granuja! Ay, hijo, qué descanso. Mira, esto lo guardaba para el Chino Pérez, pero tú le darás mejor uso.'],
          { f: () => j.dar('tinta') },
        ];
      }
      return [
        [R, 'Se me ha subido el gato al tejado de la esquina y no baja ni con sardinas. A mi edad yo ya no salto.'],
        [R, 'Tú que tienes piernas: sube por el murete, anda.'],
      ];
    },
  },
  taquillero: {
    nombre: 'Taquillero', pal: 'taquillero',
    habla: (j) => [
      ['Taquillero', j.ban('jefe:miura')
        ? 'El Miura ha pedido perdón a toda la calle, puerta por puerta. Ha tardado dos días porque llama con la cabeza.'
        : 'La plaza lleva cerrada desde el 92. Ahí dentro solo vive el Miura. Embiste a todo lo que se mueve… y solo para cuando se estrella.'],
      ['Taquillero', j.p.mechero ? 'Esos tablones están secos como la mojama.' : 'Ha clavado la puerta con tablones. A golpes no los quitas.'],
    ],
  },
  paca: {
    nombre: 'La Paca', pal: 'paca',
    habla: (j) => {
      const P = 'La Paca';
      const ops = ['Bocata de calamares (300 pts)', j.ban('tinta_paca') ? '—' : 'Bote de tinta (2000 pts)', 'Nada'];
      return [
        [P, 'Sellos, tabaco, quinielas y lo que no se puede decir. ¿Qué va a ser, Ahijado?'],
        {
          op: ops,
          r: (i) => {
            if (i === 0) {
              if (j.p.bocatas >= 5) return [[P, 'No te caben más en los bolsillos, criatura.']];
              return comprar(j, 300, () => j.dar('bocata'));
            }
            if (i === 1) {
              if (j.ban('tinta_paca')) return [[P, 'De eso ya no me queda.']];
              return comprar(j, 2000, () => { j.pon('tinta_paca'); return j.dar('tinta'); });
            }
            return [[P, 'Pues con Dios.']];
          },
        },
      ];
    },
  },
  chino: {
    nombre: 'El Chino Pérez', pal: 'chino',
    habla: (j) => {
      const C = 'El Chino Pérez';
      const p = j.p;
      if (p.tatuaje >= 6) return [[C, 'Está terminada. Treinta años aprendiendo con Hideo y es lo mejor que he hecho. No te pongas camisa nunca más.']];
      if (p.tinta <= 0) {
        return [
          [C, p.tatuaje ? 'La espalda pide más. Tráeme tinta y seguimos.' : 'El Ahijado. Soy de Albacete, antes de que preguntes. Me enseñó tu padrino; lo de «Chino» es cosa del barrio.'],
          [C, `Cada pieza te hará aguantar más. Llevas ${p.tatuaje} de 6. Tráeme botes de TINTA.`],
        ];
      }
      p.tinta--; p.tatuaje++; p.vidaMax += 2; p.vida = p.vidaMax;
      j.sfx('fanfarria');
      return [
        [C, 'Túmbate. Esto con Hideo dolía más: él lo hacía a mano, con caña de bambú.'],
        `El Chino Pérez te tatúa ${PIEZAS[p.tatuaje - 1]}.`,
        `¡Tu vida máxima aumenta! Pieza ${p.tatuaje} de 6.`,
      ];
    },
  },
};

export const MARCAS: Record<string, DefMarca> = {
  gato: {
    spr: 'gato', solido: false,
    si: (j) => !j.ban('gato'),
    usar: (j, e) => {
      j.pon('gato'); e.vivo = false; j.sfx('cofre');
      return ['Un gato atigrado te mira con desprecio profesional. Se deja coger a cambio de arañarte un poco.', 'Llevas a SASHIMI bajo el brazo. Devuélveselo a Doña Remedios.'];
    },
  },
  tragaperras: {
    spr: 'maquina',
    usar: (j) => [{ f: () => j.abrirTragaperras() }],
  },
  altar: {
    spr: 'altar',
    usar: (j) => {
      const H = 'Carta de Don Hideo';
      if (j.p.katana) return ['El altar de Don Hideo. El sello del Clavel Negro descansa entero sobre la madera.'];
      const n = j.sellos();
      if (n < 3) return [`El altar de Don Hideo: una foto, incienso y un clavel seco. En la madera hay tres huecos con forma de cuña.${n ? ` Tienes ${n} de los tres trozos del sello.` : ''}`];
      j.pon('carta');
      return [
        'Encajas los tres trozos. El sello cruje, entero otra vez, y un cajón oculto se abre bajo el altar.',
        [H, 'Rai: si lees esto, Fermín ha hecho lo que yo temía. Lleva un año comprando el pueblo solar a solar para la promotora del Gran Sol, con el dinero del clan.'],
        [H, 'Me ha invitado a tomar el té esta noche. Los dos sabemos lo que lleva la taza. Soy viejo; prefiero que me encuentre sentado.'],
        [H, 'El Clavel Negro no es de nadie. Es una promesa que le hice a este barrio cuando me dio de comer. Te dejo mi acero. Mi silla, no.'],
        { f: () => j.dar('katana') },
        'Don Fermín, «el Notario». Está en el ático del Hotel Gran Sol, al final del paseo marítimo.',
      ];
    },
  },
};

export const GUION = {
  intro: [
    'Puerto Albor, costa de Levante.\nNoche de San Juan de 1999.',
    'Hace treinta años, un marinero japonés desertó en este puerto.\nSe llamaba Hideo Tachibana.',
    'Trajo un código: el respeto, la deuda, la palabra dada.\nEl barrio le puso nombre a su familia:\nEL CLAVEL NEGRO.',
    'Tú eres Rai Montoya, «el Ahijado».\nLlevas cinco años embarcado, lejos de todo aquello.',
    'Ayer llegó un telegrama al barco:\n\n«DON HIDEO HA MUERTO. VUELVE.\n— MARUJA»',
  ],
  final: [
    'Al amanecer, la Guardia Civil encontró a Don Fermín esposado a la grúa del Gran Sol, con las escrituras falsas en el bolsillo.',
    'El hotel nunca llegó a inaugurarse.\nHoy anidan cigüeñas en la planta novena.',
    'El sello del Clavel Negro volvió a estar entero.\nRai lo dejó en el altar de Don Hideo, junto a la katana.',
    '«El clan no es de nadie», dijo.\nY pidió una caña en La Camelia.',
  ],
  creditos: [
    'CLAVEL NEGRO', '',
    'Diseño, programación, guion y música', 'Claude', '',
    'Gráficos', '«Zelda-like tilesets and sprites»', 'de ArMM1998 (CC0)', '',
    '«RPG Urban Pack»', 'de Kenney (CC0)', '',
    'Fuente', 'Tiny5 (SIL Open Font License)', '',
    'Con cariño para los juegos de 16 bits', 'en los que se saltaba, se empujaban cajas', 'y siempre faltaba una llave.', '',
    'Gracias por jugar.',
  ],

  entrar: {
    inicio: (j: Juego) => {
      j.decir([
        'El Levante huele igual que hace cinco años: a salitre, a gasoil y a pólvora de verbena.',
        'Muévete con la cruceta. SALTA con el botón de salto: puedes subir un escalón y cruzar huecos pequeños.',
        'Maruja te espera en el bar La Camelia, en el paseo marítimo: sube por el muelle hacia el norte.',
      ]);
    },
  } as Record<string, (j: Juego) => void>,

  bloqueos: {
    lonja: (j: Juego): Paso[] | null => (j.p.bate ? null : ['Dentro se oyen risas y cadenas. Con las manos vacías no pintas nada ahí. Maruja te espera en el bar del paseo.']),
    hotel: (j: Juego): Paso[] | null => (j.p.katana ? null : ['Las obras del Gran Sol. Dos gorilas con pinganillo vigilan la valla. Aún no tienes nada que hacer ahí.']),
  } as Record<string, (j: Juego) => Paso[] | null>,

  jefes: {
    percebe: {
      antes: () => [
        ['El Percebe', '¡Hombre, el Ahijado! Cinco años fregando cubiertas y vuelves a pedirme cuentas a MÍ.'],
        ['El Percebe', 'El viejo ya no manda. La Lonja es mía, y este trozo de sello dice que el puerto también. ¡Ven a por él!'],
      ],
      despues: (j: Juego) => [
        ['El Percebe', 'Agh… Pegas… igual que él. Toma el maldito sello.'],
        'Has recuperado un TROZO DEL SELLO del Clavel Negro.',
        { f: () => j.dar('tinta') },
        ['El Percebe', 'Yo no lo maté, chaval. Cuando fui a su casa ya estaba frío… y alguien salía por la puerta de atrás con mucha prisa y muy buen traje.'],
        ['El Percebe', 'Pregúntale a la Faraona. Lleva las cuentas del clan desde sus bodegas, bajo el casco viejo. Y llévate esas tracas: te harán falta.'],
        { f: () => j.irA('muelle', '2') },
      ],
    },
    faraona: {
      antes: (j: Juego) => {
        for (const v of j.ents) if (v.tipo === 'vela') v.encendida = true;
        return [
          ['La Faraona', 'Mira quién baja a mis bodegas. El niño bonito de Hideo.'],
          ['La Faraona', 'Aquí abajo se baila a mi son, Ahijado. Y cuando yo quiero… se baila a oscuras.'],
        ];
      },
      despues: (j: Juego) => [
        ['La Faraona', 'Basta, basta… Qué manos tiene el niño.'],
        'Has recuperado el segundo TROZO DEL SELLO.',
        { f: () => j.dar('tinta') },
        ['La Faraona', 'Los números no mienten: alguien lleva un año vaciando la caja del clan para comprar solares. Y todos los papeles llevan la misma firma. La de Fermín.'],
        ['La Faraona', 'El tercer trozo lo tiene el Miura, en la plaza de toros. Ha atrancado la puerta con tablones; llévate fuego.'],
        { f: () => j.irA('casco', '2') },
      ],
    },
    miura: {
      antes: () => [
        ['El Miura', '…'],
        ['El Miura', 'MUUUH… Digo… ¡FUERA DE MI PLAZA!'],
      ],
      despues: (j: Juego) => [
        ['El Miura', 'El Miura… pierde. El Miura respeta.'],
        'Has recuperado el tercer TROZO DEL SELLO.',
        { f: () => j.dar('tinta') },
        ['El Miura', 'El Notario dijo al Miura: «El viejo quiere vender el barrio». Mentira gorda. El Miura piensa despacio, pero ya ha llegado.'],
        ['El Miura', 'Lleva los tres trozos a casa de Don Hideo. Él guardaba una cosa para ti.'],
        { f: () => j.irA('toros_ext', '2') },
      ],
    },
    notario: {
      antes: () => [
        ['Don Fermín', 'Rai. Qué puntual. Tu padrino también lo era: llegó a su infarto justo a la hora en que yo servía el té.'],
        ['Don Fermín', 'Esto nunca fue una familia, hijo. Es suelo urbanizable. Firmado, sellado… y ahora, compulsado.'],
      ],
      fase2: () => [
        ['Don Fermín', 'Je… ¿Creías que solo sé de papeles? Treinta años viendo entrenar al viejo desde la mesa de al lado.'],
        ['Don Fermín', 'Algo se me quedó.'],
      ],
      despues: (j: Juego) => [
        ['Don Fermín', 'El sello… no vale nada… sin alguien que lo empuñe…'],
        'Rai guarda la katana.',
        'No lo empuña nadie. Por eso vale.',
        { f: () => j.verEscena(GUION.final, () => { j.pon('fin'); j.guardar(); j.modo = 'creditos'; j.congelado = 0; j.musica = 'creditos'; }) },
      ],
    },
  } as Record<string, { antes: (j: Juego) => Paso[]; despues: (j: Juego) => Paso[]; fase2?: (j: Juego) => Paso[] }>,
};
