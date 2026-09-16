import "dotenv/config";
import prisma from "../src/lib/prisma.ts";
import auth from "../src/lib/auth.ts";

async function createUser(
  email: string,
  password: string,
  name: string,
  role: "admin" | "agent",
) {
  await auth.api.createUser({
    body: {
      email,
      password,
      name,
      role,
      data: { emailVerified: true },
    },
  });
  console.log(`Created ${role} user: ${email}`);
}

async function main() {
  console.log("Wiping existing data...");
  await prisma.verification.deleteMany();
  await prisma.session.deleteMany();
  await prisma.account.deleteMany();
  await prisma.user.deleteMany();

  console.log("Seeding users...");
  await createUser(
    process.env.ADMIN_EMAIL || "admin@example.com",
    process.env.ADMIN_PASSWORD || "Test@123",
    process.env.ADMIN_NAME || "Admin",
    "admin",
  );
  await createUser(
    process.env.AGENT_EMAIL || "agent@example.com",
    process.env.AGENT_PASSWORD || "Test@123",
    process.env.AGENT_NAME || "Support Agent",
    "agent",
  );

  console.log("Seeding finished.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
