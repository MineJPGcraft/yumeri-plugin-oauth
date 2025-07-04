export declare function generateCode(length?: number): string;
export declare function getUserInfo(userinfoEndpoint: string, accessToken: string): Promise<any>;
export declare function getAccess(tokenEndpoint: string, clientId: string, clientSecret: string, scope?: string): Promise<any>;
export declare function refreshAccessToken(tokenEndpoint: string, clientId: string, clientSecret: string, refreshToken: string): Promise<any>;
