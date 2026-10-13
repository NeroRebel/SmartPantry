import { router } from 'expo-router';
import { ProductForm } from '@/components/product-form';
import { createProduct } from '@/db/products';

export default function AddProductScreen() {
  return (
    <ProductForm
      title="Add Product"
      submitLabel="Add to Pantry"
      onBack={() => router.canGoBack() ? router.back() : router.replace('/(tabs)/inventory')}
      onSubmit={async (input) => {
        await createProduct(input);
        router.dismissTo('/(tabs)/inventory');
      }}
    />
  );
}
