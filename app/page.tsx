import { Suspense } from "react";
import { EditorPage } from "@/components/editor-page";
import { Nav } from "@/components/nav";
import { loadTab } from "@/lib/server/load";

async function Editor({ searchParams }: { searchParams: PageProps<"/">["searchParams"] }) {
  const { tab } = await searchParams;
  const data = await loadTab(tab);
  return <EditorPage {...data} />;
}

export default function Home(props: PageProps<"/">) {
  return (
    <>
      <Nav active="/" />
      <main className="mx-auto max-w-7xl p-4">
        <Suspense fallback={<p className="p-8 text-center text-slate-400">불러오는 중…</p>}>
          <Editor searchParams={props.searchParams} />
        </Suspense>
      </main>
    </>
  );
}
