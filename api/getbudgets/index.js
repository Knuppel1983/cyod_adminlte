module.exports = async function (context, req) {
  context.res = {
    status: 200,
    headers: { "Content-Type": "application/json" },
    body: {
      ok: true,
      path: "/api/Ping",
      time: new Date().toISOString()
    }
  };
};
