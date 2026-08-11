import { AsyncLocalStorage } from "node:async_hooks";

const requestContextStorage = new AsyncLocalStorage();

export const getRequestContext = () => requestContextStorage.getStore() ?? {};

export const runWithRequestContext = (context, callback) =>
    requestContextStorage.run(context, callback);

export const updateRequestContext = (values) => {
    const context = requestContextStorage.getStore();

    if (context) {
        Object.assign(context, values);
    }
};

export default requestContextStorage;
