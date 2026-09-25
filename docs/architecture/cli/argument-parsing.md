# Argument & Option Parsing

## Overview

`ArgParser` is a zero-dependency, high-performance CLI tokenizer and validator designed specifically for jsango commands. It achieves over 1.3 million complex parses per second with zero external runtime dependencies.

## Supported Syntaxes

### 1. Positional Arguments

- **Required**: `jsango model:show User` (fails with `MissingArgumentError` if omitted).
- **Optional**: `jsango help [command]` (supports defaults).
- **Variadic**: `jsango lint src/ test/` (`variadic: true` collects trailing tokens).
- **Type Coercion**: Automatically coerces to `string`, `number`, or `boolean`.

### 2. Named Options

- **Long options**: `--connection=default` or `--connection default`.
- **Short options**: `-c default` or `-c=default`.
- **Boolean flags**: `--force`, `-f`.
- **Boolean negation**: Passing `--no-cache` automatically sets `cache: false`.
- **Enum options**: Validates value against defined choices (`choices: ['postgres', 'mysql', 'sqlite', 'memory']`).
- **Array options**: Repeated flags (`--include src --include tests`) accumulate into `['src', 'tests']`.

### 3. Strict Validation

- **Unknown Options**: Any option not defined in the command or global option list is rejected with `UnknownOptionError` and a closest-match suggestion.
- **Type Safety**: Invalid numbers or missing option values throw `InvalidOptionValueError`.
