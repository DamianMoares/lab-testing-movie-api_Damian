![logo_ironhack_blue 7](https://user-images.githubusercontent.com/23629340/40541063-a07a0a8a-601a-11e8-91b5-2f13e4e6b441.png)

# Lab | TDD con Jest y Supertest — Testear la API de Películas

## Objetivo

Aplicar el ciclo **Red → Green → Refactor** para añadir una nueva funcionalidad a la API: el sistema de **favoritos**. Escribirás los tests primero, luego la implementación, siguiendo TDD estricto. También testearás los middlewares de autenticación con mocks.

## Requisitos previos

- Haber completado los labs D1 y D2 de w7 (API con auth JWT y PostgreSQL)
- Haber leído el material del D3 de w7
- Node.js v18+

## Lo que vas a construir (en orden TDD)

```
POST /api/favoritos/:peliculaId   ← Añadir película a favoritos
DELETE /api/favoritos/:peliculaId ← Quitar de favoritos
GET /api/favoritos                ← Listar favoritos del usuario autenticado
```

## Paso 1: Instalar dependencias de test

```bash
npm install --save-dev jest supertest
```

Añade a `package.json`:

```json
{
  "scripts": {
    "test": "jest",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage"
  },
  "jest": {
    "testEnvironment": "node",
    "testMatch": ["**/__tests__/**/*.test.js"]
  }
}
```

Crea la carpeta de tests:

```bash
mkdir -p src/__tests__
```

## Paso 2: Configurar una base de datos de test

Añade al `.env`:

```
DB_TEST_NAME=peliculas_test
```

Crea la base de datos de test en psql:

```sql
CREATE DATABASE peliculas_test;
\c peliculas_test
-- Copia el mismo schema que peliculas_db
```

Modifica `src/config/db.js` para usar `DB_TEST_NAME` en entorno de test:

```javascript
const { Pool } = require('pg')

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.NODE_ENV === 'test'
    ? process.env.DB_TEST_NAME
    : process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD
})

module.exports = pool
```

Crea `src/__tests__/setup.js` para limpiar la DB entre tests:

```javascript
const pool = require('../config/db')

beforeAll(async () => {
  // Crear tablas si no existen
  await pool.query(`
    CREATE TABLE IF NOT EXISTS usuarios (
      id SERIAL PRIMARY KEY,
      nombre VARCHAR(100) NOT NULL,
      email VARCHAR(150) UNIQUE NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      rol VARCHAR(20) NOT NULL DEFAULT 'usuario',
      activo BOOLEAN DEFAULT true,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `)

  await pool.query(`
    CREATE TABLE IF NOT EXISTS peliculas (
      id SERIAL PRIMARY KEY,
      titulo VARCHAR(255) NOT NULL,
      anio INTEGER,
      nota NUMERIC(3,1),
      director_id INTEGER,
      genero_id INTEGER,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `)

  await pool.query(`
    CREATE TABLE IF NOT EXISTS favoritos (
      id SERIAL PRIMARY KEY,
      usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
      pelicula_id INTEGER NOT NULL REFERENCES peliculas(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(usuario_id, pelicula_id)
    )
  `)
})

beforeEach(async () => {
  // Limpiar datos entre cada test
  await pool.query('DELETE FROM favoritos')
  await pool.query('DELETE FROM peliculas')
  await pool.query('DELETE FROM usuarios')
})

afterAll(async () => {
  await pool.end()
})
```

Actualiza `jest` en `package.json` para usar el setup:

```json
"jest": {
  "testEnvironment": "node",
  "testMatch": ["**/__tests__/**/*.test.js"],
  "setupFilesAfterFramework": ["./src/__tests__/setup.js"],
  "globalSetup": "./src/__tests__/setup.js"
}
```

> **Nota**: Para simplificar, en los tests de este lab usaremos helpers para insertar datos directamente en la DB de test y generaremos tokens JWT válidos sin hacer peticiones reales de login.

## Paso 3: Helper de tests

Crea `src/__tests__/helpers.js`:

```javascript
const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken')
const pool = require('../config/db')

const crearUsuario = async ({ nombre = 'Test User', email = 'test@test.com', password = 'pass123', rol = 'usuario' } = {}) => {
  const password_hash = await bcrypt.hash(password, 10)
  const { rows } = await pool.query(
    `INSERT INTO usuarios (nombre, email, password_hash, rol)
     VALUES ($1, $2, $3, $4)
     RETURNING id, nombre, email, rol`,
    [nombre, email, password_hash, rol]
  )
  const usuario = rows[0]
  const token = jwt.sign(
    { id: usuario.id, email: usuario.email, rol: usuario.rol },
    process.env.JWT_SECRET || 'test-secret',
    { expiresIn: '1h' }
  )
  return { usuario, token }
}

const crearPelicula = async ({ titulo = 'Película Test', anio = 2024, nota = 8.0 } = {}) => {
  const { rows } = await pool.query(
    `INSERT INTO peliculas (titulo, anio, nota) VALUES ($1, $2, $3) RETURNING *`,
    [titulo, anio, nota]
  )
  return rows[0]
}

module.exports = { crearUsuario, crearPelicula }
```

## Paso 4: RED — Escribe los tests primero (fallarán)

Crea `src/__tests__/favoritos.test.js`:

```javascript
const request = require('supertest')
const app = require('../../index')
const { crearUsuario, crearPelicula } = require('./helpers')

describe('Favoritos', () => {

  describe('POST /api/favoritos/:peliculaId', () => {

    it('debe añadir una película a favoritos (201)', async () => {
      const { token } = await crearUsuario()
      const pelicula = await crearPelicula()

      const res = await request(app)
        .post(`/api/favoritos/${pelicula.id}`)
        .set('Authorization', `Bearer ${token}`)

      expect(res.status).toBe(201)
      expect(res.body).toHaveProperty('ok', true)
      expect(res.body.favorito).toHaveProperty('pelicula_id', pelicula.id)
    })

    it('debe devolver 401 sin token', async () => {
      const pelicula = await crearPelicula()

      const res = await request(app)
        .post(`/api/favoritos/${pelicula.id}`)

      expect(res.status).toBe(401)
    })

    it('debe devolver 404 si la película no existe', async () => {
      const { token } = await crearUsuario()

      const res = await request(app)
        .post('/api/favoritos/99999')
        .set('Authorization', `Bearer ${token}`)

      expect(res.status).toBe(404)
    })

    it('debe devolver 409 si la película ya está en favoritos', async () => {
      const { token, usuario } = await crearUsuario()
      const pelicula = await crearPelicula()

      // Primera vez
      await request(app)
        .post(`/api/favoritos/${pelicula.id}`)
        .set('Authorization', `Bearer ${token}`)

      // Segunda vez — debe fallar
      const res = await request(app)
        .post(`/api/favoritos/${pelicula.id}`)
        .set('Authorization', `Bearer ${token}`)

      expect(res.status).toBe(409)
    })
  })

  describe('DELETE /api/favoritos/:peliculaId', () => {

    it('debe eliminar una película de favoritos (200)', async () => {
      const { token } = await crearUsuario()
      const pelicula = await crearPelicula()

      // Primero añadir
      await request(app)
        .post(`/api/favoritos/${pelicula.id}`)
        .set('Authorization', `Bearer ${token}`)

      // Luego eliminar
      const res = await request(app)
        .delete(`/api/favoritos/${pelicula.id}`)
        .set('Authorization', `Bearer ${token}`)

      expect(res.status).toBe(200)
      expect(res.body).toHaveProperty('ok', true)
    })

    it('debe devolver 404 si el favorito no existe', async () => {
      const { token } = await crearUsuario()
      const pelicula = await crearPelicula()

      const res = await request(app)
        .delete(`/api/favoritos/${pelicula.id}`)
        .set('Authorization', `Bearer ${token}`)

      expect(res.status).toBe(404)
    })
  })

  describe('GET /api/favoritos', () => {

    it('debe devolver los favoritos del usuario autenticado', async () => {
      const { token } = await crearUsuario()
      const pelicula1 = await crearPelicula({ titulo: 'Peli 1' })
      const pelicula2 = await crearPelicula({ titulo: 'Peli 2' })

      await request(app)
        .post(`/api/favoritos/${pelicula1.id}`)
        .set('Authorization', `Bearer ${token}`)

      await request(app)
        .post(`/api/favoritos/${pelicula2.id}`)
        .set('Authorization', `Bearer ${token}`)

      const res = await request(app)
        .get('/api/favoritos')
        .set('Authorization', `Bearer ${token}`)

      expect(res.status).toBe(200)
      expect(res.body).toHaveLength(2)
      expect(res.body[0]).toHaveProperty('titulo')
    })

    it('los favoritos de un usuario no incluyen los de otro', async () => {
      const { token: token1 } = await crearUsuario({ email: 'user1@test.com' })
      const { token: token2 } = await crearUsuario({ email: 'user2@test.com' })
      const pelicula = await crearPelicula()

      await request(app)
        .post(`/api/favoritos/${pelicula.id}`)
        .set('Authorization', `Bearer ${token1}`)

      const res = await request(app)
        .get('/api/favoritos')
        .set('Authorization', `Bearer ${token2}`)

      expect(res.status).toBe(200)
      expect(res.body).toHaveLength(0)
    })
  })
})
```

Ejecuta los tests. Todos deben **fallar** en rojo:

```bash
NODE_ENV=test npx jest favoritos.test.js
```

## Paso 5: Tests para el middleware `verificarToken`

Crea `src/__tests__/verificarToken.test.js`:

```javascript
const request = require('supertest')
const jwt = require('jsonwebtoken')
const app = require('../../index')

describe('Middleware verificarToken', () => {

  it('debe rechazar peticiones sin header Authorization (401)', async () => {
    const res = await request(app)
      .get('/api/favoritos')

    expect(res.status).toBe(401)
    expect(res.body).toHaveProperty('error')
  })

  it('debe rechazar tokens con formato incorrecto (401)', async () => {
    const res = await request(app)
      .get('/api/favoritos')
      .set('Authorization', 'token-sin-bearer')

    expect(res.status).toBe(401)
  })

  it('debe rechazar tokens expirados (401)', async () => {
    const tokenExpirado = jwt.sign(
      { id: 1, email: 'test@test.com', rol: 'usuario' },
      process.env.JWT_SECRET || 'test-secret',
      { expiresIn: '0s' }
    )

    const res = await request(app)
      .get('/api/favoritos')
      .set('Authorization', `Bearer ${tokenExpirado}`)

    expect(res.status).toBe(401)
    expect(res.body.error).toMatch(/expirado/i)
  })

  it('debe rechazar tokens firmados con el secreto incorrecto (401)', async () => {
    const tokenFalso = jwt.sign(
      { id: 1, email: 'test@test.com', rol: 'usuario' },
      'secreto-incorrecto',
      { expiresIn: '1h' }
    )

    const res = await request(app)
      .get('/api/favoritos')
      .set('Authorization', `Bearer ${tokenFalso}`)

    expect(res.status).toBe(401)
  })
})
```

## Paso 6: GREEN — Implementar la funcionalidad

Ahora implementa para que los tests pasen. Crea la tabla:

```sql
\c peliculas_test  -- (y luego en peliculas_db también)

CREATE TABLE favoritos (
  id          SERIAL PRIMARY KEY,
  usuario_id  INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  pelicula_id INTEGER NOT NULL REFERENCES peliculas(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(usuario_id, pelicula_id)
);
```

Crea `src/controllers/favoritosController.js`:

```javascript
const pool = require('../config/db')
const AppError = require('../utils/AppError')

// POST /api/favoritos/:peliculaId
const añadirFavorito = async (req, res, next) => {
  try {
    const peliculaId = Number(req.params.peliculaId)
    const usuarioId = req.usuario.id

    const pelicula = await pool.query('SELECT id FROM peliculas WHERE id = $1', [peliculaId])
    if (pelicula.rows.length === 0) {
      throw new AppError('Película no encontrada', 404)
    }

    try {
      const { rows } = await pool.query(
        `INSERT INTO favoritos (usuario_id, pelicula_id) VALUES ($1, $2) RETURNING *`,
        [usuarioId, peliculaId]
      )
      res.status(201).json({ ok: true, favorito: rows[0] })
    } catch (err) {
      if (err.code === '23505') {
        throw new AppError('Esta película ya está en tus favoritos', 409)
      }
      throw err
    }

  } catch (err) {
    next(err)
  }
}

// DELETE /api/favoritos/:peliculaId
const quitarFavorito = async (req, res, next) => {
  try {
    const peliculaId = Number(req.params.peliculaId)
    const usuarioId = req.usuario.id

    const { rowCount } = await pool.query(
      'DELETE FROM favoritos WHERE usuario_id = $1 AND pelicula_id = $2',
      [usuarioId, peliculaId]
    )

    if (rowCount === 0) {
      throw new AppError('Favorito no encontrado', 404)
    }

    res.json({ ok: true, mensaje: 'Eliminado de favoritos' })
  } catch (err) {
    next(err)
  }
}

// GET /api/favoritos
const listarFavoritos = async (req, res, next) => {
  try {
    const usuarioId = req.usuario.id

    const { rows } = await pool.query(
      `SELECT p.id, p.titulo, p.anio, p.nota, f.created_at AS añadido_en
       FROM favoritos f
       JOIN peliculas p ON p.id = f.pelicula_id
       WHERE f.usuario_id = $1
       ORDER BY f.created_at DESC`,
      [usuarioId]
    )

    res.json(rows)
  } catch (err) {
    next(err)
  }
}

module.exports = { añadirFavorito, quitarFavorito, listarFavoritos }
```

Crea `src/routes/favoritos.js`:

```javascript
const { Router } = require('express')
const router = Router()
const verificarToken = require('../middleware/verificarToken')
const { añadirFavorito, quitarFavorito, listarFavoritos } = require('../controllers/favoritosController')

router.use(verificarToken)

router.post('/:peliculaId', añadirFavorito)
router.delete('/:peliculaId', quitarFavorito)
router.get('/', listarFavoritos)

module.exports = router
```

Monta en `index.js`:

```javascript
const favoritosRouter = require('./src/routes/favoritos')
app.use('/api/favoritos', favoritosRouter)
```

Asegúrate de exportar `app` sin llamar a `listen` en modo test:

```javascript
// Al final de index.js
if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`Servidor en http://localhost:${PORT}`)
  })
}

module.exports = app
```

Ejecuta los tests de nuevo — deben pasar en verde:

```bash
NODE_ENV=test npx jest
```

## Paso 7: REFACTOR — Mejorar sin romper

Extrae la verificación de película a un helper compartido en `src/utils/verificarPelicula.js`:

```javascript
const pool = require('../config/db')
const AppError = require('./AppError')

const verificarPeliculaExiste = async (peliculaId) => {
  const result = await pool.query('SELECT id FROM peliculas WHERE id = $1', [peliculaId])
  if (result.rows.length === 0) {
    throw new AppError('Película no encontrada', 404)
  }
  return result.rows[0]
}

module.exports = verificarPeliculaExiste
```

Usa este helper en `favoritosController.js` y en cualquier controlador que lo necesite. Corre los tests de nuevo para confirmar que el refactor no rompió nada:

```bash
NODE_ENV=test npx jest
```

## Paso 8: Cobertura de código

```bash
NODE_ENV=test npx jest --coverage
```

Observa el informe de cobertura. Identifica qué líneas no están cubiertas y escribe tests adicionales para aumentar la cobertura de `favoritosController.js` por encima del **80%**.

## Parte 2: Reflexión

Responde en `NOTAS.md`:

1. **¿Qué ventaja tiene escribir los tests ANTES de la implementación?** Describe una situación donde haberlos escrito después habría escondido un bug.

2. **¿Por qué usamos una base de datos de test separada en lugar de mockear el módulo `db`?** ¿Cuándo sí tendría sentido mockear?

3. **¿Qué es el error de PostgreSQL con código `23505` y por qué lo capturamos específicamente?**

## Criterios de evaluación

- [ ] `npm test` ejecuta todos los tests sin error
- [ ] Los tests de `POST /api/favoritos/:id` cubren: éxito (201), sin token (401), película inexistente (404), duplicado (409)
- [ ] Los tests de `DELETE /api/favoritos/:id` cubren: éxito (200), favorito inexistente (404)
- [ ] Los tests de `GET /api/favoritos` verifican que cada usuario solo ve sus propios favoritos
- [ ] Los tests de `verificarToken` cubren: sin header, formato incorrecto, token expirado, secreto incorrecto
- [ ] La implementación pasa todos los tests en verde
- [ ] La cobertura de `favoritosController.js` supera el 80%
- [ ] El refactor de `verificarPeliculaExiste` está aplicado y los tests siguen pasando

## Bonus

1. **Test de integración completo**: Escribe un test que simule el flujo completo: registro → login → buscar películas → añadir a favoritos → listar favoritos → eliminar de favoritos. Cada paso usa el token del anterior.

2. **Mock de bcrypt**: En el helper de tests, en lugar de llamar a `bcrypt.hash` (lento), usa `jest.mock` para que siempre devuelva un hash fijo. Mide cuánto más rápido es la suite de tests.

3. **Test parametrizado**: Usa `test.each` para testear múltiples casos de validación del registro (email inválido, contraseña corta, campos vacíos) sin repetir código.