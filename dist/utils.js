"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateCode = generateCode;
exports.getUserInfo = getUserInfo;
exports.getAccess = getAccess;
exports.refreshAccessToken = refreshAccessToken;
const crypto_1 = __importDefault(require("crypto"));
const axios_1 = __importDefault(require("axios"));
const qs_1 = __importDefault(require("qs"));
function generateCode(length = 32) {
    return crypto_1.default.randomBytes(length).toString('hex');
}
async function getUserInfo(userinfoEndpoint, accessToken) {
    try {
        const response = await axios_1.default.get(userinfoEndpoint, {
            headers: {
                Authorization: `Bearer ${accessToken}`
            }
        });
        return response.data;
    }
    catch (error) {
        return false;
    }
}
async function getAccess(tokenEndpoint, clientId, clientSecret, scope = '') {
    try {
        const response = await axios_1.default.post(tokenEndpoint, qs_1.default.stringify({
            grant_type: 'client_credentials',
            client_id: clientId,
            client_secret: clientSecret,
            scope: scope
        }), {
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        });
        return response.data;
    }
    catch (error) {
        // throw error;
        return false;
    }
}
async function refreshAccessToken(tokenEndpoint, clientId, clientSecret, refreshToken) {
    try {
        const response = await axios_1.default.post(tokenEndpoint, qs_1.default.stringify({
            grant_type: 'refresh_token',
            client_id: clientId,
            client_secret: clientSecret,
            refresh_token: refreshToken
        }), {
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        });
        return response.data;
    }
    catch (error) {
        return false;
    }
}
