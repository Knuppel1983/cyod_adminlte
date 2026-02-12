// npm install mssql (in /api map)
const sql = require('mssql');

module.exports = async function (context, req) {
  context.log('=== DB CONNECTION TEST START ===');

  let pool;
  try {
    const connStr = process.env.SqlConnectionString;
    context.log('[Env] SqlConnectionString present?', !!connStr);

    if (!connStr) {
      context.res = { status: 500, body: 'Connection string missing' };
      return;
    }

    context.log('[SQL] Connecting...');
    pool = await sql.connect(connStr);

    context.log('[SQL] Connected?', !!pool?.connected);

    // Mini-query — GEEN afhankelijkheid van jouw tabellen
    const result = await pool.request().query('SELECT 1 AS test;');
    context.log('[SQL] Query OK:', result?.recordset);

    context.res = {
      status: 200,
      body: {
        connected: true,
        result: result.recordset,
        message: 'Database connection OK'
      }
    };
  } catch (err) {
    context.log.error('[SQL ERROR]', err);
    context.res = {
      status: 500,
      body: {
        connected: false,
        error: err.message
      }
    };
  } finally {
    if (pool && pool.close) {
      await pool.close();
      context.log('[SQL] Pool closed.');
    }
  }
};