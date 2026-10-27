import { z } from 'zod'

export const reservationContactSchema = z.object({
  name: z.string().trim().min(2, 'Escribe tu nombre (mínimo 2 caracteres).'),
  email: z.email('Escribe un correo electrónico válido.'),
})
