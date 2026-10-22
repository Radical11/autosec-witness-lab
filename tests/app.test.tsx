// DOM integration tests. These are deliberately labelled separately from real-browser QA.
// The worker transport is substituted here; scripts/runtime-proof.mjs checks the built worker.
// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "../src/App";
import { analyse, caseFile, DEFAULT_RULES } from "../src/engine/analysis";
import { compile, compareDfa } from "../src/engine/automata";
let workerDelay = 0;
class TestWorker {
  onmessage: ((event: { data: unknown }) => void) | null = null;
  onerror: ((e: unknown) => void) | null = null;
  stopped = false;
  postMessage({
    id,
    task,
    data,
  }: {
    id: number;
    task: string;
    data: Parameters<typeof caseFile>[0];
  }) {
    setTimeout(() => {
      if (this.stopped) return;
      try {
        const result =
          task === "analyse"
            ? analyse(data.input, data.rules)
            : task === "compile"
              ? compile(data.left, data.mode)
              : (() => {
                  const left = compile(data.left, data.mode),
                    right = compile(data.right, data.mode);
                  return {
                    left,
                    right,
                    comparison: compareDfa(left.minimal, right.minimal),
                  };
                })();
        this.onmessage?.({ data: { id, task, result } });
      } catch (e) {
        this.onmessage?.({
          data: { id, task, error: { message: (e as Error).message } },
        });
      }
    }, workerDelay);
  }
  terminate() {
    this.stopped = true;
  }
}
beforeEach(() => {
  const values = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (k: string) => values.get(k) ?? null,
    setItem: (k: string, v: string) => values.set(k, v),
    removeItem: (k: string) => values.delete(k),
    clear: () => values.clear(),
  });
  workerDelay = 0;
  vi.stubGlobal("Worker", TestWorker);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
async function boot() {
  render(<App />);
  await screen.findAllByText("Valid structure");
}
describe("User flows in a DOM environment", () => {
  it("loads an example, analyses a mutation, and restores the original", async () => {
    await boot();
    const u = userEvent.setup();
    await u.click(
      screen.getByRole("button", { name: "Remove closing bracket" }),
    );
    await screen.findByText("Invalid structure");
    expect(screen.getByText(/Removed the closing parenthesis/)).toBeTruthy();
    expect(screen.getAllByText("Signature found").length).toBeGreaterThan(0);
    await u.click(screen.getByRole("button", { name: "Restore original" }));
    await screen.findAllByText("Valid structure");
    await u.click(screen.getByRole("button", { name: /Missing flag value/ }));
    await screen.findAllByText("Invalid structure");
    expect(
      screen.getAllByText(/No production for Value/).length,
    ).toBeGreaterThan(0);
  });
  it("generates a counterexample, advances both machines, and proves equivalence", async () => {
    await boot();
    const u = userEvent.setup();
    await u.click(screen.getByRole("button", { name: /Run signature demo/ }));
    await screen.findByText('"--a"');
    expect(
      screen.getByRole("img", { name: /Rule A counterexample replay/ }),
    ).toBeTruthy();
    const slider = screen.getByRole("slider", {
      name: "Counterexample replay: step",
    });
    fireEvent.change(slider, { target: { value: "3" } });
    expect(screen.getByText("Accepted")).toBeTruthy();
    expect(screen.getByText("Rejected")).toBeTruthy();
    await u.click(screen.getByRole("button", { name: "Equivalent forms" }));
    await u.click(
      screen.getByRole("button", { name: /Find a counterexample/ }),
    );
    await screen.findByText("These rules recognise the same language.");
  });
  it("shows stale results after an edit and validates malformed rules", async () => {
    await boot();
    const u = userEvent.setup();
    await u.type(
      screen.getByRole("textbox", { name: "Command-like script" }),
      ")",
    );
    expect(
      screen.getByText("Previous result · input has changed"),
    ).toBeTruthy();
    await u.click(screen.getByRole("button", { name: "Automata Lab02" }));
    await u.clear(screen.getByLabelText("Rule A"));
    await u.type(screen.getByLabelText("Rule A"), "[[");
    await u.click(screen.getByRole("button", { name: "Build rule A" }));
    await screen.findByRole("alert");
    expect(screen.getByRole("alert").textContent).toContain("square bracket");
  });
  it("replays grammar, exposes the calculated sets, and rejects mismatched PDA brackets", async () => {
    await boot();
    const u = userEvent.setup();
    await u.click(screen.getByRole("button", { name: "Grammar & Stack03" }));
    expect(screen.getByText("No LL(1) conflicts")).toBeTruthy();
    fireEvent.change(
      screen.getByRole("slider", { name: "Parser replay: step" }),
      { target: { value: "5" } },
    );
    expect(screen.getByText("ACTION 6")).toBeTruthy();
    await u.click(
      screen.getByText("Parse tree", { exact: false, selector: "summary" }),
    );
    expect(document.querySelector(".parse-tree")).toBeTruthy();
    await u.click(screen.getByRole("button", { name: "Mismatched" }));
    expect(screen.getByText("Final: rejected")).toBeTruthy();
  });
  it("saves a case, persists across remount, exports JSON, and imports with recomputation", async () => {
    const blobs: Blob[] = [];
    vi.stubGlobal(
      "URL",
      class extends URL {
        static createObjectURL(blob: Blob) {
          blobs.push(blob);
          return "blob:test";
        }
        static revokeObjectURL() {}
      },
    );
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    await boot();
    const u = userEvent.setup();
    await u.click(screen.getByRole("button", { name: "Evidence04" }));
    await u.click(screen.getByRole("button", { name: "Save case" }));
    expect(JSON.parse(localStorage.getItem("autosec-cases-v1")!)).toHaveLength(
      1,
    );
    await u.click(screen.getByRole("button", { name: "Export JSON" }));
    expect(blobs.length).toBe(1);
    cleanup();
    await boot();
    await u.click(screen.getByRole("button", { name: "Evidence04" }));
    expect(screen.getByRole("button", { name: "Load" })).toBeTruthy();
    const c = {
      name: "Imported",
      input: "inspect --tag",
      left: "a",
      right: "b",
      mode: "whole" as const,
      rules: DEFAULT_RULES,
    };
    const file = new File([JSON.stringify(caseFile(c, null))], "case.json", {
      type: "application/json",
    });
    Object.defineProperty(file, "text", {
      value: () => Promise.resolve(JSON.stringify(caseFile(c, null))),
    });
    await u.upload(screen.getByLabelText("Import case JSON"), file);
    await screen.findAllByText("Invalid structure");
    expect(
      (screen.getByLabelText("Command-like script") as HTMLTextAreaElement)
        .value,
    ).toBe("inspect --tag");
  });
  it("reports cancellation without labelling a new result as accepted", async () => {
    await boot();
    workerDelay = 500;
    const u = userEvent.setup();
    await u.click(screen.getByRole("button", { name: "Automata Lab02" }));
    await u.click(
      screen.getByRole("button", { name: /Find a counterexample/ }),
    );
    await u.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.getByRole("alert").textContent).toContain("cancelled");
    await waitFor(() => expect(screen.queryByText("WITNESS FOUND")).toBeNull());
  });
  it("supports keyboard navigation and activation of the app navigation", async () => {
    await boot();
    const u = userEvent.setup();
    const target = screen.getByRole("button", { name: "Evidence04" });
    target.focus();
    await u.keyboard("{Enter}");
    expect(
      screen.getByRole("heading", { name: "Make the result reproducible." }),
    ).toBeTruthy();
    await u.tab();
    expect(document.activeElement).not.toBe(target);
  });
});
