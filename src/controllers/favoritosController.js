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