import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Seeding database...')

  // Create first Admin
  const admin = await prisma.colleague.upsert({
    where: { name: 'Admin Utama' },
    update: {},
    create: {
      name: 'Admin Utama',
      role: 'ADMIN',
    },
  })

  console.log(`✅ Default Admin created: ${admin.name}`)
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
