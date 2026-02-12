// /api/GetUserId/index.js
const sql = require('mssql');

module.exports = async function (context, req) {
  let pool;
  try {
    const connStr = process.env.SqlConnectionString;
    if (!connStr) {
      context.res = { status: 500, body: 'DB config missing' };
      return;
    }

    // Claims uit SWA (EasyAuth). Route is via SWA al authenticated.
    const p = req.headers['x-ms-client-principal'];
    if (!p) { context.res = { status: 401, body: 'Unauthorized' }; return; }

    const principal = JSON.parse(Buffer.from(p, 'base64').toString('utf8'));
    const claims = principal.userClaims || principal.claims || [];
    const find = (k) => {
      const key = k.toLowerCase();
      const hit = claims.find(c => (c.typ || '').toLowerCase() === key || (c.typ || '').toLowerCase().endsWith('/' + key));
      return hit?.val || '';
    };

    const email = find('preferred_username') || find('email') || principal.userDetails || '';
    const username = email.split('@')[0];

    pool = await sql.connect(connStr);
    const result = await pool.request()
      .input('Username', sql.NVarChar(256), username)
      .query(`
        SELECT TOP (1)
               u.[id]          AS user_id,
               b.[budget]      AS budget
        FROM   dbo.[users]       AS u
        LEFT JOIN dbo.[tst_budget] AS b
               ON b.[user_id] = u.[id]
        WHERE  LOWER(u.[username]) = LOWER(@Username);
      `);

    if (result.recordset.length === 0) {
      context.res = { status: 404, body: { found: false, username, id: null } };
      return;
    }

    context.res = { status: 200, body: { found: true, username, id: result.recordset[0].id } };
  } catch (err) {
    context.log.error(err);
    context.res = { status: 500, body: 'Internal Server Error' };
  } finally {
    if (pool && pool.close) await pool.close();
  }
};