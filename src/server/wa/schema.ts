// Validación del webhook de la Cloud API (campo `messages`) con zod.
// Solo se tipifica lo que el demo usa; el resto pasa intacto (`loose`).

import { z } from 'zod';

const Interactivo = z.union([
  z.looseObject({
    type: z.literal('button_reply'),
    button_reply: z.looseObject({ id: z.string(), title: z.string() }),
  }),
  z.looseObject({
    type: z.literal('list_reply'),
    list_reply: z.looseObject({ id: z.string(), title: z.string(), description: z.string().optional() }),
  }),
  // Otros interactivos (nfm_reply, etc.) se tratan como texto libre.
  z.looseObject({ type: z.string() }),
]);

export const MensajeWebhook = z.looseObject({
  from: z.string().min(1),
  id: z.string().min(1),
  timestamp: z.string(),
  type: z.string(),
  text: z.looseObject({ body: z.string() }).optional(),
  location: z
    .looseObject({ latitude: z.number(), longitude: z.number(), name: z.string().optional(), address: z.string().optional() })
    .optional(),
  interactive: Interactivo.optional(),
});
export type MensajeWebhook = z.infer<typeof MensajeWebhook>;

export const EstatusWebhook = z.looseObject({
  id: z.string().min(1),
  status: z.string(),
  timestamp: z.string(),
  recipient_id: z.string().optional(),
  errors: z.array(z.looseObject({ code: z.number().optional(), title: z.string().optional() })).optional(),
});
export type EstatusWebhook = z.infer<typeof EstatusWebhook>;

export const ContactoWebhook = z.looseObject({
  wa_id: z.string(),
  profile: z.looseObject({ name: z.string().optional() }).optional(),
});

export const ValorWebhook = z.looseObject({
  messaging_product: z.literal('whatsapp'),
  metadata: z.looseObject({ display_phone_number: z.string().optional(), phone_number_id: z.string() }),
  contacts: z.array(ContactoWebhook).optional(),
  messages: z.array(MensajeWebhook).optional(),
  statuses: z.array(EstatusWebhook).optional(),
});
export type ValorWebhook = z.infer<typeof ValorWebhook>;

export const PayloadWebhook = z.looseObject({
  object: z.literal('whatsapp_business_account'),
  entry: z.array(
    z.looseObject({
      id: z.string(),
      changes: z.array(z.looseObject({ field: z.string(), value: z.unknown() })),
    }),
  ),
});
export type PayloadWebhook = z.infer<typeof PayloadWebhook>;

/** Extrae los `value` del campo `messages` que pasan la validación. */
export function valoresDeMensajes(payload: PayloadWebhook): ValorWebhook[] {
  const out: ValorWebhook[] = [];
  for (const entry of payload.entry) {
    for (const change of entry.changes) {
      if (change.field !== 'messages') continue;
      const r = ValorWebhook.safeParse(change.value);
      if (r.success) out.push(r.data);
    }
  }
  return out;
}
