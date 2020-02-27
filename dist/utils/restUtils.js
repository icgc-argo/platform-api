"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const apollo_server_express_1 = require("apollo-server-express");
const logger_1 = __importDefault(require("./logger"));
/*
convert the REST status codes to GQL errors, or return the response if passing
*/
exports.restErrorResponseHandler = (response) => __awaiter(void 0, void 0, void 0, function* () {
    // Generic handle 5xx errors
    if (response.status >= 500 && response.status <= 599) {
        const responseBody = yield response.text();
        logger_1.default.debug(`Server 5xx response: ${responseBody}`);
        throw new apollo_server_express_1.ApolloError(); // will return Apollo code INTERNAL_SERVER_ERROR
    }
    switch (response.status) {
        case 200:
        case 201:
            return response;
        case 401:
        case 403:
            throw new apollo_server_express_1.AuthenticationError(response.status);
        case 400:
        case 404:
            let notFoundData;
            try {
                // This was built for the response structure from Clincial Service which returns a message value in the 404 response.
                notFoundData = yield response.json();
            }
            catch (_a) {
                notFoundData = { message: '' };
            }
            // throw error with message and properties in response (if any)
            throw new apollo_server_express_1.UserInputError(notFoundData.message, notFoundData);
        default:
            return response;
    }
});
//# sourceMappingURL=restUtils.js.map