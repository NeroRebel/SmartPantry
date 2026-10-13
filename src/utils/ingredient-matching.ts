import type { Product } from '@/types/product';
import type { Recipe, RecipeIngredient, RecipeMatch } from '@/types/recipe';
import { getProductStatus } from '@/utils/product-status';

type PantryProduct = Pick<Product, 'name' | 'quantity' | 'expirationDate'>;

function singularize(word: string): string {
  if (word.endsWith('oes') && word.length > 4) return word.slice(0, -2);
  if (word.endsWith('ies') && word.length > 4) return `${word.slice(0, -3)}y`;
  if (word.endsWith('s') && word.length > 3 && !/(ss|us|is)$/.test(word)) return word.slice(0, -1);
  return word;
}

export function normalizeIngredientName(value: string): string {
  return value.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ').trim().split(/\s+/).filter(Boolean).map(singularize).join(' ');
}

export function isUsablePantryProduct(product: PantryProduct, today = new Date()): boolean {
  return (product.quantity === null || product.quantity > 0) && getProductStatus(product.expirationDate, today) !== 'expired';
}

export function getIngredientDiscoveryTerm(productName: string): string {
  const name = normalizeIngredientName(productName);
  return /^chicken (breast|thigh|wing|leg|drumstick)( |$)/.test(name) ? 'chicken' : name;
}

export function doesPantryProductMatchIngredient(product: PantryProduct, ingredient: RecipeIngredient, today = new Date()): boolean {
  if (!isUsablePantryProduct(product, today)) return false;
  const pantryName = normalizeIngredientName(product.name);
  const ingredientName = normalizeIngredientName(ingredient.name);
  if (!pantryName || !ingredientName) return false;
  if (pantryName === ingredientName) return true;
  return ingredientName === 'chicken' && /^chicken (breast|thigh|wing|leg|drumstick)$/.test(pantryName);
}

export function calculateRecipeMatch(recipe: Recipe, products: readonly PantryProduct[], today = new Date()): RecipeMatch {
  const availableIngredients: RecipeIngredient[] = [];
  const missingIngredients: RecipeIngredient[] = [];
  for (const ingredient of recipe.ingredients) {
    const target = products.some((product) => doesPantryProductMatchIngredient(product, ingredient, today))
      ? availableIngredients : missingIngredients;
    target.push(ingredient);
  }
  const totalCount = recipe.ingredients.length;
  return {
    recipe, availableIngredients, missingIngredients,
    availableCount: availableIngredients.length, totalCount,
    matchPercentage: totalCount === 0 ? 0 : Math.round((availableIngredients.length / totalCount) * 100),
  };
}

export function sortRecipeMatches(matches: RecipeMatch[]): RecipeMatch[] {
  return [...matches].sort((a, b) => {
    const aComplete = a.totalCount > 0 && a.missingIngredients.length === 0;
    const bComplete = b.totalCount > 0 && b.missingIngredients.length === 0;
    return Number(bComplete) - Number(aComplete) || b.matchPercentage - a.matchPercentage ||
      a.missingIngredients.length - b.missingIngredients.length || b.availableCount - a.availableCount ||
      a.recipe.name.localeCompare(b.recipe.name);
  });
}
