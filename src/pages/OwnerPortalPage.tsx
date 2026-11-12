import { useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowRight, CalendarDays, Check, Clock3, LogOut, Save, Store } from 'lucide-react'
import { Link } from 'react-router-dom'
import { restaurantService } from '../features/restaurants/service'
import { useOwnerAuth } from '../features/auth/useOwnerAuth'
import type { Restaurant } from '../types'

export function OwnerPortalPage() {
  const queryClient = useQueryClient()
  const { session, signOut } = useOwnerAuth()
  const isDemo = import.meta.env.VITE_DEMO_MODE !== 'false'
  const [section, setSection] = useState<'settings' | 'pending' | 'completed'>('settings')
  const { data: restaurants = [], isLoading, isError } = useQuery({
    queryKey: ['owner-restaurants', session?.restaurantIds],
    queryFn: ({ signal }) => restaurantService.listOwned(session?.restaurantIds ?? [], signal),
  })
  const reservationsQuery = useQuery({
    queryKey: ['owner-reservations', session?.id],
    queryFn: ({ signal }) => restaurantService.listOwnerReservations(signal),
    enabled: !isDemo && session?.role === 'restaurant',
  })
  const reservations = reservationsQuery.data ?? []
  const pendingReservations = reservations.filter((item) => item.status === 'pending' || item.status === 'confirmed')
  const completedReservations = reservations.filter((item) => item.status === 'completed')
  const [selectedId, setSelectedId] = useState('')
  const restaurant = restaurants.find((item) => item.id === selectedId) ?? restaurants[0]
  const [draft, setDraft] = useState<{
    id: string
    hours: string
    availableTimes: string
    reservationPolicy: string
    pricePerPerson: number
    tableAvailability: Record<string, number>
    menuHighlights: Restaurant['menuHighlights']
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
          pricePerPerson: restaurant.pricePerPerson,
          tableAvailability: restaurant.tableAvailability ?? {},
          menuHighlights: restaurant.menuHighlights,
        }
    : null

  const mutation = useMutation({
    mutationFn: ({ id, settings }: {
      id: string
      settings: Pick<Restaurant, 'hours' | 'availableTimes' | 'reservationPolicy' | 'pricePerPerson' | 'menuHighlights'> & {
        tableAvailability: Record<string, number>
      }
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
  const reservationMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: 'confirmed' | 'completed' }) =>
      restaurantService.updateReservationStatus(id, status),
    onSuccess: (updated) => {
      void queryClient.invalidateQueries({ queryKey: ['owner-reservations', session?.id] })
      setMessage(updated.status === 'completed' ? 'Reserva marcada como finalizada.' : 'Reserva confirmada.')
    },
    onError: (error) => setMessage(error instanceof Error ? error.message : 'No se pudo actualizar la reserva.'),
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
    if (times.some((time) => editorValues.tableAvailability[time] === undefined)) {
      setMessage('Define cuántas mesas estarán disponibles en cada turno.')
      return
    }
    if (times.some((time) => !Number.isInteger(editorValues.tableAvailability[time]) || editorValues.tableAvailability[time] < 0 || editorValues.tableAvailability[time] > 200)) {
      setMessage('La disponibilidad debe ser un número entero de 0 a 200 mesas por turno.')
      return
    }
    mutation.mutate({
      id: restaurant.id,
      settings: {
        hours: editorValues.hours.trim(),
        availableTimes: times,
        tableAvailability: Object.fromEntries(times.map((time) => [time, editorValues.tableAvailability[time]])),
        reservationPolicy: editorValues.reservationPolicy.trim(),
        pricePerPerson: editorValues.pricePerPerson,
        menuHighlights: editorValues.menuHighlights,
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
      <div className="breadcrumb"><span>Panel de administración</span></div>
      <section className="owner-intro">
        <div className="owner-intro-main">
          <span className="owner-icon"><Store size={21} /></span>
          <div>
            <h1>Panel de <em>restaurante</em></h1>
            <p>Administra la información de tu local y atiende las reservas desde un solo lugar.</p>
          </div>
        </div>
        <div className="owner-intro-actions">
          <div className="owner-account-meta">
            <span className="owner-account-status"><span />{isDemo ? 'Cuenta demo activa' : session?.planStatus === 'active' ? 'Plan Restaurante activo' : 'Plan pendiente de pago'}</span>
            <span>{session?.domain ?? session?.email}</span>
          </div>
          <button className="button button-outline owner-signout" type="button" onClick={() => void leavePortal()}>
            <LogOut size={14} /> Cerrar sesión
          </button>
        </div>
        <span className="owner-demo-note">{isDemo
          ? 'Panel demo · Los cambios se guardan en este navegador.'
          : 'La información que actualices se mostrará en la ficha de tu restaurante.'}</span>
      </section>

      <div className="owner-dashboard-layout">
        <nav className="owner-dashboard-tabs" aria-label="Secciones del panel">
          <span className="owner-nav-heading">Gestiona tu local</span>
          <button type="button" className={section === 'settings' ? 'active' : ''} aria-current={section === 'settings' ? 'page' : undefined} onClick={() => { setSection('settings'); setMessage('') }}>
            <Store size={17} /><span><strong>Datos del local</strong><small>Horario, precios y turnos</small></span>
          </button>
          <button type="button" className={section === 'pending' ? 'active' : ''} aria-current={section === 'pending' ? 'page' : undefined} onClick={() => { setSection('pending'); setMessage('') }}>
            <CalendarDays size={17} /><span><strong>Pendientes</strong><small>Solicitudes por atender</small></span>
            {!isDemo && <span className="owner-nav-count">{pendingReservations.length}</span>}
          </button>
          <button type="button" className={section === 'completed' ? 'active' : ''} aria-current={section === 'completed' ? 'page' : undefined} onClick={() => { setSection('completed'); setMessage('') }}>
            <Check size={17} /><span><strong>Finalizadas</strong><small>Reservas completadas</small></span>
            {!isDemo && <span className="owner-nav-count">{completedReservations.length}</span>}
          </button>
          <div className="owner-nav-footnote">
            <span className="owner-account-status"><span />{session?.planStatus === 'active' ? 'Cuenta activa' : 'Cuenta pendiente'}</span>
            <small>{isDemo ? 'Modo de demostración' : 'Tus datos se sincronizan con GastroRed'}</small>
          </div>
        </nav>

        <section className="owner-editor">
          <div className="owner-editor-heading">
            <div>
              <h2>{section === 'settings' ? 'Información del local' : section === 'pending' ? 'Reservas pendientes' : 'Reservas finalizadas'}</h2>
              <p>{section === 'settings'
                ? 'Mantén actualizados los detalles que ven tus clientes.'
                : section === 'pending'
                  ? 'Confirma las solicitudes o márcalas como finalizadas.'
                  : 'Consulta las visitas que ya atendiste.'}</p>
            </div>
            {section === 'settings' && restaurant && <span className="owner-restaurant-chip"><Store size={14} /> {restaurant.name}</span>}
            {section === 'pending' && !isDemo && <span className="owner-section-count">{pendingReservations.length} {pendingReservations.length === 1 ? 'reserva' : 'reservas'}</span>}
            {section === 'completed' && !isDemo && <span className="owner-section-count">{completedReservations.length} {completedReservations.length === 1 ? 'reserva' : 'reservas'}</span>}
          </div>
        {session?.restaurantIds.length === 0 && !isDemo && (
          <div className="demo-note warning-note owner-link-warning" role="status">
            Tu cuenta está activa, pero todavía no está vinculada a una ficha de restaurante. Contacta al equipo de GastroRed para validar y conectar tu local; el panel se habilitará al completar la vinculación.
          </div>
        )}
        {isLoading && <p className="reviews-state">Cargando restaurantes…</p>}
        {isError && <p className="reviews-state reviews-error" role="alert">No se pudieron cargar los restaurantes. Recarga la página para intentar de nuevo.</p>}
        {section === 'settings' && !isLoading && !isError && restaurants.length === 0 && <p className="reviews-state">{import.meta.env.VITE_DEMO_MODE !== 'false'
          ? 'No hay restaurantes para administrar.'
          : 'Tu cuenta de restaurante está activa. La ficha de tu local debe vincularse a la guía antes de editar horarios o reservas.'}</p>}
        {section === 'settings' && !isLoading && !isError && restaurant && editorValues && (
          <form className="owner-form" onSubmit={saveSettings}>
            <div className="owner-settings-grid">
            <label className="contact-field owner-field-wide">Restaurante
              <select value={restaurant.id} onChange={(event) => { setSelectedId(event.target.value); setMessage('') }}>
                {restaurants.map((item) => <option value={item.id} key={item.id}>{item.name} · {item.neighborhood}</option>)}
              </select>
            </label>
            <label className="contact-field">Horario de atención
              <input value={editorValues.hours} onChange={(event) => setDraft({ ...editorValues, hours: event.target.value })} required maxLength={120} placeholder="Mar–sáb · 13:00–22:00" />
            </label>
            <label className="contact-field">Turnos disponibles
              <input value={editorValues.availableTimes} onChange={(event) => {
                const availableTimes = event.target.value
                const validTimes = [...new Set(availableTimes.split(',').map((time) => time.trim()).filter((time) => /^([01]\d|2[0-3]):[0-5]\d$/.test(time)))]
                setDraft({
                  ...editorValues,
                  availableTimes,
                  tableAvailability: Object.fromEntries(validTimes.map((time) => [
                    time,
                    editorValues.tableAvailability[time] ?? 8,
                  ])),
                })
              }} required placeholder="13:00, 14:00, 19:30" />
              <small>Formato de 24 horas. Separa los turnos con comas.</small>
            </label>
            <fieldset className="owner-table-availability owner-field-wide">
              <legend>Mesas disponibles por turno</legend>
              <p>Indica cuántas mesas puedes recibir en cada horario. Cada solicitud de reserva ocupa una mesa.</p>
              {(() => {
                const times = [...new Set(editorValues.availableTimes.split(',').map((time) => time.trim()).filter((time) => /^([01]\d|2[0-3]):[0-5]\d$/.test(time)))]
                return times.length ? <div className="owner-table-grid">
                  {times.map((time) => (
                    <label className="owner-table-row" key={time}>
                      <span><Clock3 size={15} /> {time}</span>
                      <input
                        type="number"
                        min="0"
                        max="200"
                        step="1"
                        inputMode="numeric"
                        aria-label={`Mesas disponibles para las ${time}`}
                        value={editorValues.tableAvailability[time] ?? 8}
                        onChange={(event) => setDraft({
                          ...editorValues,
                          tableAvailability: {
                            ...editorValues.tableAvailability,
                            [time]: event.target.value === '' ? 0 : Number(event.target.value),
                          },
                        })}
                        required
                      />
                      <small>mesas</small>
                    </label>
                  ))}
                </div> : <p className="owner-table-empty">Añade turnos válidos arriba para configurar su disponibilidad.</p>
              })()}
            </fieldset>
            <label className="contact-field owner-field-wide">Política de reservas
              <textarea value={editorValues.reservationPolicy} onChange={(event) => setDraft({ ...editorValues, reservationPolicy: event.target.value })} maxLength={240} rows={3} placeholder="Indica condiciones importantes para reservar" />
            </label>
            <label className="contact-field">Precio promedio por persona (S/)
              <input type="number" min="0" max="5000" step="0.5" value={editorValues.pricePerPerson} onChange={(event) => setDraft({ ...editorValues, pricePerPerson: Number(event.target.value) })} required />
            </label>
            {editorValues.menuHighlights.length > 0 && <fieldset className="owner-menu-prices owner-field-wide">
              <legend>Precios de platos destacados</legend>
              {editorValues.menuHighlights.map((dish, index) => <label className="contact-field" key={`${restaurant.id}-${dish.name}`}>{dish.name} · S/
                <input type="number" min="0" max="5000" step="0.5" value={dish.price} onChange={(event) => setDraft({
                  ...editorValues,
                  menuHighlights: editorValues.menuHighlights.map((item, itemIndex) => itemIndex === index
                    ? { ...item, price: Number(event.target.value) }
                    : item),
                })} required />
              </label>)}
            </fieldset>}
            </div>
            <div className="owner-form-footer">
              <span>Los cambios se aplican a la ficha pública del restaurante.</span>
              <button className="button button-primary" type="submit" disabled={mutation.isPending}>
                <Save size={15} /> {mutation.isPending ? 'Guardando…' : 'Guardar cambios'}
              </button>
            </div>
            {message && <p className={`owner-message${mutation.isError || message.startsWith('Escribe') || message.startsWith('Añade') ? ' error' : ''}`} role="status">{message}</p>}
          </form>
        )}
        {section !== 'settings' && (
          <>
            {isDemo && <p className="demo-note warning-note">Las reservas reales estarán disponibles cuando la API y MySQL estén conectados.</p>}
            {!isDemo && reservationsQuery.isLoading && <p className="reviews-state" role="status">Cargando reservas…</p>}
            {!isDemo && reservationsQuery.isError && <div className="state-card" role="alert"><strong>No se pudieron cargar las reservas.</strong><p>Revisa la conexión e inténtalo nuevamente.</p><button className="button button-outline" type="button" onClick={() => void reservationsQuery.refetch()}>Intentar de nuevo</button></div>}
            {!isDemo && !reservationsQuery.isLoading && !reservationsQuery.isError && (() => {
              const visible = reservations.filter((item) => section === 'completed'
                ? item.status === 'completed'
                : item.status === 'pending' || item.status === 'confirmed')
              return session?.restaurantIds.length === 0
                ? <div className="state-card"><strong>Vincula primero tu ficha de restaurante.</strong><p>Las reservas aparecerán cuando el equipo de GastroRed conecte el local con esta cuenta.</p></div>
                : visible.length ? <div className="owner-reservation-list">
                {visible.map((reservation) => <article className="owner-reservation" key={reservation.id}>
                  <div className="owner-reservation-date"><strong>{reservation.time}</strong><span>{reservation.date}</span></div>
                  <div className="owner-reservation-details">
                    <strong>{reservation.name} · {reservation.guests} {reservation.guests === 1 ? 'persona' : 'personas'}</strong>
                    <span>{reservation.restaurantName} · {reservation.email}</span>
                    <span className={`reservation-status ${reservation.status}`}>{reservation.status === 'completed' ? 'Finalizada' : reservation.status === 'confirmed' ? 'Confirmada' : 'Pendiente'}</span>
                  </div>
                  {section === 'pending' && <div className="owner-reservation-actions">
                    {reservation.status === 'pending' && <button className="button button-outline" type="button" disabled={reservationMutation.isPending} onClick={() => reservationMutation.mutate({ id: reservation.id, status: 'confirmed' })}>Confirmar</button>}
                    <button className="button button-primary" type="button" disabled={reservationMutation.isPending} onClick={() => reservationMutation.mutate({ id: reservation.id, status: 'completed' })}>Marcar finalizada</button>
                  </div>}
                </article>)}
              </div> : <div className="empty-reservations"><span className="empty-icon">{section === 'pending' ? <CalendarDays size={23} /> : <Check size={23} />}</span><h2>{section === 'pending' ? 'No hay reservas pendientes.' : 'Aún no hay reservas finalizadas.'}</h2><p>{section === 'pending' ? 'Las nuevas solicitudes de clientes aparecerán aquí.' : 'Cuando finalices una reserva, quedará archivada en esta sección.'}</p></div>
            })()}
            {message && <p className={`owner-message${reservationMutation.isError ? ' error' : ''}`} role={reservationMutation.isError ? 'alert' : 'status'}>{message}</p>}
          </>
        )}
        <Link className="text-link owner-view-link" to="/propietario/restaurantes">Gestionar mis restaurantes <ArrowRight size={15} /></Link>
        </section>
      </div>
    </div>
  )
}
