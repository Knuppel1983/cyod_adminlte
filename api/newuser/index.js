// api/newuser/index.js

const sql = require('mssql');

// Connectiestring
const connStr = process.env.SqlConnectionString;
if (!connStr) {
  context.res = { status: 500, body: { error: 'SqlConnectionString ontbreekt in app settings' } };
  return;
}

module.exports = async function (context, req) {
  if (req.method !== 'POST') {
    context.res = {
      status: 405,
      body: { error: 'Only POST is allowed' }
    };
    return;
  }

  const body = req.body || {};
  const username = body.username && String(body.username).trim();
  const peildatum = body.peildatum; // verwacht: 'yyyy-mm-dd'

  if (!username) {
    context.res = {
      status: 400,
      body: { error: 'Username is verplicht.' }
    };
    return;
  }

  if (!peildatum) {
    context.res = {
      status: 400,
      body: { error: 'Peildatum is verplicht.' }
    };
    return;
  }

  try {
    const pool = await sql.connect(connStr);

    const request = pool.request()
      .input('Username',  sql.NVarChar(50), username)
      .input('Peildatum', sql.Date,        peildatum)
      // optioneel later:
      // .input('Courant',      sql.Int,         1)
      // .input('Contractvorm', sql.NVarChar(50), 'CYOD')
      // .input('Leentoestel',  sql.Bit,         0)
      // .input('Active',       sql.Bit,         1)
      ;

    const result = await request.execute('dbo.usp_NewUserWithBudgets');

    const row = result.recordset && result.recordset[0] ? result.recordset[0] : null;

    context.res = {
      status: 200,
      body: {
        success: true,
        userId: row ? row.NewUserId : null,
        username: username,
        tstBudget: row ? row.TstBudget : null,
        ovgBudget: row ? row.OvgBudget : null,
        repBudget: row ? row.RepBudget : null,
        peildatum: row ? row.Peildatum : peildatum
      }
    };
  } catch (err) {
    context.log.error('Error in new-user API:', err);

    context.res = {
      status: 500,
      body: {
        success: false,
        error: 'Er is een fout opgetreden bij het aanmaken van de gebruiker.',
        details: err.message
      }
    };
  }
};