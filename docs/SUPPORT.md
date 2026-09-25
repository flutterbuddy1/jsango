# jsango Support Matrix

This document defines officially tested and supported runtimes, operating systems, databases, and package managers for **jsango v1.0.0**.

---

## 1. JavaScript Runtimes

| Runtime     | Version Range                      | Support Status                         | Notes                                                                         |
| :---------- | :--------------------------------- | :------------------------------------- | :---------------------------------------------------------------------------- |
| **Node.js** | `>= 20.0.0` (Active LTS / Current) | :white_check_mark: **Fully Supported** | Tested on Node 20.x and 22.x                                                  |
| **Node.js** | `< 20.0.0`                         | :x: **Unsupported**                    | Lacks required Web API globals (`ReadableStream`, `Crypto`)                   |
| **Bun**     | `>= 1.1.0`                         | :construction: **Future Target**       | Core packages are runtime-independent; dedicated Bun adapter planned for 1.1+ |
| **Deno**    | `>= 1.40.0`                        | :construction: **Future Target**       | Post-1.0 roadmap evaluation                                                   |

---

## 2. Operating Systems

| OS                                       | Architectures                          | Support Status                         |
| :--------------------------------------- | :------------------------------------- | :------------------------------------- |
| **Linux** (Ubuntu, Debian, Alpine, RHEL) | `x64`, `arm64`                         | :white_check_mark: **Fully Supported** |
| **macOS** (Darwin)                       | `Apple Silicon (arm64)`, `Intel (x64)` | :white_check_mark: **Fully Supported** |
| **Windows** (WSL2 / native)              | `x64`                                  | :white_check_mark: **Supported**       |

---

## 3. Databases & Dialects

| Database Engine      | Driver / Adapter       | Status                                   | Transactional DDL                       |
| :------------------- | :--------------------- | :--------------------------------------- | :-------------------------------------- |
| **In-Memory Engine** | `MemoryDatabaseDriver` | :white_check_mark: **Built-in / Stable** | Supported (Snapshots & Savepoints)      |
| **PostgreSQL**       | Universal SQL Dialect  | :white_check_mark: **Supported**         | Supported natively                      |
| **SQLite**           | Universal SQL Dialect  | :white_check_mark: **Supported**         | Supported (within transaction scope)    |
| **MySQL / MariaDB**  | Universal SQL Dialect  | :white_check_mark: **Supported**         | Non-transactional DDL (Implicit commit) |

---

## 4. Package Managers

- **pnpm**: `>= 9.0.0` (Recommended)
- **npm**: `>= 10.0.0`
- **yarn**: `>= 4.0.0` (Berry)
