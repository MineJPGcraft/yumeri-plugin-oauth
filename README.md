# Oauth 系统

特点：

- 对接上级 oidc 鉴权
- 可开发者自行注册应用
- 支持多种 scope 调用

使用方法：

1. 创建一个 Yumeri 框架项目
2. 在插件市场安装 yumeri-plugin-oauth 或使用包管理器安装
3. 在 config.yml 中启用插件

依赖：

本插件基于数据库存储和控制台设置，所以需要依赖于 database 和 console 服务。
