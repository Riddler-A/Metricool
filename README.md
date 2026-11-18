# Prisma CN · Redes

Herramienta interna de Prisma CN para programar publicaciones y ver analítica de redes
sociales. Usa la imagen oficial de [Postiz](https://github.com/gitroomhq/postiz-app)
(open source, AGPL-3.0) **sin modificar su código**. La identidad visual de Prisma CN se
aplica con una capa aparte que se edita sin recompilar nada.

- **Dirección:** https://redes.alexisconsultor.com
- **Servidor:** el VPS de Contabo con HestiaCP (185.137.122.204, desde noviembre de 2026;
  el mismo de alexisconsultor.com e interno.alexisconsultor.com)

```
navegador ──HTTPS──► nginx de Hestia (SSL Let's Encrypt, plantilla NODEJS3010)
                       └──► 127.0.0.1:3010 → branding (nginx: inyecta brand.css y brand.js)
                                               └──► postiz ──► Postgres / Redis / Temporal
```

## Estructura

| Ruta | Qué es |
|---|---|
| `docker-compose.yml` | Todos los servicios. Se basa en el compose oficial de Postiz y agrega la capa de marca. |
| `.env.example` | Plantilla de configuración: dirección, contraseñas y llaves de las redes sociales. |
| `branding/` | **Identidad visual**: colores y tipografías (`brand.css`), símbolo (`simbolo-negro.png` y `simbolo-dorado.png`), favicon y nombre en la pestaña (`brand.js`). |
| `hestia/` | Plantilla de proxy propia (`prisma-postiz.tpl` y `.stpl`). **Ya no hace falta**: el servidor nuevo usa la plantilla `NODEJS3010` de Hestia. Se conserva por si algún día se cambia de servidor. |
| `proxy/` | Configuración del nginx de la capa de marca. Normalmente no se toca. |
| `scripts/` | Instalación, revisión, verificación y respaldo en el servidor (ver paso 4). |
| `reportes/` | **Reportes de resultados** con la identidad de Prisma CN, en `/reportes` (ver sección "Reportes"). |
| `SIGUIENTES-PASOS.md` | **Estado del proyecto y plan** para continuar (pensado para que lo lea una IA). |
| `temporal/` | Configuración de Temporal, el motor que ejecuta las publicaciones programadas. |

Nada de esto toca los otros sitios del servidor (`alexisconsultor.com` ni `interno.`), las
apps de PM2 ni los datos de `~/datos-interno/`.

---

## 0. Revisiones antes de instalar

En una terminal de tu computadora:

```bash
ssh -i ~/.ssh/hestia_alexisconsultor alexisconsultorcom@185.137.122.204 'bash ~/apps/prisma-redes/scripts/revisar.sh'
```

El script no cambia nada: revisa Docker, memoria, el `.env`, el puerto y la plantilla de
Hestia, y dice qué falta. Lo que revisa:

- **Memoria:** Postiz + Temporal + Elasticsearch usan unos **3 GB**. Con menos de 3.5 GB
  disponibles **no se instala**: pondría en riesgo los otros sitios. La salida sería
  ampliar el VPS. (15-nov-2026: 7.8 GB en total, 5.1 GB disponibles. Cabe, con poco
  margen: por eso el paso 2 agrega swap.)
- **Docker:** si no está, hay que instalarlo (paso 2).
- **Puerto 3010:** el servidor lo comparten otros usuarios de Hestia y cualquiera puede
  ocupar un puerto. El 3003 ya lo usa el sitio de otro usuario. Si el 3010 se ocupa,
  elige otro libre (`ss -ltn`) y cambia `POSTIZ_PORT` y la plantilla `NODEJS30xx` del paso 3.

## 1. Probar en tu computadora primero

Requiere [Docker Desktop](https://www.docker.com/products/docker-desktop/).

```bash
git clone https://github.com/Riddler-A/Metricool.git prisma-redes
cd prisma-redes
cp .env.example .env
```

En `.env` para la prueba local:

- `POSTIZ_URL=http://localhost:3010`
- `NOT_SECURED=true`
- `JWT_SECRET`, `POSTGRES_PASSWORD` y `TEMPORAL_DB_PASSWORD`: genera cada uno con
  `openssl rand -hex 32` y pégalos tú.

```bash
docker compose up -d
```

Espera unos minutos y abre http://localhost:3010. Revisa que se vean los colores, las
tipografías y el símbolo de Prisma CN. Para apagar todo: `docker compose down`.

## 2. Instalar Docker en el servidor (una sola vez, requiere root)

Esto **cambia configuración permanente del servidor**. Docker se instala con el usuario
`root` del VPS (el de Contabo), no con `alexisconsultorcom`:

```bash
ssh root@185.137.122.204
curl -fsSL https://get.docker.com | sh
usermod -aG docker alexisconsultorcom

# Memoria de reserva (swap) de 4 GB: el servidor no tiene y protege a los otros sitios
fallocate -l 4G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile
echo '/swapfile none swap sw 0 0' >> /etc/fstab

# Que PM2 (sitio y portal) arranque solo si el servidor se reinicia
env PATH=$PATH:/usr/bin pm2 startup systemd -u alexisconsultorcom --hp /home/alexisconsultorcom
```

El compose solo publica puertos en `127.0.0.1`, así que nada de Docker queda expuesto a
internet saltándose el firewall de Hestia. Ojo: estar en el grupo `docker` equivale a tener
permisos de root sobre el servidor; cuida la llave SSH de `alexisconsultorcom`.

## 3. Subdominio en Hestia

Este servidor no permite plantillas propias, así que se usa la de Hestia `NODEJS3010`
(manda el dominio a `127.0.0.1:3010`, el `POSTIZ_PORT` del `.env`). La carpeta `hestia/`
no se usa aquí.

En el panel de Hestia, con el usuario `alexisconsultorcom` (15-nov-2026: el dominio y el
SSL ya existen, pero la plantilla está en `NODEJS3003` y por eso la dirección muestra el
sitio de otro usuario; falta cambiarla a `NODEJS3010` y activar HSTS):

1. **Web → Agregar dominio web:** `redes.alexisconsultor.com`. Desactiva la redirección a "www".
2. En **DNS**, confirma que el registro `redes` tipo A apunte a `185.137.122.204`.
3. Edita el dominio:
   - **Plantilla de proxy (Advanced Options):** `NODEJS3010`
   - **SSL:** activado, con **Let's Encrypt**, y **forzar HTTPS**.
   - **HSTS:** actívalo (obliga al navegador a usar siempre HTTPS).
4. Guarda.

Con la plantilla `NODEJS3010` y Postiz sin arrancar, la dirección responde `502`: es normal.

## 4. Subir y arrancar la herramienta en el servidor

```bash
# Desde tu computadora, dentro de la carpeta del repo (sin .env ni archivos locales):
ssh -i ~/.ssh/hestia_alexisconsultor alexisconsultorcom@185.137.122.204 'mkdir -p ~/apps/prisma-redes'
git archive HEAD | ssh -i ~/.ssh/hestia_alexisconsultor alexisconsultorcom@185.137.122.204 'cd ~/apps/prisma-redes && tar -x'
```

Luego, en el servidor, tres scripts hacen el resto:

```bash
ssh -i ~/.ssh/hestia_alexisconsultor alexisconsultorcom@185.137.122.204
cd ~/apps/prisma-redes
bash scripts/crear-env.sh   # crea .env con secretos nuevos, sin mostrarlos (permisos 600)
bash scripts/instalar.sh    # revisa, descarga, enciende y verifica
```

| Script | Qué hace |
|---|---|
| `scripts/crear-env.sh` | Crea el `.env` con tres secretos nuevos. No toca uno que ya exista. |
| `scripts/revisar.sh` | Revisión previa (Docker, memoria, `.env`, puerto, Hestia). No cambia nada. |
| `scripts/instalar.sh` | Corre la revisión, descarga las imágenes, enciende todo y verifica. Se puede repetir. |
| `scripts/verificar.sh` | Revisión de funcionamiento y seguridad. No cambia nada. |
| `scripts/respaldo.sh` | Respalda la base de datos en `~/respaldos-redes` y borra los de más de 14 días. |

`instalar.sh` no arranca si `revisar.sh` encuentra una falla (por ejemplo, poca memoria o
el puerto ocupado). Al final, `verificar.sh` confirma que la dirección muestra **esta**
herramienta y no otro sitio del servidor.

**En cuanto responda**, abre https://redes.alexisconsultor.com y crea tu cuenta y las del
equipo: mientras el registro esté abierto, cualquiera que llegue a la dirección puede
crearse una. Al terminar, en `.env` pon `DISABLE_REGISTRATION=true` y ejecuta
`docker compose up -d`. La versión de Postiz ya va fija en `POSTIZ_VERSION` (v2.25.1, la
que se probó); para actualizar, cámbiala a propósito.

## 5. Identidad visual

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
git archive HEAD -- branding | ssh -i ~/.ssh/hestia_alexisconsultor alexisconsultorcom@185.137.122.204 'cd ~/apps/prisma-redes && tar -x'
```

## Reportes de resultados

En el menú de la izquierda de la herramienta hay un botón **Reportes** que abre
https://redes.alexisconsultor.com/reportes. Ahí se arma el "Reporte de resultados de redes
sociales" de Prisma CN y se descarga en PDF con la identidad visual.

1. **Crear reporte** → cliente, fechas del periodo y cuentas de Postiz que entran.
2. **Traer datos de Postiz** llena lo marcado como *Postiz*: alcance, impresiones, likes,
   comentarios, guardados, compartidos, seguidores nuevos, mejores y peores publicaciones,
   rendimiento por formato, por pilar (las etiquetas de cada publicación) y por red. El
   periodo anterior (misma duración, justo antes) se calcula solo.
3. Lo demás se llena a mano: KPI y metas, conversión, visitas al perfil, pauta,
   comunidad, audiencia, aprendizajes, plan y cada **Qué significa**.
4. **Guardar y ver reporte** → revisa la lista "Antes de entregar" y usa **Descargar PDF**
   (en la ventana de impresión: *Guardar como PDF*, con *Gráficos de fondo* activado).
5. Para el mes siguiente, **Duplicar** conserva cliente, cuentas, objetivos y KPI con sus metas.

Cómo funciona:

- Es una app aparte (`reportes/`, Node sin dependencias, contenedor `prisma-reportes`); no
  modifica Postiz. Usa la **sesión de Postiz** de quien la abre: sin sesión, manda al inicio
  de sesión, y no necesita llaves ni contraseñas nuevas.
- Los reportes se guardan como archivos JSON en el volumen de Docker `reportes-data`. Al
  borrar uno se mueve a `papelera/` dentro del mismo volumen.
- La estructura del reporte (secciones, campos, tablas) está en `reportes/esquema.js`. Para
  agregar o quitar un campo basta con cambiarlo ahí; el formulario y el PDF se ajustan solos.
- Las secciones vacías no aparecen en el PDF, y la tasa de engagement se calcula siempre con
  la misma fórmula: interacciones ÷ alcance × 100.
- Alcance e interacciones se suman **por publicación del periodo** (lo que entrega cada red).
  Si la red no da datos de una publicación, la app avisa.
- Pruebas: `node --test reportes/pruebas.test.js` (usan un Postiz simulado).
- Respaldo: `scripts/respaldo.sh` (el del cron diario) guarda también los reportes en
  `~/respaldos-redes/reportes-<fecha>.tar.gz`.

## 6. Conectar Facebook e Instagram (app de Meta)

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

## 7. Operación

Todos los comandos se corren en el servidor dentro de `~/apps/prisma-redes`.

| Tarea | Comando |
|---|---|
| Ver estado | `docker compose ps` |
| Ver logs | `docker compose logs -f postiz` |
| Actualizar Postiz | `docker compose pull && docker compose up -d` |
| Respaldar la base de datos | `mkdir -p ~/respaldos-redes && docker compose exec -T postiz-postgres pg_dump -U postiz-user postiz-db > ~/respaldos-redes/redes-$(date +%F).sql` |
| Ver flujos de publicación (depuración) | `ssh -L 8233:localhost:8233 -i ~/.ssh/hestia_alexisconsultor alexisconsultorcom@185.137.122.204` y abrir http://localhost:8233 |

Recomendaciones:

- **Respaldo diario** de la base de datos. Con `crontab -e` agrega esta línea (respalda a
  las 3:15 y `scripts/respaldo.sh` borra los de más de 14 días):
  ```
  15 3 * * * bash $HOME/apps/prisma-redes/scripts/respaldo.sh >> $HOME/respaldos-redes/respaldo.log 2>&1
  ```
  Los archivos subidos (imágenes y videos) viven en el volumen `postiz-uploads` y **no**
  entran en este respaldo.
- Antes de usarla con clientes, **fija la versión** de Postiz en `POSTIZ_VERSION`.
- Las primeras semanas, **corre en paralelo con Metricool** una o dos marcas.

## 8. Seguridad (revisión del 11-nov-2026)

Ya resuelto en este repo:

- Ningún contenedor queda expuesto a internet: los puertos se publican solo en `127.0.0.1`
  y las bases de datos, Redis y Elasticsearch no publican ninguno.
- `.env` está en `.gitignore` y el historial de git no contiene contraseñas.
- La capa de marca agrega cabeceras de seguridad (`nosniff`, `SAMEORIGIN`, `Referrer-Policy`,
  `Permissions-Policy`), oculta la versión de nginx y pasa a Postiz la IP real del visitante.

Depende de ti al instalar:

1. Secretos **nuevos** en el `.env` del servidor (`openssl rand -hex 32`) y `chmod 600 .env`.
2. `NOT_SECURED` **vacío** en el servidor.
3. Crear las cuentas en cuanto arranque y luego `DISABLE_REGISTRATION=true`.
4. SSL + forzar HTTPS + HSTS en Hestia.
5. Fijar `POSTIZ_VERSION` y actualizar a propósito (revisando las notas de la versión).
6. Respaldo diario (sección 7) y, de vez en cuando, copiar `~/respaldos-redes` fuera del servidor.
7. Las llaves de Meta y demás redes solo en `.env`, nunca en git ni en chats.

## Licencia

Postiz es AGPL-3.0. Este repo no modifica su código: solo lo configura y le agrega una
capa visual externa. Para uso interno no hay obligaciones adicionales.
