import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { RecipeVisual } from '@/components/recipe-card';
import { useThemedStyles } from '@/theme/theme-context';
import type { AppColors } from '@/theme/theme';
import { addMissingRecipeIngredients } from '@/data/recipe-shopping';
import { getRecipeById } from '@/data/recipes';
import { getProducts } from '@/db/products';
import { useFocusedData } from '@/hooks/use-focused-data';
import type { Recipe, RecipeIngredient, RecipeMatch } from '@/types/recipe';
import { calculateRecipeMatch } from '@/utils/ingredient-matching';
import { showFeedback } from '@/services/feedback';
import { getLocalUserId } from '@/db/local-state';

function goBack() {
  if (router.canGoBack()) router.back();
  else router.replace('/(tabs)/recipes');
}

function IngredientRow({ ingredient, available }: { ingredient: RecipeIngredient; available: boolean | null }) {
  const { colors, styles } = useThemedStyles(createStyles);
  const { t } = useTranslation();
  return (
    <View accessible accessibilityLabel={`${ingredient.name}, ${ingredient.measure ?? t('recipe.toTaste')}${available === null ? '' : `, ${t(available ? 'polish.available' : 'polish.missing')}`}`} style={styles.ingredientRow}>
      <Ionicons name={available ? 'checkmark-circle' : 'ellipse-outline'} size={21} color={available === null ? colors.secondary : available ? colors.fresh : colors.soon} />
      <Text style={styles.ingredientName}>{ingredient.name}</Text>
      <Text style={styles.measure}>{ingredient.measure ?? t('recipe.toTaste')}</Text>
    </View>
  );
}

function RecipeDetails({ recipe, match, pantryLoading, pantryError, retryPantry, adding, onAddMissing }: {
  recipe: Recipe;
  match: RecipeMatch | null;
  pantryLoading: boolean;
  pantryError: string | null;
  retryPantry: () => void;
  adding: boolean;
  onAddMissing: () => void;
}) {
  const { colors, styles } = useThemedStyles(createStyles);
  const { t } = useTranslation();
  const steps = recipe.instructions.split('\n').map((step) => step.trim()).filter(Boolean);
  const complete = !!match && match.totalCount > 0 && match.missingIngredients.length === 0;

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'left', 'right']}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <View style={styles.topBar}>
          <Pressable accessibilityRole="button" accessibilityLabel={t('recipe.backRecipes')} onPress={goBack} style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}>
            <Ionicons name="chevron-back" size={24} color={colors.text} />
          </Pressable>
          <Text style={styles.topBarTitle}>{t('recipe.details')}</Text>
          <View style={styles.topBarSpacer} />
        </View>

        <RecipeVisual recipe={recipe} large />

        <View style={styles.intro}>
          <Text style={styles.category}>{recipe.category}{recipe.area ? ` · ${recipe.area}` : ''}</Text>
          <Text accessibilityRole="header" style={styles.name}>{recipe.name}</Text>
          {recipe.description && <Text style={styles.description}>{recipe.description}</Text>}
        </View>

        <View style={styles.meta}>
          <Meta icon={recipe.prepTime != null ? 'time-outline' : 'restaurant-outline'} label={recipe.prepTime != null ? t('recipe.prepTime') : t('recipe.category')} value={recipe.prepTime != null ? t('common.minutes', { count: recipe.prepTime }) : recipe.category} />
          <Meta icon={recipe.difficulty ? 'flame-outline' : 'earth-outline'} label={recipe.difficulty ? t('recipe.difficulty') : t('recipe.cuisine')} value={recipe.difficulty ?? recipe.area ?? t('common.unknown')} />
          <Meta icon="list-outline" label={t('recipe.ingredients')} value={String(recipe.ingredients.length)} />
        </View>

        <View style={styles.section}>
          <Text accessibilityRole="header" style={styles.sectionTitle}>{t('recipe.ingredients')}</Text>
          {pantryLoading && !match && <ActivityIndicator color={colors.accent} accessibilityLabel={t('recipe.checking')} />}
          {pantryError && <View style={styles.matchError}>
            <Text accessibilityRole="alert" style={styles.unavailableText}>{t('recipe.checkError')}</Text>
            <Pressable accessibilityRole="button" onPress={retryPantry}><Text style={styles.retryText}>{t('common.tryAgain')}</Text></Pressable>
          </View>}
          {match && match.totalCount > 0 && <View style={styles.matchSummary}>
            <Ionicons name={complete ? 'checkmark-circle' : 'basket-outline'} size={22} color={complete ? colors.fresh : colors.soon} />
            <Text style={[styles.matchSummaryText, { color: complete ? colors.fresh : colors.soon }]}>{complete ? t('recipe.everything') : t('recipe.haveCount', { available: match.availableCount, total: match.totalCount })}</Text>
          </View>}
          {recipe.ingredients.length === 0 && <Text style={styles.unavailableText}>{t('recipe.noIngredients')}</Text>}
          {match ? <>
            {match.totalCount > 0 && <View style={styles.ingredientGroup}>
              <Text style={[styles.groupTitle, { color: colors.fresh }]}>{t('recipe.available', { count: match.availableCount })}</Text>
              {match.availableCount === 0 ? <Text style={styles.unavailableText}>{t('recipe.noneAvailable')}</Text> :
                match.availableIngredients.map((ingredient, index) => <IngredientRow key={`${ingredient.name}-${index}`} ingredient={ingredient} available />)}
            </View>}
            {match.missingIngredients.length > 0 && <View style={styles.ingredientGroup}>
              <Text style={[styles.groupTitle, { color: colors.soon }]}>{t('recipe.missing', { count: match.missingIngredients.length })}</Text>
              {match.missingIngredients.map((ingredient, index) => <IngredientRow key={`${ingredient.name}-${index}`} ingredient={ingredient} available={false} />)}
              <Pressable accessibilityRole="button" accessibilityState={{ disabled: adding || pantryLoading, busy: adding }} disabled={adding || pantryLoading} onPress={onAddMissing} style={({ pressed }) => [styles.addMissingButton, (pressed || adding || pantryLoading) && styles.pressed]}>
                {adding ? <ActivityIndicator color={colors.background} /> : <Ionicons name="basket-outline" size={20} color={colors.background} />}
                <Text style={styles.addMissingText}>{adding ? t('common.adding') : t('recipe.addMissing', { count: match.missingIngredients.length })}</Text>
              </Pressable>
            </View>}
          </> : recipe.ingredients.map((ingredient, index) => <IngredientRow key={`${ingredient.name}-${index}`} ingredient={ingredient} available={null} />)}
        </View>

        <View style={styles.section}>
          <Text accessibilityRole="header" style={styles.sectionTitle}>{t('recipe.instructions')}</Text>
          {steps.length === 0 && <Text style={styles.unavailableText}>{t('recipe.noInstructions')}</Text>}
          {steps.map((step, index) => (
            <View key={index} style={styles.stepRow}>
              <View style={styles.stepNumber}><Text style={styles.stepNumberText}>{index + 1}</Text></View>
              <Text style={styles.stepText}>{step}</Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Meta({ icon, label, value }: { icon: keyof typeof Ionicons.glyphMap; label: string; value: string }) {
  const { colors, styles } = useThemedStyles(createStyles);
  return (
    <View style={styles.metaItem}>
      <Ionicons name={icon} size={20} color={colors.accent} />
      <Text style={styles.metaValue}>{value}</Text>
      <Text style={styles.metaLabel}>{label}</Text>
    </View>
  );
}

export default function RecipeDetailScreen() {
  const { colors, styles } = useThemedStyles(createStyles);
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string | string[] }>();
  const recipeId = typeof id === 'string' ? id : '';
  const load = useCallback(() => getRecipeById(recipeId), [recipeId]);
  const { data: recipe, loading, error, reload } = useFocusedData(load, { localChanges: false, midnight: false, remote: true });
  const { data: products, loading: pantryLoading, error: pantryError, reload: retryPantry } = useFocusedData(getProducts);
  const match = recipe && products && !pantryError ? calculateRecipeMatch(recipe, products) : null;
  const [adding, setAdding] = useState(false);
  const submitting = useRef(false);

  async function addMissing() {
    if (!recipe || submitting.current) return;
    const owner = getLocalUserId();
    submitting.current = true;
    setAdding(true);
    try {
      const result = await addMissingRecipeIngredients(recipe);
      const count = result.added;
      showFeedback(count > 0 ? 'polish.ingredientsAdded' : result.skipped > 0 ? 'recipe.allAlready' : 'recipe.everything', {
        owner, values: { count, skipped: result.skipped }, action: { key: 'recipe.viewList', run: () => router.push('/shopping-list') },
      });
    } catch {
      showFeedback('recipe.addError', { owner, tone: 'error' });
    } finally {
      submitting.current = false;
      setAdding(false);
    }
  }

  if (loading && !recipe) {
    return <SafeAreaView style={styles.screen}><ActivityIndicator style={styles.loader} color={colors.accent} accessibilityLabel={t('common.loading')} /></SafeAreaView>;
  }
  if (error || !recipe) {
    return (
      <SafeAreaView style={styles.screen}>
        <View style={styles.fallback}>
          <Ionicons name="restaurant-outline" size={40} color={colors.secondary} />
          <Text accessibilityRole="header" style={styles.fallbackTitle}>{error ? t('recipe.unableLoad') : t('recipe.notFound')}</Text>
          <Text style={styles.fallbackText}>{error ? t(error) : t('recipe.gone')}</Text>
          {error && <Pressable accessibilityRole="button" onPress={reload} style={styles.fallbackButton}><Text style={styles.fallbackButtonText}>{t('common.tryAgain')}</Text></Pressable>}
          <Pressable accessibilityRole="button" onPress={goBack} style={styles.fallbackButton}><Text style={styles.fallbackButtonText}>{t('recipe.backRecipes')}</Text></Pressable>
        </View>
      </SafeAreaView>
    );
  }
  return <RecipeDetails recipe={recipe} match={match} pantryLoading={pantryLoading} pantryError={pantryError} retryPantry={retryPantry} adding={adding} onAddMissing={() => void addMissing()} />;
}

const createStyles = (colors: AppColors) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { width: '100%', maxWidth: 600, alignSelf: 'center', paddingHorizontal: 24, paddingTop: 12, paddingBottom: 44, gap: 24 },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  backButton: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  topBarTitle: { flex: 1, color: colors.secondary, textAlign: 'center', fontSize: 13, fontWeight: '600' },
  topBarSpacer: { width: 44 },
  intro: { gap: 11 },
  category: { color: colors.accent, fontSize: 12, fontWeight: '700' },
  name: { color: colors.text, fontSize: 30, lineHeight: 37, fontWeight: '700' },
  description: { color: colors.secondary, fontSize: 14, lineHeight: 22 },
  meta: { flexDirection: 'row', borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.border, paddingVertical: 17 },
  metaItem: { flex: 1, alignItems: 'center', gap: 6, paddingHorizontal: 4 },
  metaValue: { color: colors.text, fontSize: 13, fontWeight: '700', textAlign: 'center' },
  metaLabel: { color: colors.secondary, fontSize: 11, textAlign: 'center' },
  section: { gap: 13 },
  sectionTitle: { color: colors.text, fontSize: 19, fontWeight: '700' },
  unavailableText: { color: colors.secondary, fontSize: 14, lineHeight: 22 },
  matchSummary: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, paddingHorizontal: 14, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 12 },
  matchSummaryText: { flex: 1, fontSize: 13, lineHeight: 19, fontWeight: '600' },
  matchError: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  retryText: { color: colors.accent, fontSize: 13, fontWeight: '600' },
  ingredientGroup: { gap: 4 },
  groupTitle: { fontSize: 13, fontWeight: '700', marginTop: 8, marginBottom: 2 },
  ingredientRow: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 12, borderBottomWidth: 1, borderBottomColor: colors.border, paddingVertical: 10 },
  ingredientName: { flex: 1, color: colors.text, fontSize: 14, lineHeight: 21 },
  measure: { flexShrink: 1, maxWidth: '45%', color: colors.secondary, fontSize: 13, lineHeight: 20, textAlign: 'right' },
  addMissingButton: { minHeight: 54, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9, padding: 12, marginTop: 14, borderRadius: 14, backgroundColor: colors.text },
  addMissingText: { flexShrink: 1, color: colors.background, fontSize: 13, lineHeight: 18, fontWeight: '700', textAlign: 'center' },
  stepRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 14, paddingVertical: 4 },
  stepNumber: { width: 28, height: 28, borderRadius: 14, backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center' },
  stepNumberText: { color: colors.accent, fontSize: 13, fontWeight: '700' },
  stepText: { flex: 1, color: colors.secondary, fontSize: 14, lineHeight: 23 },
  loader: { marginTop: 80 },
  fallback: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 13, padding: 24 },
  fallbackTitle: { color: colors.text, fontSize: 20, fontWeight: '700' },
  fallbackText: { color: colors.secondary, fontSize: 13, textAlign: 'center' },
  fallbackButton: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 18, borderRadius: 12, backgroundColor: colors.surface },
  fallbackButtonText: { color: colors.accent, fontSize: 14, fontWeight: '600' },
  pressed: { opacity: 0.7 },
});
