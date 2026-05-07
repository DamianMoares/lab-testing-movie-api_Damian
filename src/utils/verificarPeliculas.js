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