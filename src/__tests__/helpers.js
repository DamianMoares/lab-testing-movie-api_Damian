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