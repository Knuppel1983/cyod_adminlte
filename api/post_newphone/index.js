// api/user_setactive/index.js
const sql = require('mssql');

module.exports = async function (context, req) {
  try {
    // 1) Input lezen en valideren
    const body = req.body || {};
    const userId = body.userId;
    const active = body.active;
    const reason = typeof body.reason === 'string' ? body.reason : null;

    if (typeof userId !== 'number' || !Number.isInteger(userId)) {
      context.res = { status: 400, body: { error: 'userId moet een integer zijn' } };
      return;
    }
    if (!(active === 0 || active === 1)) {
      context.res = { status: 400, body: { error: 'active moet 0 of 1 zijn' } };
      return;
    }

    // 2) Wie voert uit? (SWA header of fallback)
    // x-ms-client-principal-name staat bij SWA login
    const performedByHeader = req.headers && (req.headers['x-ms-client-principal-name'] || req.headers['x-user']);
    const performedBy = performedByHeader ? String(performedByHeader) : 'admin@swa';

    // 3) Connectiestring
    const connStr = process.env.SqlConnectionString;
    if (!connStr) {
      context.res = { status: 500, body: { error: 'SqlConnectionString ontbreekt in app settings' } };
      return;
    }

    // 4) DB call
    const pool = await sql.connect(connStr);
    await pool.request()
      .input('userId', sql.Int, userId)
      .input('active', sql.Bit, active)
      .input('performedBy', sql.NVarChar(256), performedBy)
      .input('reason', sql.NVarChar(4000), reason)
      .execute('dbo.user_setactive');

    // 5) OK
    context.res = { status: 200, body: { ok: true } };
  } catch (err) {
    // Foutafhandeling: map 'User not found' naar 404, anders 500
    const msg = (err && err.message) ? err.message : 'Server error';
    const isNotFound = typeof msg === 'string' && msg.toLowerCase().indexOf('user not found') !== -1;
    context.log.error('user-set-active error:', err);
    context.res = { status: isNotFound ? 404 : 500, body: { error: msg } };
  }
};
