export type RecipeDifficulty = 'Easy' | 'Medium' | 'Hard';

export type RecipeCategory = string;

export interface RecipeIngredient {
  name: string;
  measure: string | null;
}

export interface Recipe {
  id: string;
  name: string;
  imageUrl: string | null;
  emoji: string;
  category: RecipeCategory;
  tags: RecipeCategory[];
  area: string | null;
  description: string | null;
  instructions: string;
  prepTime: number | null;
  difficulty: RecipeDifficulty | null;
  ingredients: RecipeIngredient[];
}

export type RecipeListItem = Pick<Recipe, 'id' | 'name' | 'imageUrl' | 'emoji' | 'category' | 'area' | 'prepTime' | 'difficulty'> & {
  ingredientCount: number | null;
};

export interface RecipeMatch {
  availableIngredientCount: number;
  missingIngredientCount: number;
}
