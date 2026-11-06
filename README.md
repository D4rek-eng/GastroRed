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

Copia `.env.example` como `.env.local` para el frontend y `.env.server.example` como `.env.server` para la API. El modo demo sigue activo por defecto. El archivo `.env.server` contiene secretos y está excluido de Git.

| Variable | Descripción |
| --- | --- |
| `VITE_DEMO_MODE` | `true` activa datos y acciones de demostración. El valor por defecto también es demo. |
| `VITE_API_BASE_URL` | URL base de la API. Vacía usa el mismo origen; Vite reenvía `/api` a `localhost:3001`. |

Para habilitar cuentas y persistencia local, instala MySQL 8 o MariaDB y configura `.env.server`. Crea la base y el usuario usando una cuenta administrativa local:

```sql
CREATE DATABASE gastrored CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'gastrored'@'127.0.0.1' IDENTIFIED BY 'elige-una-clave-local';
GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, ALTER, INDEX, REFERENCES
  ON gastrored.* TO 'gastrored'@'127.0.0.1';
```

Completa `MYSQL_PASSWORD` en `.env.server` con la misma clave que asignaste y conserva `DEMO_PAYMENTS_ENABLED=true` solo en tu entorno local. En `.env.local`, cambia `VITE_DEMO_MODE=false` para que la web use la API en vez del almacenamiento temporal del modo demo. Después ejecuta:

```bash
npm run demo:setup
npm run dev:api
```

En otra terminal, inicia Vite con `npm run dev`. `demo:setup` aplica las migraciones y crea estas cuentas locales, con correo verificado y listas para iniciar sesión:

- Cliente Free: `cliente@gastrored.demo` / `GastroDemo2026!`
- Restaurante: dominio `mesaysabor.demo` / `MesaDemo2026!`

El seed puede volver a ejecutarse para restaurar las credenciales de demostración; no elimina reservas ni reseñas. En desarrollo, `DEMO_PAYMENTS_ENABLED=true` activa los planes Pro/Restaurante sin efectuar un cobro real. Esta opción se rechaza al iniciar en producción. En despliegues, usa `DEMO_PAYMENTS_ENABLED=false`, configura HTTPS, una URL pública para `MERCADOPAGO_WEBHOOK_URL`, credenciales de Mercado Pago y un `SMTP_URL` para entregar códigos de verificación. `FRONTEND_ORIGIN` debe ser el origen público exacto del frontend. No copies credenciales reales a archivos versionados.

## Tema por horario

El tema se ajusta a la hora local del dispositivo: modo claro de 06:00 a 17:59 y modo oscuro de 18:00 a 05:59. El cambio se aplica automáticamente y se vuelve a comprobar al regresar a la pestaña.

## Funcionalidades implementadas

- Landing informativa en `/` con parallax, planes Free/Pro y acceso al inicio de la app en `/inicio`.
- Inicio editorial de la app, navegación responsive, búsqueda y rutas principales.
- Búsqueda por restaurante, distrito, cocina y plato; filtro por cocina, precio y valoración; orden por relevancia, valoración, precio y distancia.
- Descubrimiento de restaurantes reales con OpenStreetMap. Free usa 200 m; Pro puede ampliar el radio hasta 1 km cuando la suscripción está activa.
- Registro e inicio de sesión de clientes con correo personal; registro de restaurantes con dominio único, correo corporativo del mismo dominio y acceso mediante dominio y contraseña.
- Verificación de correo por código; los códigos solo se devuelven en desarrollo cuando no hay SMTP configurado.
- Plan cliente Pro a S/ 100/mes y plan Restaurante a S/ 120/mes. En producción, Mercado Pago crea suscripciones mensuales y la activación depende de validar el webhook firmado. En la instalación demo local, el simulador puede activar el plan sin cobrar.
- Reservas, comentarios y favoritos personales requieren una cuenta de cliente con sesión. Las reservas y comentarios se persisten en MySQL al desactivar el modo demo; cada cuenta puede publicar una opinión por restaurante y mantener favoritos por cuenta en este dispositivo.
- Guía curada siempre disponible con carta, precios por plato, reseñas y fotografías reales; cada imagen tiene su crédito y los locales sin foto propia muestran un espacio neutro, nunca una imagen referencial.
- Ficha de restaurante con menú y reseñas de ejemplo, comentarios autenticados de 1 a 5 estrellas, mapa de Google, distancia desde la ubicación del usuario con permiso, favoritos guardados en este dispositivo y solicitud de reserva con validación Zod/React Hook Form.
- Comparador de hasta cuatro restaurantes, criterios prioritarios, puntuación ponderada explicada, normalizada y probada, con contraste de tema oscuro.
- Panel de restaurantes protegido por sesión y suscripción activa: permite editar horario, turnos, mesas disponibles por turno, política de reservas, precio promedio y precio de platos; muestra reservas pendientes y finalizadas, y permite confirmar o finalizar una solicitud.
- Las reservas solo pueden solicitarse en un turno publicado por el restaurante. La ficha pública refleja los horarios y precios guardados.
- El restaurante define cuántas mesas ofrece en cada turno; cada solicitud pendiente o confirmada ocupa una mesa y el sistema impide aceptar solicitudes cuando se agota esa capacidad. La ficha muestra las mesas restantes para la fecha elegida.
- El dominio y correo corporativos se verifican durante el registro; un responsable de GastroRed debe vincular la ficha pública a la cuenta antes de habilitar su administración.
- En el modo de datos demo del frontend, el radio superior sigue siendo 200 m. Para una demostración persistente, usa la API local y las cuentas sembradas; el simulador de pagos local no cobra. Reservas y comentarios requieren sesión de cliente.
- Estados de carga, error y ausencia de resultados.
- La cuenta de restaurante recién creada se registra en la base de datos; la vinculación a una ficha pública de la guía requiere asociar esa ficha. El panel informa cuando la cuenta todavía no está vinculada y no permite modificar fichas ajenas.

## Restaurantes cercanos y ubicación

Al aceptar el permiso de ubicación, la guía curada sigue visible y la portada de la app y el listado suman una sección de descubrimiento con los locales reales registrados en OpenStreetMap alrededor de la ubicación. La búsqueda usa el endpoint de mapa de OpenStreetMap para radios de 200 y 500 metros y Overpass para radios mayores; los resultados se guardan en el navegador durante unas horas para no repetir consultas. La portada de la app busca a 200 m; en el listado puedes elegir 200 m, 500 m o 1 km. Un aviso propio invita a activar la ubicación la primera vez de cada sesión, además del botón de la cabecera.

La ubicación se obtiene con `enableHighAccuracy` y se muestra con su precisión en metros. El distrito y la región se resuelven con BigDataCloud y, si falla, con Nominatim; por eso un punto en Sullana se muestra como «Sullana, Piura, Perú» y no como Lima. La interfaz indica las coordenadas y advierte cuando el navegador entrega una ubicación aproximada. Las coordenadas no se guardan en ningún servidor.

Los datos de OpenStreetMap son abiertos (ODbL) y pueden estar incompletos: no siempre incluyen carta, precios, reseñas o reservas. Cuando el local publica una imagen propia en OpenStreetMap, Wikidata o Wikimedia Commons la mostramos con su atribución; si no existe, la ficha usa un espacio sin fotografía en lugar de una imagen referencial. Para esos locales, la ficha muestra la información disponible y enlaza a OpenStreetMap en lugar de inventar disponibilidad o precios. Si quieres fotos y disponibilidad reales de cada local, conecta un proveedor de lugares con clave (por ejemplo Google Places o Foursquare) en lugar de la fuente abierta.

## Datos demo y contenido externo

Los restaurantes de ejemplo, horarios, reseñas, distancias de referencia y precios son ilustrativos; no reflejan disponibilidad ni servicios confirmados. Las fotografías son reales, se descargan localmente como WebP y provienen de Wikimedia Commons con licencias abiertas; los autores y licencias se listan en `/creditos`. El mapa usa Google Maps Embed en la ficha de cada restaurante. Al pulsar la ubicación en la cabecera, el navegador solicita permiso de geolocalización; las coordenadas se usan para calcular la distancia, mostrar los locales cercanos y obtener el nombre de la localidad. No se guarda la ubicación.

## API y persistencia

La API Node está en `server/`; las migraciones están en `server/migrations/`. `npm run demo:setup` migra la base y crea las cuentas de prueba; también puedes ejecutar `npm run db:migrate` y `npm run db:seed-demo` por separado. Las sesiones, cuentas, reservas, reseñas y ajustes de restaurantes se guardan en MySQL. Las operaciones implementadas incluyen:

- `POST /api/v1/auth/register`, `POST /api/v1/auth/verify-email`, `POST /api/v1/auth/login`, `GET /api/v1/auth/session`, `POST /api/v1/auth/logout`
- `POST /api/v1/billing/checkout`, `POST /api/v1/billing/webhook`
- `GET|POST /api/v1/reservations`
- `GET /api/v1/owner/reservations`, `PATCH /api/v1/owner/reservations/{id}`
- `GET /api/v1/restaurants/settings`, `GET /api/v1/restaurants/{id}`
- `GET|POST /api/v1/restaurants/{id}/reviews`
- `GET /api/v1/owner/restaurants`, `PATCH /api/v1/owner/restaurants/{id}`

Las sesiones usan cookies `HttpOnly`, `SameSite=Lax` y `Secure` en producción; el servidor guarda solo el hash de cada token de sesión. Las contraseñas se derivan con scrypt. La API valida el rol, el estado del plan y la propiedad antes de aceptar cambios del portal. El catálogo editorial permanece en el frontend; las cuentas de restaurante requieren una asociación explícita con una ficha de catálogo para editarla.

Las imágenes y fichas de restaurantes seed son ilustrativas. Las solicitudes nuevas se guardan como `pending`; el restaurante puede confirmarlas y luego marcarlas como `completed`. Una reserva no se considera confirmada solo por haber enviado la solicitud.

## Verificación

```bash
npm test
npm run build
npm run lint
npm run check:server
```

El diseño es mobile-first y tiene breakpoints para móvil, tablet y escritorio. Antes de producción, configurar MySQL, SMTP y Mercado Pago, vincular cada cuenta de restaurante a su ficha validada y verificar el flujo de reservas con las credenciales de despliegue.
