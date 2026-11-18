// Estructura del "Reporte de resultados de redes sociales" de Prisma CN.
// El formulario y el reporte final se generan a partir de esta misma lista,
// así que para agregar o quitar un campo basta con cambiarlo aquí.
//
// Tipos de campo:
//   texto     una línea
//   parrafo   varias líneas
//   metricas  tabla con filas fijas (métricas) y columnas actual / anterior;
//             la variación se calcula sola
//   tabla     tabla con filas que se pueden agregar
//
// formato de una fila o columna: 'numero' | 'porcentaje' | 'dinero' | 'texto'
// auto: true  → se llena con "Traer datos de Postiz" (se puede corregir a mano)

const COLUMNAS_PERIODO = [
  { clave: 'actual', titulo: 'Este periodo' },
  { clave: 'anterior', titulo: 'Periodo anterior' },
];

const SECCIONES = [
  {
    clave: 'resumen',
    titulo: 'Resumen ejecutivo',
    campos: [
      {
        tipo: 'parrafo',
        clave: 'frase',
        etiqueta: 'Conclusión del mes (una frase)',
        ayuda: 'Ej. "Crecimos 18% en alcance, pero los mensajes por WhatsApp se mantuvieron igual; el siguiente mes nos enfocamos en convertir esa atención en conversaciones."',
      },
      {
        tipo: 'tabla',
        clave: 'kpis',
        titulo: 'KPI principales',
        filasMin: 3,
        especial: 'kpis',
        columnas: [
          { clave: 'kpi', titulo: 'KPI', formato: 'texto' },
          { clave: 'actual', titulo: 'Este periodo', formato: 'numero' },
          { clave: 'anterior', titulo: 'Periodo anterior', formato: 'numero' },
          { clave: 'meta', titulo: 'Meta', formato: 'numero' },
        ],
      },
      { tipo: 'parrafo', clave: 'logro', etiqueta: 'Logro del mes', ayuda: 'Lo más importante que salió bien, con su número.' },
      { tipo: 'parrafo', clave: 'alerta', etiqueta: 'Alerta del mes', ayuda: 'Lo que requiere atención y qué vamos a hacer al respecto.' },
    ],
  },
  {
    clave: 'objetivos',
    titulo: 'Objetivos del periodo',
    intro: 'Cada número de este reporte se lee contra lo que acordamos lograr.',
    campos: [
      {
        tipo: 'tabla',
        clave: 'filas',
        filasMin: 3,
        columnas: [
          { clave: 'negocio', titulo: 'Objetivo de negocio', formato: 'texto' },
          { clave: 'redes', titulo: 'Objetivo en redes', formato: 'texto' },
          { clave: 'kpi', titulo: 'KPI que lo mide', formato: 'texto' },
          { clave: 'meta', titulo: 'Meta del periodo', formato: 'texto' },
        ],
      },
    ],
  },
  {
    clave: 'embudo',
    titulo: 'Resultados por etapa del embudo',
    campos: [
      { tipo: 'parrafo', clave: 'frase', etiqueta: 'En qué etapa estuvo el avance y en cuál el freno (una frase)' },
      {
        tipo: 'metricas',
        clave: 'visibilidad',
        titulo: 'Visibilidad: ¿cuántas personas nos vieron?',
        columnas: COLUMNAS_PERIODO,
        filas: [
          { clave: 'alcance', etiqueta: 'Alcance (cuentas únicas)', formato: 'numero', auto: true },
          { clave: 'impresiones', etiqueta: 'Impresiones', formato: 'numero', auto: true },
          { clave: 'visitas', etiqueta: 'Visitas al perfil', formato: 'numero' },
          { clave: 'seguidores', etiqueta: 'Seguidores totales', formato: 'numero' },
          { clave: 'nuevos', etiqueta: 'Seguidores nuevos (netos)', formato: 'numero', auto: true },
        ],
      },
      { tipo: 'parrafo', clave: 'visibilidadQue', etiqueta: 'Qué significa (visibilidad)' },
      {
        tipo: 'metricas',
        clave: 'interaccion',
        titulo: 'Interacción: ¿les importó lo que vieron?',
        columnas: COLUMNAS_PERIODO,
        filas: [
          { clave: 'engagement', etiqueta: 'Tasa de engagement (%)', formato: 'porcentaje', auto: true, calculo: 'engagement' },
          { clave: 'likes', etiqueta: 'Likes', formato: 'numero', auto: true },
          { clave: 'comentarios', etiqueta: 'Comentarios', formato: 'numero', auto: true },
          { clave: 'guardados', etiqueta: 'Guardados', formato: 'numero', auto: true },
          { clave: 'compartidos', etiqueta: 'Compartidos', formato: 'numero', auto: true },
        ],
      },
      { tipo: 'parrafo', clave: 'interaccionQue', etiqueta: 'Qué significa (interacción)' },
      {
        tipo: 'metricas',
        clave: 'conversion',
        titulo: 'Conversión: ¿se acercaron a comprar?',
        columnas: COLUMNAS_PERIODO,
        filas: [
          { clave: 'clics', etiqueta: 'Clics al link del perfil o publicación', formato: 'numero', auto: true },
          { clave: 'abrieronWhatsapp', etiqueta: 'Abrieron el chat de WhatsApp (enlace rastreable)', formato: 'numero', auto: true },
          { clave: 'dm', etiqueta: 'Mensajes directos (DM)', formato: 'numero' },
          { clave: 'whatsapp', etiqueta: 'Conversaciones por WhatsApp', formato: 'numero' },
          { clave: 'ventas', etiqueta: 'Citas, cotizaciones o ventas reportadas por el negocio', formato: 'numero', auto: true },
        ],
      },
      { tipo: 'parrafo', clave: 'conversionQue', etiqueta: 'Qué significa (conversión)' },
    ],
  },
  {
    clave: 'porRed',
    titulo: 'Desglose por red',
    opcional: true,
    ayuda: 'Solo si el cliente tiene más de una red activa.',
    campos: [
      {
        tipo: 'tabla',
        clave: 'filas',
        filasMin: 3,
        columnas: [
          { clave: 'red', titulo: 'Red', formato: 'texto' },
          { clave: 'seguidores', titulo: 'Seguidores', formato: 'numero' },
          { clave: 'alcance', titulo: 'Alcance', formato: 'numero', auto: true },
          { clave: 'engagement', titulo: 'Engagement (%)', formato: 'porcentaje', auto: true },
          { clave: 'clicsMensajes', titulo: 'Clics + mensajes', formato: 'numero' },
          { clave: 'publicaciones', titulo: 'Publicaciones', formato: 'numero', auto: true },
        ],
      },
      { tipo: 'parrafo', clave: 'que', etiqueta: 'Qué significa', ayuda: 'Qué red está aportando más al objetivo y si conviene mover esfuerzo de una a otra.' },
    ],
  },
  {
    clave: 'contenido',
    titulo: 'Análisis de contenido',
    campos: [
      { tipo: 'parrafo', clave: 'frase', etiqueta: 'Qué tipo de contenido mueve más el objetivo del cliente (una frase)' },
      {
        tipo: 'tabla',
        clave: 'mejores',
        titulo: 'Las 3 publicaciones con mejor resultado',
        filasMin: 3,
        filasMax: 3,
        numerada: true,
        columnas: [
          { clave: 'publicacion', titulo: 'Publicación', formato: 'texto', auto: true },
          { clave: 'enlace', titulo: 'Enlace', formato: 'enlace', auto: true },
          { clave: 'formato', titulo: 'Formato', formato: 'texto', auto: true },
          { clave: 'alcance', titulo: 'Alcance', formato: 'numero', auto: true },
          { clave: 'interacciones', titulo: 'Interacciones', formato: 'numero', auto: true },
          { clave: 'porque', titulo: 'Por qué funcionó', formato: 'texto' },
        ],
      },
      {
        tipo: 'tabla',
        clave: 'peores',
        titulo: 'Las 3 publicaciones con menor resultado',
        filasMin: 3,
        filasMax: 3,
        numerada: true,
        columnas: [
          { clave: 'publicacion', titulo: 'Publicación', formato: 'texto', auto: true },
          { clave: 'enlace', titulo: 'Enlace', formato: 'enlace', auto: true },
          { clave: 'formato', titulo: 'Formato', formato: 'texto', auto: true },
          { clave: 'alcance', titulo: 'Alcance', formato: 'numero', auto: true },
          { clave: 'interacciones', titulo: 'Interacciones', formato: 'numero', auto: true },
          { clave: 'porque', titulo: 'Por qué no funcionó', formato: 'texto' },
        ],
      },
      {
        tipo: 'metricas',
        clave: 'formatos',
        titulo: 'Rendimiento por formato',
        primeraColumna: 'Formato',
        columnas: [
          { clave: 'publicaciones', titulo: 'Publicaciones', formato: 'numero' },
          { clave: 'alcance', titulo: 'Alcance promedio', formato: 'numero' },
          { clave: 'engagement', titulo: 'Engagement promedio (%)', formato: 'porcentaje' },
        ],
        sinVariacion: true,
        filas: [
          { clave: 'video', etiqueta: 'Reel / video', auto: true },
          { clave: 'carrusel', etiqueta: 'Carrusel', auto: true },
          { clave: 'imagen', etiqueta: 'Imagen estática', auto: true },
          { clave: 'historias', etiqueta: 'Historias' },
        ],
      },
      {
        tipo: 'tabla',
        clave: 'pilares',
        titulo: 'Rendimiento por pilar de contenido',
        filasMin: 3,
        ayuda: 'Los pilares salen de las etiquetas (tags) que pongas a las publicaciones en Postiz.',
        columnas: [
          { clave: 'pilar', titulo: 'Pilar', formato: 'texto', auto: true },
          { clave: 'publicaciones', titulo: 'Publicaciones', formato: 'numero', auto: true },
          { clave: 'alcance', titulo: 'Alcance promedio', formato: 'numero', auto: true },
          { clave: 'engagement', titulo: 'Engagement promedio (%)', formato: 'porcentaje', auto: true },
        ],
      },
      { tipo: 'parrafo', clave: 'que', etiqueta: 'Qué significa (contenido)' },
    ],
  },
  {
    clave: 'pauta',
    titulo: 'Pauta',
    opcional: true,
    ayuda: 'Solo si hubo inversión en anuncios durante el periodo.',
    campos: [
      {
        tipo: 'tabla',
        clave: 'campanas',
        filasMin: 2,
        especial: 'pauta',
        ayuda: 'Una fila por campaña. Puedes llenarla a mano o importar el archivo que exporta cada plataforma (abajo). Costo por resultado, CPM, CPC y CTR se calculan solos. La foto es el anuncio o creativo principal.',
        importarCsv: true,
        columnas: [
          { clave: 'plataforma', titulo: 'Plataforma', formato: 'opciones', opciones: ['Meta', 'TikTok', 'Google Ads'] },
          { clave: 'campana', titulo: 'Campaña', formato: 'texto' },
          { clave: 'objetivo', titulo: 'Objetivo', formato: 'texto' },
          { clave: 'inversion', titulo: 'Inversión (MXN)', formato: 'dinero' },
          { clave: 'impresiones', titulo: 'Impresiones', formato: 'numero' },
          { clave: 'alcance', titulo: 'Alcance', formato: 'numero' },
          { clave: 'clics', titulo: 'Clics', formato: 'numero' },
          { clave: 'resultados', titulo: 'Resultados', formato: 'numero' },
          { clave: 'imagen', titulo: 'Foto del anuncio', formato: 'imagen' },
        ],
      },
      { tipo: 'parrafo', clave: 'que', etiqueta: 'Qué significa', ayuda: 'Si la inversión se tradujo en resultados para el negocio y qué ajustar en el presupuesto.' },
    ],
  },
  {
    clave: 'comunidad',
    titulo: 'Comunidad y atención',
    campos: [
      {
        tipo: 'metricas',
        clave: 'atencion',
        columnas: COLUMNAS_PERIODO,
        sinVariacion: true,
        filas: [
          { clave: 'mensajes', etiqueta: 'Mensajes recibidos', formato: 'numero' },
          { clave: 'tiempo', etiqueta: 'Tiempo promedio de respuesta', formato: 'texto' },
          { clave: 'respondidos', etiqueta: 'Comentarios respondidos (%)', formato: 'porcentaje' },
        ],
      },
      { tipo: 'texto', clave: 'positivo', etiqueta: 'Comentario positivo destacado' },
      { tipo: 'texto', clave: 'negativo', etiqueta: 'Comentario negativo o queja destacada' },
      { tipo: 'texto', clave: 'atendio', etiqueta: 'Cómo se atendió' },
      { tipo: 'texto', clave: 'pregunta', etiqueta: 'Pregunta que se repite' },
      { tipo: 'texto', clave: 'oportunidad', etiqueta: 'Oportunidad de contenido' },
    ],
  },
  {
    clave: 'audiencia',
    titulo: 'Audiencia',
    opcional: true,
    ayuda: 'Cada 3 meses o cuando haya un cambio relevante. Si no cambió nada, déjala vacía y no aparece.',
    campos: [
      {
        tipo: 'metricas',
        clave: 'datos',
        primeraColumna: 'Dato',
        sinVariacion: true,
        columnas: [
          { clave: 'actual', titulo: 'Actual', formato: 'texto' },
          { clave: 'cambio', titulo: 'Cambio vs. trimestre anterior', formato: 'texto' },
        ],
        filas: [
          { clave: 'edad', etiqueta: 'Rango de edad principal', formato: 'texto' },
          { clave: 'genero', etiqueta: 'Género', formato: 'texto' },
          { clave: 'ciudades', etiqueta: 'Ciudades principales', formato: 'texto' },
          { clave: 'horas', etiqueta: 'Días y horas de mayor actividad', formato: 'texto' },
        ],
      },
      { tipo: 'parrafo', clave: 'que', etiqueta: 'Qué significa', ayuda: '¿La audiencia se parece al cliente que el negocio quiere atraer?' },
    ],
  },
  {
    clave: 'aprendizajes',
    titulo: 'Aprendizajes',
    campos: [
      {
        tipo: 'tabla',
        clave: 'filas',
        filasMin: 3,
        columnas: [
          { clave: 'funciono', titulo: 'Qué funcionó', formato: 'texto' },
          { clave: 'nofunciono', titulo: 'Qué no funcionó', formato: 'texto' },
          { clave: 'hipotesis', titulo: 'Nuestra hipótesis', formato: 'texto' },
        ],
      },
    ],
  },
  {
    clave: 'plan',
    titulo: 'Plan del siguiente periodo',
    campos: [
      {
        tipo: 'tabla',
        clave: 'acciones',
        filasMin: 3,
        columnas: [
          { clave: 'accion', titulo: 'Acción', formato: 'texto' },
          { clave: 'objetivo', titulo: 'Objetivo que ataca', formato: 'texto' },
          { clave: 'responsable', titulo: 'Responsable', formato: 'texto' },
          { clave: 'fecha', titulo: 'Fecha', formato: 'texto' },
        ],
      },
      { tipo: 'parrafo', clave: 'pruebas', etiqueta: 'Pruebas que haremos', ayuda: 'Ej. probar dos ganchos distintos en reels, cambiar horario de publicación.' },
      { tipo: 'parrafo', clave: 'metas', etiqueta: 'Metas ajustadas para el siguiente periodo', ayuda: 'KPI y meta nueva, si cambia.' },
      { tipo: 'parrafo', clave: 'necesitamos', etiqueta: 'Lo que necesitamos de ti', ayuda: 'Ej. fotos del producto, registro de ventas que llegaron por redes, aprobación del calendario.' },
    ],
  },
  {
    clave: 'metodologia',
    titulo: 'Fuentes y metodología',
    anexo: true,
    campos: [
      { tipo: 'texto', clave: 'fuentes', etiqueta: 'Fuente de los datos', ayuda: 'Ej. Estadísticas de Meta Business Suite / TikTok / Administrador de anuncios / registro del negocio.' },
      { tipo: 'texto', clave: 'fecha', etiqueta: 'Fecha de extracción' },
      { tipo: 'parrafo', clave: 'notas', etiqueta: 'Notas', ayuda: 'Cambios en la medición, días sin datos, etc.' },
    ],
  },
];

// Se imprime siempre al final, en el anexo.
const GLOSARIO = [
  ['Alcance', 'Cuántas personas distintas vieron tu contenido.'],
  ['Impresiones', 'Cuántas veces se mostró tu contenido; una persona puede verlo varias veces.'],
  ['Tasa de engagement', 'De cada 100 personas que te vieron, cuántas reaccionaron (like, comentario, guardado o compartido).'],
  ['Guardados', 'Personas que guardaron tu publicación para verla después; señal de que les fue útil.'],
  ['Compartidos', 'Personas que enviaron tu publicación a alguien más.'],
  ['Clics al link', 'Personas que salieron de la red social para ir a tu sitio, WhatsApp o tienda.'],
  ['CTR', 'De cada 100 personas que vieron un anuncio, cuántas le dieron clic.'],
  ['Costo por resultado', 'Cuánto costó en anuncios cada mensaje, clic o venta conseguida.'],
];

const FORMULA_ENGAGEMENT =
  'Tasa de engagement = interacciones (likes + comentarios + guardados + compartidos) ÷ alcance × 100.';

module.exports = { SECCIONES, GLOSARIO, FORMULA_ENGAGEMENT };
