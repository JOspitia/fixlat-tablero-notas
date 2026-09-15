import { Client } from 'pg';
import { APIGatewayProxyHandler, APIGatewayProxyResult } from 'aws-lambda';

interface DashboardMetrics {
    total: number;
    pendiente: number;
    en_curso: number;
    hecho: number;
}

const CORS_HEADERS = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
};

export const handler: APIGatewayProxyHandler = async (): Promise<APIGatewayProxyResult> => {
    const client = new Client({
        host: process.env.DB_HOST || 'localhost',
        port: Number(process.env.DB_PORT) || 5432,
        user: process.env.DB_USER || 'fixlat_user',
        password: process.env.DB_PASSWORD || 'fixlat_password',
        database: process.env.DB_NAME || 'fixlat_db',
    });

    try {
        await client.connect();

        const query = `
            SELECT
                COUNT(*)::int                                           AS total,
                COUNT(CASE WHEN status = 'Pendiente' THEN 1 END)::int  AS pendiente,
                COUNT(CASE WHEN status = 'En curso'  THEN 1 END)::int  AS en_curso,
                COUNT(CASE WHEN status = 'Hecho'     THEN 1 END)::int  AS hecho
            FROM notes;
        `;

        const result = await client.query<DashboardMetrics>(query);
        const metrics: DashboardMetrics = result.rows[0] ?? {
            total: 0,
            pendiente: 0,
            en_curso: 0,
            hecho: 0,
        };

        return {
            statusCode: 200,
            headers: CORS_HEADERS,
            body: JSON.stringify(metrics),
        };
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Error desconocido';
        return {
            statusCode: 500,
            headers: CORS_HEADERS,
            body: JSON.stringify({ error: message }),
        };
    } finally {
        await client.end().catch(() => {});
    }
};
