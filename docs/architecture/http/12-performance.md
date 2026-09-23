# 12 — HTTP Performance Benchmarks & Rules

## Design Rules for Hot Paths

- **Case-Insensitive Normalization**:
  Cached lowercase Map keys prevent repeated string lowercasing passes during header searches.
- **Lazy Query Parsing**:
  `HttpQuery` parses query parameters only once and buffers results in lightweight arrays.
- **Microbenchmark Results**:
  Validated under Vitest bench baseline suite (`benchmarks/http/http.bench.ts`):

| Operation                               | Throughput (ops/sec) | Mean Latency |
| :-------------------------------------- | :------------------- | :----------- |
| **Raw Response Creation**               | 10,990,926 ops/sec   | 0.0001 ms    |
| **Header Lookup**                       | 7,160,766 ops/sec    | 0.0001 ms    |
| **Request Context Creation**            | 6,915,571 ops/sec    | 0.0001 ms    |
| **Header Mutation (Set/Delete)**        | 5,298,487 ops/sec    | 0.0002 ms    |
| **Text Response Creation**              | 2,909,532 ops/sec    | 0.0003 ms    |
| **Query Parameter Parsing**             | 2,288,720 ops/sec    | 0.0004 ms    |
| **JSON Response Creation**              | 2,066,799 ops/sec    | 0.0005 ms    |
| **Request Object Creation**             | 834,571 ops/sec      | 0.0012 ms    |
| **HTTP Error Creation & Serialization** | 322,924 ops/sec      | 0.0031 ms    |
