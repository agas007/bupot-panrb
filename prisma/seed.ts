import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Seeding database...')

  const defaultPassword = process.env.DEFAULT_USER_PASSWORD || "Placeholder123";

  // Create first Admin (agastya.arnanda)
  const admin = await prisma.colleague.upsert({
    where: { username: 'agastya.arnanda' },
    update: {},
    create: {
      name: 'Agastya Arnanda',
      username: 'agastya.arnanda',
      password: defaultPassword,
      role: 'ADMIN',
    },
  })

  console.log(`✅ Default Admin created: ${admin.username}`)
}

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (e) => {
    console.error(e)
    await prisma.$disconnect()
    process.exit(1)
  })
