import { describe, expect, it } from "vitest";
import { parseOwner } from "@/lib/ingest/owner";

describe("parseOwner (보도자료 담당 부서 표)", () => {
  it("실 이름이 아니라 담당 과와 책임자 연락처를 뽑는다", () => {
    const text = [
      "재정경제부는 … 정책들을 지속 모색해나갈 계획이다.",
      "담당 부서",
      "혁신성장실",
      "책임자",
      "과 장",
      "김혜련",
      "(044-215-4930)",
      "전략경제분석과",
      "담당자",
      "사무관",
      "양지연",
      "(didwldus48@korea.kr)",
      "담당 부서",
      "중소기업중앙회",
      "AI혁신사업팀",
    ].join("\n");
    expect(parseOwner(text)).toEqual({ division: "전략경제분석과", contact: "과장 김혜련 (044-215-4930)" });
  });

  it("담당 부서 표가 없으면 비워 둔다", () => {
    expect(parseOwner("본문만 있는 보도자료")).toEqual({ division: null, contact: null });
  });
});
