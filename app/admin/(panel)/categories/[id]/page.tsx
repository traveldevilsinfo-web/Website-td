import { TaxonomyEditor } from "../../_taxonomy/views";

export default async function Page({ params }: PageProps<"/admin/categories/[id]">) {
  return <TaxonomyEditor kind="categories" idParam={(await params).id} />;
}
