# Prisma CN · Redes

Herramienta interna de Prisma CN para programar publicaciones y ver analítica de redes
sociales. Usa la imagen oficial de [Postiz](https://github.com/gitroomhq/postiz-app)
(open source, AGPL-3.0) **sin modificar su código**. La identidad visual de Prisma CN se
aplica con una capa aparte que se edita sin recompilar nada.

- **Dirección:** https://redes.alexisconsultor.com
- **Servidor:** el VPS con HestiaCP (el mismo de web. e interno.alexisconsultor.com)

```
navegador ──HTTPS──► nginx de Hestia (SSL Let's Encrypt, plantilla prisma-postiz)
                       └──► 127.0.0.1:4007 → branding (nginx: inyecta brand.css y brand.js)
                                               └──► postiz ──► Postgres / Redis / Temporal
```

## Estructura

| Ruta | Qué es |
|---|---|
| `docker-compose.yml` | Todos los servicios. Se basa en el compose oficial de Postiz y agrega la capa de marca. |
| `.env.example` | Plantilla de configuración: dirección, contraseñas y llaves de las redes sociales. |
| `branding/` | **Identidad visual**: colores y tipografías (`brand.css`), símbolo (`simbolo-negro.png` y `simbolo-dorado.png`), favicon y nombre en la pestaña (`brand.js`). |
| `hestia/` | Plantilla de proxy para HestiaCP (`prisma-postiz.tpl` y `.stpl`). |
| `proxy/` | Configuración del nginx de la capa de marca. Normalmente no se toca. |
| `temporal/` | Configuración de Temporal, el motor que ejecuta las publicaciones programadas. |

Nada de esto toca los otros sitios del servidor (`web.`, `interno.` ni `alexisconsultor.com`)
ni los datos de `~/datos-interno/`.

---

## 0. Revisiones antes de instalar

En una terminal de tu computadora:

```bash
ssh -i ~/.ssh/hestia_alexisconsultor alexisconsultorcom@161.97.124.223 'free -h; nproc; docker --version'
```

- **Memoria:** Postiz + Temporal + Elasticsearch usan unos **3 GB**. Si en la línea `Mem:`
  la columna `available` marca menos de 3.5 GB, **no instales**: pondría en riesgo los
  otros sitios. La salida sería ampliar el VPS.
- **Docker:** si dice `command not found`, hay que instalarlo (paso 2).

## 1. Probar en tu computadora primero

Requiere [Docker Desktop](https://www.docker.com/products/docker-desktop/).

```bash
git clone https://github.com/Riddler-A/Metricool.git prisma-redes
cd prisma-redes
cp .env.example .env
```

En `.env` para la prueba local:

- `POSTIZ_URL=http://localhost:4007`
- `NOT_SECURED=true`
- `JWT_SECRET`, `POSTGRES_PASSWORD` y `TEMPORAL_DB_PASSWORD`: genera cada uno con
  `openssl rand -hex 32` y pégalos tú.

```bash
docker compose up -d
```

Espera unos minutos y abre http://localhost:4007. Revisa que se vean los colores, las
tipografías y el símbolo de Prisma CN. Para apagar todo: `docker compose down`.

## 2. Instalar Docker en el servidor (una sola vez, requiere root)

Esto **cambia configuración permanente del servidor**. Docker se instala con el usuario
`root` del VPS (el de Contabo), no con `alexisconsultorcom`:

```bash
ssh root@161.97.124.223
curl -fsSL https://get.docker.com | sh
usermod -aG docker alexisconsultorcom
```

El compose solo publica puertos en `127.0.0.1`, así que nada de Docker queda expuesto a
internet saltándose el firewall de Hestia.

## 3. Instalar la plantilla de proxy en Hestia (una sola vez, requiere root)

```bash
# Desde tu computadora, dentro de la carpeta del repo:
scp hestia/prisma-postiz.tpl hestia/prisma-postiz.stpl root@161.97.124.223:/usr/local/hestia/data/templates/web/nginx/
```

## 4. Crear el subdominio en Hestia

En el panel de Hestia, con el usuario `alexisconsultorcom`:

1. **Web → Agregar dominio web:** `redes.alexisconsultor.com`. Desactiva la redirección a "www".
2. En **DNS**, confirma que exista el registro `redes` tipo A apuntando a `161.97.124.223`.
3. Edita el dominio:
   - **Plantilla de proxy:** `prisma-postiz`
   - **SSL:** activado, con **Let's Encrypt**, y **forzar HTTPS**.
4. Guarda.

## 5. Subir y arrancar la herramienta en el servidor

```bash
# Desde tu computadora, dentro de la carpeta del repo (sin .env ni archivos locales):
ssh -i ~/.ssh/hestia_alexisconsultor alexisconsultorcom@161.97.124.223 'mkdir -p ~/apps/prisma-redes'
git archive HEAD | ssh -i ~/.ssh/hestia_alexisconsultor alexisconsultorcom@161.97.124.223 'cd ~/apps/prisma-redes && tar -x'
```

Crea el `.env` del servidor **tú mismo** (contiene contraseñas):

```bash
ssh -i ~/.ssh/hestia_alexisconsultor alexisconsultorcom@161.97.124.223
cd ~/apps/prisma-redes
cp .env.example .env
nano .env    # POSTIZ_URL=https://redes.alexisconsultor.com, NOT_SECURED vacío, secretos nuevos
docker compose up -d
docker compose logs -f postiz   # Ctrl+C para salir
```

Comprueba que responde:

```bash
curl -sI http://127.0.0.1:4007 | head -1
curl -sI https://redes.alexisconsultor.com | head -1
```

Luego abre https://redes.alexisconsultor.com, crea tu cuenta y las del equipo. Al
terminar, en `.env` pon `DISABLE_REGISTRATION=true` y ejecuta `docker compose up -d`.

## 6. Identidad visual

Todo vive en `branding/` y **no requiere reiniciar**: se edita y se recarga el navegador.

- **Colores y tipografías:** ya tienen la paleta de Prisma CN (hueso, negro, grises,
  terracota en acciones, dorado en detalles), Fraunces + Inter, selección en dorado y
  esquinas de 12 px en los campos.
- **Símbolo:** copia a `branding/` los PNG transparentes del prisma con los nombres
  `simbolo-negro.png` (tema claro) y `simbolo-dorado.png` (tema oscuro). Mientras no estén,
  el espacio del logo se ve vacío.
- **Favicon:** reemplaza `branding/favicon.ico`. Por ahora es el de Postiz.
- **Nombre en la pestaña:** `BRAND_NAME` en `branding/brand.js`.

Esto cambia el aspecto, no textos internos ni pantallas completas. Si una actualización de
Postiz renombra sus estilos, alguna parte puede dejar de verse con la marca; la
herramienta sigue funcionando y se corrige ajustando `brand.css`.

Para subir cambios de marca al servidor:

```bash
git archive HEAD -- branding | ssh -i ~/.ssh/hestia_alexisconsultor alexisconsultorcom@161.97.124.223 'cd ~/apps/prisma-redes && tar -x'
```

## 7. Conectar Facebook e Instagram (app de Meta)

1. En [developers.facebook.com](https://developers.facebook.com) crea una app de tipo **Business**.
2. Agrega los productos **Facebook Login for Business** e **Instagram**.
3. En Facebook Login, en **URIs de redireccionamiento de OAuth válidos**, agrega:
   ```
   https://redes.alexisconsultor.com/integrations/social/facebook
   https://redes.alexisconsultor.com/integrations/social/instagram
   ```
4. Para Instagram **sin página de Facebook** (Instagram Login), en el producto Instagram agrega:
   ```
   https://redes.alexisconsultor.com/integrations/social/instagram-standalone
   ```
5. Pon el App ID y App Secret en el `.env` del servidor (`FACEBOOK_APP_ID`,
   `FACEBOOK_APP_SECRET` y, si aplica, `INSTAGRAM_APP_ID`, `INSTAGRAM_APP_SECRET`) y ejecuta
   `docker compose up -d`.
6. **Uso interno sin App Review:** deja la app en modo desarrollo y agrega en *Roles de la
   app* a cada persona del equipo que va a conectar cuentas. Las páginas e Instagram de los
   clientes deben estar compartidos con esas personas (por ejemplo, en tu Business
   Manager). Para cuentas con Instagram Login, agrega cada cuenta como **tester de Instagram**.
7. En la herramienta: **Agregar canal → Facebook / Instagram** y autoriza.

> Las rutas de redirect se tomaron del código fuente de Postiz (oct-2026). Si Meta marca
> "URL bloqueada", copia la URL exacta que aparece en el navegador al conectar y agrégala.

## 8. Operación

Todos los comandos se corren en el servidor dentro de `~/apps/prisma-redes`.

| Tarea | Comando |
|---|---|
| Ver estado | `docker compose ps` |
| Ver logs | `docker compose logs -f postiz` |
| Actualizar Postiz | `docker compose pull && docker compose up -d` |
| Respaldar la base de datos | `mkdir -p ~/respaldos-redes && docker compose exec -T postiz-postgres pg_dump -U postiz-user postiz-db > ~/respaldos-redes/redes-$(date +%F).sql` |
| Ver flujos de publicación (depuración) | `ssh -L 8233:localhost:8233 -i ~/.ssh/hestia_alexisconsultor alexisconsultorcom@161.97.124.223` y abrir http://localhost:8233 |

Recomendaciones:

- **Respaldo diario** de la base de datos (con un cron, como el de `~/datos-interno/`).
- Antes de usarla con clientes, **fija la versión** de Postiz en `POSTIZ_VERSION`.
- Las primeras semanas, **corre en paralelo con Metricool** una o dos marcas.

## Licencia

Postiz es AGPL-3.0. Este repo no modifica su código: solo lo configura y le agrega una
capa visual externa. Para uso interno no hay obligaciones adicionales.
