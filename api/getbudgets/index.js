// npm install mssql
const sql = require('mssql');

module.exports = async function (context, req) {
  try {
    // 1) Connection string uit SWA Application settings
    const connStr = process.env.SqlConnectionString;
    if (!connStr) {
      context.log.error('SqlConnectionString missing in environment settings');
      return (context.res = { status: 500, body: 'DB config missing' });
    }

    // 2) Gebruiker uit EasyAuth header (x-ms-client-principal)
    const principalHeader = req.headers['x-ms-client-principal'];
    if (!principalHeader) {
      return (context.res = { status: 401, body: 'Unauthorized' });
    }
    const principal = JSON.parse(
      Buffer.from(principalHeader, 'base64').toString('utf8')
    );

    // Claims kunnen in principal.userClaims of principal.claims zitten; normaliseer
    const claims = principal.userClaims || principal.claims || [];
    const getClaim = (needle) => {
      const n = needle.toLowerCase();
      const hit = claims.find((c) => {
        const t = (c.typ || '').toLowerCase();
        return t === n || t.endsWith('/' + n);
      });
      return hit?.val || '';
    };

    // 3) Bepaal de bron voor e‑mail/UPN
    const emailOrUpn =
      getClaim('preferred_username') ||
      getClaim('emailaddress') || // soms als URI-variant
      getClaim('email') ||
      principal.userDetails || '';

    if (!emailOrUpn) {
      return (context.res = { status: 400, body: 'No user identity found' });
    }

    // 4) Maak 'voornaam.achternaam' door alles vóór @ te nemen
    //    Voorbeeld: 'mark.destreel@verwol.nl' -> 'mark.destreel'
    const username = emailOrUpn.split('@')[0];

    // 5) Query (parametrized) op dbo.users.username en haal de id op
    //    Gebruik case-insensitieve vergelijking door beide kanten LOWER te doen (optioneel)
    const pool = await sql.connect(connStr);
    const result = await pool
      .request()
      .input('Username', sql.NVarChar(256), username)
      .query(`
        SELECT TOP (1) [id]
        FROM [dbo].[users]
        WHERE LOWER([username]) = LOWER(@Username)
      `);

    if (result.recordset.length === 0) {
      // Geen match gevonden
      return (context.res = {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
        body: { found: false, username, id: null }
      });
    }

    const { id } = result.recordset[0];

    // 6) Succes: id teruggeven als JSON
    context.res = {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
      body: { found: true, username, id }
    };
  } catch (err) {
    context.log.error('DB error', err);
    context.res = { status: 500, body: 'Internal Server Error' };
  }
};