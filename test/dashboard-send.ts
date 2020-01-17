import * as test from "tape";

import {
    LogLevel,
    AgentLaunchDisabled,
    ApplicationMetadata,
    ExternalDownloadDisallowed,
    Scout,
    ScoutRequest,
    ScoutSpan,
    consoleLogFn,
} from "../lib";

import {
    AgentEvent,
    AgentRequestType,
    BaseAgentRequest,
    ScoutEvent,
    buildScoutConfiguration,
} from "../lib/types";

import { V1FinishRequest } from "../lib/protocol/v1/requests";

import { Client } from "pg";
import { Connection } from "mysql";

import * as TestUtil from "./util";
import * as TestConstants from "./constants";

import { SQL_QUERIES } from "./fixtures";

let PG_CONTAINER_AND_OPTS: TestUtil.ContainerAndOpts | null = null;
let MYSQL_CONTAINER_AND_OPTS: TestUtil.ContainerAndOpts | null = null;

// This "test" is made to send to the dashboard
// it does not shut down scout in order to give it time to actually send data
// https://github.com/scoutapp/scout_apm_node/issues/71
test("Scout sends basic controller span to dashboard", {timeout: TestUtil.DASHBOARD_SEND_TIMEOUT_MS}, t => {
    const config = buildScoutConfiguration({
        allowShutdown: true,
        monitor: true,
        name: TestConstants.TEST_SCOUT_NAME,
    });

    const appMeta = new ApplicationMetadata(config, {frameworkVersion: "test"});

    if (!config.key) {
        throw new Error("No Scout key! Provide one with the SCOUT_KEY ENV variable");
    }

    if (!config.name) {
        throw new Error("No Scout name! Provide one with the SCOUT_NAME ENV variable");
    }

    const scout = new Scout(config, {appMeta});

    // Set up a listener to wait for scout to report the transaction
    const listener = (message: BaseAgentRequest) => {
        // Ignore requests that are sent that aren't span starts
        if (!message || message.type !== AgentRequestType.V1FinishRequest) { return; }
        t.pass("Witnessed V1FinishRequest being sent");

        scout.removeListener(ScoutEvent.RequestSent, listener);

        // Wait ~2 minutes for request to be sent to scout in the cloud then shutdown
        TestUtil.waitMinutes(2)
            .then(() => TestUtil.shutdownScout(t, scout));
    };

    // Set up listener on the agent to listen for the stop request to be sent
    scout.on(AgentEvent.RequestSent, listener);

    const name = `Controller/GET /`;

    scout.transaction(name, (transactionDone) => {
        return scout.instrument(name, () => {
            TestUtil.waitMs(200)
                .then(() => t.pass("wait completed"))
                .then(() => transactionDone())
                .catch(err => t.fail("some error occurred"));
        });
    })
        .catch(err => TestUtil.shutdownScout(t, scout, err));
});

//////////////////////////////
// Postgres dashboard sends //
//////////////////////////////

// Pseudo test that will start a containerized postgres instance
TestUtil.startContainerizedPostgresTest(test, cao => {
    PG_CONTAINER_AND_OPTS = cao;
});

// For the postgres integration
// https://github.com/scoutapp/scout_apm_node/issues/83
test("transaction with with postgres DB query to dashboard", {timeout: TestUtil.DASHBOARD_SEND_TIMEOUT_MS}, t => {
    const config = buildScoutConfiguration({
        allowShutdown: true,
        monitor: true,
        name: TestConstants.TEST_SCOUT_NAME,
    });

    const appMeta = new ApplicationMetadata(config, {frameworkVersion: "test"});

    if (!config.key) {
        throw new Error("No Scout key! Provide one with the SCOUT_KEY ENV variable");
    }

    if (!config.name) {
        throw new Error("No Scout name! Provide one with the SCOUT_NAME ENV variable");
    }

    const scout = new Scout(config, {appMeta});
    let client: Client;

    // Set up a listener to wait for scout to report the transaction
    const listener = (message: BaseAgentRequest) => {
        // Ignore requests that are sent that aren't span starts
        if (!message || message.type !== AgentRequestType.V1FinishRequest) { return; }
        t.pass("Witnessed V1FinishRequest being sent");

        scout.removeListener(ScoutEvent.RequestSent, listener);

        // Wait ~2 minutes for request to be sent to scout in the cloud then shutdown
        TestUtil.waitMinutes(2)
            .then(() => client.end())
            .then(() => TestUtil.shutdownScout(t, scout));
    };

    // Set up listener on the agent to listen for the stop request to be sent
    scout.on(AgentEvent.RequestSent, listener);

    const name = `Controller/GET /`;

    scout.transaction(name, (transactionDone) => {
        return scout.instrument(name, (spanDone) => {
            TestUtil
            // Connect a PG client
                .makeConnectedPGClient(() => PG_CONTAINER_AND_OPTS)
                .then(c => client = c)
            // Do a query
                .then(() => {
                    return client
                        .query(SQL_QUERIES.SELECT_TIME)
                        .then(() => t.comment("performed query"));
                })
            // Finish the span
                .then(() => spanDone())
                .then(() => t.pass("span finished"))
            // Finish the transaction
                .then(() => transactionDone())
                .then(() => t.pass("db transaction finished"))
            // If an error happens then shutdown the DB client and end test
                .catch(err => {
                    t.fail("some error occurred");

                    (client ? client.end() : Promise.resolve())
                        .then(() => TestUtil.shutdownScout(t, scout, err));
                });
        });
    })
        .catch(err => {
            (client ? client.end() : Promise.resolve())
                .then(() => TestUtil.shutdownScout(t, scout, err));
        });
});

// Pseudo test that will stop a containerized postgres instance that was started
TestUtil.stopContainerizedPostgresTest(test, () => PG_CONTAINER_AND_OPTS);

///////////////////////////
// MySQL dashboard sends //
///////////////////////////

// Pseudo test that will start a containerized mysql instance
TestUtil.startContainerizedMySQLTest(test, cao => {
    MYSQL_CONTAINER_AND_OPTS = cao;
});

test("transaction with mysql query to dashboard", {timeout: TestUtil.DASHBOARD_SEND_TIMEOUT_MS}, t => {
    // Build scout config & app meta for test
    const config = buildScoutConfiguration({
        allowShutdown: true,
        monitor: true,
        name: TestConstants.TEST_SCOUT_NAME,
    });
    if (!config.key) { throw new Error("No Scout key! Provide one with the SCOUT_KEY ENV variable"); }
    if (!config.name) { throw new Error("No Scout name! Provide one with the SCOUT_NAME ENV variable"); }

    const appMeta = new ApplicationMetadata(config, {frameworkVersion: "test"});

    // Build scout instance, get ready to hold an active mysql connection
    const scout = new Scout(config, {appMeta});
    let conn: Connection;

    // Set up a listener to wait for scout to report the transaction
    const listener = (message: BaseAgentRequest) => {
        // Ignore requests that are sent that aren't span starts
        if (!message || message.type !== AgentRequestType.V1FinishRequest) { return; }
        t.pass("witnessed V1FinishRequest being sent");

        scout.removeListener(ScoutEvent.RequestSent, listener);

        // Fire off disconnect
        conn.end(() => {
            // Wait ~2 minutes for scout to clear requests
            TestUtil.waitMinutes(2)
                .then(() => TestUtil.shutdownScout(t, scout));
        });
    };

    // Set up listener on the agent to listen for the stop request to be sent
    scout.on(AgentEvent.RequestSent, listener);

    const name = `Controller/GET /`;

    scout
        .setup()
    // Run the transaction
        .then(() => scout.transaction(name, (transactionDone) => {
            return scout.instrument(name, (spanDone) => {
                return TestUtil.makeConnectedMySQLConnection(() => MYSQL_CONTAINER_AND_OPTS)
                    .then(c => conn = c)
                    .then(() => new Promise((resolve, reject) => {
                        // mysql's query function needs to be wrapped in a promise
                        conn.query(SQL_QUERIES.SELECT_TIME, (err, result) => {
                            if (err) {
                                reject(err);
                                return;
                            }

                            t.pass("query performed");
                            // End the span and the request
                            spanDone();
                            transactionDone();
                            resolve(result);
                        });
                    }));
            });
        }))
    // If an error occurs shutdown scout and end connection
        .catch(err => {
            if (conn) {
                conn.end(() => {
                    TestUtil.shutdownScout(t, scout, err);
                });
            }

            TestUtil.shutdownScout(t, scout, err);
        });
});

// Pseudo test that will stop a containerized mysql instance that was started
TestUtil.stopContainerizedMySQLTest(test, () => MYSQL_CONTAINER_AND_OPTS);
