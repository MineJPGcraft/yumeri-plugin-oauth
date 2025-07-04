import { Context, Config, Session, Logger, ConfigSchema } from 'yumeri';
import path from 'path';
import fs from 'fs';
import { Database } from '@yumerijs/types/dist/database'
import crypto from 'crypto';
import axios, { formToJSON } from 'axios';
import qs from 'qs';

const logger = new Logger("oauth");

export const depend = ['console', 'database']; // 需要的服务
export const usage = `Oauth服务端，对接上游OIDC服务端。<br>重定向链接请写\\<域名\\>/oauth/callback`

import { generateCode, getUserInfo, getAccess, refreshAccessToken } from './utils';

interface OperateConsole {
  addconsoleitem: (name: string, icon: string, displayname: string, htmlpath: string, staticpath: string) => void;

  /**
   * 移除一个控制台项。
   * @param name 要移除的控制台项的名称。
   */
  removeconsoleitem: (name: string) => void;

  /**
   * 获取指定会话的登录状态。
   * @param session 会话对象，包含 sessionid。
   * @returns 如果该会话已登录则返回 true，否则返回 false。
   */
  getloginstatus: (session: Session) => boolean;
}

export const config = {
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
  } as Record<string, ConfigSchema>
};
export async function apply(ctx: Context, config: Config) {
  let loginstatus: Record<string, string> = {}
  const console: OperateConsole = ctx.getComponent('console');
  const database: Database = ctx.getComponent('database');
  if (!await database.tableExists('oauth_apps')) {
    database.createTable('oauth_apps', {
      id: { type: 'INTEGER', primaryKey: true, autoIncrement: true },
      name: { type: 'VARCHAR', length: 255 },
      clientid: { type: 'VARCHAR', length: 255, unique: true },
      clientsecret: { type: 'VARCHAR', length: 255 },
      redirecturi: { type: 'VARCHAR', length: 255 },
      scope: { type: 'VARCHAR', length: 255 },
      developerid: { type: 'VARCHAR', length: 255 },
      description: { type: 'VARCHAR', length: 255, default: '' },
      website: { type: 'VARCHAR', length: 255, default: 'https://yumeri.dev' },
      tos: { type: 'VARCHAR', length: 255, default: 'https://yumeri.dev' },
      createAt: { type: 'DATETIME', default: 'CURRENT_TIMESTAMP_FUNC' }
    })
  }
  if (!await database.tableExists('oauth_authentication_token')) {
    database.createTable('oauth_authentication_token', {
      id: { type: 'INTEGER', primaryKey: true, autoIncrement: true },
      userid: { type: 'VARCHAR', length: 255 },
      appid: { type: 'VARCHAR', length: 255 },
      token: { type: 'VARCHAR', length: 255 },
      scope: { type: 'VARCHAR', length: 255 },
      createAt: { type: 'DATETIME', default: 'CURRENT_TIMESTAMP_FUNC' },
    })
  }
  if (!await database.tableExists('oauth_refresh_token')) {
    database.createTable('oauth_refresh_token', {
      id: { type: 'INTEGER', primaryKey: true, autoIncrement: true },
      userid: { type: 'VARCHAR', length: 255 },
      appid: { type: 'VARCHAR', length: 255 },
      token: { type: 'VARCHAR', length: 255 },
      scope: { type: 'VARCHAR', length: 255 },
      createAt: { type: 'DATETIME', default: 'CURRENT_TIMESTAMP_FUNC' },
    })
  }
  if (!await database.tableExists('oauth_authorization_code')) {
    database.createTable('oauth_authorization_code', {
      id: { type: 'INTEGER', primaryKey: true, autoIncrement: true },
      userid: { type: 'VARCHAR', length: 255 },
      username: { type: 'VARCHAR', length: 255 },
      appid: { type: 'VARCHAR', length: 255 },
      code: { type: 'VARCHAR', length: 255 },
      scope: { type: 'VARCHAR', length: 255 },
      createAt: { type: 'DATETIME', default: 'CURRENT_TIMESTAMP_FUNC' },
    })
  }
  if (!await database.tableExists('oauth_oidc_tokens')) {
    database.createTable('oauth_oidc_tokens', {
      id: { type: 'INTEGER', primaryKey: true, autoIncrement: true },
      userid: { type: 'VARCHAR', length: 255 },
      authenticathiontoken: { type: 'VARCHAR', length: 255 },
      refreshtoken: { type: 'VARCHAR', length: 255 },
      createAt: { type: 'DATETIME', default: 'CURRENT_TIMESTAMP_FUNC' },
    })
  }
  // 创建系统自用初始化应用（如果没有）
  const sysapp = await database.findOne('oauth_apps', { clientid: 'yumeri' })
  if (!sysapp) {
    const clientsecret = generateCode(32);
    await database.insert('oauth_apps', {
      name: 'Yumeri.js',
      clientid: 'yumeri',
      clientsecret,
      redirecturi: config.get<string>('redirecturi'),
      scope: 'email profile openid',
      developerid: 'yumeri'
    })
  }
  /******
   * test
   */
  // database.insert('oauth_apps', {
  //   name: '风梨AI',
  //   clientid: 'test',
  //   clientsecret: 'test',
  //   redirecturi: 'https://ai.flweb.cn/oauth/oidc',
  //   scope: 'email profile openid',
  //   developerid: 'test'
  // })

  // 注册oauth命令
  ctx.command('oauth')
    .action(async (session: Session, param?: any) => {
      // logger.info(session)
      if (console.getloginstatus(session)) {
        if (param.path.startsWith('/adminapi/')) {
          if (param.path === '/adminapi/getapps') {
            session.setMime('json');
            session.body = (await database.find('oauth_apps')).toString;
          }
          if (param.path === '/adminapi/editapp') {
            session.setMime('json');
            if (param.id) {
              await database.update('oauth_apps', param.data as Record<string, any>, { id: param.id });
              session.body = { code: 200, message: '修改成功' }.toString();
            }
          }
        }
      }
      if (param.path.startsWith('/api/')) {
        if (param.path === '/api/username') {
          if (!param.code) return;
          const result = await database.findOne('oauth_authorization_code', { code: param.code });
          const name = result.username
          if (!name) return;
          session.body = name;
        }
        if (param.path === '/api/appname') {
          if (!param.appid) return;
          const app = await database.findOne('oauth_apps', { clientid: param.appid })
          const result = await database.findOne('oauth_authorization_code', { code: param.code })
          if (!app.clientid) return;
          if (!result.appid) return;
          if (app.clientid !== result.appid) return;
          session.body = app.name;
        }
      }
      if (param.path === '/confirm') {
        session.setMime('html');
        session.body = fs.readFileSync(path.join(__dirname, '../static/confirm.html'));
      } else if (param.path === '/callback') {

        session.setMime('html');
        if (!param.state) return;
        const appid = param.state.split('_')[0]
        const truescope = param.state.split('_')[1].split('-').join(' ')
        const truestate = param.state.split('_')[2]
        const appinfo = await database.findOne('oauth_apps', { clientid: appid })
        if (!appinfo) return;
        const result = await getAccess(config.get('tokenend'), param.code, config.get<string>('clientid'), config.get<string>('clientsecret'), appinfo.scope)
        const { access_token, refresh_token } = result
        // logger.info(result)
        const userinfo = await getUserInfo(config.get('userend'), access_token, config.get<string>('clientid'))
        // logger.info(userinfo)
        const userid = userinfo[config.get<string>('useridinfo')]
        const username = userinfo[config.get<string>('nicknameinfo')]
        await database.insert('oauth_oidc_tokens', {
          userid: userid,
          authenticathiontoken: access_token,
          refreshtoken: refresh_token
        })
        const code = generateCode(16); // 生成给下游的Authentication Code
        await database.insert('oauth_authorization_code', {
          userid,
          username,
          appid,
          code,
          scope: truescope
        })
        if (appid === 'yumeri') {
          const token = generateCode(32)
          await database.insert('oauth_authentication_token', {
            token,
            appid: 'yumeri',
            userid,
            scope: truescope
          })
          loginstatus[session.sessionid] = token;
          session.body = '<script>window.location.href = "/developer"</script>'
          return
        }
        session.body = `<script>window.location.href = "/oauth/confirm?state=${truestate}&appid=${appid}&code=${code}&scope=${truescope}&redirect_uri=${encodeURIComponent(appinfo.redirecturi)}"</script>`
      } else if (param.path === '/authorize') {
        session.setMime('html');
        const result = await database.findOne('oauth_apps', { clientid: param.client_id })
        if (!result) return;
        session.body = `<script>
        window.location.href = "${config.get<string>('authend')}?response_type=code&client_id=${encodeURIComponent(config.get<string>('clientid'))}&redirect_uri=${encodeURIComponent(config.get<string>('redirecturi'))}&scope=${result.scope}&state=${encodeURIComponent(param.client_id + '_' + param.scope.split(' ').join('-') + '_' + param.state)}";
        </script>`;
      } else if (param.path === '/userinfo') {
        session.setMime('json');
        const header: Record<string, any> = session.properties?.req.headers;
        logger.info(header)
        if (!header.authorization) return;
        const token = header.authorization.split(' ')[1]
        if (header.authorization.split(' ')[0] !== 'Bearer') return;
        const result = await database.findOne('oauth_authentication_token', { token })
        if (!result) return;
        const app = await database.findOne('oauth_apps', { clientid: result.appid })
        if (!app) return;
        const oidc = await database.findOne('oauth_oidc_tokens', { userid: result.userid })
        if (!oidc) return;
        const accesstoken = oidc.authenticathiontoken
        const userinfo = await getUserInfo(config.get('userend'), accesstoken, config.get<string>('clientid'))
        const scope = result.scope.split(' ') as Array<string>
        // logger.info(scope)
        const parseduserinfo = {
          ...(scope.includes('openid') && { name: userinfo[config.get<string>('nicknameinfo')] }),
          ...(scope.includes('openid') && { id: userinfo[config.get<string>('useridinfo')] }),
          ...(scope.includes('openid') && { sub: userinfo[config.get<string>('useridinfo')] }),
          ...(scope.includes('email') && { email: userinfo[config.get<string>('emailinfo')] }),
          ...(scope.includes('phone') && { phone: userinfo[config.get<string>('phoneinfo')] }),
          ...(scope.includes('profile') && { avatar: userinfo[config.get<string>('avatarinfo')] })
        }
        session.body = JSON.stringify(parseduserinfo);
        // logger.info(session.body)
      } else if (param.path === '/accesstoken') {
        session.setMime('json');
        if (!param.code) return;
        const result = await database.findOne('oauth_authorization_code', { code: param.code })
        if (!result) return;
        const app = await database.findOne('oauth_apps', { clientid: result.appid })
        if (!app) return;
        const clientsecret = app.clientsecret
        if (param.client_id !== app.clientid || param.client_secret !== clientsecret) return;
        const token = generateCode(32)
        await database.insert('oauth_authentication_token', {
          token,
          appid: app.clientid,
          userid: result.userid,
          scope: result.scope
        })
        // session.body = JSON.stringify({ access_token: token, expires_in: 604800, token_type: 'Bearer' })
      }
    });
  ctx.command('developer')
    .action(async (session, param) => {
      session.setMime('html')
      if (loginstatus[session.sessionid]) {
        if (param.path.startsWith('/api/')) {
          session.setMime('json')
          const accesstoken = loginstatus[session.sessionid]
          const result = await database.findOne('oauth_authentication_token', { token: accesstoken })
          if (!result) return;
          const app = await database.findOne('oauth_apps', { clientid: 'yumeri' })
          if (!app) return;
          const userid = result.userid
          const oidc = await database.findOne('oauth_oidc_tokens', { userid })
          if (!oidc) return;
          const userinfo = await getUserInfo(config.get('userend'), oidc.authenticathiontoken, config.get<string>('clientid'))
          if (!userinfo) return;
          if (param.path === '/api/getapps') {
            const apps = await database.find('oauth_apps', { developerid: userinfo[config.get<string>('useridinfo')] })
            apps.forEach(app => {
              app.clientsecret = ''
            })
            session.body = JSON.stringify(apps)
          } else if (param.path === '/api/editapp') {
            if (!param.appId) return;
            const app = await database.findOne('oauth_apps', { clientid: param.appId })
            if (!app) return;
            if (app.developerid !== userinfo[config.get<string>('useridinfo')]) return;
            if (param.appData.name) app.name = param.appData.name
            if (param.appData.description) app.description = param.appData.description
            if (param.appData.redirecturi) app.redirecturi = param.appData.callback
            if (param.appData.scope) app.scope = param.appData.scope
            if (param.appData.description) app.description = param.appData.description
            if (param.appData.website) app.website = param.appData.website
            if (param.appData.tos) app.tos = param.appData.tos
            await database.update('oauth_apps', app, { clientid: param.appId })
            session.body = JSON.stringify({ status: 'success' })
          } else if (param.path === '/api/createapp') {
            // logger.info(param)
            if (!param.appData) return;
            if (!param.appData.name) return;
            if (!param.appData.callback) return;

            const app = {
              clientid: generateCode(32),
              clientsecret: generateCode(32),
              name: param.appData.name,
              description: param.appData.description || '',
              redirecturi: param.appData.callback,
              scope: param.appData.scope || 'openid profile email',
              developerid: userinfo[config.get<string>('useridinfo')],
              tos: param.appData.tos || '',
              website: param.appData.website || '',
            }
            try {
              await database.insert('oauth_apps', app)
            }
            catch (e) {
              session.body = JSON.stringify({ status: 'error', message: e })
              return;
            }
            session.body = JSON.stringify({ status: 'success', data: { clientsecret: app.clientsecret } })
          } else if (param.path === '/api/deleteapp') {
            if (!param.appId) return;
            const app = await database.findOne('oauth_apps', { clientid: param.appId })
            if (!app) return;
            if (app.developerid !== userinfo[config.get<string>('useridinfo')]) return;
            await database.delete('oauth_apps', { clientid: param.appId })
            session.body = JSON.stringify({ status: 'success' })
          } else if (param.path === '/api/refreshsecret') {
            // logger.info(param)
            if (!param.appId) return;
            const app = await database.findOne('oauth_apps', { clientid: param.appId })
            if (!app) return;
            // logger.info(app)
            if (app.developerid !== userinfo[config.get<string>('useridinfo')]) return;
            app.clientsecret = generateCode(32)
            await database.update('oauth_apps', app, { clientid: param.appId })
            session.body = JSON.stringify({ status: 'success', data: { clientsecret: app.clientsecret } })
          }
          return;
        }
        if (param.path === '' || param.path === '/') {
          const filepath = path.join(__dirname, '../static/developer/index.html');
          if (!fs.existsSync(filepath)) return;
          session.body = fs.readFileSync(filepath);
          return;
        }
        const filepath = path.join(__dirname, '../static/developer', param.path);
        // 判断是不是在那个文件夹
        if (filepath.startsWith(path.join(__dirname, '../static/developer'))) {
          if (!fs.existsSync(filepath)) return;
          session.body = fs.readFileSync(filepath);
        }
      } else {
        session.body = `<script>window.location.href = "/oauth/authorize?client_id=yumeri&redirect_uri=${encodeURIComponent(config.get<string>('redirecturi'))}&response_type=code&scope=email openid profile&state=1"</script>`
      }
    })
  console.addconsoleitem('user', 'fa-user', 'Oauth用户管理', path.join(__dirname, '../static/user/index.html'), path.join(__dirname, '../static/user/'));
  console.addconsoleitem('app', 'fa-app', 'Oauth应用管理', path.join(__dirname, '../static/app/index.html'), path.join(__dirname, '../static/app/'));
}