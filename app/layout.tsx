import type { Metadata } from "next";
import { DialogHost } from "@/components/dialog";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI·바이오 보도자료 뉴스레터 편집기",
  description: "정부 부처 보도자료 AI 요약·편집·메일 발송",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ko" className="h-full antialiased">
      <body className="min-h-full bg-slate-50 text-slate-900 [font-family:'Pretendard','Apple_SD_Gothic_Neo','Malgun_Gothic',sans-serif]">
        {children}
        <DialogHost />
      </body>
    </html>
  );
}
