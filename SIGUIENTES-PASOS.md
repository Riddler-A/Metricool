# Prisma CN · Redes: estado y siguientes pasos

Este archivo es para la IA (o la persona) que continúe el proyecto. Léelo completo antes
de tocar nada. El detalle de cada paso está en `README.md`; aquí está **en qué punto
quedó todo y qué sigue, en orden**.

Última actualización: 15 de noviembre de 2026.

## Cómo trabajar con Alexis

- Alexis Jimenez es el dueño de Prisma CN. **No es programador**: explícale en español
  sencillo, paso a paso, y dile qué vas a hacer antes de cambiar algo importante.
- Si tienes la skill `prisma-cn`, cárgala: trae las reglas del servidor (`servidor.md`) y
  de la marca (`marca.md`). Si lo que dice la skill no coincide con este archivo, gana lo
  más reciente; revisa el servidor antes de decidir.
- **Nunca** pidas ni muestres contraseñas, llaves o el contenido de `.env`. Lo que lleve
  contraseña lo teclea Alexis, o lo genera un script sin mostrarlo.
- Pide permiso antes de borrar, publicar, enviar mensajes o cambiar configuraciones
  permanentes. No toques los otros sitios ni a los otros usuarios del servidor.
- **Empieza por las preguntas de la sección 6**: varias decisiones de los pasos siguientes
  dependen de sus respuestas. Hazlas pocas a la vez, no todas juntas.

## 1. Qué es

Herramienta interna para programar publicaciones y ver analítica de redes sociales, para
reemplazar a Metricool. Es [Postiz](https://github.com/gitroomhq/postiz-app) (código
abierto) con una capa visual de Prisma CN. Dirección final: https://redes.alexisconsultor.com

- Repo: `Riddler-A/Metricool`, rama `claude/festive-mayer-72bcyu`.
- Servidor: Contabo, `185.137.122.204`, Ubuntu 24.04 con HestiaCP. Usuario
  `alexisconsultorcom` (sin root). Carpeta de la herramienta: `~/apps/prisma-redes`.
- Conexión: `ssh -i ~/.ssh/hestia_alexisconsultor -o BatchMode=yes alexisconsultorcom@185.137.122.204`

## 2. Qué ya está hecho

- [x] Kit completo y probado en la computadora de Alexis con Docker Desktop: los 8
      servicios encienden, usa unos 3 GB de memoria, la marca se aplica.
- [x] Marca: paleta, tipografías (Fraunces + Inter), símbolo en la app y en el inicio de
      sesión, favicon, morados de Postiz cambiados a terracota, panel de testimonios de
      Postiz oculto, nombre "Prisma CN · Redes" en la pestaña.
- [x] Seguridad: puertos solo en `127.0.0.1`, cabeceras de seguridad, versión de Postiz
      fija (`v2.25.1`, la que se probó), `.env` fuera de git, historial sin secretos.
- [x] Scripts de instalación, revisión, verificación y respaldo (`scripts/`), probados en
      local.
- [x] Subdominio `redes.alexisconsultor.com` creado en Hestia con SSL de Let's Encrypt.
- [x] Archivos subidos al servidor en `~/apps/prisma-redes` (versión del 15-nov-2026).
- [x] `.env` del servidor ya creado con `scripts/crear-env.sh` (secretos nuevos, permisos
      600, puerto 3000, versión v2.25.1). Le faltan solo las llaves de las redes.
- [x] `scripts/revisar.sh` corrido en el servidor: solo marca las dos fallas de la
      sección 3 (Docker y la plantilla de Hestia).
- [x] **Módulo de reportes** (17-nov-2026, con gráficas): genera el "Reporte de resultados de redes
      sociales" de Prisma CN con su identidad visual y lo descarga en PDF. Vive en
      `/reportes` (botón "Reportes" en el menú de Postiz), es la app `reportes/` en el
      contenedor `prisma-reportes` y usa la sesión de Postiz. Probado en local con datos de
      ejemplo y 8 pruebas automáticas (`node --test reportes/pruebas.test.js`). Detalle en el README,
      sección "Reportes de resultados". **Falta probar "Traer datos de Postiz" con cuentas
      reales** (paso H).

## 3. Qué bloquea (lo hace Alexis, no la IA)

1. **Docker no está instalado en el servidor.** Se instala con `root` (README, paso 2).
   El mismo bloque crea 4 GB de swap y deja PM2 arrancando solo.
2. ~~HSTS en Hestia~~ Listo (18-nov-2026): plantilla `NODEJS3000`, puerto 3000 libre, SSL de
   Let's Encrypt, redirección a HTTPS y HSTS activos. Las dos apps de prueba de PM2 que usaban el
   3000 ("alexisconsultor" y "web-alexisconsultor") están detenidas con permiso de Alexis, sin
   borrar sus archivos; no las enciendas porque chocarían con esta herramienta.

## 4. Pasos cuando ya haya Docker (en este orden)

Cada paso dice cómo comprobar que salió bien. No avances si la comprobación falla.

**Paso A. Revisar el servidor (solo lectura).**
```bash
ssh -i ~/.ssh/hestia_alexisconsultor -o BatchMode=yes alexisconsultorcom@185.137.122.204 'docker --version; docker ps; free -h; ss -ltn | grep -E ":(3000|8233) "'
```
Bien si: Docker responde, `docker ps` no da error de permisos, hay al menos 3.5 GB
disponibles y los puertos 3000 y 8233 no aparecen. Si `docker ps` da "permission denied",
falta `usermod -aG docker alexisconsultorcom` (root) y volver a entrar por SSH. Si el 3000
está ocupado, revisa con `pm2 list` que las apps de prueba sigan detenidas (sección 3).

**Paso B. Subir la versión actual del repo.** Desde la carpeta del repo, en la computadora:
```bash
git archive HEAD | ssh -i ~/.ssh/hestia_alexisconsultor -o BatchMode=yes alexisconsultorcom@185.137.122.204 'mkdir -p ~/apps/prisma-redes && chmod 700 ~/apps ~/apps/prisma-redes && cd ~/apps/prisma-redes && tar -x'
```
`git archive` no incluye `.env`, así que no pisa el del servidor.

**Paso C. Confirmar el `.env` del servidor (ya está creado).**
```bash
ssh ... 'cd ~/apps/prisma-redes && bash scripts/revisar.sh'
```
Bien si la parte "Configuración (.env)" sale toda en OK. Si el archivo no existiera,
`bash scripts/crear-env.sh` lo crea con secretos nuevos sin mostrarlos (y no toca uno que
ya exista). No copies el `.env` de la computadora: ese es de prueba (`NOT_SECURED=true`,
puerto 4007). **No lo borres ni lo regeneres después de arrancar**: las bases de datos
quedan creadas con esas contraseñas.

**Paso D. Instalar.**
```bash
ssh ... 'cd ~/apps/prisma-redes && bash scripts/instalar.sh'
```
Corre `revisar.sh`, descarga unos 3 GB, enciende y corre `verificar.sh`. Tarda entre 5 y
10 minutos. Bien si termina en "sin fallas". El aviso de "REGISTRO ABIERTO" es normal en
este punto.

**Paso E. Crear las cuentas y cerrar el registro (de inmediato).** Mientras el registro
esté abierto, cualquiera puede crearse una cuenta. Alexis abre
https://redes.alexisconsultor.com, crea su cuenta (la primera es la administradora) y las
del equipo. Luego:
```bash
ssh ... 'cd ~/apps/prisma-redes && sed -i "s/^DISABLE_REGISTRATION=.*/DISABLE_REGISTRATION=true/" .env && docker compose up -d && bash scripts/verificar.sh'
```
Bien si `verificar.sh` dice "Registro cerrado".

**Paso F. Respaldo diario.** Con permiso de Alexis (es una configuración permanente):
```bash
ssh ... '(crontab -l 2>/dev/null; echo "15 3 * * * bash \$HOME/apps/prisma-redes/scripts/respaldo.sh >> \$HOME/respaldos-redes/respaldo.log 2>&1") | crontab - && bash ~/apps/prisma-redes/scripts/respaldo.sh'
```
Antes revisa con `crontab -l` que la línea no exista ya. Bien si aparece un archivo en
`~/respaldos-redes/`.

**Paso G. Conectar Facebook e Instagram** (README, sección 6). Alexis crea la app en
developers.facebook.com y pone él mismo el App ID y el App Secret en el `.env` del
servidor (`nano .env`), y luego `docker compose up -d`. Depende de las preguntas 1 a 3.

**Paso H. Probar de verdad.** Programar una publicación de prueba en una cuenta propia de
Prisma CN, confirmar que sale a la hora y que la analítica carga. Correr una o dos marcas
en paralelo con Metricool unas semanas antes de cancelarlo.

**Paso H2. Probar los reportes con datos reales.** Con al menos una cuenta conectada y
publicaciones de un mes: Reportes → Crear reporte → elegir la cuenta → "Traer datos de
Postiz". Comparar alcance, likes, comentarios, guardados y compartidos contra Meta Business
Suite del mismo periodo. Puntos a revisar, porque solo se probaron con un Postiz simulado:
- Que las etiquetas de métricas que manda cada red coincidan con `ETIQUETAS` en
  `reportes/calculos.js` (Instagram: Reach, Views, Likes, Comments, Saves, Shares). Si una
  métrica sale vacía, revisar qué `label` entrega `GET /api/analytics/post/<id>`.
- Que el formato (video, carrusel, imagen) salga bien: se lee de `GET /api/posts/<id>`.
- Que las gráficas diarias salgan: usan las métricas con un punto por día de
  `GET /api/analytics/<cuenta>?date=N` (Instagram: reach y follower_count). Si la gráfica
  de alcance por día no aparece, revisar qué etiquetas trae esa respuesta.
- Que las miniaturas del ranking carguen: salen de `image[0].thumbnail` o `image[0].path`
  del post. Si la red guarda la imagen fuera de Postiz, puede verse el recuadro vacío.
- Seguidores nuevos: la red solo guarda ~30 días; el periodo anterior suele ir a mano.
- Importar un CSV real de cada plataforma que use Alexis (Meta, TikTok, Google Ads). Los
  nombres de columna se reconocen por sinónimos en `reportes/pauta-csv.js` (`SINONIMOS`),
  probados solo con archivos de ejemplo. Si una columna no se reconoce, agrega su nombre ahí
  y un caso en `pruebas.test.js`.
Si algo no cuadra, corrígelo en `calculos.js` o `postiz.js`, agrega el caso a
`reportes/pruebas.test.js` y vuelve a subir.

**Paso H2c. Enlaces rastreables y registro del cliente.** Con Alexis: crear los enlaces de
cada cliente (uno por red y por anuncio) y cambiar los links de las biografías y anuncios por
los cortos; crear el registro de cada cliente y mandarle su enlace privado (hay botón "Copiar
mensaje para WhatsApp"). Comprobar en el servidor que `/r/…` redirige y cuenta, y que `/c/…`
abre sin sesión. Las rutas `/r/` y `/c/` las atiende el nginx de la capa de marca.

**Paso H2b. Diseñar los embudos reales.** Con Alexis, en Reportes → Embudos, crear el
embudo de cada cliente (empezar con una plantilla y ajustar etapas). Preguntarle qué etapas
mide cada negocio fuera de redes (citas, reservas, ventas en tienda) y quién le pasa esos
números cada mes: esas etapas van como "se escribe a mano".

**Paso H3 (más adelante). Conectar las plataformas de anuncios por API.** Hoy la pauta se
importa por CSV. Traerla sola requiere: Meta Marketing API (app de Meta con permiso
`ads_read` y revisión), TikTok Business API (cuenta de desarrollador y aprobación) y Google Ads
API (developer token aprobado por Google). Preguntar a Alexis si vale la pena antes de empezar.

**Paso I. Cerrar pendientes.** Actualizar `servidor.md` de la skill `prisma-cn` con la
fila de `redes.` (carpeta `~/apps/prisma-redes`, Docker, puerto 3000 / NODEJS3000) y
actualizar este archivo.

## 5. Cosas que ya se sabe que pueden fallar

- **Otro sitio en el mismo puerto.** El servidor lo comparten varios usuarios de Hestia y
  cualquiera puede ocupar un puerto. Por eso `verificar.sh` comprueba que la dirección
  muestre esta herramienta. Si muestra otra cosa, el problema es la plantilla de proxy.
- **Memoria justa.** El servidor tiene 7.8 GB y unos 5 GB libres; Postiz usa 3 GB. Sin
  swap, un pico puede tumbar los otros sitios. No instales si `revisar.sh` marca falla de
  memoria.
- **El servidor a veces no responde desde la red del ITESO** (pasó el 11-nov-2026: ni SSH
  ni HTTPS, y luego volvió solo). Si no conecta, prueba más tarde o desde otra red antes de
  concluir que está caído.
- **Conectar redes en la computadora no funciona.** Meta y las demás exigen la dirección
  real con HTTPS. La copia local solo sirve para ver la interfaz y la marca.
- **Actualizar Postiz puede romper la marca**, porque `branding/brand.css` depende de
  nombres de clases y variables de Postiz. Tras actualizar, revisar a ojo el inicio de
  sesión y el calendario, en tema claro y oscuro.
- **Los respaldos no incluyen los archivos subidos** (imágenes y videos), que viven en el
  volumen de Docker `postiz-uploads`. Sí incluyen la base de datos y los reportes.
- **Actualizar Postiz puede romper "Traer datos de Postiz"**, porque los reportes usan la
  API interna de Postiz (`/api/posts`, `/api/analytics/...`, `/api/integrations/list`).
  Tras actualizar, crear un reporte de prueba y traer datos. El botón "Reportes" del menú
  se agrega con `branding/brand.js` copiando el botón "Media"; si desaparece, revisar ahí.
- **Alcance del reporte = suma del alcance de cada publicación** del periodo. No es igual
  al "alcance de la cuenta" de Meta (personas únicas): suele salir más alto. Está explicado
  en la metodología del reporte; si Alexis prefiere el de la cuenta, se llena a mano.

## 6. Preguntas para Alexis

Hazlas antes de los pasos G y H, pocas a la vez. Anota aquí las respuestas.

**Redes y cuentas**
1. ¿Qué redes necesitas primero? (Instagram, Facebook, TikTok, LinkedIn, YouTube,
   Threads, Google Business...) Cada una pide crear una app de desarrollador distinta.
2. ¿Cuántas marcas o clientes vas a manejar al inicio, y sus cuentas de Instagram son
   profesionales y están ligadas a una página de Facebook? De eso depende si se usa
   "Instagram (Facebook Business)" o "Instagram (Standalone)".
3. ¿Ya tienes un Business Manager de Meta donde tus clientes te hayan dado acceso a sus
   páginas? Sin revisión de Meta (App Review), solo pueden conectar cuentas las personas
   agregadas como probadoras de la app.

**Equipo**
4. ¿Quién más va a usar la herramienta y qué debe poder hacer cada quien (publicar, solo
   proponer, solo ver)?
5. ¿Tus clientes van a entrar a aprobar publicaciones, o solo tu equipo?

**Funciones**
6. ¿Quieres que la herramienta redacte textos con IA? Requiere una llave de OpenAI y se
   paga por uso, aparte.
7. ¿Quieres que mande correos (invitaciones al equipo, recuperar contraseña)? Requiere
   que el buzón `estrategias@` tenga SMTP configurado, que sigue pendiente. Sin correo,
   una contraseña olvidada solo se recupera desde el servidor.
8. ¿Qué usas hoy de Metricool que no puedes perder? (reportes en PDF, bandeja de mensajes,
   análisis de competidores, enlace en bio...) Postiz no trae todo eso; conviene saberlo
   antes de cancelar Metricool.

**Operación**
9. ¿Quién tiene la contraseña de `root` del servidor y quién va a instalar Docker?
10. ¿Dónde quieres guardar una copia de los respaldos fuera del servidor (Google Drive,
    tu computadora)? Hoy solo quedarían en el mismo servidor.
11. ¿Vas a subir videos pesados? El disco tiene unos 90 GB libres y los archivos subidos
    no se borran solos.
12. ¿Hasta cuándo tienes pagado Metricool? Marca la fecha límite para tener esto probado.

## 7. Copia de prueba en la computadora de Alexis

- Corre con Docker Desktop en http://localhost:4007 (su `.env` local usa el puerto 4007 y
  `NOT_SECURED=true`). Encender: `docker compose up -d`. Apagar: `docker compose stop`.
- Hay una cuenta de prueba de la IA; sus datos están en `.env.prueba-local` (fuera de
  git). La cuenta de Alexis es otra y su contraseña solo la sabe él.
- Ocupa unos 3 GB de memoria mientras está encendida.
