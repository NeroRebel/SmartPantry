import { getProducts } from '@/db/products';
import { getRecipeById, getRecipesByIngredient } from '@/data/recipes';
import type { Product } from '@/types/product';
import type { Recipe, RecipeListItem, RecipeMatch } from '@/types/recipe';
import { calculateRecipeMatch, getIngredientDiscoveryTerm, isUsablePantryProduct, sortRecipeMatches } from '@/utils/ingredient-matching';

const MAX_DISCOVERY_TERMS = 4;
const MAX_PER_TERM = 5;
const MAX_DETAILS = 12;
const LOOKUP_BATCH_SIZE = 3;

export interface PantryRecommendations {
  totalProducts: number;
  matches: RecipeMatch[];
}

const candidateCache = new Map<string, Promise<RecipeListItem[]>>();
const detailCache = new Map<string, Promise<Recipe | null>>();

function cachedCandidates(term: string): Promise<RecipeListItem[]> {
  let request = candidateCache.get(term);
  if (!request) {
    request = getRecipesByIngredient(term).catch((error) => {
      candidateCache.delete(term);
      throw error;
    });
    candidateCache.set(term, request);
  }
  return request;
}

function cachedDetail(id: string): Promise<Recipe | null> {
  let request = detailCache.get(id);
  if (!request) {
    request = getRecipeById(id).catch((error) => {
      detailCache.delete(id);
      throw error;
    });
    detailCache.set(id, request);
  }
  return request;
}

export async function discoverPantryRecipes(products: readonly Product[]): Promise<RecipeMatch[]> {
  const today = new Date();
  const usable = products.filter((product) => isUsablePantryProduct(product, today));
  const terms = [...new Set(usable.map((product) => getIngredientDiscoveryTerm(product.name)).filter(Boolean))]
    .slice(0, MAX_DISCOVERY_TERMS);
  if (terms.length === 0) return [];

  const candidateLists = await Promise.all(terms.map(async (term) => (await cachedCandidates(term)).slice(0, MAX_PER_TERM)));
  const candidates: RecipeListItem[] = [];
  const seen = new Set<string>();
  for (let index = 0; index < MAX_PER_TERM && candidates.length < MAX_DETAILS; index++) {
    for (const list of candidateLists) {
      const candidate = list[index];
      if (candidate && !seen.has(candidate.id)) {
        seen.add(candidate.id);
        candidates.push(candidate);
      }
      if (candidates.length === MAX_DETAILS) break;
    }
  }

  const recipes: Recipe[] = [];
  for (let index = 0; index < candidates.length; index += LOOKUP_BATCH_SIZE) {
    const batch = await Promise.all(candidates.slice(index, index + LOOKUP_BATCH_SIZE).map((candidate) => cachedDetail(candidate.id)));
    for (const recipe of batch) if (recipe) recipes.push(recipe);
  }
  return sortRecipeMatches(recipes.map((recipe) => calculateRecipeMatch(recipe, usable, today)).filter((match) => match.availableCount > 0));
}

export async function getPantryRecipeMatches(): Promise<PantryRecommendations> {
  const products = await getProducts();
  return { totalProducts: products.length, matches: await discoverPantryRecipes(products) };
}
