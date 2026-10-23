// DOM tests substitute the worker transport; browser QA checks the real bundle.
// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "../src/App";
import { analyse, type CaseInput } from "../src/engine/analysis";
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
    data: CaseInput;
  }) {
    setTimeout(() => {
      if (this.stopped) return;
      try {
        let result;
        if (task === "analyse") result = analyse(data.input, data.rules);
        else {
          const left = compile(data.left, data.mode),
            right = compile(data.right, data.mode);
          result = {
            left,
            right,
            comparison: compareDfa(left.minimal, right.minimal),
          };
        }
        this.onmessage?.({ data: { id, result } });
      } catch (e) {
        this.onmessage?.({
          data: { id, error: { message: (e as Error).message } },
        });
      }
    }, workerDelay);
  }
  terminate() {
    this.stopped = true;
  }
}
beforeEach(() => {
  workerDelay = 0;
  vi.stubGlobal("Worker", TestWorker);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
describe("Small demo flows", () => {
  it("checks a valid nested command and exposes steps only on request", async () => {
    render(<App />);
    const u = userEvent.setup();
    expect(screen.queryByText("Valid", { exact: true })).toBeNull();
    await u.click(screen.getByRole("button", { name: "Check input" }));
    await screen.findByText("Valid", { exact: true });
    expect(screen.getByText("Found", { exact: true })).toBeTruthy();
    const details = document.querySelector("details")!;
    expect(details.open).toBe(false);
    await u.click(screen.getByText("Show steps"));
    expect(details.open).toBe(true);
    expect(screen.getByText("Accept: input and stack reached $.")).toBeTruthy();
  });
  it("keeps pattern matching independent of missing values and brackets", async () => {
    render(<App />);
    const u = userEvent.setup();
    await u.click(screen.getByRole("button", { name: "Missing value" }));
    await screen.findByText("Invalid", { exact: true });
    expect(screen.getByText("Found", { exact: true })).toBeTruthy();
    expect(
      screen.getByText("A flag needs a word or quoted value."),
    ).toBeTruthy();
    await u.click(screen.getByRole("button", { name: "Missing bracket" }));
    await screen.findByText("A group is missing its closing bracket.");
    await u.click(screen.getByRole("button", { name: "Valid command" }));
    await screen.findByText("Valid", { exact: true });
  });
  it("clears old results on edits and handles plain commands and lexical errors", async () => {
    render(<App />);
    const u = userEvent.setup();
    await u.click(screen.getByRole("button", { name: "Valid command" }));
    await screen.findByText("Valid", { exact: true });
    await u.clear(screen.getByLabelText("Command"));
    expect(screen.queryByText("Valid", { exact: true })).toBeNull();
    await u.type(screen.getByLabelText("Command"), "inspect file");
    await u.click(screen.getByRole("button", { name: "Check input" }));
    await screen.findByText("Not found", { exact: true });
    expect(screen.getByText("Valid", { exact: true })).toBeTruthy();
    await u.type(screen.getByLabelText("Command"), " @");
    await u.click(screen.getByRole("button", { name: "Check input" }));
    await screen.findByText(/Unsupported character/);
    expect(screen.getByText("Invalid", { exact: true })).toBeTruthy();
  });
  it("finds --a and shows the real acceptance disagreement and trace", async () => {
    render(<App />);
    const u = userEvent.setup();
    await u.click(screen.getByRole("button", { name: "Compare rules" }));
    await u.click(
      within(document.querySelector("form")!).getByRole("button", {
        name: "Compare rules",
      }),
    );
    await screen.findByText("Shortest example");
    expect(document.querySelector(".witness")?.textContent).toBe("--a");
    expect(screen.getByText("Accepts", { exact: true })).toBeTruthy();
    expect(screen.getByText("Rejects", { exact: true })).toBeTruthy();
    await u.click(screen.getByText("Show steps"));
    expect(within(screen.getByRole("table")).getAllByRole("row")).toHaveLength(
      5,
    );
  });
  it("checks equivalence, the empty witness and invalid regex diagnostics", async () => {
    render(<App />);
    const u = userEvent.setup();
    await u.click(screen.getByRole("button", { name: "Compare rules" }));
    const submit = () =>
      within(document.querySelector("form")!).getByRole("button", {
        name: "Compare rules",
      });
    const a = screen.getByLabelText("Rule A"),
      b = screen.getByLabelText("Rule B");
    await u.clear(a);
    await u.type(a, "a+");
    await u.clear(b);
    await u.type(b, "aa*");
    await u.click(submit());
    await screen.findByText("Same language");
    await u.clear(a);
    await u.type(a, "a*");
    await u.clear(b);
    await u.type(b, "a+");
    await u.click(submit());
    await screen.findByText("ε (empty input)");
    await u.clear(a);
    await u.type(a, "[[");
    await u.click(submit());
    expect((await screen.findByRole("alert")).textContent).toContain(
      "square bracket",
    );
    expect(screen.queryByText("Shortest example")).toBeNull();
  });
  it("cancels pending work and ignores late results", async () => {
    render(<App />);
    const u = userEvent.setup();
    workerDelay = 300;
    await u.click(screen.getByRole("button", { name: "Check input" }));
    await u.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.getByRole("alert").textContent).toContain("cancelled");
    await waitFor(() =>
      expect(screen.queryByText("Valid", { exact: true })).toBeNull(),
    );
  });
  it("supports keyboard view activation and input submission", async () => {
    render(<App />);
    const u = userEvent.setup();
    screen.getByRole("button", { name: "Compare rules" }).focus();
    await u.keyboard("{Enter}");
    expect(
      screen.getByRole("heading", { name: "Compare two rules" }),
    ).toBeTruthy();
    screen.getByLabelText("Rule B").focus();
    await u.keyboard("{Enter}");
    await screen.findByText("Shortest example");
  });
});
