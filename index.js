const favoritosRouter = require('./src/routes/favoritos')
app.use('/api/favoritos', favoritosRouter)

// exportar al app
if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`Servidor en http://localhost:${PORT}`)
  })
}

module.exports = app