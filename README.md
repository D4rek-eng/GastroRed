# GastroRed

Aplicación web responsive para descubrir, comparar y solicitar reservas en restaurantes. Construida con React, TypeScript, Vite, Tailwind CSS, React Router y TanStack Query; interfaz en español y precios en soles peruanos.

## Requisitos y ejecución

- Node.js 20.19+ o 22.12+.
- npm.

```bash
npm install
npm run dev
```

## Configuración

Copia `.env.example` como `.env.local`.

| Variable | Descripción |
| --- | --- |
| `VITE_DEMO_MODE` | `true` activa datos y acciones de demostración. El valor por defecto también es demo. |
| `VITE_API_BASE_URL` | URL base del backend que implementa los endpoints `/api/v1`. |

Con `VITE_DEMO_MODE=false`, configura `VITE_API_BASE_URL` con una API compatible. Las solicitudes usan cookies (`credentials: include`); la autenticación real y las reglas de autorización deben implementarse y validarse en el backend. La reserva demo se guarda como solicitud pendiente, nunca como confirmada.

## Tema por horario

El tema se ajusta a la hora local del dispositivo: modo claro de 06:00 a 17:59 y modo oscuro de 18:00 a 05:59. El cambio se aplica automáticamente y se vuelve a comprobar al regresar a la pestaña.

## Funcionalidades implementadas

- Inicio editorial, navegación responsive, búsqueda y rutas principales.
- Búsqueda por restaurante, distrito, cocina y plato; filtro por cocina, precio y valoración; orden por relevancia, valoración, precio y distancia.
- Descubrimiento de restaurantes reales a 200 m, 500 m o 1 km con OpenStreetMap; radio ampliable y fichas sin datos inventados.
- Guía curada siempre disponible con carta, precios por plato, reseñas y fotografías reales; cada imagen tiene su crédito y los locales sin foto propia muestran un espacio neutro, nunca una imagen referencial.
- Ficha de restaurante con menú y reseñas de ejemplo, comentarios de usuarios con valoración de 1 a 5 estrellas y filtro por puntuación, mapa de Google centrado en el restaurante, distancia desde la ubicación del usuario con permiso, guardar favoritos en este dispositivo y flujo de solicitud de reserva con validación Zod/React Hook Form.
- Comparador de hasta cuatro restaurantes, criterios prioritarios, puntuación ponderada explicada, normalizada y probada, con contraste de tema oscuro.
- Login de restaurantes con correo y contraseña, sesión protegida y portal para editar horarios, turnos y política de reservas; los cambios demo se guardan localmente y actualizan las fichas.
- Listado local de favoritos y solicitudes demo de reserva en memoria.
- Estados de carga, error y ausencia de resultados.
- Las rutas de mapa, cuenta y administración que dependen de servicios no conectados se identifican como pendientes. El modo demo del portal tiene credenciales de prueba visibles en su login; en producción, sesión, rol y restaurantes autorizados deben verificarse en el backend.

## Restaurantes cercanos y ubicación

Al aceptar el permiso de ubicación, la guía curada sigue visible y la portada y el listado suman una sección de descubrimiento con los locales reales registrados en OpenStreetMap a 200 metros a la redonda. La búsqueda usa el endpoint de mapa de OpenStreetMap para radios de 200 y 500 metros y Overpass para radios mayores; los resultados se guardan en el navegador durante unas horas para no repetir consultas. Si no hay locales a 200 metros, la portada amplía automáticamente a 500 m y 1 km e indica el radio utilizado. En el listado puedes elegir 200 m, 500 m o 1 km. Un aviso propio invita a activar la ubicación la primera vez de cada sesión, además del botón de la cabecera.

La ubicación se obtiene con `enableHighAccuracy` y se muestra con su precisión en metros. El distrito y la región se resuelven con BigDataCloud y, si falla, con Nominatim; por eso un punto en Sullana se muestra como «Sullana, Piura, Perú» y no como Lima. La interfaz indica las coordenadas y advierte cuando el navegador entrega una ubicación aproximada. Las coordenadas no se guardan en ningún servidor.

Los datos de OpenStreetMap son abiertos (ODbL) y pueden estar incompletos: no siempre incluyen carta, precios, reseñas o reservas. Cuando el local publica una imagen propia en OpenStreetMap, Wikidata o Wikimedia Commons la mostramos con su atribución; si no existe, la ficha usa un espacio sin fotografía en lugar de una imagen referencial. Para esos locales, la ficha muestra la información disponible y enlaza a OpenStreetMap en lugar de inventar disponibilidad o precios. Si quieres fotos y disponibilidad reales de cada local, conecta un proveedor de lugares con clave (por ejemplo Google Places o Foursquare) en lugar de la fuente abierta.

## Datos demo y contenido externo

Los restaurantes de ejemplo, horarios, reseñas, distancias de referencia y precios son ilustrativos; no reflejan disponibilidad ni servicios confirmados. Las fotografías son reales, se descargan localmente como WebP y provienen de Wikimedia Commons con licencias abiertas; los autores y licencias se listan en `/creditos`. El mapa usa Google Maps Embed en la ficha de cada restaurante. Al pulsar la ubicación en la cabecera, el navegador solicita permiso de geolocalización; las coordenadas se usan para calcular la distancia, mostrar los locales cercanos y obtener el nombre de la localidad. No se guarda la ubicación.

## Contrato REST esperado

El cliente centralizado está en `src/lib/api/client.ts` y el servicio inicial en `src/features/restaurants/service.ts`. Al desactivar demo, se usan:

- `GET /api/v1/restaurants?q=&cuisine=&maxPrice=&minRating=&sort=`
- `GET /api/v1/restaurants/{id}`
- `GET /api/v1/restaurants/{id}/reviews`
- `POST /api/v1/reservations`

Los tipos actuales son el contrato mínimo de la interfaz, no un contrato backend verificado. La respuesta de reseñas es un arreglo de `{ id, restaurantId, author, date, rating, comment, visit }`. Acordar esquemas, errores, disponibilidad, autorización y cancelación con el backend antes de producción. Quedan pendientes servicios de autenticación, menú, favoritos, comparaciones persistidas y administración.

Para habilitar las nuevas operaciones en modo real, el backend debe implementar `POST /api/v1/restaurants/{id}/reviews` (validar sesión y valoración de 1 a 5), `POST /api/v1/auth/owner/login`, `GET /api/v1/auth/owner/session`, `POST /api/v1/auth/owner/logout`, `GET /api/v1/owner/restaurants` y `PATCH /api/v1/owner/restaurants/{id}`. La sesión debe viajar en cookie segura `HttpOnly`, `Secure` y `SameSite`; el servidor debe autorizar cada restaurante en las operaciones de lectura y escritura. El login de demostración usa `propietario@mesaysabor.demo` / `MesaDemo2026!` y solo administra Mérito. En demo, los comentarios y cambios del portal se guardan en este navegador y no se comparten con otros usuarios; las credenciales demo no son para producción.

## Verificación

```bash
npm test
npm run build
npm run lint
```

El diseño es mobile-first y tiene breakpoints para móvil, tablet y escritorio. Antes de producción, verificar overflow y accesibilidad con los navegadores objetivo, y conectar disponibilidad, autenticación y permisos reales.
