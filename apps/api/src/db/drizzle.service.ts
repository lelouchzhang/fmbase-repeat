import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
// import { drizzle } from 'drizzle-orm/neon-http'; //neon-http不支持事务，改用severless
import { Pool } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';

import * as schema from './schema/index.js';

@Injectable()
export class DrizzleService implements OnModuleInit {
  public db!: ReturnType<typeof drizzle<typeof schema>>;
  constructor(private config: ConfigService) {}

  onModuleInit() {
    const databaseUrl = this.config.get<string>('DATABASE_URL')!;
    const pool = new Pool({ connectionString: databaseUrl });
    this.db = drizzle(pool, { schema });
  }
}
