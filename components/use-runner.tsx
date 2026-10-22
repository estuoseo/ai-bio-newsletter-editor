"use client";
import { useState, useTransition } from "react";
import type { ActionResult } from "@/app/actions";

/** Server Action을 부르고 결과 문구를 보여주는 공통 도우미 */
export function useRunner() {
  const [pending, start] = useTransition();
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);
  const run = (fn: () => Promise<ActionResult>, onOk?: () => void) =>
    start(async () => {
      const r = await fn();
      if (r.ok) {
        setNotice(r.message ? { ok: true, text: r.message } : null);
        onOk?.();
      } else setNotice({ ok: false, text: r.error });
    });
  return { pending, notice, setNotice, run };
}

export function Notice({ notice }: { notice: { ok: boolean; text: string } | null }) {
  if (!notice) return null;
  return <p className={`text-sm ${notice.ok ? "text-emerald-700" : "text-red-600"}`}>{notice.text}</p>;
}
