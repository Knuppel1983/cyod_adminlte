module.exports = async function (context, req) {
  // Niets externs, geen requires, geen SQL: kan niet op dependencies stuklopen.
  context.res = {
    status: 200,
    headers: { "Content-Type": "application/json" },
    body: {
      ok: true,
      time: new Date().toISOString(),
      path: "/api/Ping"
    }
  };
};