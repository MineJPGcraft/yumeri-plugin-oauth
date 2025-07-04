import crypto from 'crypto';
import axios from 'axios';
import qs from 'qs';

export function generateCode(length = 32) {
    return crypto.randomBytes(length).toString('hex');
}

export async function getUserInfo(userinfoEndpoint: string, accessToken: string, clientid: string) {
    try {
        const response = await axios.get(`${userinfoEndpoint}?clientId=${clientid}&access_token=${accessToken}`, {
            headers: {
                Authorization: `Bearer ${accessToken}`
            }
        });
        return response.data;
    } catch (error) {
        return false;
    }
}

export async function getAccess(tokenEndpoint: string, code: string, clientId: string, clientSecret: string, scope = ''): Promise<any> {
    try {
        const response = await axios.post(
            tokenEndpoint,
            qs.stringify({
                grant_type: 'authorization_code',
                code,
                client_id: clientId,
                client_secret: clientSecret,
                scope: scope
            }),
            {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                }
            }
        );

        return response.data;
    } catch (error) {
        // throw error;
        return false;
    }
}

export async function refreshAccessToken(tokenEndpoint: string, clientId: string, clientSecret: string, refreshToken: string) {
    try {
        const response = await axios.post(
            tokenEndpoint,
            qs.stringify({
                grant_type: 'refresh_token',
                client_id: clientId,
                client_secret: clientSecret,
                refresh_token: refreshToken
            }),
            {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                }
            }
        );
        return response.data;
    } catch (error) {
        return false;
    }
}