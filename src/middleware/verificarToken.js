const jwt = require('jsonwebtoken')
const AppError = require('../utils/AppError')

const verificarToken = (req, res, next) => {
  try {
    // Verificar que existe el header Authorization
    const authHeader = req.headers.authorization
    if (!authHeader) {
      return res.status(401).json({ error: 'Token no proporcionado' })
    }

    // Verificar formato del token (Bearer token)
    const token = authHeader.split(' ')[1]
    if (!token || authHeader.split(' ')[0] !== 'Bearer') {
      return res.status(401).json({ error: 'Formato de token inválido' })
    }

    // Verificar y decodificar el token
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'test-secret')
    
    // Añadir la información del usuario al request
    req.usuario = decoded
    
    next()
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expirado' })
    } else if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: 'Token inválido' })
    } else {
      return res.status(401).json({ error: 'Error de autenticación' })
    }
  }
}

module.exports = verificarToken
