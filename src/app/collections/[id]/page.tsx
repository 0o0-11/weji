import CollectionDetail from "@/components/CollectionDetail";

export const metadata = { title: "Collection — WEJI ويجي" };

export default async function CollectionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <CollectionDetail collectionId={id} />;
}
