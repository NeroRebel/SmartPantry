import { router, useLocalSearchParams } from 'expo-router';
import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { ProductForm } from '@/components/product-form';
import { ProductLoadState } from '@/components/product-load-state';
import { getProductById } from '@/db/products';
import { useFocusedData } from '@/hooks/use-focused-data';
import { editProduct } from '@/services/product-lifecycle';

export default function EditProductScreen() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const productId = typeof id === 'string' && id.length > 0 && id.length <= 256 ? id : null;
  const load = useCallback(() => productId ? getProductById(productId) : Promise.resolve(null), [productId]);
  const { data: product, loading, error, reload } = useFocusedData(load);

  if ((loading && !product) || error || !product) {
    return <ProductLoadState loading={loading} error={error} onRetry={reload} onBack={() => router.dismissTo('/(tabs)/inventory')} />;
  }

  const detailRoute = { pathname: '/product/[id]', params: { id: product.id } } as const;
  return (
    <ProductForm
      key={product.id}
      title={t('product.edit')}
      submitLabel={t('product.saveChanges')}
      initialProduct={product}
      onBack={() => router.dismissTo(detailRoute)}
      onSubmit={async (input) => {
        await editProduct(product.id, input);
        router.dismissTo(detailRoute);
      }}
    />
  );
}
