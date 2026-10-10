export interface AppConfig {
  port: number;
  corsOrigins: string[];
  txConcurrency: number;
  db: {
    host: string;
    port: number;
    username: string;
    password: string;
    database: string;
    poolSize: number;
    logging: boolean;
  };
}

function int(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export default (): AppConfig => {
  const poolSize = int(process.env.DB_POOL_SIZE, 10);
  return {
    port: int(process.env.PORT, 3000),
    corsOrigins: (process.env.CORS_ORIGIN ?? 'http://localhost:5173,http://localhost:8080')
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean),
    // Leave at least one pool connection free for reads, seeding and FAILED inserts.
    txConcurrency: Math.min(int(process.env.TX_CONCURRENCY, 8), Math.max(poolSize - 1, 1)),
    db: {
      host: process.env.DB_HOST ?? 'localhost',
      port: int(process.env.DB_PORT, 5432),
      username: process.env.DB_USER ?? 'bank',
      password: process.env.DB_PASSWORD ?? 'bank',
      database: process.env.DB_NAME ?? 'bank',
      poolSize,
      logging: process.env.DB_LOGGING === 'true',
    },
  };
};
