"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.config = exports.usage = exports.depend = void 0;
exports.apply = apply;
const yumeri_1 = require("yumeri");
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const logger = new yumeri_1.Logger("oauth");
exports.depend = ['console', 'database']; // 需要的服务
exports.usage = `Oauth服务端，对接上游OIDC服务端。<br>重定向链接请写\\<域名\\>/oauth/callback`;
const utils_1 = require("./utils");
exports.config = {
    schema: {
        authend: {
            type: 'string',
            default: 'https://example.com/auth/authorize',
            description: '认证端点'
        },
        tokenend: {
            type: 'string',
            default: 'https://example.com/auth/token',
            description: '令牌端点'
        },
        userend: {
            type: 'string',
            default: 'https://example.com/auth/user',
            description: '用户信息端点',
        },
        clientid: {
            type: 'string',
            default: 'clientid',
            description: '客户端ID'
        },
        clientsecret: {
            type: 'string',
            default: 'clientsecret',
            description: '客户端密钥'
        },
        emailinfo: {
            type: 'string',
            default: 'email',
            description: '用户邮箱字段'
        },
        useridinfo: {
            type: 'string',
            default: 'id',
            description: '用户名字段'
        },
        phoneinfo: {
            type: 'string',
            default: 'phone',
            description: '手机号字段'
        },
        avatarinfo: {
            type: 'string',
            default: 'avatar',
            description: '用户头像字段'
        },
        nicknameinfo: {
            type: 'string',
            default: 'nickname',
            description: '用户昵称字段'
        },
        redirecturi: {
            type: 'string',
            default: 'http://localhost:14510/oauth/callback',
            description: '重定向URI'
        }
    }
};
async function apply(ctx, config) {
    const console = ctx.getComponent('console');
    const database = ctx.getComponent('database');
    if (!await database.tableExists('oauth_apps')) {
        database.createTable('oauth_apps', {
            id: { type: 'INT', primaryKey: true },
            name: { type: 'VARCHAR', length: 255 },
            clientid: { type: 'VARCHAR', length: 255 },
            clientsecret: { type: 'VARCHAR', length: 255 },
            redirecturi: { type: 'VARCHAR', length: 255 },
            scope: { type: 'VARCHAR', length: 255 },
            developerid: { type: 'VARCHAR', length: 255 },
        });
    }
    if (!await database.tableExists('oauth_authentication_token')) {
        database.createTable('oauth_authentication_token', {
            id: { type: 'INT', primaryKey: true },
            userid: { type: 'VARCHAR', length: 255 },
            appid: { type: 'VARCHAR', length: 255 },
            token: { type: 'VARCHAR', length: 255 },
            scope: { type: 'VARCHAR', length: 255 },
            createAt: { type: 'DATETIME', default: 'CURRENT_TIMESTAMP_FUNC' },
        });
    }
    if (!await database.tableExists('oauth_refresh_token')) {
        database.createTable('oauth_refresh_token', {
            id: { type: 'INT', primaryKey: true },
            userid: { type: 'VARCHAR', length: 255 },
            appid: { type: 'VARCHAR', length: 255 },
            token: { type: 'VARCHAR', length: 255 },
            scope: { type: 'VARCHAR', length: 255 },
            createAt: { type: 'DATETIME', default: 'CURRENT_TIMESTAMP_FUNC' },
        });
    }
    if (!await database.tableExists('oauth_authorization_code')) {
        database.createTable('oauth_authorization_code', {
            id: { type: 'INT', primaryKey: true },
            userid: { type: 'VARCHAR', length: 255 },
            username: { type: 'VARCHAR', length: 255 },
            appid: { type: 'VARCHAR', length: 255 },
            code: { type: 'VARCHAR', length: 255 },
            scope: { type: 'VARCHAR', length: 255 },
            createAt: { type: 'DATETIME', default: 'CURRENT_TIMESTAMP_FUNC' },
        });
    }
    if (!await database.tableExists('oauth_oidc_tokens')) {
        database.createTable('oauth_oidc_tokens', {
            id: { type: 'INT', primaryKey: true },
            userid: { type: 'VARCHAR', length: 255 },
            authenticathiontoken: { type: 'VARCHAR', length: 255 },
            refreshtoken: { type: 'VARCHAR', length: 255 },
            createAt: { type: 'DATETIME', default: 'CURRENT_TIMESTAMP_FUNC' },
        });
    }
    /******
     * test
     */
    // database.insert('oauth_apps', {
    //   id: 1,
    //   name: 'test',
    //   clientid: 'test',
    //   clientsecret: 'test',
    //   redirecturi: 'http://localhost:14510/oauth/callback',
    //   scope: 'test',
    //   developerid: 'test'
    // })
    // 注册oauth命令
    ctx.command('oauth')
        .action(async (session, param) => {
        if (console.getloginstatus(session)) {
            if (param.path.startsWith('/adminapi/')) {
                if (param.path === '/adminapi/getapps') {
                    session.setMime('json');
                    session.body = (await database.find('oauth_apps')).toString;
                }
                if (param.path === '/adminapi/editapp') {
                    session.setMime('json');
                    if (param.id) {
                        await database.update('oauth_apps', param.data, { id: param.id });
                        session.body = { code: 200, message: '修改成功' }.toString();
                    }
                }
            }
        }
        if (param.path.startsWith('/api/')) {
            if (param.path === '/api/username') {
                if (!param.code)
                    return;
                const result = await database.findOne('oauth_authentication_code', { code: param.code });
                const name = result.username;
                if (!name)
                    return;
                session.body = name;
            }
            if (param.path === '/api/appname') {
                if (!param.appid)
                    return;
                const app = await database.findOne('oauth_apps', { id: param.appid });
                const result = await database.findOne('oauth_authorization_code', { code: param.code });
                if (app.clientid !== result.appid)
                    return;
                session.body = app.name;
            }
        }
        if (param.path === '/confirm') {
            session.setMime('html');
            session.body = fs_1.default.readFileSync(path_1.default.join(__dirname, '../static/confirm.html'));
        }
        else if (param.path === '/callback') {
            session.setMime('html');
            if (!param.state)
                return;
            const appid = param.state.split('_')[0];
            const truescope = param.state.split('_')[1].split('-').join(' ');
            const truestate = param.state.split('_')[2];
            const appinfo = await database.findOne('oauth_apps', { id: appid });
            if (!appinfo)
                return;
            const { access_token, refresh_token } = await (0, utils_1.getAccess)(config.get('tokenend'), param.code, appinfo.clientid, appinfo.clientsecret);
            const userinfo = await (0, utils_1.getUserInfo)(config.get('userend'), access_token);
            const userid = userinfo[config.get('useridinfo')];
            const username = userinfo[config.get('usernameinfo')];
            await database.insert('oauth_oidc_tokens', {
                userid: userid,
                authenticathiontoken: access_token,
                refreshtoken: refresh_token
            });
            const code = (0, utils_1.generateCode)(16); // 生成给下游的Authentication Code
            await database.insert('oauth_authorization_code', {
                userid,
                username,
                appid,
                code,
                scope: truescope
            });
            session.body = `<script>window.location.href = "/oauth/confirm?state=${truestate}&appid=${appid}&code=${code}&scope=${truescope}"`;
        }
        else if (param.path === '/authorize') {
            session.setMime('html');
            const result = await database.findOne('oauth_apps', { id: param.clientid });
            if (!result)
                return;
            session.body = `<script>
        window.location.href = "${config.get('authend')}?response_type=code&client_id=${encodeURIComponent(config.get('clientid'))}&redirect_uri=${encodeURIComponent(config.get('redirecturi'))}&scope=${encodeURIComponent(config.get('scope'))}&state=${encodeURIComponent(param.clientid + '_' + param.scope.split(' ').join('-') + '_' + param.state)}";
        </script>`;
        }
    });
    console.addconsoleitem('user', 'fa-user', 'Oauth用户管理', path_1.default.join(__dirname, '../static/user/index.html'), path_1.default.join(__dirname, '../static/user/'));
    console.addconsoleitem('app', 'fa-app', 'Oauth应用管理', path_1.default.join(__dirname, '../static/app/index.html'), path_1.default.join(__dirname, '../static/app/'));
}
