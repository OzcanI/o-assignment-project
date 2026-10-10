/** The app supports exactly one currency; amounts carry no currency code. */
export const CURRENCY = 'USD'

/** Empty means same origin (Vite dev proxy or nginx in Docker). */
export const API_BASE_URL: string = import.meta.env.VITE_API_URL ?? ''

/** How often the bank balance, persons and transaction log are refetched. */
export const POLL_INTERVAL_MS = 2000

export const LOG_LIMIT = 50

export const MAX_BATCH_SIZE = 200
