const { Pool } = require('pg')

const pool = new Pool({
    host: process.env.DB_HOST || 'LOCALHOST',
    port: process.env.DB_PORT || 5432,
    database: process.env.NODE_ENV === 'test'
        ? process.env.DB_TEST_NAME
        : process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD
})

module.exports = pool