"use client";
// 브라우저 기본 팝업(confirm·prompt·alert) 대신 쓰는 화면 안 대화상자.
// Claude 앱 안 브라우저 등 일부 환경은 기본 팝업을 막아 "취소"로 처리하기 때문이다.
import { useEffect, useRef, useState } from "react";

type Request =
  | { kind: "confirm"; message: string; danger?: boolean; resolve: (ok: boolean) => void }
  | { kind: "prompt"; message: string; initial: string; resolve: (value: string | null) => void }
  | { kind: "alert"; message: string; resolve: () => void };

let show: ((r: Request) => void) | null = null;

export const askConfirm = (message: string, opts: { danger?: boolean } = {}) =>
  new Promise<boolean>((resolve) => (show ? show({ kind: "confirm", message, danger: opts.danger, resolve }) : resolve(false)));

export const askText = (message: string, initial = "") =>
  new Promise<string | null>((resolve) => (show ? show({ kind: "prompt", message, initial, resolve }) : resolve(null)));

export const tell = (message: string) =>
  new Promise<void>((resolve) => (show ? show({ kind: "alert", message, resolve }) : resolve()));

/** layout에 한 번만 둔다 */
export function DialogHost() {
  const [req, setReq] = useState<Request | null>(null);
  const [value, setValue] = useState("");
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    show = (r) => {
      setValue(r.kind === "prompt" ? r.initial : "");
      setReq(r);
    };
    return () => {
      show = null;
    };
  }, []);
  useEffect(() => {
    if (req?.kind === "prompt") input.current?.select();
  }, [req]);

  if (!req) return null;
  const close = (ok: boolean) => {
    if (req.kind === "confirm") req.resolve(ok);
    else if (req.kind === "prompt") req.resolve(ok ? value : null);
    else req.resolve();
    setReq(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4" onMouseDown={() => close(false)}>
      <form
        className="w-full max-w-sm space-y-4 rounded-2xl bg-white p-5 shadow-xl"
        onMouseDown={(e) => e.stopPropagation()}
        onSubmit={(e) => {
          e.preventDefault();
          close(true);
        }}
        onKeyDown={(e) => e.key === "Escape" && close(false)}
      >
        <p className="whitespace-pre-line text-sm text-slate-800">{req.message}</p>
        {req.kind === "prompt" && <input ref={input} value={value} onChange={(e) => setValue(e.target.value)} className="input w-full" />}
        <div className="flex justify-end gap-2">
          {req.kind !== "alert" && (
            <button type="button" className="btn" onClick={() => close(false)}>
              취소
            </button>
          )}
          <button autoFocus={req.kind !== "prompt"} className={req.kind === "confirm" && req.danger ? "btn-primary !bg-red-600 hover:!bg-red-500" : "btn-primary"}>
            확인
          </button>
        </div>
      </form>
    </div>
  );
}
