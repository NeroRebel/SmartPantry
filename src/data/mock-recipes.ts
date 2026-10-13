import type { Recipe } from '@/types/recipe';

export const mockRecipes: Recipe[] = [
  {
    id: 'creamy-tomato-pasta', name: 'Creamy Tomato Pasta', imageUrl: null, emoji: '🍝', category: 'Pasta', tags: ['Dinner', 'Vegetarian'], area: 'Italian',
    description: 'A silky tomato sauce with just enough cream to make a weeknight feel special.', instructions: 'Cook pasta in salted water until al dente; reserve a cup of cooking water.\nSoften garlic in olive oil, then add chopped tomatoes and simmer for 10 minutes.\nStir in cream and a splash of pasta water. Toss with pasta, finish with cheese and basil.', prepTime: 25, difficulty: 'Easy',
    ingredients: [{ name: 'Pasta', measure: '200 g' }, { name: 'Tomatoes', measure: '3 pcs' }, { name: 'Cream', measure: '100 ml' }, { name: 'Garlic', measure: '2 cloves' }, { name: 'Cheese', measure: '50 g' }, { name: 'Basil', measure: 'a handful' }],
  },
  {
    id: 'garlic-chicken-stir-fry', name: 'Garlic Chicken Stir-Fry', imageUrl: null, emoji: '🍗', category: 'Chicken', tags: ['Dinner'], area: 'Asian-inspired',
    description: 'Tender chicken and crisp vegetables in a quick garlic-soy glaze.', instructions: 'Slice chicken and vegetables into bite-sized pieces.\nSear chicken in a hot pan until cooked through; set aside.\nStir-fry vegetables for 4 minutes. Add garlic, soy sauce and honey, then return chicken to the pan and toss until glossy.', prepTime: 25, difficulty: 'Easy',
    ingredients: [{ name: 'Chicken breast', measure: '500 g' }, { name: 'Bell pepper', measure: '1 pc' }, { name: 'Broccoli', measure: '200 g' }, { name: 'Garlic', measure: '3 cloves' }, { name: 'Soy sauce', measure: '2 tbsp' }, { name: 'Honey', measure: '1 tbsp' }],
  },
  {
    id: 'shakshuka', name: 'Shakshuka', imageUrl: null, emoji: '🍳', category: 'Breakfast', tags: ['Vegetarian', 'Lunch'], area: 'North African',
    description: 'Eggs gently poached in a warm, spiced tomato and pepper sauce.', instructions: 'Soften onion and bell pepper in olive oil. Stir in cumin and paprika.\nAdd tomatoes and simmer until thick, about 12 minutes.\nMake wells in the sauce, crack in the eggs, cover and cook until the whites set. Finish with parsley.', prepTime: 30, difficulty: 'Easy',
    ingredients: [{ name: 'Eggs', measure: '4 pcs' }, { name: 'Tomatoes', measure: '4 pcs' }, { name: 'Bell pepper', measure: '1 pc' }, { name: 'Onion', measure: '1 pc' }, { name: 'Cumin', measure: '1 tsp' }, { name: 'Parsley', measure: 'a handful' }],
  },
  {
    id: 'cheese-omelette', name: 'Cheese Omelette', imageUrl: null, emoji: '🧀', category: 'Breakfast', tags: ['Vegetarian'], area: 'Classic',
    description: 'Soft eggs folded around melted cheese and fresh herbs.', instructions: 'Beat eggs with a pinch of salt and pepper.\nMelt butter in a nonstick pan over medium-low heat, then pour in the eggs.\nGently push the edges toward the center. Add cheese and chives, fold, and serve while soft.', prepTime: 10, difficulty: 'Easy',
    ingredients: [{ name: 'Eggs', measure: '3 pcs' }, { name: 'Cheese', measure: '40 g' }, { name: 'Butter', measure: '1 tsp' }, { name: 'Chives', measure: '1 tbsp' }],
  },
  {
    id: 'chicken-salad', name: 'Chicken Salad', imageUrl: null, emoji: '🥗', category: 'Lunch', tags: ['Chicken'], area: 'Mediterranean',
    description: 'A bright, satisfying salad with lemony dressing.', instructions: 'Season and cook chicken in a skillet until golden and cooked through. Rest, then slice.\nCombine lettuce, tomatoes and cucumber in a bowl.\nWhisk olive oil with lemon juice and toss through the vegetables. Top with chicken.', prepTime: 20, difficulty: 'Easy',
    ingredients: [{ name: 'Chicken breast', measure: '300 g' }, { name: 'Lettuce', measure: '1 head' }, { name: 'Tomatoes', measure: '2 pcs' }, { name: 'Cucumber', measure: '1 pc' }, { name: 'Lemon', measure: '1 pc' }, { name: 'Olive oil', measure: '2 tbsp' }],
  },
  {
    id: 'tomato-soup', name: 'Tomato Soup', imageUrl: null, emoji: '🥣', category: 'Lunch', tags: ['Vegetarian'], area: 'Classic',
    description: 'Comforting tomato soup with a smooth finish and a little basil.', instructions: 'Soften onion and garlic in olive oil.\nAdd chopped tomatoes and stock; simmer for 20 minutes.\nBlend until smooth, stir in cream, season to taste and finish with basil.', prepTime: 30, difficulty: 'Easy',
    ingredients: [{ name: 'Tomatoes', measure: '6 pcs' }, { name: 'Onion', measure: '1 pc' }, { name: 'Garlic', measure: '2 cloves' }, { name: 'Vegetable stock', measure: '400 ml' }, { name: 'Cream', measure: '50 ml' }, { name: 'Basil', measure: 'a handful' }],
  },
  {
    id: 'pasta-carbonara', name: 'Pasta Carbonara', imageUrl: null, emoji: '🍝', category: 'Pasta', tags: ['Dinner'], area: 'Italian',
    description: 'A rich, glossy pasta made with eggs, cheese and crisp bacon.', instructions: 'Cook pasta in salted water. Crisp bacon in a pan and keep the rendered fat.\nWhisk eggs with finely grated cheese and black pepper.\nOff the heat, toss hot pasta with bacon and the egg mixture. Loosen with pasta water until creamy.', prepTime: 25, difficulty: 'Medium',
    ingredients: [{ name: 'Pasta', measure: '200 g' }, { name: 'Eggs', measure: '2 pcs' }, { name: 'Bacon', measure: '100 g' }, { name: 'Parmesan', measure: '60 g' }, { name: 'Black pepper', measure: 'to taste' }],
  },
  {
    id: 'vegetable-pasta', name: 'Vegetable Pasta', imageUrl: null, emoji: '🥦', category: 'Pasta', tags: ['Dinner', 'Vegetarian'], area: 'Mediterranean',
    description: 'Colorful vegetables and pasta tossed with a light garlic sauce.', instructions: 'Cook pasta until al dente.\nSauté zucchini and bell pepper until tender, then add garlic and cherry tomatoes.\nToss with pasta, olive oil and a splash of cooking water. Finish with cheese.', prepTime: 25, difficulty: 'Easy',
    ingredients: [{ name: 'Pasta', measure: '200 g' }, { name: 'Zucchini', measure: '1 pc' }, { name: 'Bell pepper', measure: '1 pc' }, { name: 'Cherry tomatoes', measure: '150 g' }, { name: 'Garlic', measure: '2 cloves' }, { name: 'Cheese', measure: '40 g' }],
  },
  {
    id: 'chicken-with-potatoes', name: 'Chicken with Potatoes', imageUrl: null, emoji: '🍗', category: 'Chicken', tags: ['Dinner'], area: 'Homestyle',
    description: 'Golden roasted chicken and potatoes with rosemary and lemon.', instructions: 'Heat oven to 200°C. Cut potatoes into wedges and toss with oil, salt and rosemary.\nSeason chicken and place it on a tray with the potatoes and lemon wedges.\nRoast for 35–40 minutes, until the chicken is cooked through and the potatoes are golden.', prepTime: 50, difficulty: 'Easy',
    ingredients: [{ name: 'Chicken thighs', measure: '4 pcs' }, { name: 'Potatoes', measure: '500 g' }, { name: 'Lemon', measure: '1 pc' }, { name: 'Rosemary', measure: '2 sprigs' }, { name: 'Olive oil', measure: '2 tbsp' }],
  },
  {
    id: 'egg-fried-vegetables', name: 'Egg Fried Vegetables', imageUrl: null, emoji: '🥬', category: 'Vegetarian', tags: ['Breakfast', 'Lunch'], area: 'Asian-inspired',
    description: 'Quick vegetables with softly scrambled eggs and a savory finish.', instructions: 'Slice vegetables and beat eggs with a pinch of salt.\nStir-fry carrots and peas in a hot pan until tender. Push them aside and softly scramble the eggs.\nToss everything with soy sauce and spring onions. Serve hot.', prepTime: 15, difficulty: 'Easy',
    ingredients: [{ name: 'Eggs', measure: '2 pcs' }, { name: 'Carrots', measure: '2 pcs' }, { name: 'Peas', measure: '100 g' }, { name: 'Spring onions', measure: '2 pcs' }, { name: 'Soy sauce', measure: '1 tbsp' }],
  },
];

// Preview-only availability; it is intentionally not part of Recipe or linked to Inventory.
export const mockAvailableIngredients: Record<string, string[]> = {
  'creamy-tomato-pasta': ['Pasta', 'Tomatoes', 'Garlic', 'Cheese'],
  'garlic-chicken-stir-fry': ['Chicken breast', 'Bell pepper', 'Garlic'],
  shakshuka: ['Eggs', 'Tomatoes', 'Onion', 'Cumin'],
  'cheese-omelette': ['Eggs', 'Cheese', 'Butter'],
  'chicken-salad': ['Chicken breast', 'Lettuce', 'Tomatoes'],
  'tomato-soup': ['Tomatoes', 'Onion', 'Garlic', 'Basil'],
  'pasta-carbonara': ['Pasta', 'Eggs', 'Black pepper'],
  'vegetable-pasta': ['Pasta', 'Bell pepper', 'Garlic', 'Cheese'],
  'chicken-with-potatoes': ['Potatoes', 'Lemon', 'Olive oil'],
  'egg-fried-vegetables': ['Eggs', 'Carrots', 'Soy sauce'],
};
