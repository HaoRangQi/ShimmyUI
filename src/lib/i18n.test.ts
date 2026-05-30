import { describe, expect, it } from "vitest";
import { dictionaries } from "./i18n";

describe("i18n dictionaries", () => {
  it("keeps English and Chinese keys aligned", () => {
    expect(Object.keys(dictionaries.zh).sort()).toEqual(
      Object.keys(dictionaries.en).sort(),
    );
  });
});
