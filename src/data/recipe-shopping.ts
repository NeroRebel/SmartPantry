import { getProducts } from '@/db/products';
import { createShoppingItem, getShoppingItems } from '@/db/shopping-list';
import type { Recipe } from '@/types/recipe';
import { calculateRecipeMatch } from '@/utils/ingredient-matching';
import { selectMissingShoppingItems } from '@/utils/recipe-shopping';

export interface AddMissingIngredientsResult {
  added: number;
  skipped: number;
  missing: number;
}

export async function addMissingRecipeIngredients(recipe: Recipe): Promise<AddMissingIngredientsResult> {
  const products = await getProducts();
  const match = calculateRecipeMatch(recipe, products);
  if (match.missingIngredients.length === 0) return { added: 0, skipped: 0, missing: 0 };
  const existing = await getShoppingItems();
  const { items, skipped } = selectMissingShoppingItems(match.missingIngredients, existing);
  for (const item of items) await createShoppingItem(item);
  return { added: items.length, skipped, missing: match.missingIngredients.length };
}
