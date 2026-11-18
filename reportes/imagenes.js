// Fotos de los anuncios. Llegan desde el navegador ya reducidas (data URL) y aquí se
// revisan antes de guardarlas: solo JPG o PNG de verdad (por sus primeros bytes, no por
// lo que diga el navegador), con tamaño máximo y nombre aleatorio.

const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');

const MAX_BYTES = 1.5 * 1024 * 1024;
const NOMBRE = /^[a-f0-9]{16}\.(jpg|png)$/;

function carpeta(datos) {
  const dir = path.join(datos, 'imagenes');
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function tipoReal(buf) {
  if (buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'jpg';
  if (buf.length > 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'png';
  return null;
}

// Devuelve el nombre del archivo guardado o lanza un error con mensaje para el equipo.
async function guardar(datos, dataUrl) {
  const m = /^data:image\/(jpeg|png);base64,([A-Za-z0-9+/=]+)$/.exec(String(dataUrl || ''));
  if (!m) throw new Error('La foto no es una imagen JPG o PNG válida.');
  const buf = Buffer.from(m[2], 'base64');
  if (buf.length > MAX_BYTES) throw new Error('La foto pesa demasiado (máximo 1.5 MB).');
  const tipo = tipoReal(buf);
  if (!tipo) throw new Error('El archivo no es una imagen JPG o PNG.');
  const nombre = `${crypto.randomBytes(8).toString('hex')}.${tipo}`;
  await fsp.writeFile(path.join(carpeta(datos), nombre), buf, { mode: 0o600 });
  return nombre;
}

function valida(nombre) {
  return NOMBRE.test(String(nombre || ''));
}

// Envía la imagen; responde 404 si el nombre no es válido o no existe.
function servir(datos, nombre, res) {
  if (!valida(nombre)) {
    res.writeHead(404);
    return res.end();
  }
  const archivo = path.join(carpeta(datos), nombre);
  fs.stat(archivo, (err) => {
    if (err) {
      res.writeHead(404);
      return res.end();
    }
    res.writeHead(200, {
      'content-type': nombre.endsWith('.png') ? 'image/png' : 'image/jpeg',
      'cache-control': 'private, max-age=86400',
      'x-content-type-options': 'nosniff',
    });
    fs.createReadStream(archivo).pipe(res);
  });
}

module.exports = { guardar, servir, valida };
