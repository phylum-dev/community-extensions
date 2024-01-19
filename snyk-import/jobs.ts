const DEFAULT_PARALLEL_COUNT = 8;

/// Run the given function in parallel on the items in the input array.
export async function inParallel<In, Out>(
  input: In[],
  fn: (i: In) => Promise<Out>,
  parallel_count?: number,
): Promise<Out[]> {
  const output: Out[] = [];

  parallel_count ||= DEFAULT_PARALLEL_COUNT;

  // Start workers
  const workers = [];
  for (let i = 0; i < parallel_count; i++) {
    workers.push(runWorker(input, output, fn));
  }

  // Wait for them to finish
  await Promise.all(workers);

  return output;
}

async function runWorker<In, Out>(
  input: In[],
  output: Out[],
  fn: (i: In) => Promise<Out>,
) {
  while (true) {
    const val = input.pop();
    if (val === undefined) return;
    output.push(await fn(val));
  }
}
