module.exports = async function (context, req) {
  const sql = require('mssql');

  const connStr = process.env.SqlConnectionString;
  if (!connStr) {
    context.res = { status: 500, body: { ok: false, error: 'SqlConnectionString missing' } };
    return;
  }

  let pool;
  try {
    pool = await sql.connect(connStr);
    context.res = { status: 200, body: { ok: true, step: 'connected' } };
  } catch (err) {
    context.res = {
      status: 500,
      body: { ok: false, where: 'connect', error: err.message, number: err.number ?? null }
    };
  } finally {
    if (pool && pool.close) await pool.close();
  }
};