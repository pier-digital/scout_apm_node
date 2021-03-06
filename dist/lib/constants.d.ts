export declare const DEFAULT_CORE_AGENT_VERSION = "v1.2.8";
export declare const DOMAIN_SOCKET_URI_SCHEME_RGX: RegExp;
export declare const TMP_DIR_PREFIX = "core-agent-dl-";
export declare const CORE_AGENT_BIN_FILE_NAME = "core-agent";
export declare const CORE_AGENT_MANIFEST_FILE_NAME = "manifest.json";
export declare const DEFAULT_BIN_STARTUP_WAIT_MS = 1000;
export declare const DEFAULT_CORE_AGENT_DOWNLOAD_CACHE_DIR = "/tmp/scout_apm_core";
export declare const DEFAULT_REQUEST_PREFIX = "req-";
export declare const DEFAULT_SPAN_PREFIX = "span-";
export declare const DEFAULT_CONNECTION_POOL_OPTS: {
    max: number;
    min: number;
    testOnBorrow: boolean;
};
export declare const SECOND_MS = 1000;
export declare const MINUTE_MS: number;
export declare const AGENT_BUFFER_TIME_MS: number;
export declare const DEFAULT_EXPRESS_REQUEST_TIMEOUT_MS: number;
export declare const DEFAULT_SOCKET_FILE_NAME = "core-agent.sock";
export declare const DEFAULT_CORE_AGENT_NAME = "scout_apm_core";
export declare const SCOUT_PATH_TAG = "path";
export declare const DEFAULT_PARAM_FILTER_LOOKUP: {
    "access": boolean;
    "access_token": boolean;
    "api_key": boolean;
    "apikey": boolean;
    "auth": boolean;
    "auth_token": boolean;
    "card[number]": boolean;
    "certificate": boolean;
    "credentials": boolean;
    "crypt": boolean;
    "key": boolean;
    "mysql_pwd": boolean;
    "otp": boolean;
    "passwd": boolean;
    "password": boolean;
    "private": boolean;
    "protected": boolean;
    "salt": boolean;
    "secret": boolean;
    "ssn": boolean;
    "stripetoken": boolean;
    "token": boolean;
};
export declare const DEFAULT_PARAM_SCRUB_REPLACEMENT = "[FILTERED]";
export declare const DEFAULT_SLOW_REQUEST_THRESHOLD_MS: number;
export declare const DEFAULT_SOCKET_TIMEOUT_MS: number;
export declare const DEFAULT_AGENT_SEND_TIMEOUT_MS = 10000;
