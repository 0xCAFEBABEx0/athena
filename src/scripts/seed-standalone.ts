import { getPayload } from 'payload'
import config from '../payload.config'
import { seed } from '../endpoints/seed'

const runSeed = async () => {
  const payload = await getPayload({ config })

  try {
    await seed({ payload, req: { payload, user: null } as any })
    console.log('Seed completed successfully.')
    process.exit(0)
  } catch (error) {
    console.error('Error seeding database:', error)
    process.exit(1)
  }
}

runSeed()
