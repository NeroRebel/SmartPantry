import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import { useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useThemedStyles } from '@/theme/theme-context';
import type { AppColors } from '@/theme/theme';
import type { Recipe, RecipeListItem, RecipeMatch } from '@/types/recipe';

const visualColors: Record<string, readonly [string, string]> = {
  Breakfast: ['#5A291F', '#9E5C2F'], Lunch: ['#223C31', '#4B7150'],
  Dinner: ['#3D2C31', '#865044'], Pasta: ['#5D2926', '#B65C2D'],
  Chicken: ['#5D3524', '#AA7140'], Vegetarian: ['#264536', '#5D8350'], Dessert: ['#704035', '#AD7153'],
};

export function RecipeVisual({ recipe, large = false }: { recipe: Pick<RecipeListItem, 'name' | 'imageUrl' | 'emoji' | 'category'>; large?: boolean }) {
  const { styles } = useThemedStyles(createStyles);
  const [failedImage, setFailedImage] = useState<string | null>(null);
  return (
    <View style={[styles.visual, large ? styles.largeVisual : styles.cardVisual]}>
      {recipe.imageUrl && recipe.imageUrl !== failedImage ? (
        <Image source={{ uri: recipe.imageUrl }} resizeMode="cover" style={styles.image} accessibilityLabel={recipe.name} onError={() => setFailedImage(recipe.imageUrl)} />
      ) : (
        <LinearGradient colors={visualColors[recipe.category] ?? ['#3D3432', '#796259']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.gradient}>
          <Text style={[styles.emoji, large && styles.largeEmoji]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">{recipe.emoji}</Text>
        </LinearGradient>
      )}
    </View>
  );
}

export function RecipeCard({ recipe, onPress, match }: { recipe: RecipeListItem | Recipe; onPress: () => void; match?: RecipeMatch }) {
  const { colors, styles } = useThemedStyles(createStyles);
  const { t } = useTranslation();
  const ingredientCount = 'ingredientCount' in recipe ? recipe.ingredientCount : recipe.ingredients.length;
  const hasMeta = recipe.prepTime != null || !!recipe.difficulty || ingredientCount != null;
  const complete = !!match && match.totalCount > 0 && match.missingIngredients.length === 0;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${recipe.name}, ${recipe.area ?? recipe.category}${recipe.prepTime != null ? `, ${t('common.minutes', { count: recipe.prepTime })}` : ''}${recipe.difficulty ? `, ${recipe.difficulty}` : ''}${match ? `, ${t('recipe.haveCount', { available: match.availableCount, total: match.totalCount })}` : ''}`}
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      <RecipeVisual recipe={recipe} />
      <View style={styles.body}>
        <View style={styles.titleRow}>
          <View style={styles.copy}>
            <Text style={styles.eyebrow}>{recipe.area ?? recipe.category}</Text>
            <Text style={styles.name}>{recipe.name}</Text>
          </View>
          <Ionicons name="chevron-forward" size={19} color={colors.secondary} />
        </View>
        {hasMeta && <View style={styles.meta}>
          {recipe.prepTime != null && <Meta icon="time-outline" text={t('common.minutes', { count: recipe.prepTime })} />}
          {recipe.difficulty && <Meta icon="flame-outline" text={recipe.difficulty} />}
          {ingredientCount != null && <Meta icon="list-outline" text={t('common.ingredientCount', { count: ingredientCount })} />}
        </View>}
        {match && <View style={styles.matchRow}>
          <Ionicons name={complete ? 'checkmark-circle' : 'sparkles-outline'} size={20} color={complete ? colors.fresh : colors.soon} />
          <View style={styles.matchCopy}>
            <Text style={[styles.matchCount, { color: complete ? colors.fresh : colors.soon }]}>{t('recipes.availableCount', { available: match.availableCount, total: match.totalCount })}</Text>
            <Text style={styles.matchDetail}>{complete ? t('recipes.canCook') : t('recipes.missingCount', { count: match.missingIngredients.length })}</Text>
          </View>
        </View>}
      </View>
    </Pressable>
  );
}

function Meta({ icon, text }: { icon: keyof typeof Ionicons.glyphMap; text: string }) {
  const { colors, styles } = useThemedStyles(createStyles);
  return <View style={styles.metaItem}><Ionicons name={icon} size={14} color={colors.secondary} /><Text style={styles.metaText}>{text}</Text></View>;
}

const createStyles = (colors: AppColors) => StyleSheet.create({
  card: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 18, overflow: 'hidden' },
  pressed: { opacity: 0.75 },
  visual: { overflow: 'hidden', backgroundColor: colors.surface },
  cardVisual: { height: 148 },
  largeVisual: { height: 240, borderRadius: 20 },
  gradient: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  image: { width: '100%', height: '100%' },
  emoji: { fontSize: 74, lineHeight: 96 },
  largeEmoji: { fontSize: 112, lineHeight: 140 },
  body: { padding: 16, gap: 13 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  copy: { flex: 1, gap: 5 },
  eyebrow: { color: colors.accent, fontSize: 11, fontWeight: '700' },
  name: { color: colors.text, fontSize: 18, lineHeight: 24, fontWeight: '700' },
  meta: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 16, rowGap: 8 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  metaText: { color: colors.secondary, fontSize: 12, lineHeight: 17 },
  matchRow: { flexDirection: 'row', alignItems: 'center', gap: 9, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 12 },
  matchCopy: { flex: 1, minWidth: 0, gap: 3 },
  matchCount: { fontSize: 12, lineHeight: 17, fontWeight: '700' },
  matchDetail: { color: colors.secondary, fontSize: 11, lineHeight: 16 },
});
