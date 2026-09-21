import csvText from '../data/mlbb_betting_dataset.csv?raw'
import { parseDataset } from './parse'
import type { ParseResult } from './types'

/**
 * The bundled CSV is the source of truth. Vite inlines it at build time, so
 * saving the file in the editor hot-reloads the whole dashboard.
 */
export const dataset: ParseResult = parseDataset(csvText)

export { csvText }
