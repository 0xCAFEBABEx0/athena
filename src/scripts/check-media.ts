import { getPayload } from 'payload'
import config from '../payload.config'

const checkMedia = async () => {
  const payload = await getPayload({ config })

  try {
    const media = await payload.find({
      collection: 'media',
      limit: 10,
    })

    console.log('\n--- Media Collection Debug Info ---')
    if (media.docs.length === 0) {
      console.log('No media documents found.')
    } else {
      media.docs.forEach((doc) => {
        console.log(`Doc:`, doc)
        console.log('------------------------')
      })
    }
    process.exit(0)
  } catch (error) {
    console.error('Error querying media:', error)
    process.exit(1)
  }
}

checkMedia()
