# NOTAS - Reflexión sobre TDD y Testing

## 1. ¿Qué ventaja tiene escribir los tests ANTES de la implementación? Describe una situación donde haberlos escrito después habría escondido un bug.

**Ventajas de escribir tests antes (TDD):**

- **Claridad de requisitos**: Los tests definen exactamente qué debe hacer el código antes de escribirlo
- **Diseño orientado a pruebas**: Obliga a pensar en la interfaz y estructura desde el principio
- **Seguridad contra regresiones**: Cada cambio está validado inmediatamente
- **Documentación viva**: Los tests sirven como especificación ejecutable

**Situación donde escribir tests después esconde un bug:**

Imaginemos que implementamos el endpoint `POST /api/favoritos/:peliculaId` sin tests primero:

```javascript
// Implementación sin tests (con bug)
const añadirFavorito = async (req, res, next) => {
  try {
    const peliculaId = Number(req.params.peliculaId)
    const usuarioId = req.usuario.id

    // BUG: No verificamos si la película existe
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
}
```

Si escribimos los tests después, podríamos pensar: "Ya funciona, solo necesito probarlo" y podríamos olvidar el caso de película inexistente. El bug permanecería oculto hasta que un usuario intente añadir una película que no existe, causando un error 500 en lugar del esperado 404.

Con TDD, el test `debe devolver 404 si la película no existe` nos obligaría a implementar la verificación desde el principio.

## 2. ¿Por qué usamos una base de datos de test separada en lugar de mockear el módulo `db`? ¿Cuándo sí tendría sentido mockear?

**Ventajas de base de datos de test separada:**

- **Realismo**: Tests ejecutan contra el mismo motor de base de datos que producción
- **Integración real**: Validan que las consultas SQL, constraints y relaciones funcionan
- **Detecta problemas de configuración**: Conexión, permisos, tipos de datos
- **Testing de transacciones**: Podemos probar rollback, commits y comportamiento concurrente
- **Validación de schema**: Tests fallan si el schema no coincide con lo esperado

**Cuándo sí tendría sentido mockear:**

- **Tests unitarios puros**: Cuando queremos probar solo la lógica de negocio sin dependencias externas
- **Microservicios**: Para probar un servicio sin depender de otros servicios
- **Performance**: Cuando las operaciones de base de datos son muy lentas y afectan el tiempo de ejecución de tests
- **Entornos CI/CD limitados**: Cuando no hay recursos para mantener una base de datos de test
- **Escenarios de error**: Para simular errores específicos de base de datos que son difíciles de reproducir

**Ejemplo de cuándo mockear:**
```javascript
// Test unitario de lógica de negocio
const calcularDescuento = (usuario, producto) => {
  if (usuario.rol === 'premium' && producto.precio > 100) {
    return producto.precio * 0.1; // 10% descuento
  }
  return 0;
}

// Aquí no necesitamos base de datos, es lógica pura
```

## 3. ¿Qué es el error de PostgreSQL con código `23505` y por qué lo capturamos específicamente?

**Error PostgreSQL 23505: `unique_violation`**

Este error ocurre cuando se intenta insertar un registro que viola una restricción `UNIQUE` en la base de datos.

**En nuestro contexto:**
```sql
CREATE TABLE favoritos (
  id SERIAL PRIMARY KEY,
  usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  pelicula_id INTEGER NOT NULL REFERENCES peliculas(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(usuario_id, pelicula_id)  -- ← Esta restricción causa el 23505
);
```

**Por qué lo capturamos específicamente:**

1. **Significado de negocio**: El error 23505 significa "el usuario ya tiene esta película en favoritos"
2. **Experiencia de usuario**: Devolver un 409 (Conflict) con mensaje claro es mejor que un 500 (Error interno)
3. **Consistencia**: Todos los intentos de duplicación devuelven el mismo error predecible
4. **Logging**: Podemos registrar intentos de duplicación para análisis
5. **Testing**: Los tests pueden verificar específicamente este caso de uso

**Implementación:**
```javascript
try {
  const { rows } = await pool.query(
    `INSERT INTO favoritos (usuario_id, pelicula_id) VALUES ($1, $2) RETURNING *`,
    [usuarioId, peliculaId]
  )
  res.status(201).json({ ok: true, favorito: rows[0] })
} catch (err) {
  if (err.code === '23505') {
    // Convertimos error técnico de BD en error amigable para el API
    throw new AppError('Esta película ya está en tus favoritos', 409)
  }
  throw err
}
```

**Otros códigos PostgreSQL comunes:**
- `23503`: `foreign_key_violation` - Referencia a registro que no existe
- `23502`: `not_null_violation` - Campo obligatorio es nulo
- `23514`: `check_violation` - Violación de constraint CHECK

Capturar estos códigos específicamente nos permite dar respuestas HTTP adecuadas y significativas a los clientes de nuestra API.
