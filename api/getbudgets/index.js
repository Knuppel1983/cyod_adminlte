// npm install mssql (in /api)
const sql = require('mssql');

module.exports = async function (context, req) {
  let pool;
  try {
    const connStr = process.env.SqlConnectionString;
    if (!connStr) {
      context.res = { status: 500, body: 'Connection string missing' };
      return;
    }
    pool = await sql.connect(connStr);
    const r = await pool.request().query('SELECT 1 AS test');
    context.res = { status: 200, body: { ok: true, result: r.recordset } };
  } catch (err) {
    context.res = { status: 500, body: { ok: false, error: err.message } };
  } finally {
    if (pool && pool.close) await pool.close();
  }
};
