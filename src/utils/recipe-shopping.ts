import type { RecipeIngredient } from '@/types/recipe';
import type { NewShoppingItem, ShoppingItem } from '@/types/shopping-item';
import { doesPantryNameMatchIngredientName } from '@/utils/ingredient-matching';

export function recipeIngredientToShoppingItem(ingredient: RecipeIngredient): NewShoppingItem {
  const measure = ingredient.measure?.trim() ?? '';
  const simple = /^(\d+(?:[.,]\d+)?)\s*(g|kg|ml|l|pcs?|packs?|cups?|tbsp|tsp)?$/i.exec(measure);
  if (simple) {
    const unit = simple[2] === 'l' ? 'L' : simple[2] ?? null;
    return { name: ingredient.name.trim(), quantity: Number(simple[1].replace(',', '.')), unit, source: 'recipe' };
  }
  return { name: ingredient.name.trim(), quantity: null, unit: measure || null, source: 'recipe' };
}

export function selectMissingShoppingItems(missing: readonly RecipeIngredient[], existing: readonly ShoppingItem[]) {
  const activeNames = existing.filter((item) => !item.completed).map((item) => item.name);
  const items: NewShoppingItem[] = [];
  let skipped = 0;
  for (const ingredient of missing) {
    const name = ingredient.name.trim();
    if (!name) continue;
    const alreadyListed = activeNames.some((listed) =>
      doesPantryNameMatchIngredientName(listed, name) || doesPantryNameMatchIngredientName(name, listed));
    if (alreadyListed) {
      skipped++;
    } else {
      items.push(recipeIngredientToShoppingItem(ingredient));
      activeNames.push(name);
    }
  }
  return { items, skipped };
}
