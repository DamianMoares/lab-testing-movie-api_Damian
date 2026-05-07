require('dotenv').config()
const express = require('express')
const cors = require('cors')
const app = express()

// Middlewares
app.use(cors())
app.use(express.json())

// Rutas
const favoritosRouter = require('./src/routes/favoritos')
app.use('/api/favoritos', favoritosRouter)

// Manejo de errores
app.use((err, req, res, next) => {
  console.error(err.stack)
  res.status(err.status || 500).json({
    error: err.message || 'Error interno del servidor'
  })
})

const PORT = process.env.PORT || 3000

// Exportar app para tests
if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`Servidor en http://localhost:${PORT}`)
  })
}

module.exports = app