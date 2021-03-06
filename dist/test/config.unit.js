"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const os = require("os");
const path = require("path");
const test = require("tape");
const process_1 = require("process");
const app_root_dir_1 = require("app-root-dir");
const types_1 = require("../lib/types");
const scout_1 = require("../lib/scout");
const util_1 = require("./util");
test("ScoutConfiguration builds with minimal passed ENV", t => {
    // This env mimics what would be passed in from process.env
    const config = types_1.buildScoutConfiguration({}, {
        env: {
            SCOUT_NAME: "app",
            SCOUT_HOSTNAME: "hostname",
            SCOUT_KEY: "key",
        },
    });
    t.assert(config, "config was generated");
    t.equals(config.hostname, "hostname", "hostname was set");
    t.equals(config.name, "app", "application name was set");
    t.equals(config.key, "key", "key was set");
    t.end();
});
// // WARNING: This test must be run with some isolation or serially,
// // since it touches process.env (even though it resets it)
test("ScoutConfiguration overrides correctly for every config value", (t) => {
    util_1.testConfigurationOverlay(t, { appKey: "name", envValue: "test", expectedValue: "test" });
    util_1.testConfigurationOverlay(t, { appKey: "appServer", envValue: "test-server", expectedValue: "test-server" });
    util_1.testConfigurationOverlay(t, {
        appKey: "applicationRoot",
        envValue: "/var/app/root",
        expectedValue: "/var/app/root"
    });
    util_1.testConfigurationOverlay(t, { appKey: "coreAgentDir", envValue: "/tmp/dir", expectedValue: "/tmp/dir" });
    util_1.testConfigurationOverlay(t, { appKey: "coreAgentDownload", envValue: "true", expectedValue: true });
    util_1.testConfigurationOverlay(t, { appKey: "coreAgentLaunch", envValue: "false", expectedValue: false });
    util_1.testConfigurationOverlay(t, { appKey: "coreAgentLogLevel", envValue: "info", expectedValue: types_1.LogLevel.Info });
    util_1.testConfigurationOverlay(t, { appKey: "coreAgentPermissions", envValue: "700", expectedValue: 700 });
    util_1.testConfigurationOverlay(t, { appKey: "coreAgentversion", envValue: "v1.2.4", expectedValue: "v1.2.4" });
    util_1.testConfigurationOverlay(t, {
        appKey: "disabledInstruments",
        envValue: "instrument_1,instrument_2",
        expectedValue: ["instrument_1", "instrument_2"],
    });
    util_1.testConfigurationOverlay(t, { appKey: "downloadUrl", envValue: "example.org", expectedValue: "example.org" });
    util_1.testConfigurationOverlay(t, { appKey: "framework", envValue: "fw_value", expectedValue: "fw_value" });
    util_1.testConfigurationOverlay(t, { appKey: "frameworkversion", envValue: "v1", expectedValue: "v1" });
    util_1.testConfigurationOverlay(t, { appKey: "hostname", envValue: "test-hostname", expectedValue: "test-hostname" });
    util_1.testConfigurationOverlay(t, {
        appKey: "ignore",
        envValue: "/api/v1/example,/api/v1/test",
        expectedValue: ["/api/v1/example", "/api/v1/test"],
    });
    util_1.testConfigurationOverlay(t, { appKey: "key", envValue: "123456789", expectedValue: "123456789" });
    util_1.testConfigurationOverlay(t, { appKey: "logLevel", envValue: "warn", expectedValue: types_1.LogLevel.Warn });
    util_1.testConfigurationOverlay(t, { appKey: "monitor", envValue: "true", expectedValue: true });
    util_1.testConfigurationOverlay(t, { appKey: "revisionSha", envValue: "51ab8123", expectedValue: "51ab8123" });
    util_1.testConfigurationOverlay(t, { appKey: "scmSubdirectory", envValue: "/var/code", expectedValue: "/var/code" });
    util_1.testConfigurationOverlay(t, {
        appKey: "socketPath",
        envValue: "/var/path/to/socket.sock",
        expectedValue: "/var/path/to/socket.sock",
    });
    t.end();
});
// https://github.com/scoutapp/scout_apm_node/issues/61
test("application metadata is correctly generated", (t) => {
    const env = {
        SCOUT_NAME: "app",
        SCOUT_HOSTNAME: "hostname",
        SCOUT_KEY: "key",
        SCOUT_FRAMEWORK: "express",
        SCOUT_FRAMEWORK_VERSION: "v1",
        SCOUT_APP_SERVER: "appsrv",
        SCOUT_SCM_SUBDIRECTORY: "server",
        SCOUT_APPLICATION_ROOT: "/var/app",
        SCOUT_REVISION_SHA: "12345678",
    };
    const config = types_1.buildScoutConfiguration({}, { env });
    const appMetadata = new types_1.ApplicationMetadata(config);
    t.assert(appMetadata, "app metadata was generated");
    t.equals(appMetadata.language, "nodejs", `[language] matches [${appMetadata.language}]`);
    t.equals(appMetadata.languageVersion, process_1.version, `[languageVersion] matches [${appMetadata.languageVersion}]`);
    t.assert(new Date(appMetadata.serverTime), `[serverTime] is a non null date [${appMetadata.serverTime}]`);
    t.equals(appMetadata.framework, env.SCOUT_FRAMEWORK, `[framework] matches [${appMetadata.framework}]`);
    t.equals(appMetadata.frameworkVersion, env.SCOUT_FRAMEWORK_VERSION, `[frameworkVersion] matches [${appMetadata.frameworkVersion}]`);
    t.equals(appMetadata.environment, "", `[environment] matches [${appMetadata.environment}]`);
    t.equals(appMetadata.appServer, env.SCOUT_APP_SERVER, `[appServer] matches [${appMetadata.appServer}]`);
    t.equals(appMetadata.hostname, env.SCOUT_HOSTNAME, `[hostname] matches [${appMetadata.hostname}]`);
    t.equals(appMetadata.databaseEngine, "", `[databaseEngine] matches [${appMetadata.databaseEngine}]`);
    t.equals(appMetadata.databaseAdapter, "", `[databaseAdapter] matches [${appMetadata.databaseAdapter}]`);
    t.equals(appMetadata.applicationName, env.SCOUT_NAME, `[applicationName] matches [${appMetadata.applicationName}]`);
    t.assert(appMetadata.libraries && appMetadata.libraries instanceof Array, `[libraries] is non-null and an array [${appMetadata.libraries}]`);
    t.equals(appMetadata.paas, "", `[paas] matches [${appMetadata.paas}]`);
    t.equals(appMetadata.applicationRoot, env.SCOUT_APPLICATION_ROOT, `[applicationRoot] matches [${appMetadata.applicationRoot}]`);
    t.equals(appMetadata.scmSubdirectory, env.SCOUT_SCM_SUBDIRECTORY, `[scmSubdirectory] matches [${appMetadata.scmSubdirectory}]`);
    t.equals(appMetadata.gitSHA, env.SCOUT_REVISION_SHA, `[gitSHA] matches [${appMetadata.gitSHA}]`);
    t.end();
});
// https://github.com/scoutapp/scout_apm_node/issues/124
test("core agent dir matches python", (t) => {
    const config = types_1.buildScoutConfiguration({ coreAgentVersion: "v1.2.8" });
    const scout = new scout_1.Scout(config);
    const expectedCoreAgentDir = path.join(os.tmpdir(), "scout_apm_core");
    const expectedSocketPath = path.join(expectedCoreAgentDir, `scout_apm_core-v1.2.8-${types_1.generateTriple()}`, "core-agent.sock");
    t.equals(config.coreAgentDir, expectedCoreAgentDir, "core agent directory matches the expected value");
    t.equals(scout.getSocketPath(), `unix://${expectedSocketPath}`, "socket path matches expected value");
    t.end();
});
// https://github.com/scoutapp/scout_apm_node/issues/169
test("application root is present in default", (t) => {
    const config = types_1.buildScoutConfiguration();
    // Application root is supposed to be the folder *above* the project's folder
    const expectedApplicationRoot = path.dirname(app_root_dir_1.get());
    t.equals(config.applicationRoot, expectedApplicationRoot, `root dir matches expected [${expectedApplicationRoot}]`);
    t.end();
});
test("log level accepts both upper and lower case", (t) => {
    // Upper, lower, weird cases
    t.equals(types_1.parseLogLevel("DEBUG"), types_1.LogLevel.Debug);
    t.equals(types_1.parseLogLevel("debug"), types_1.LogLevel.Debug);
    t.equals(types_1.parseLogLevel("DEbUG"), types_1.LogLevel.Debug);
    t.equals(types_1.parseLogLevel("INFO"), types_1.LogLevel.Info);
    t.equals(types_1.parseLogLevel("info"), types_1.LogLevel.Info);
    t.equals(types_1.parseLogLevel("InfO"), types_1.LogLevel.Info);
    t.equals(types_1.parseLogLevel("WARN"), types_1.LogLevel.Warn);
    t.equals(types_1.parseLogLevel("warn"), types_1.LogLevel.Warn);
    t.equals(types_1.parseLogLevel("wARn"), types_1.LogLevel.Warn);
    t.equals(types_1.parseLogLevel("ERROR"), types_1.LogLevel.Error);
    t.equals(types_1.parseLogLevel("error"), types_1.LogLevel.Error);
    t.equals(types_1.parseLogLevel("Error"), types_1.LogLevel.Error);
    t.end();
});
