const prisma = require("../lib/prisma");

async function getHealth(req, res) {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: "ok", database: "connected" });
  } catch (err) {
    res.status(503).json({ status: "error", database: "unreachable" });
  }
}

module.exports = { getHealth };
