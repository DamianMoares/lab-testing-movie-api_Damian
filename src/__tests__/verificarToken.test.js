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