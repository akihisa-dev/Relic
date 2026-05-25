import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { I18nProvider } from "../i18n";
import { ChronicleSettingsPanel } from "./ChronicleSettingsPanel";

describe("ChronicleSettingsPanel", () => {
  it("サブ暦名や開始年の空欄を未設定として保存する", () => {
    const onSave = vi.fn();

    render(
      <I18nProvider language="ja">
        <ChronicleSettingsPanel
          calendars={[
            { id: "chronicle0", name: "王国暦" },
            { id: "chronicle1", name: "帝国暦", startYear: 100 }
          ]}
          onSave={onSave}
        />
      </I18nProvider>
    );

    fireEvent.change(screen.getByLabelText("メイン暦の開始年"), { target: { value: "" } });

    expect(onSave).toHaveBeenLastCalledWith([
      { id: "chronicle0", name: "王国暦" },
      { id: "chronicle1", name: "帝国暦" }
    ]);
    expect(screen.getByText("開始年を入力すると換算を確認できます。")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("暦名"), { target: { value: "" } });
    fireEvent.change(screen.getByLabelText("メイン暦の開始年"), { target: { value: "100" } });

    expect(onSave).toHaveBeenLastCalledWith([
      { id: "chronicle0", name: "王国暦" },
      { id: "chronicle1", name: "", startYear: 100 }
    ]);
    expect(screen.getByText("chronicle1 1年 = 王国暦100年")).toBeInTheDocument();
  });

  it("不正な開始年は保存せず入力欄の近くにエラーを出す", () => {
    const onSave = vi.fn();

    render(
      <I18nProvider language="ja">
        <ChronicleSettingsPanel
          calendars={[
            { id: "chronicle0", name: "王国暦" },
            { id: "chronicle1", name: "帝国暦", startYear: 100 }
          ]}
          onSave={onSave}
        />
      </I18nProvider>
    );

    fireEvent.change(screen.getByLabelText("メイン暦の開始年"), { target: { value: "0" } });

    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByLabelText("メイン暦の開始年")).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByText("開始年は1以上の整数で入力してください。")).toBeInTheDocument();
  });
});
