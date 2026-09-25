# Router Performance

## Algorithmic Efficiency

The JSango routing engine is built upon a segment-based Radix Trie:

- **Static Route Matching**: $O(k)$ where $k$ is the number of path segments, achieved via direct `Map.get()` lookup at each level.
- **Parameterized Matching**: Segment constraints are precompiled regexes or functions executed once per segment.
- **Independence from Table Size**: Route lookup latency remains virtually constant as the routing table grows from 10 to 1,000+ routes.

## Benchmark Results

Benchmark results measured with Vitest benchmark runner on modern hardware:

| Benchmark Scenario                          | Throughput (ops/sec) | Average Latency |
| :------------------------------------------ | :------------------- | :-------------- |
| **Static Route (1 route)**                  | ~3,278,000 ops/s     | ~0.30 µs        |
| **Static Route (100 routes)**               | ~1,190,000 ops/s     | ~0.80 µs        |
| **Static Route (1,000 routes)**             | ~1,227,000 ops/s     | ~0.80 µs        |
| **Parameterized (single param)**            | ~1,743,000 ops/s     | ~0.60 µs        |
| **Method Not Allowed (405)**                | ~1,574,000 ops/s     | ~0.60 µs        |
| **Route Not Found (404)**                   | ~1,373,000 ops/s     | ~0.70 µs        |
| **Mixed Table (static + param + wildcard)** | ~705,000 ops/s       | ~1.40 µs        |
| **Parameter Extraction Throughput**         | ~695,000 ops/s       | ~1.40 µs        |
| **Parameterized (multi param)**             | ~678,000 ops/s       | ~1.50 µs        |
| **Wildcard Route Matching**                 | ~655,000 ops/s       | ~1.50 µs        |

## Allocation Minimization

1. **Segment Splitting**: Path segments are split with zero regex overhead and leading/trailing empty segment filtering.
2. **Object Freezing**: Parameter objects and results are frozen to prevent prototype pollution and accidental mutations.
3. **No Dynamic Code Generation**: Uses pure TypeScript trie traversal without `eval()` or `new Function()`, ensuring CSP compliance and predictable JIT compilation.
