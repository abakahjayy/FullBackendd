// express-async-errors replaces every route handler with an anonymous wrapper
// ("newFn") and discards the original. Remember it on the wrapper
// (handler.original) so utils/apiDocs.js can show the real handler name and
// read which body/query fields it uses. Must be required before any router.
const Route = require("express/lib/router/route");
const Router = require("express/lib/router");
const methods = require("http").METHODS.map((m) => m.toLowerCase());

const flatFns = (args) => args.flat(Infinity).filter((a) => typeof a === "function");

// After a call pushed one layer per function onto `stack`, tag each one.
const tagNewLayers = (stack, before, fns) => {
    const added = stack.slice(before);
    if (added.length !== fns.length) return;
    added.forEach((layer, i) => {
        const h = layer.handle;
        if (typeof h === "function" && h !== fns[i] && !h.original) {
            Object.defineProperty(h, "original", { value: fns[i] });
        }
    });
};

for (const method of [...methods, "all"]) {
    const register = Route.prototype[method];
    if (typeof register !== "function") continue;
    Route.prototype[method] = function (...args) {
        const before = this.stack.length;
        const out = register.apply(this, args);
        tagNewLayers(this.stack, before, flatFns(args));
        return out;
    };
}

const use = Router.use;
Router.use = function (...args) {
    const before = this.stack.length;
    const out = use.apply(this, args);
    tagNewLayers(this.stack, before, flatFns(args));
    return out;
};
