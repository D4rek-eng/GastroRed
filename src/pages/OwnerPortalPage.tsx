import { useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowRight, Clock3, Save, Store } from 'lucide-react'
import { Link } from 'react-router-dom'
import { restaurantService } from '../features/restaurants/service'
import { useOwnerAuth } from '../features/auth/useOwnerAuth'
import type { Restaurant } from '../types'

export function OwnerPortalPage() {
  const queryClient = useQueryClient()
  const { session, signOut } = useOwnerAuth()
  const { data: restaurants = [], isLoading, isError } = useQuery({
    queryKey: ['owner-restaurants', session?.restaurantIds],
    queryFn: ({ signal }) => restaurantService.listOwned(session?.restaurantIds ?? [], signal),
  })
  const [selectedId, setSelectedId] = useState('')
  const restaurant = restaurants.find((item) => item.id === selectedId) ?? restaurants[0]
  const [draft, setDraft] = useState<{
    id: string
    hours: string
    availableTimes: string
    reservationPolicy: string
  } | null>(null)
  const [message, setMessage] = useState('')
  const editorValues = restaurant
    ? draft?.id === restaurant.id
      ? draft
      : {
          id: restaurant.id,
          hours: restaurant.hours,
          availableTimes: restaurant.availableTimes.join(', '),
          reservationPolicy: restaurant.reservationPolicy,
        }
    : null

  const mutation = useMutation({
    mutationFn: ({ id, settings }: {
      id: string
      settings: Pick<Restaurant, 'hours' | 'availableTimes' | 'reservationPolicy'>
    }) => restaurantService.updateOwnerSettings(id, settings),
    onSuccess: (updated) => {
      queryClient.setQueryData<Restaurant>(['restaurant', updated.id], updated)
      void queryClient.invalidateQueries({ queryKey: ['owner-restaurants'] })
      void queryClient.invalidateQueries({ queryKey: ['restaurants'] })
      setMessage(import.meta.env.VITE_DEMO_MODE !== 'false'
        ? 'Cambios guardados. En modo demo se conservan en este navegador.'
        : 'Cambios guardados.')
    },
    onError: (error) => setMessage(error instanceof Error ? error.message : 'No se pudieron guardar los cambios.'),
  })

  function saveSettings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!restaurant || !editorValues) return
    const times = [...new Set(editorValues.availableTimes.split(',').map((time) => time.trim()).filter(Boolean))]
    if (times.some((time) => !/^([01]\d|2[0-3]):[0-5]\d$/.test(time))) {
      setMessage('Escribe los horarios en formato 24 horas, separados por comas (por ejemplo: 13:00, 19:30).')
      return
    }
    if (!times.length) {
      setMessage('Añade al menos un horario disponible.')
      return
    }
    mutation.mutate({
      id: restaurant.id,
      settings: {
        hours: editorValues.hours.trim(),
        availableTimes: times,
        reservationPolicy: editorValues.reservationPolicy.trim(),
      },
    })
  }

  async function leavePortal() {
    setMessage('')
    try {
      await signOut()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'No se pudo cerrar la sesión.')
    }
  }

  return (
    <div className="page-container owner-page">
      <div className="breadcrumb"><Link to="/">Inicio</Link><span>/</span><span>Acceso restaurantes</span></div>
      <section className="owner-intro">
        <span className="owner-icon"><Store size={21} /></span>
        <span className="eyebrow">PORTAL PARA RESTAURANTES</span>
        <h1>Tu restaurante,<br /><em>a tu manera.</em></h1>
        <p>Actualiza horarios, turnos disponibles y condiciones de reserva que se muestran en tu ficha.</p>
        <span className="owner-demo-note">Panel demo · Los cambios se guardan en este navegador. En producción, el backend valida la cuenta y los restaurantes autorizados.</span>
      </section>

      <section className="owner-editor">
        <div className="owner-editor-heading">
          <div><span className="eyebrow">GESTIÓN DEL LOCAL</span><h2>Horarios y disponibilidad</h2></div>
          <div className="owner-editor-actions"><span>{session?.email}</span><button className="button button-outline" type="button" onClick={() => void leavePortal()}>Cerrar sesión</button><Clock3 size={20} /></div>
        </div>
        {isLoading && <p className="reviews-state">Cargando restaurantes…</p>}
        {isError && <p className="reviews-state reviews-error" role="alert">No se pudieron cargar los restaurantes. Recarga la página para intentar de nuevo.</p>}
        {!isLoading && !isError && restaurants.length === 0 && <p className="reviews-state">No hay restaurantes para administrar.</p>}
        {!isLoading && !isError && restaurant && editorValues && (
          <form className="owner-form" onSubmit={saveSettings}>
            <label className="contact-field">Restaurante
              <select value={restaurant.id} onChange={(event) => { setSelectedId(event.target.value); setMessage('') }}>
                {restaurants.map((item) => <option value={item.id} key={item.id}>{item.name} · {item.neighborhood}</option>)}
              </select>
            </label>
            <label className="contact-field">Horario de atención
              <input value={editorValues.hours} onChange={(event) => setDraft({ ...editorValues, hours: event.target.value })} required maxLength={120} placeholder="Mar–sáb · 13:00–22:00" />
            </label>
            <label className="contact-field">Turnos disponibles
              <input value={editorValues.availableTimes} onChange={(event) => setDraft({ ...editorValues, availableTimes: event.target.value })} required placeholder="13:00, 14:00, 19:30" />
              <small>Formato de 24 horas. Separa los turnos con comas.</small>
            </label>
            <label className="contact-field">Política de reservas
              <textarea value={editorValues.reservationPolicy} onChange={(event) => setDraft({ ...editorValues, reservationPolicy: event.target.value })} maxLength={240} rows={3} placeholder="Indica condiciones importantes para reservar" />
            </label>
            <button className="button button-primary" type="submit" disabled={mutation.isPending}>
              <Save size={15} /> {mutation.isPending ? 'Guardando…' : 'Guardar cambios'}
            </button>
            {message && <p className={`owner-message${mutation.isError || message.startsWith('Escribe') || message.startsWith('Añade') ? ' error' : ''}`} role="status">{message}</p>}
          </form>
        )}
        <Link className="text-link owner-view-link" to="/restaurantes">Ver fichas de restaurantes <ArrowRight size={15} /></Link>
      </section>
    </div>
  )
}
