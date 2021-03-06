"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const integrations_1 = require("../types/integrations");
const types_1 = require("../types");
// Hook into the express and mongodb module
class PugIntegration extends integrations_1.RequireIntegration {
    constructor() {
        super(...arguments);
        this.packageName = "pug";
    }
    shim(pugExport) {
        pugExport = this.shimPugRender(pugExport);
        pugExport = this.shimPugRenderFile(pugExport);
        return pugExport;
    }
    /**
     * Shim for pug's `render` function
     *
     * @param {any} pugExport - pug's export
     */
    shimPugRender(pugExport) {
        const originalFn = pugExport.render;
        const integration = this;
        const render = (src, options, callback) => {
            const originalArgs = arguments;
            integration.logFn("[scout/integrations/pug] rendering...", types_1.LogLevel.Debug);
            // If no scout instance is available then run the function normally
            if (!integration.scout) {
                return originalFn(src, options, callback);
            }
            return integration.scout.instrumentSync(types_1.ScoutSpanOperation.TemplateRender, ({ span }) => {
                if (!span) {
                    return originalFn.apply(null, originalArgs);
                }
                span.addContextSync(types_1.ScoutContextName.Name, "<string>");
                return originalFn(src, options, callback);
            });
        };
        pugExport.render = render;
        return pugExport;
    }
    /**
     * Shim for pug's `renderFile` function
     *
     * @param {any} pugExport - pug's export
     */
    shimPugRenderFile(pugExport) {
        const originalFn = pugExport.renderFile;
        const integration = this;
        const renderFile = function (path, options, callback) {
            // Pug does something weird -- if the callback is specified, it recursively calls renderFile
            // to avoid that, we need to do a similar check to know when to actually do the instrumentation versus not
            // we only want to do the instrumentation on the actual run (when callback is not defined)
            if (callback) {
                return originalFn(path, options, callback);
            }
            integration.logFn(`[scout/integrations/pug] rendering file [${path}]...`, types_1.LogLevel.Debug);
            // If no scout instance is available then run the function normally
            if (!integration.scout) {
                integration.logFn("[scout/integrations/pug] Failed to find integration's scout instance", types_1.LogLevel.Warn);
                return originalFn(path, options, callback);
            }
            return integration.scout.instrumentSync(types_1.ScoutSpanOperation.TemplateRender, ({ span }) => {
                if (!span) {
                    return originalFn(path, options, callback);
                }
                span.addContextSync(types_1.ScoutContextName.Name, path);
                return originalFn(path, options, callback);
            });
        };
        pugExport.renderFile = renderFile;
        pugExport.__express = pugExport.renderFile;
        return pugExport;
    }
}
exports.PugIntegration = PugIntegration;
exports.default = new PugIntegration();
