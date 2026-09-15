const { Client } = require('pg');

exports.handler = async (event) => {
    const client = new Client({
        host: process.env.DB_HOST || 'localhost',
        port: process.env.DB_PORT || 5432,
        user: process.env.DB_USER || 'fixlat_user',
        password: process.env.DB_PASSWORD || 'fixlat_password',
        database: process.env.DB_NAME || 'fixlat_db',
    });

    try {
        await client.connect();

        const query = `
      SELECT 
        COUNT(*)::int AS total,
        COUNT(CASE WHEN status = 'Pendiente' THEN 1 END)::int AS pendiente,
        COUNT(CASE WHEN status = 'En curso' THEN 1 END)::int AS en_curso,
        COUNT(CASE WHEN status = 'Hecho' THEN 1 END)::int AS hecho
      FROM notes;
    `;

        const res = await client.query(query);
        const metrics = res.rows[0] || { total: 0, pendiente: 0, en_curso: 0, hecho: 0 };

        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
            },
            body: JSON.stringify(metrics),
        };
    } catch (error) {
        return {
            statusCode: 500,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
            },
            body: JSON.stringify({ error: error.message }),
        };
    } finally {
        await client.end().catch(() => {});
    }
};