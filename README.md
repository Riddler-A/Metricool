# PRISMA Social: scheduler interno basado en Postiz

Herramienta interna de PRISMA Consultoría para programar publicaciones y ver analítica
de redes sociales. Usa la imagen oficial de [Postiz](https://github.com/gitroomhq/postiz-app)
(open source, AGPL-3.0) **sin modificar su código**. La identidad visual se aplica con
una capa aparte que se puede editar sin recompilar nada.

```
navegador ──HTTPS──► caddy ──► branding (nginx) ──► postiz ──► Postgres / Redis / Temporal
                    (certificados   (inyecta brand.css
                     automáticos)    y brand.js)
```

## Estructura

| Ruta | Qué es |
|---|---|
| `docker-compose.yml` | Todos los servicios. Se basa en el compose oficial de Postiz y agrega Caddy (HTTPS) y la capa de marca. |
| `.env.example` | Plantilla de configuración: dominio, contraseñas y llaves de las redes sociales. |
| `branding/` | **Tu identidad visual**: colores (`brand.css`), logo (`logo.svg`), favicon y nombre en la pestaña (`brand.js`). |
| `proxy/` | Configuración de Caddy y nginx. Normalmente no necesitas tocarla. |
| `temporal/` | Configuración de Temporal, el motor que ejecuta las publicaciones programadas. |

---

## 1. Requisitos

- **Un VPS** con Ubuntu 24.04, **mínimo 4 GB de RAM** (Postiz + Temporal + Elasticsearch
  no caben bien en 2 GB). Hetzner, DigitalOcean o Contabo sirven.
- **Un subdominio**, por ejemplo `social.prismaconsultoria.com`, con un registro DNS
  tipo **A** apuntando a la IP del VPS.
- Los puertos **80 y 443** abiertos en el firewall del VPS.

## 2. Instalar Docker en el VPS

```bash
ssh root@IP_DEL_VPS
curl -fsSL https://get.docker.com | sh
```

## 3. Bajar este repo y configurar

```bash
git clone https://github.com/riddler-a/metricool.git prisma-social
cd prisma-social
cp .env.example .env
nano .env
```

En `.env`:

1. `POSTIZ_DOMAIN`: tu subdominio, sin `https://`.
2. `JWT_SECRET`, `POSTGRES_PASSWORD` y `TEMPORAL_DB_PASSWORD`: genera cada uno con
   `openssl rand -hex 32`.
3. Deja las llaves de Meta vacías por ahora (paso 6).

## 4. Levantar todo

```bash
docker compose up -d
docker compose logs -f postiz   # Ctrl+C para salir de los logs
```

El primer arranque tarda unos minutos (descarga imágenes y prepara las bases de datos).
Después abre `https://TU_SUBDOMINIO`, crea tu cuenta y las de tu equipo, y luego en
`.env` cambia `DISABLE_REGISTRATION=true` y ejecuta `docker compose up -d` para cerrar
el registro.

## 5. Personalizar la identidad visual

Todo vive en `branding/` y **no requiere reiniciar**: guarda el archivo y recarga el navegador.

- **Colores:** edita el bloque *Paleta PRISMA* al inicio de `branding/brand.css`.
- **Logo:** reemplaza `branding/logo.svg` por el logo de PRISMA (SVG, de preferencia cuadrado).
- **Favicon:** reemplaza `branding/favicon.ico`. Por ahora es el de Postiz.
- **Tipografía:** cambia la línea `@import` y el `font-family` en `brand.css`.
- **Nombre en la pestaña:** cambia `BRAND_NAME` en `branding/brand.js`.

Limitación: esto cambia el aspecto, no textos internos ni pantallas completas. Si una
actualización de Postiz renombra sus clases o variables, la personalización puede dejar
de verse en algún punto, pero la herramienta sigue funcionando. Se corrige ajustando `brand.css`.

## 6. Conectar Facebook e Instagram (app de Meta)

1. En [developers.facebook.com](https://developers.facebook.com) crea una app de tipo
   **Business**.
2. Agrega los productos **Facebook Login for Business** e **Instagram**.
3. En la configuración de Facebook Login, en **URIs de redireccionamiento de OAuth
   válidos**, agrega:
   ```
   https://TU_SUBDOMINIO/integrations/social/facebook
   https://TU_SUBDOMINIO/integrations/social/instagram
   ```
4. Si vas a conectar Instagram **sin página de Facebook** (Instagram Login), en el
   producto Instagram agrega como redirect:
   ```
   https://TU_SUBDOMINIO/integrations/social/instagram-standalone
   ```
   y copia el *Instagram App ID / Secret* a `INSTAGRAM_APP_ID` / `INSTAGRAM_APP_SECRET`.
5. Copia el **App ID** y el **App Secret** de la app a `FACEBOOK_APP_ID` y
   `FACEBOOK_APP_SECRET` en `.env`, y ejecuta `docker compose up -d`.
6. **Uso interno sin App Review:** deja la app en modo desarrollo y agrega en
   *Roles de la app* a cada persona que va a conectar cuentas (tú y tu equipo). Las
   páginas e Instagram de los clientes deben estar accesibles para esos usuarios, por
   ejemplo como activos compartidos en tu Business Manager. Para cuentas de Instagram
   Login, agrega cada cuenta como **tester de Instagram**.
7. En la herramienta: **Agregar canal → Facebook / Instagram** y autoriza.

> Las rutas de redirect se tomaron del código fuente de Postiz (oct-2026). Si Meta marca
> "URL bloqueada", revisa la URL exacta que aparece en la barra del navegador al conectar
> y agrégala tal cual.

## 7. Operación

| Tarea | Comando |
|---|---|
| Ver estado | `docker compose ps` |
| Ver logs | `docker compose logs -f postiz` |
| Actualizar Postiz | `docker compose pull && docker compose up -d` |
| Respaldar la base de datos | `docker compose exec postiz-postgres pg_dump -U postiz-user postiz-db > respaldo-$(date +%F).sql` |
| Ver flujos de publicación (depuración) | `ssh -L 8080:localhost:8080 root@IP_DEL_VPS` y abrir `http://localhost:8080` |

Recomendaciones:

- **Respalda la base de datos** a diario (por ejemplo con un cron) y guarda los respaldos
  fuera del VPS.
- Antes de pasar a producción, **fija la versión** de Postiz en `POSTIZ_VERSION` y
  actualiza a propósito, no por accidente.
- Durante las primeras semanas, **corre en paralelo con Metricool** una o dos marcas y
  verifica que todo se publique a tiempo.

## Probar en tu computadora (opcional)

Con Docker Desktop instalado, pon `POSTIZ_DOMAIN=localhost` en `.env` y ejecuta
`docker compose up -d`. Abre `https://localhost` y acepta el certificado local. Sirve
para ver la interfaz y la personalización. Las publicaciones solo salen mientras la
computadora esté encendida.

## Licencia

Postiz es AGPL-3.0. Este repo no modifica su código, solo lo configura y le agrega una
capa visual externa. Para uso interno no hay obligaciones adicionales.
