import type { Recipe } from '@/types/recipe';

export const recipeCategories = ['All', 'Breakfast', 'Chicken', 'Vegetarian', 'Pasta', 'Dessert'] as const;
export type RecipeFilter = typeof recipeCategories[number];

export function filterRecipes(recipes: readonly Recipe[], query: string, category: RecipeFilter): Recipe[] {
  const search = query.trim().toLocaleLowerCase();
  return recipes.filter((recipe) =>
    (category === 'All' || recipe.category === category || recipe.tags.includes(category)) &&
    (!search || recipe.name.toLocaleLowerCase().includes(search) ||
      recipe.ingredients.some((ingredient) => ingredient.name.toLocaleLowerCase().includes(search)))
  );
}
