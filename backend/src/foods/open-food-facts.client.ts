import {
  isPlausiblePer100g,
  normalizeNutrients,
  type Nutrients,
} from '@healthmanager/shared';
import { BadGatewayException, Injectable, Logger } from '@nestjs/common';

const PRODUCT_URL = 'https://world.openfoodfacts.org/api/v2/product';
const FIELDS =
  'product_name_fr,product_name,brands,nutriments,serving_quantity';
/** Open Food Facts asks every client to identify itself. */
const USER_AGENT =
  'healthManager/1.0 (+https://github.com/ThomasBernard0/healthManager)';
const TIMEOUT_MS = 8000;
const KJ_PER_KCAL = 4.184;

export interface OffProduct {
  name: string | null;
  brand: string | null;
  /** null when the label is missing a value or the values are impossible. */
  per100g: Nutrients | null;
  /** Grams in one serving, when the product declares one. */
  servingGrams: number | null;
}

interface OffResponse {
  status?: number;
  product?: {
    product_name_fr?: string;
    product_name?: string;
    brands?: string;
    serving_quantity?: number | string;
    nutriments?: Record<string, number | string | undefined>;
  };
}

const text = (value: unknown): string | null =>
  typeof value === 'string' && value.trim() ? value.trim() : null;

const num = (value: unknown): number | null => {
  const n = typeof value === 'string' ? Number(value) : value;
  return typeof n === 'number' && Number.isFinite(n) ? n : null;
};

/** Open Food Facts product JSON → name, first brand, per-100 g values (kJ converted if kcal is missing). */
export function parseOffProduct(body: OffResponse): OffProduct | null {
  const p = body.product;
  if (body.status !== 1 || !p) return null;

  const n = p.nutriments ?? {};
  const kj = num(n['energy-kj_100g']);
  const kcal =
    num(n['energy-kcal_100g']) ?? (kj === null ? null : kj / KJ_PER_KCAL);
  const protein = num(n.proteins_100g);
  const carbs = num(n.carbohydrates_100g);
  const fat = num(n.fat_100g);
  let per100g: Nutrients | null = null;
  if (kcal !== null && protein !== null && carbs !== null && fat !== null) {
    const values = normalizeNutrients({ kcal, protein, carbs, fat });
    per100g = isPlausiblePer100g(values) ? values : null;
  }

  const serving = num(p.serving_quantity);
  return {
    name: text(p.product_name_fr) ?? text(p.product_name),
    brand: text(p.brands?.split(',')[0]),
    per100g,
    servingGrams:
      serving !== null && serving > 0 && serving <= 2000 ? serving : null,
  };
}

@Injectable()
export class OpenFoodFactsClient {
  private readonly logger = new Logger(OpenFoodFactsClient.name);

  /** null = no such product; throws 502 when Open Food Facts can't be reached. */
  async product(barcode: string): Promise<OffProduct | null> {
    let res: Response;
    try {
      res = await fetch(`${PRODUCT_URL}/${barcode}.json?fields=${FIELDS}`, {
        headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch (error) {
      this.logger.warn(`Open Food Facts unreachable: ${String(error)}`);
      throw new BadGatewayException('Open Food Facts unreachable');
    }
    if (res.status === 404) return null;
    if (!res.ok) {
      this.logger.warn(`Open Food Facts answered ${res.status}`);
      throw new BadGatewayException('Open Food Facts error');
    }
    return parseOffProduct((await res.json()) as OffResponse);
  }
}
