module.exports = async function (context, req) {
  // 1) User uit EasyAuth
  const principalHeader = req.headers['x-ms-client-principal'];
  let userEmail = '';
  if (principalHeader) {
    const decoded = Buffer.from(principalHeader, 'base64').toString('utf8');
    const principal = JSON.parse(decoded);
    const claims = principal.userClaims || principal.claims || [];
    const emailClaim = claims.find(c =>
      (c.typ || '').toLowerCase().includes('preferred_username') ||
      (c.typ || '').toLowerCase().includes('email')
    );
    userEmail = emailClaim?.val || principal.userDetails || '';
  }

  // 2) TODO: verbind met Azure SQL via 'mssql' pakket en parameteriseer op userEmail
  context.res = {
    headers: { 'Content-Type': 'application/json' },
    body: [{ OwnerEmail: userEmail || 'unknown', Amount: 100, LastUpdated: new Date().toISOString() }]
  };
};