const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  // Add any seed data if needed
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });