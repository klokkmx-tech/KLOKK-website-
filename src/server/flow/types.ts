// Tipos de la máquina de estados del demo (brief §04).
// Este módulo no tiene dependencias ni I/O.

export const ESTADOS = [
  'NUEVO',
  'ESPERA_UBIC',
  'ESPERA_TAMANO',
  'ESPERA_GIRO',
  'CALIFICADO',
  'AGENDADO',
  'BAJA',
] as const;
export type Estado = (typeof ESTADOS)[number];

export const TAMANOS = ['tam_menos_25', 'tam_25_100', 'tam_mas_100'] as const;
export type TamanoId = (typeof TAMANOS)[number];

export const GIROS = [
  'giro_construccion',
  'giro_restaurantes',
  'giro_comercio',
  'giro_manufactura',
  'giro_inmobiliaria',
  'giro_servicios',
  'giro_seguridad',
  'giro_logistica',
  'giro_otro',
] as const;
export type GiroId = (typeof GIROS)[number];

export const CONSENT_IDS = ['consent_si', 'consent_no'] as const;

/** Subconjunto del lead que la máquina necesita para decidir. Fechas en ISO-8601. */
export interface Lead {
  estado: Estado;
  estado_ts: string;
  tamano: TamanoId | null;
  giro: GiroId | null;
  consentimiento: boolean | null;
  consentimiento_ts: string | null;
  baja_ts: string | null;
  agenda_ts: string | null;
  recordatorio_ubic_ts: string | null;
  ultimo_aviso_texto_ts: string | null;
}

/** Eventos de entrada de la máquina. ESTATUS no pasa por aquí: no transiciona. */
export type Evento =
  | { tipo: 'ENTRADA' }
  | { tipo: 'BAJA' }
  | { tipo: 'UBICACION'; lat: number; lon: number }
  | { tipo: 'BOTON_TAMANO'; id: TamanoId }
  | { tipo: 'LISTA_GIRO'; id: GiroId }
  | { tipo: 'BOTON_CONSENT'; valor: 'si' | 'no' }
  /** Texto no reconocido, media, sticker, contacto, reacción o id interactivo desconocido. */
  | { tipo: 'TEXTO_LIBRE'; resumen: string }
  | { tipo: 'TIMEOUT_UBIC' }
  | { tipo: 'CLIC_AGENDA' };

export type ClaveMensaje = 'M1' | 'M1b' | 'M2' | 'M3' | 'M4' | 'M5' | 'M6' | 'M7' | 'M8' | 'M9';

/** Acciones que el ejecutor (con I/O) realiza en el orden recibido. */
export type Accion =
  | { tipo: 'CREAR_LEAD' }
  | { tipo: 'ENVIAR'; clave: ClaveMensaje }
  | { tipo: 'CREAR_REGISTRO'; lat: number; lon: number }
  | { tipo: 'GENERAR_PDF' }
  | { tipo: 'GUARDAR_TAMANO'; id: TamanoId }
  | { tipo: 'GUARDAR_GIRO'; id: GiroId }
  | { tipo: 'GUARDAR_CONSENT'; valor: boolean }
  | { tipo: 'GUARDAR_BAJA' }
  | { tipo: 'GUARDAR_AGENDA' }
  | { tipo: 'MARCAR_RECORDATORIO' }
  /** Al entrar a ESPERA_UBIC desde otro estado: limpia recordatorio_ubic_ts. */
  | { tipo: 'REINICIAR_RECORDATORIO' }
  | { tipo: 'PROGRAMAR_PLANTILLAS' }
  | { tipo: 'CANCELAR_PLANTILLAS'; motivo: 'baja' | 'agenda' | 'respuesta' }
  | { tipo: 'CORREO_CALIFICADO' }
  | { tipo: 'CORREO_AVISO_TEXTO' }
  | { tipo: 'REDIRIGIR' };

export interface Resultado {
  estado: Estado;
  acciones: Accion[];
}
