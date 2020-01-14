"use strict";
function __export(m) {
    for (var p in m) if (!exports.hasOwnProperty(p)) exports[p] = m[p];
}
Object.defineProperty(exports, "__esModule", { value: true });
var scout_1 = require("./scout");
exports.Scout = scout_1.Scout;
exports.ScoutRequest = scout_1.ScoutRequest;
exports.ScoutSpan = scout_1.ScoutSpan;
var types_1 = require("./types");
exports.ScoutAgentEvent = types_1.AgentEvent;
exports.ScoutEvent = types_1.ScoutEvent;
exports.ApplicationMetadata = types_1.ApplicationMetadata;
exports.buildScoutConfiguration = types_1.buildScoutConfiguration;
exports.LogLevel = types_1.LogLevel;
exports.consoleLogFn = types_1.consoleLogFn;
exports.buildWinstonLogFn = types_1.buildWinstonLogFn;
var express_1 = require("./express");
exports.expressMiddleware = express_1.scoutMiddleware;
__export(require("./errors"));
const integrations_1 = require("./integrations");
// Create an export bag which will contain
exports.EXPORT_BAG = {};
// Set up PG integration
// This is needed for use in Typescript projects since `import` will not
// run global code unless you do a whole-file import
function setupRequireIntegrations(packages) {
    packages = packages || [];
    packages.forEach(name => {
        const integration = integrations_1.getIntegrationForPackage(name);
        if (integration) {
            integration.ritmHook(exports.EXPORT_BAG);
        }
    });
}
exports.setupRequireIntegrations = setupRequireIntegrations;
// For pure NodeJS contexts this will be run automatically
setupRequireIntegrations([
    "pg",
]);