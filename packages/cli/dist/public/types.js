export var ExitCode;
(function (ExitCode) {
    ExitCode[ExitCode["SUCCESS"] = 0] = "SUCCESS";
    ExitCode[ExitCode["GENERAL_ERROR"] = 1] = "GENERAL_ERROR";
    ExitCode[ExitCode["USAGE_ERROR"] = 2] = "USAGE_ERROR";
    ExitCode[ExitCode["CONFIG_ERROR"] = 3] = "CONFIG_ERROR";
    ExitCode[ExitCode["DATABASE_ERROR"] = 4] = "DATABASE_ERROR";
    ExitCode[ExitCode["MIGRATION_ERROR"] = 5] = "MIGRATION_ERROR";
    ExitCode[ExitCode["INTERRUPTED"] = 130] = "INTERRUPTED";
})(ExitCode || (ExitCode = {}));
//# sourceMappingURL=types.js.map