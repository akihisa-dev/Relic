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
            { name: "王国暦" },
            { name: "帝国暦", startYear: 100 }
          ]}
          onSave={onSave}
        />
      </I18nProvider>
    );

    fireEvent.change(screen.getByLabelText("メイン暦の開始年"), { target: { value: "" } });

    expect(onSave).toHaveBeenLastCalledWith([
      { name: "王国暦" },
      { name: "帝国暦" }
    ]);
    expect(screen.getByText("開始年を入力すると換算を確認できます。")).toBeInTheDocument();

    fireEvent.change(screen.getByDisplayValue("帝国暦"), { target: { value: "帝国暦2" } });
    fireEvent.change(screen.getByLabelText("メイン暦の開始年"), { target: { value: "100" } });

    expect(onSave).toHaveBeenLastCalledWith([
      { name: "王国暦" },
      { name: "帝国暦2", startYear: 100 }
    ]);
    expect(screen.getByText("帝国暦21年 = 王国暦100年")).toBeInTheDocument();
  });

  it("不正な開始年は保存せず入力欄の近くにエラーを出す", () => {
    const onSave = vi.fn();

    render(
      <I18nProvider language="ja">
        <ChronicleSettingsPanel
          calendars={[
            { name: "王国暦" },
            { name: "帝国暦", startYear: 100 }
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
