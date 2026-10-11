-- DEMO-WEB-01 · esquema inicial (brief §07).
-- Proyecto de Supabase exclusivo del demo. Acceso solo con la llave de servicio.
-- RLS activado en todas las tablas SIN políticas: anon y authenticated no leen ni escriben.

create type estado_lead as enum (
  'NUEVO', 'ESPERA_UBIC', 'ESPERA_TAMANO', 'ESPERA_GIRO',
  'CALIFICADO', 'AGENDADO', 'BAJA'
);

create table leads (
  id                     uuid primary key default gen_random_uuid(),
  wa_id                  text not null unique,          -- messages[].from, sin normalizar
  nombre_perfil          text,                          -- contacts[].profile.name, puede ser null
  estado                 estado_lead not null default 'NUEVO',
  estado_ts              timestamptz not null default now(),
  tamano                 text check (tamano in ('tam_menos_25', 'tam_25_100', 'tam_mas_100')),
  giro                   text,                          -- id de fila de M5 (giro_*)
  consentimiento         boolean,                       -- null = no ha respondido M7
  consentimiento_ts      timestamptz,
  baja_ts                timestamptz,                   -- permanente: nunca plantillas, nunca M7
  agenda_token           text not null unique,          -- 32 chars base64url, generado por la app
  agenda_ts              timestamptz,                   -- primer clic en /a/<token>
  recordatorio_ubic_ts   timestamptz,                   -- M1b enviado
  ultimo_entrante_ts     timestamptz,
  ultimo_aviso_texto_ts  timestamptz,                   -- límite 1 correo/lead/hora
  creado_ts              timestamptz not null default now(),
  actualizado_ts         timestamptz not null default now()
);
create index leads_estado_idx on leads (estado, estado_ts);

create table mensajes (
  id            bigint generated always as identity primary key,
  lead_id       uuid references leads (id) on delete cascade,
  wa_id         text not null,
  direccion     text not null check (direccion in ('in', 'out')),
  tipo          text not null,            -- text, location, interactive, document, template, ...
  clave         text,                     -- M1, M1b, M2..M9, T1..T3 (solo salientes)
  meta_msg_id   text unique,              -- wamid: dedupe de entrantes, correlación de estatus
  estatus       text,                     -- accepted, sent, delivered, read, failed
  estatus_ts    timestamptz,
  error         jsonb,
  cuerpo        jsonb not null,           -- payload crudo, sin tokens ni cabeceras
  ts            timestamptz not null default now()
);
create index mensajes_lead_ts_idx on mensajes (lead_id, ts);

create table registros (
  id            bigint generated always as identity primary key,
  lead_id       uuid not null references leads (id) on delete cascade,
  folio         text not null unique,     -- DEMO-AAAAMMDD-NNNN
  evento        text not null default 'Entrada',
  ts            timestamptz not null,     -- hora de servidor al procesar la ubicación
  lat           numeric(9, 6) not null,   -- redondeado con toFixed(6) antes de guardar y hashear
  lon           numeric(9, 6) not null,
  hash_sha256   char(64) not null,
  media_id      text,                     -- id en la Media API de Meta (caduca a los 30 días)
  mensaje_id    bigint references mensajes (id),
  creado_ts     timestamptz not null default now()
);
create index registros_lead_idx on registros (lead_id, ts);

create table folios_dia (
  fecha   date primary key,               -- fecha en America/Merida
  ultimo  integer not null default 0
);

-- Incremento atómico del consecutivo diario. Devuelve el NNNN ya reservado.
create function siguiente_folio(p_fecha date) returns integer
language sql as $$
  insert into folios_dia (fecha, ultimo) values (p_fecha, 1)
  on conflict (fecha) do update set ultimo = folios_dia.ultimo + 1
  returning ultimo;
$$;

create table plantillas_programadas (
  id                 bigint generated always as identity primary key,
  lead_id            uuid not null references leads (id) on delete cascade,
  plantilla          text not null check (plantilla in ('T1', 'T2', 'T3')),
  programado_para    timestamptz not null,
  estado             text not null default 'pendiente'
                     check (estado in ('pendiente', 'enviada', 'cancelada', 'fallida')),
  enviado_ts         timestamptz,
  mensaje_id         bigint references mensajes (id),
  motivo             text,                -- motivo de cancelación o error de envío
  creado_ts          timestamptz not null default now(),
  unique (lead_id, plantilla)
);
create index plantillas_pendientes_idx on plantillas_programadas (estado, programado_para);

-- Bitácora de hechos para el resumen diario y la depuración.
create table eventos (
  id        bigint generated always as identity primary key,
  lead_id   uuid references leads (id) on delete cascade,
  tipo      text not null,   -- LEAD_NUEVO, ENTRADA, UBICACION, PDF, M4, M5, M6, M7, CONSENT_SI,
                             -- CONSENT_NO, BAJA, CLIC_AGENDA, TEXTO_LIBRE, RECORDATORIO,
                             -- PLANTILLA_ENVIADA, PLANTILLA_CANCELADA, CORREO_CALIFICADO,
                             -- CORREO_AVISO, CORREO_RESUMEN
  detalle   jsonb,
  ts        timestamptz not null default now()
);
create index eventos_ts_idx on eventos (ts);

-- Transición atómica de estado (brief §07, «Reglas de acceso y concurrencia»).
-- Devuelve true si el lead estaba en el estado esperado y se actualizó.
create function transicionar_lead(p_id uuid, p_esperado estado_lead, p_nuevo estado_lead)
returns boolean
language sql as $$
  with u as (
    update leads
       set estado = p_nuevo,
           estado_ts = case when p_nuevo = p_esperado then estado_ts else now() end,
           actualizado_ts = now()
     where id = p_id and estado = p_esperado
     returning 1
  )
  select exists (select 1 from u);
$$;

alter table leads                  enable row level security;
alter table mensajes               enable row level security;
alter table registros              enable row level security;
alter table folios_dia             enable row level security;
alter table plantillas_programadas enable row level security;
alter table eventos                enable row level security;

revoke all on all tables    in schema public from anon, authenticated;
revoke all on all functions in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
