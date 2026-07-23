import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Seeding database...')

  const defaultPassword = process.env.DEFAULT_USER_PASSWORD || "PajakAman2026";

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

  // Create Archive Policies
  console.log('🗂️ Seeding archive policies...')

  const policies = [
    {
      dataType: "SPM_RECORD",
      retentionYears: 5,
      inactivePeriod: 1,
      disposalMethod: "SOFT_DELETE",
    },
    {
      dataType: "PPH21_WITHHOLDING",
      retentionYears: 5,
      inactivePeriod: 1,
      disposalMethod: "SOFT_DELETE",
    },
    {
      dataType: "TAX_RECONCILIATION",
      retentionYears: 3,
      inactivePeriod: 1,
      disposalMethod: "SOFT_DELETE",
    },
  ]

  for (const policy of policies) {
    const existing = await prisma.archivePolicy.findUnique({
      where: { dataType: policy.dataType },
    })

    if (!existing) {
      await prisma.archivePolicy.create({
        data: policy,
      })
      console.log(`✅ Archive policy created for ${policy.dataType}`)
    } else {
      console.log(`✅ Archive policy already exists for ${policy.dataType}`)
    }
  }
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
