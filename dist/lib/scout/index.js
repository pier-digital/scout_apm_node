"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const events_1 = require("events");
const path = require("path");
const process = require("process");
const nrc = require("node-request-context");
const cls = require("continuation-local-storage");
const semver = require("semver");
const types_1 = require("../types");
const index_1 = require("../index");
const integrations_1 = require("../integrations");
const web_1 = require("../agent-downloaders/web");
const external_process_1 = require("../agents/external-process");
const Requests = require("../protocol/v1/requests");
const Constants = require("../constants");
const Errors = require("../errors");
var request_1 = require("./request");
exports.ScoutRequest = request_1.default;
var span_1 = require("./span");
exports.ScoutSpan = span_1.default;
const request_2 = require("./request");
const DONE_NOTHING = () => undefined;
const ASYNC_NS = "scout";
const ASYNC_NS_REQUEST = `${ASYNC_NS}.request`;
const ASYNC_NS_SPAN = `${ASYNC_NS}.span`;
class Scout extends events_1.EventEmitter {
    constructor(config, opts) {
        super();
        this.downloaderOptions = {};
        this.canUseAsyncHooks = false;
        this.config = config || types_1.buildScoutConfiguration();
        this.logFn = opts && opts.logFn ? opts.logFn : () => undefined;
        if (opts && opts.downloadOptions) {
            this.downloaderOptions = opts.downloadOptions;
        }
        this.applicationMetadata = new types_1.ApplicationMetadata(this.config, opts && opts.appMeta ? opts.appMeta : {});
        // Check node version for before/after
        this.canUseAsyncHooks = semver.gte(process.version, "8.9.0");
        // Create async namespace if it does not exist
        this.createAsyncNamespace();
    }
    getCoreAgentVersion() {
        return new types_1.CoreAgentVersion(this.coreAgentVersion.raw);
    }
    getApplicationMetadata() {
        return Object.assign({}, this.applicationMetadata);
    }
    getConfig() {
        return this.config;
    }
    log(msg, lvl) {
        this.logFn(msg, lvl);
    }
    setup() {
        // Return early if agent has already been set up
        if (this.agent) {
            return Promise.resolve(this);
        }
        this.downloader = new web_1.default({ logFn: this.logFn });
        // Ensure coreAgentVersion is present
        if (!this.config.coreAgentVersion) {
            const err = new Error("No core agent version specified!");
            this.log(err.message, types_1.LogLevel.Error);
            return Promise.reject(err);
        }
        this.coreAgentVersion = new types_1.CoreAgentVersion(this.config.coreAgentVersion);
        // Build options for download
        this.downloaderOptions = Object.assign({
            cacheDir: Constants.DEFAULT_CORE_AGENT_DOWNLOAD_CACHE_DIR,
            updateCache: true,
        }, this.downloaderOptions, types_1.buildDownloadOptions(this.config));
        // Download the appropriate binary
        return this.downloader
            .download(this.coreAgentVersion, this.downloaderOptions)
            .then(bp => {
            this.binPath = bp;
            this.socketPath = path.join(path.dirname(this.binPath), "core-agent.sock");
            this.log(`[scout] using socket path [${this.socketPath}]`, types_1.LogLevel.Debug);
        })
            // Build options for the agent and create the agent
            .then(() => {
            this.processOptions = new types_1.ProcessOptions(this.binPath, this.getSocketPath(), types_1.buildProcessOptions(this.config));
            this.setupAgent(new external_process_1.default(this.processOptions, this.logFn));
        })
            // Start, connect, and register
            .then(() => {
            this.log(`[scout] starting process w/ bin @ path [${this.binPath}]`, types_1.LogLevel.Debug);
            this.log(`[scout] process options:\n${JSON.stringify(this.processOptions)}`, types_1.LogLevel.Debug);
            return this.agent.start();
        })
            .then(() => this.log("[scout] agent successfully started", types_1.LogLevel.Debug))
            .then(() => this.agent.connect())
            .then(() => this.log("[scout] successfully connected to agent", types_1.LogLevel.Debug))
            .then(() => {
            if (!this.config.name) {
                this.log("[scout] 'name' configuration value missing", types_1.LogLevel.Warn);
            }
            if (!this.config.key) {
                this.log("[scout] 'key' missing in configuration", types_1.LogLevel.Warn);
            }
        })
            // Register the application
            .then(() => this.sendRegistrationRequest())
            // Send the application metadata
            .then(() => this.sendAppMetadataEvent())
            // Set up integration(s)
            .then(() => {
            Object.keys(index_1.EXPORT_BAG)
                .map(packageName => integrations_1.getIntegrationForPackage(packageName))
                .forEach(integration => integration.setScoutInstance(this));
        })
            .then(() => this);
    }
    shutdown() {
        if (!this.agent) {
            this.log("[scout] shutdown called but no agent to shutdown is present", types_1.LogLevel.Error);
            return Promise.reject(new Errors.NoAgentPresent());
        }
        return this.agent
            .disconnect()
            .then(() => {
            if (this.config.allowShutdown) {
                return this.agent.stopProcess();
            }
        });
    }
    hasAgent() {
        return typeof this.agent !== "undefined" && this.agent !== null;
    }
    getAgent() {
        return this.agent;
    }
    /**
     * Function for checking whether a given path (URL) is ignored by scout
     *
     * @param {string} path - processed path (ex. "/api/v1/echo/:name")
     * @returns {boolean} whether the path should be ignored
     */
    ignoresPath(path) {
        this.log("[scout] checking path [${path}] against ignored paths", types_1.LogLevel.Trace);
        // If ignore isn't specified or if empty, then nothing is ignored
        if (!this.config.ignore || this.config.ignore.length === 0) {
            return false;
        }
        const matchingPrefix = this.config.ignore.find(prefix => path.indexOf(prefix) === 0);
        if (matchingPrefix) {
            this.log("[scout] ignoring path [${path}] matching prefix [${matchingPrefix}]", types_1.LogLevel.Debug);
            this.emit(types_1.ScoutEvent.IgnoredPathDetected, path);
        }
        return matchingPrefix !== undefined;
    }
    /**
     * Filter a given request path (ex. /path/to/resource) according to logic before storing with Scout
     *
     * @param {string} path
     * @returns {URL} the filtered URL object
     */
    filterRequestPath(path) {
        switch (this.config.uriReporting) {
            case types_1.URIReportingLevel.FilteredParams:
                return types_1.scrubRequestPathParams(path);
            case types_1.URIReportingLevel.Path:
                return types_1.scrubRequestPath(path);
            default:
                return path;
        }
    }
    /**
     * Start a transaction
     *
     * @param {string} name
     * @returns void
     */
    transaction(name, cb) {
        this.log(`[scout] Starting transaction [${name}]`, types_1.LogLevel.Debug);
        let result;
        let ranContext = false;
        // Setup if necessary then then perform the async request context
        return this.setup()
            .then(() => {
            result = this.withAsyncRequestContext(cb);
            ranContext = true;
        })
            .catch(err => {
            this.log("[scout] Scout setup failed: ${err}", types_1.LogLevel.Error);
            if (!ranContext) {
                result = this.withAsyncRequestContext(cb);
            }
        });
    }
    /**
     * Start an instrumentation, withing a given transaction
     *
     * @param {string} operation
     * @param {Function} cb
     * @returns {Promise<any>} a promsie that resolves to the result of the callback
     */
    instrument(operation, cb) {
        this.log(`[scout] Instrumenting operation [${operation}]`, types_1.LogLevel.Debug);
        const parent = this.getCurrentSpan() || this.getCurrentRequest();
        // If no request is currently underway
        if (!parent) {
            this.log("[scout] Failed to start instrumentation, no current transaction/parent instrumentation", types_1.LogLevel.Error);
            return Promise.resolve(cb(DONE_NOTHING));
        }
        let result;
        let ranCb = false;
        this.log(`[scout] Starting child span for operation [${operation}], parent id [${parent.id}]`, types_1.LogLevel.Debug);
        let span;
        const doneFn = () => {
            this.log(`[scout] Stopping span with ID [${span.id}]`, types_1.LogLevel.Debug);
            this.asyncNamespace.set(ASYNC_NS_SPAN, undefined);
            return span.stop();
        };
        return parent
            // Start the child span
            .startChildSpan(operation)
            // Set up the async namespace, run the function
            .then(s => span = s)
            .then(() => {
            this.asyncNamespace.set(ASYNC_NS_SPAN, span);
            result = cb(doneFn);
            ranCb = true;
            return span;
        })
            // Return the result
            .then(() => result)
            .catch(err => {
            // It's possible that an error happened *before* the span could be set
            if (!ranCb) {
                result = span ? cb(doneFn) : cb(() => undefined);
            }
            this.log("[scout] failed to send start span", types_1.LogLevel.Error);
            return result;
        });
    }
    /**
     * Reterieve the current request using the async hook/continuation local storage machinery
     *
     * @returns {ScoutRequest} the current active request
     */
    getCurrentRequest() {
        return this.asyncNamespace.get(ASYNC_NS_REQUEST);
    }
    /**
     * Reterieve the current span using the async hook/continuation local storage machinery
     *
     * @returns {ScoutSpan} the current active span
     */
    getCurrentSpan() {
        return this.asyncNamespace.get(ASYNC_NS_SPAN);
    }
    /**
     * Create an async namespace internally for use with tracking if not already present
     */
    createAsyncNamespace() {
        const implementation = this.canUseAsyncHooks ? nrc : cls;
        this.asyncNamespace = implementation.getNamespace(ASYNC_NS);
        // Create if it doesn't exist
        if (!this.asyncNamespace) {
            this.asyncNamespace = implementation.createNamespace(ASYNC_NS);
        }
    }
    /**
     * Perform some action within a context
     *
     */
    withAsyncRequestContext(cb) {
        // If we can use async hooks then node-request-context is usable
        return new Promise((resolve) => {
            let result;
            let req;
            let ranCb = false;
            const doneFn = () => {
                this.log(`[scout] Finishing and sending request with ID [${req.id}]`, types_1.LogLevel.Debug);
                return req
                    .finishAndSend()
                    .then(() => this.asyncNamespace.set(ASYNC_NS_REQUEST, undefined));
            };
            // Run in the async namespace
            this.asyncNamespace.run(() => {
                this.log(`[scout] Starting request in async namespace...`, types_1.LogLevel.Debug);
                // Star the request
                this.startRequest()
                    .then(r => req = r)
                    // Update async namespace, run function
                    .then(() => {
                    this.log(`[scout] Request started w/ ID [${req.id}]`, types_1.LogLevel.Debug);
                    this.asyncNamespace.set(ASYNC_NS_REQUEST, req);
                    result = cb(doneFn);
                    ranCb = true;
                    return result;
                })
                    // If an error occurs then run the fn and log
                    .catch(err => {
                    // In the case that an error occurs before the request gets made we can't run doneFn
                    if (!ranCb) {
                        result = req ? cb(doneFn) : cb(() => undefined);
                    }
                    resolve(result);
                    this.log(`[scout] failed to send start request request: ${err}`, types_1.LogLevel.Error);
                });
            });
        });
    }
    /**
     * Helper function for starting a scout request with the instance
     *
     * @param {ScoutRequestOptions} [options]
     * @returns {Promise<ScoutRequest>} a new scout request
     */
    startRequest(opts) {
        const request = new request_2.default(Object.assign({}, { scoutInstance: this }, opts || {}));
        return request.start();
    }
    getSocketPath() {
        return `unix://${this.socketPath}`;
    }
    buildAppMetadataEvent() {
        return new Requests.V1ApplicationEvent(`Pid: ${process.pid}`, "scout.metadata", this.applicationMetadata.serialize(), { timestamp: new Date() });
    }
    // Helper for sending app metadata
    sendAppMetadataEvent() {
        return sendThroughAgent(this, this.buildAppMetadataEvent(), { async: true })
            .then(() => undefined)
            .catch(err => {
            this.log("[scout] failed to send start request request", types_1.LogLevel.Error);
        });
    }
    sendRegistrationRequest() {
        return sendThroughAgent(this, new Requests.V1Register(this.config.name || "", this.config.key || "", types_1.APIVersion.V1))
            .then(() => undefined)
            .catch(err => {
            this.log("[scout] failed to send app registration request", types_1.LogLevel.Error);
        });
    }
    // Helper function for setting up an agent to be part of the scout instance
    setupAgent(agent) {
        this.agent = agent;
        // Setup forwarding of all events of the agent through the scout instance
        Object.values(types_1.AgentEvent).forEach(evt => {
            this.agent.on(evt, msg => this.emit(evt, msg));
        });
        return Promise.resolve();
    }
}
exports.Scout = Scout;
// The functions below are exports for module-level use. They need to be made externally available for
// code in this module but *not* as part of the public API for a Scout instance.
/**
 * Send the StartRequest message to the agent
 *
 * @param {Scout} scout - A scout instance
 * @param {ScoutRequest} req - The original request
 * @returns {Promise<ScoutRequest>} the passed in request
 */
function sendStartRequest(scout, req) {
    const startReq = new Requests.V1StartRequest({
        requestId: req.id,
        timestamp: req.getTimestamp(),
    });
    return sendThroughAgent(scout, startReq)
        .then(() => req)
        .catch(err => {
        scout.log(`[scout] failed to send start request request: ${err}`, types_1.LogLevel.Error);
        return req;
    });
}
exports.sendStartRequest = sendStartRequest;
/**
 * Send the StopRequest message to the agent
 *
 * @param {Scout} scout - A scout instance
 * @param {ScoutRequest} req - The original request
 * @returns {Promise<ScoutRequest>} the passed in request
 */
function sendStopRequest(scout, req) {
    const stopReq = new Requests.V1FinishRequest(req.id);
    return sendThroughAgent(scout, stopReq)
        .then(() => {
        scout.emit(types_1.ScoutEvent.RequestSent, { request: req });
        return req;
    })
        .catch(err => {
        scout.log("[scout] failed to send stop request request", types_1.LogLevel.Error);
        return req;
    });
}
exports.sendStopRequest = sendStopRequest;
/**
 * Send the TagRequest message to the agent for a single tag
 *
 * @param {Scout} scout - A scout instance
 * @param {ScoutRequest} req - The original request
 * @param {String} name - The tag name
 * @param {String} value - The tag value
 * @returns {Promise<void>} A promise which resolves when the message has been sent
 */
function sendTagRequest(scout, req, name, value) {
    const tagReq = new Requests.V1TagRequest(name, value, req.id);
    return sendThroughAgent(scout, tagReq)
        .then(() => undefined)
        .catch(err => {
        scout.log("[scout] failed to send tag request", types_1.LogLevel.Error);
    });
}
exports.sendTagRequest = sendTagRequest;
/**
 * Send the StartSpan message to the agent
 *
 * @param {Scout} scout - A scout instance
 * @param {ScoutSpan} span - The original span
 * @returns {Promise<ScoutSpan>} the passed in span
 */
function sendStartSpan(scout, span) {
    const opts = {
        spanId: span.id,
        parentId: span.parent ? span.parent.id : undefined,
        timestamp: span.getTimestamp(),
    };
    const startSpanReq = new Requests.V1StartSpan(span.operation, span.request.id, opts);
    return sendThroughAgent(scout, startSpanReq)
        .then(() => span)
        .catch(err => {
        scout.log("[scout] failed to send start span request", types_1.LogLevel.Error);
        return span;
    });
}
exports.sendStartSpan = sendStartSpan;
/**
 * Send the TagSpan message to the agent message to the agent
 *
 * @param {Scout} scout - A scout instance
 * @param {ScoutSpan} span - The original span
 * @param {String} name - The tag name
 * @param {String} value - The tag value
 * @returns {Promise<void>} A promise which resolves when the message has been
 */
function sendTagSpan(scout, span, name, value) {
    const tagSpanReq = new Requests.V1TagSpan(name, value, span.id, span.request.id);
    return sendThroughAgent(scout, tagSpanReq)
        .then(() => undefined)
        .catch(err => {
        scout.log("[scout] failed to send tag span request", types_1.LogLevel.Error);
        return undefined;
    });
}
exports.sendTagSpan = sendTagSpan;
/**
 * Send the StopSpan message to the agent
 *
 * @param {Scout} scout - A scout instance
 * @param {ScoutSpan} span - The original span
 * @returns {Promise<ScoutSpan>} the passed in request
 */
function sendStopSpan(scout, span) {
    const stopSpanReq = new Requests.V1StopSpan(span.id, span.request.id);
    return sendThroughAgent(scout, stopSpanReq)
        .then(() => span)
        .catch(err => {
        scout.log("[scout] failed to send stop span request", types_1.LogLevel.Error);
        return span;
    });
}
exports.sendStopSpan = sendStopSpan;
/**
 * Helper function for sending a given request through the agent
 *
 * @param {Scout} scout - A scout instance
 * @param {T extends BaseAgentRequest} msg - The message to send
 * @returns {Promise<T extends BaseAgentResponse>} resp - The message to send
 */
function sendThroughAgent(scout, msg, opts) {
    if (!scout.hasAgent()) {
        const err = new Errors.Disconnected("No agent is present, please run .setup()");
        scout.log(err.message, types_1.LogLevel.Error);
        return Promise.reject(err);
    }
    const agent = scout.getAgent();
    const config = scout.getConfig();
    if (!config.monitor) {
        scout.log("[scout] monitoring disabled, not sending tag request", types_1.LogLevel.Warn);
        return Promise.reject(new Errors.MonitoringDisabled());
    }
    if (opts && opts.async) {
        return agent.sendAsync(msg);
    }
    return agent.send(msg);
}
exports.sendThroughAgent = sendThroughAgent;