import { TaxonomyEditor } from "../../_taxonomy/views";

export default async function Page({ params }: PageProps<"/admin/destinations/[id]">) {
  return <TaxonomyEditor kind="destinations" idParam={(await params).id} />;
}
