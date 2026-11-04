# Aceptación · correspondencia §10 → prueba o script

`npm run aceptacion` construye el sitio y corre toda la suite. Las casillas marcadas
«en vivo» además necesitan el entorno real y las corre JP a mano.

| # | Criterio (resumen) | Dónde se verifica |
|---|---|---|
| A1 | GET /api/wa devuelve hub.challenge; 403 si el token no coincide | `tests/webhook.test.ts` · «GET /api/wa (A1)» |
| A2 | POST sin firma o con firma inválida → 401 y nada escrito | `tests/webhook.test.ts` · «POST /api/wa firma (A2)» |
| A3 | Mismo meta_msg_id dos veces → un solo mensaje y una sola secuencia | `tests/webhook.test.ts` · «dedupe por meta_msg_id (A3)» |
| A4 | «Entrada» nuevo → ESPERA_UBIC y M1 con aviso de privacidad y solicitud de ubicación | `tests/webhook.test.ts` · «primer mensaje (A4)» |
| A5 | Ubicación → registro, PDF, media, M2 → M3 → M4 | `tests/flujo.test.ts` · «A5» |
| A6 | PDF con EJEMPLO, folio DEMO-AAAAMMDD-NNNN, huella; sin cadenas prohibidas | `tests/pdf.test.ts` |
| A7 | Ningún texto de messages.ts contiene las cadenas prohibidas | `tests/messages.test.ts` · «regla 4» |
| A8 | Huella reproducible desde la fila de registros | `tests/hash.test.ts` y `tests/flujo.test.ts` · «A8» |
| A9 | Folios consecutivos por día de Mérida, empiezan en 0001 | `tests/flujo.test.ts` · «A9» |
| A10 | M4 → M5; M5 → correo calificado, M6 y M7 | `tests/flujo.test.ts` · «A10» |
| A11 | «Sí» programa T1/T2/T3 en ventana hábil; «No» nada; sin mensaje extra | `tests/flujo.test.ts` · «A11» y `tests/horario.test.ts` |
| A12 | «Baja» → M8, cancela plantillas, baja_ts; sin M7 ni plantillas al repetir | `tests/flujo.test.ts` · «baja (A12)» |
| A13 | Lead calificado repite: M1, M2, M3, M6; sin M4, M5, M7 | `tests/flujo.test.ts` · «repetir el demo (A13)» |
| A14 | Texto libre → M9 y correo; segundo en la misma hora solo M9 | `tests/flujo.test.ts` · «texto libre (A14)» |
| A15 | Entrante posterior al consentimiento cancela plantillas | `tests/flujo.test.ts` · «A15» y `tests/machine.test.ts` |
| A16 | /a/<token> → AGENDADO, agenda_ts una vez, cancela, 302; inválido 404; sin teléfonos en URL | `tests/agenda.test.ts` |
| A17 | Cron recordatorios: M1b exactamente una vez a ≥ 10 min en ESPERA_UBIC | `tests/crons.test.ts` · «A17» |
| A18 | Cron seguimiento respeta ventana y guardas | `tests/crons.test.ts` · «A18» |
| A19 | Cron resumen con conteos correctos, incluido sin actividad | `tests/crons.test.ts` · «A19» y `tests/correo.test.ts` |
| A20 | Crons devuelven 401 sin Bearer CRON_SECRET | `tests/crons.test.ts` · «A20» |
| A21 | Estatus actualiza mensajes.estatus sin tocar el lead | `tests/webhook.test.ts` · «estatus (A21)» |
| A22 | Remitente en avisos.klokk.mx; la app no arranca con otro dominio | `tests/correo.test.ts` · «A22» |
| A23 | Sin secretos PUBLIC_; .env.example solo nombres; sin valores reales en el repo | `tests/seguridad.test.ts` · «A23» |
| A24 | RLS activado y cero políticas | `tests/seguridad.test.ts` · «A24» (estático) + **en vivo:** `supabase/verificar_rls.sql` |
| A25 | Sin SDKs de IA; ningún componente importa de src/server | `tests/seguridad.test.ts` · «A25» |
| A26 | Build prerenderiza páginas; solo endpoints en servidor | `tests/sitio.test.ts` · «A26» |
| A27 | CTA del hero a wa.me/<número>?text=Entrada; QR solo en escritorio | `tests/sitio.test.ts` · «A27» |
| A28 | /privacidad-demo existe, prerenderizada, y M1 enlaza a esa URL | `tests/sitio.test.ts` · «A28» |
| A29 | `npm run entorno` imprime ref de Supabase, WABA, número y app sin secretos; falla contra la lista de producción | **script:** `scripts/entorno.ts` |
| A30 | wa_id guardado byte a byte y usado como `to` | `tests/webhook.test.ts` · «A30» |

## Verificaciones en vivo (JP)

1. `npm run entorno` con el `.env` del demo cargado. Debe terminar con «sin coincidencias con producción».
2. `npm run entorno -- --en-vivo`: consulta en modo lectura el número y el WABA en Meta y la tabla `leads` en Supabase.
3. `supabase/verificar_rls.sql` en el editor SQL del proyecto del demo: todas las tablas con `rls = true`, `politicas = 0`, `anon_select = false`.
4. Lista de producción: crea `~/.klokk/produccion.txt` con los refs, ids y dominios de producción (uno por línea). El script falla si el entorno apunta a cualquiera de ellos.
