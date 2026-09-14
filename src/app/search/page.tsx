import { Suspense } from "react";
import SearchResults from "@/components/SearchResults";
import { MasonrySkeleton } from "@/components/MasonryGrid";

export const metadata = {
  title: "Search — WEJI ويجي",
};

export default function SearchPage() {
  // useSearchParams needs a Suspense boundary above it in the App Router.
  return (
    <Suspense
      fallback={
        <main className="mx-auto max-w-[1600px] px-4 pt-24 sm:px-6">
          <MasonrySkeleton count={15} />
        </main>
      }
    >
      <SearchResults />
    </Suspense>
  );
}
