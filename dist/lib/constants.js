"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DOMAIN_SOCKET_URI_SCHEME_RGX = /^(unix|file):\/\//;
exports.TMP_DIR_PREFIX = "core-agent-dl-";
exports.CORE_AGENT_BIN_FILE_NAME = "core-agent";
exports.CORE_AGENT_MANIFEST_FILE_NAME = "manifest.json";
exports.DEFAULT_BIN_STARTUP_WAIT_MS = 1000;
exports.DEFAULT_CORE_AGENT_DOWNLOAD_CACHE_DIR = "/tmp/core-agent/downloads";
exports.DEFAULT_REQUEST_PREFIX = "req-";
exports.DEFAULT_SPAN_PREFIX = "span-";
exports.DEFAULT_CONNECTION_POOL_OPTS = {
    max: 500,
    min: 0,
    testOnBorrow: true,
};
exports.MINUTE_MS = 60000;
exports.AGENT_BUFFER_TIME_MS = 2 * exports.MINUTE_MS;
exports.DEFAULT_EXPRESS_REQUEST_TIMEOUT_MS = 5 * exports.MINUTE_MS;
exports.DEFAULT_SOCKET_FILE_NAME = "scout-agent.sock";
exports.DEFAULT_CORE_AGENT_NAME = "scout_apm_core";
exports.SCOUT_PATH_TAG = "path";
// Common parameters to filter, copied from scout_apm_python
exports.DEFAULT_PARAM_FILTER_LOOKUP = {
    "access": true,
    "access_token": true,
    "api_key": true,
    "apikey": true,
    "auth": true,
    "auth_token": true,
    "card[number]": true,
    "certificate": true,
    "credentials": true,
    "crypt": true,
    "key": true,
    "mysql_pwd": true,
    "otp": true,
    "passwd": true,
    "password": true,
    "private": true,
    "protected": true,
    "salt": true,
    "secret": true,
    "ssn": true,
    "stripetoken": true,
    "token": true,
};
exports.DEFAULT_PARAM_SCRUB_REPLACEMENT = "[FILTERED]";