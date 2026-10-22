import { compile, compareDfa, LabError } from "./engine/automata";
import { analyse, type CaseInput } from "./engine/analysis";
self.onmessage = (
  event: MessageEvent<{
    id: number;
    task: "analyse" | "compile" | "compare";
    data: CaseInput;
  }>,
) => {
  const { id, task, data } = event.data;
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
    self.postMessage({ id, task, result });
  } catch (e) {
    self.postMessage({
      id,
      task,
      error: {
        message: e instanceof Error ? e.message : String(e),
        kind: e instanceof LabError ? e.kind : "invalid",
        offset: e instanceof LabError ? e.offset : undefined,
      },
    });
  }
};
