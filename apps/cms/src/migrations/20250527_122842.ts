import { MigrateUpArgs, MigrateDownArgs } from '@payloadcms/db-vercel-postgres'

export async function up({ db: _db }: MigrateUpArgs): Promise<void> {
    // Migration code
}

export async function down({ db: _db }: MigrateDownArgs): Promise<void> {
    // Migration code
}
