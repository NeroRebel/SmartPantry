import type { Recipe, RecipeIngredient, RecipeListItem } from '@/types/recipe';
import { recipeCategories, type RecipeFilter } from '@/utils/recipe-filters';

const BASE_URL = 'https://www.themealdb.com/api/json/v1/1';
const DEFAULT_CATEGORIES = ['Chicken', 'Pasta'] as const;
const DEFAULT_PER_CATEGORY = 8;

type NumberedField = `strIngredient${number}` | `strMeasure${number}`;

type MealDbMeal = {
  idMeal: string;
  strMeal: string;
  strCategory?: string | null;
  strArea?: string | null;
  strInstructions?: string | null;
  strMealThumb?: string | null;
  strTags?: string | null;
} & Partial<Record<NumberedField, string | null>>;

type MealDbResponse = { meals: MealDbMeal[] | null };
type MealDbCategory = { strCategory: string };
type MealDbCategoryResponse = { meals: MealDbCategory[] | null };

function optionalText(value: unknown): string | null {
  return typeof value === 'string' ? value.trim() || null : null;
}

function requireMealIdentity(meal: MealDbMeal) {
  const id = optionalText(meal.idMeal);
  const name = optionalText(meal.strMeal);
  if (!id || !name) throw new Error('The recipe service returned an invalid meal.');
  return { id, name };
}

function mealEmoji(category: string): string {
  if (category === 'Pasta') return '🍝';
  if (category === 'Chicken') return '🍗';
  if (category === 'Vegetarian' || category === 'Vegan') return '🥬';
  if (category === 'Dessert') return '🍰';
  if (category === 'Breakfast') return '🍳';
  return '🍽️';
}

export function mapMealDbMealToRecipe(meal: MealDbMeal): Recipe {
  const { id, name } = requireMealIdentity(meal);
  const category = optionalText(meal.strCategory) ?? 'Other';
  const ingredients: RecipeIngredient[] = [];
  for (let index = 1; index <= 20; index++) {
    const ingredient = optionalText(meal[`strIngredient${index}`]);
    if (ingredient) ingredients.push({ name: ingredient, measure: optionalText(meal[`strMeasure${index}`]) });
  }

  return {
    id, name, imageUrl: optionalText(meal.strMealThumb), emoji: mealEmoji(category), category,
    tags: optionalText(meal.strTags)?.split(',').map((tag) => tag.trim()).filter(Boolean) ?? [],
    area: optionalText(meal.strArea), description: null,
    instructions: optionalText(meal.strInstructions)?.replace(/\r\n?/g, '\n') ?? '',
    prepTime: null, difficulty: null, ingredients,
  };
}

function mapMealDbMealToListItem(meal: MealDbMeal, category: string): RecipeListItem {
  const { id, name } = requireMealIdentity(meal);
  return {
    id, name, imageUrl: optionalText(meal.strMealThumb), emoji: mealEmoji(category),
    category, area: null, prepTime: null, difficulty: null, ingredientCount: null,
  };
}

function toListItem(recipe: Recipe): RecipeListItem {
  return {
    id: recipe.id, name: recipe.name, imageUrl: recipe.imageUrl, emoji: recipe.emoji,
    category: recipe.category, area: recipe.area, prepTime: recipe.prepTime,
    difficulty: recipe.difficulty, ingredientCount: recipe.ingredients.length,
  };
}

async function requestJson(endpoint: string, key: string, value: string): Promise<unknown> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12_000);
  try {
    const response = await fetch(`${BASE_URL}/${endpoint}?${key}=${encodeURIComponent(value)}`, { signal: controller.signal });
    if (!response.ok) throw Object.assign(new Error(`Recipe service returned ${response.status}.`), { status: response.status });
    return await response.json();
  } finally {
    clearTimeout(timeout);
  }
}

function parseMeals(payload: unknown): MealDbMeal[] {
  if (!payload || typeof payload !== 'object' || !('meals' in payload)) throw new Error('Invalid recipe response.');
  const { meals } = payload as MealDbResponse;
  if (meals === null) return [];
  if (!Array.isArray(meals)) throw new Error('Invalid recipe response.');
  return meals;
}

export async function getRecipes(query = '', category: RecipeFilter = 'All'): Promise<RecipeListItem[]> {
  const search = query.trim();
  if (search) {
    const meals = parseMeals(await requestJson('search.php', 's', search));
    return meals.map(mapMealDbMealToRecipe)
      .filter((recipe) => category === 'All' || recipe.category.toLowerCase() === category.toLowerCase())
      .map(toListItem);
  }
  if (category !== 'All') {
    const meals = parseMeals(await requestJson('filter.php', 'c', category));
    return meals.map((meal) => mapMealDbMealToListItem(meal, category));
  }

  const batches = await Promise.all(DEFAULT_CATEGORIES.map(async (item) =>
    parseMeals(await requestJson('filter.php', 'c', item))
      .slice(0, DEFAULT_PER_CATEGORY)
      .map((meal) => mapMealDbMealToListItem(meal, item))
  ));
  const combined: RecipeListItem[] = [];
  for (let index = 0; index < DEFAULT_PER_CATEGORY; index++) {
    for (const batch of batches) if (batch[index]) combined.push(batch[index]);
  }
  return combined;
}

export async function getRecipeById(id: string): Promise<Recipe | null> {
  if (!/^\d+$/.test(id)) return null;
  const meals = parseMeals(await requestJson('lookup.php', 'i', id));
  return meals[0] ? mapMealDbMealToRecipe(meals[0]) : null;
}

export async function getRecipesByIngredient(ingredient: string): Promise<RecipeListItem[]> {
  const meals = parseMeals(await requestJson('filter.php', 'i', ingredient.trim().replace(/\s+/g, '_')));
  return meals.map((meal) => mapMealDbMealToListItem(meal, 'Other'));
}

let categoryRequest: Promise<RecipeFilter[]> | null = null;

export function getRecipeCategories(): Promise<RecipeFilter[]> {
  if (!categoryRequest) {
    categoryRequest = requestJson('list.php', 'c', 'list').then((payload) => {
      if (!payload || typeof payload !== 'object' || !('meals' in payload)) throw new Error('Invalid category response.');
      const { meals } = payload as MealDbCategoryResponse;
      if (!Array.isArray(meals)) throw new Error('Invalid category response.');
      const available = new Set(meals.map((meal) => optionalText(meal.strCategory)?.toLowerCase()).filter(Boolean));
      return recipeCategories.filter((item) => item === 'All' || available.has(item.toLowerCase()));
    }).catch((error) => {
      categoryRequest = null;
      throw error;
    });
  }
  return categoryRequest;
}
