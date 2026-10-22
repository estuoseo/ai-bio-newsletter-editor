"use client";
// 굵게·형광펜만 되는 작은 글상자 (F6). 저장 형식은 lib/html.ts / types의 RichText 참고.
import { useRef } from "react";
import type { HighlightColor } from "@/types";

function selectionRange(): Range | null {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return null;
  return sel.getRangeAt(0);
}

function highlight(color: HighlightColor) {
  const range = selectionRange();
  if (!range) return;
  const mark = document.createElement("mark");
  mark.dataset.color = color;
  mark.appendChild(range.extractContents());
  mark.querySelectorAll("mark").forEach((m) => m.replaceWith(...m.childNodes));
  range.insertNode(mark);
}

function clearFormat() {
  const range = selectionRange();
  if (!range) return;
  const text = range.toString();
  range.deleteContents();
  range.insertNode(document.createTextNode(text));
}

/** 선택한 글자에 서식을 입힌다. 버튼을 눌러도 선택이 풀리지 않게 onMouseDown에서 막는다 */
export function FormatToolbar() {
  const keep = (fn: () => void) => (e: React.MouseEvent) => {
    e.preventDefault();
    fn();
  };
  return (
    <div className="flex items-center gap-1 text-xs" title="글자를 드래그해 선택한 뒤 누르세요">
      <button type="button" onMouseDown={keep(() => document.execCommand("bold"))} className="btn !px-2 !py-0.5 font-bold">B</button>
      <button type="button" onMouseDown={keep(() => highlight("yellow"))} className="btn !px-2 !py-0.5 !bg-[#fff1a8]">형광</button>
      <button type="button" onMouseDown={keep(() => highlight("green"))} className="btn !px-2 !py-0.5 !bg-[#c9f2d4]">형광</button>
      <button type="button" onMouseDown={keep(() => highlight("blue"))} className="btn !px-2 !py-0.5 !bg-[#cfe3ff]">형광</button>
      <button type="button" onMouseDown={keep(clearFormat)} className="btn !px-2 !py-0.5">서식 지우기</button>
    </div>
  );
}

/** 처음 값만 받아 그리고, 글자를 바꾸면 onChange로 알린다 (입력 중 커서가 튀지 않게 제어하지 않음) */
export function RichText({
  html,
  onChange,
  onBlur,
  placeholder,
  className = "",
}: {
  html: string;
  onChange?: (html: string) => void;
  onBlur?: (html: string) => void;
  placeholder?: string;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  return (
    <div
      ref={(el) => {
        // 처음 붙을 때만 내용을 넣는다
        if (el && !ref.current) el.innerHTML = html;
        ref.current = el;
      }}
      contentEditable
      suppressContentEditableWarning
      data-placeholder={placeholder}
      onInput={(e) => onChange?.(e.currentTarget.innerHTML)}
      onBlur={(e) => onBlur?.(e.currentTarget.innerHTML)}
      onKeyDown={(e) => {
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "b") {
          e.preventDefault();
          document.execCommand("bold");
        }
      }}
      className={`rich min-h-[1.5em] leading-relaxed ${className}`}
    />
  );
}
