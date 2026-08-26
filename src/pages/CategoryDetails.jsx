import { TaxonomyDetail } from '../components/taxonomy/TaxonomyDetail';
import { categoryService } from '../services/categoryService';

export default function CategoryDetails() {
  return (
    <TaxonomyDetail
      service={categoryService}
      routePrefix="category"
      entityName="Categories"
      singular="Category"
      field="category"
    />
  );
}
