export interface ScannedProduct {
  barcode: string;
  name: string;
  brand: string | null;
  category: string;
  imageUrl: string | null;
  packageQuantity: string | null;
  nutritionGrade: string | null;
  quantity: number | null;
  unit: string | null;
}
