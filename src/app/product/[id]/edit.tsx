import { router, useLocalSearchParams } from 'expo-router';
import { useCallback } from 'react';
import { ProductForm } from '@/components/product-form';
import { ProductLoadState } from '@/components/product-load-state';
import { getProductById, updateProduct } from '@/db/products';
import { useFocusedData } from '@/hooks/use-focused-data';

export default function EditProductScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const productId = typeof id === 'string' && /^\d+$/.test(id) ? Number(id) : NaN;
  const load = useCallback(() => Number.isSafeInteger(productId) && productId > 0 ? getProductById(productId) : Promise.resolve(null), [productId]);
  const { data: product, loading, error, reload } = useFocusedData(load);

  if ((loading && !product) || error || !product) {
    return <ProductLoadState loading={loading} error={error} onRetry={reload} onBack={() => router.dismissTo('/(tabs)/inventory')} />;
  }

  const detailRoute = { pathname: '/product/[id]', params: { id: product.id } } as const;
  return (
    <ProductForm
      key={product.id}
      title="Edit Product"
      submitLabel="Save Changes"
      initialProduct={product}
      onBack={() => router.dismissTo(detailRoute)}
      onSubmit={async (input) => {
        await updateProduct(product.id, input);
        router.dismissTo(detailRoute);
      }}
    />
  );
}
