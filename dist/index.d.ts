import { Context, Config, ConfigSchema } from 'yumeri';
export declare const depend: string[];
export declare const usage = "Oauth\u670D\u52A1\u7AEF\uFF0C\u5BF9\u63A5\u4E0A\u6E38OIDC\u670D\u52A1\u7AEF\u3002<br>\u91CD\u5B9A\u5411\u94FE\u63A5\u8BF7\u5199\\<\u57DF\u540D\\>/oauth/callback";
export declare const config: {
    schema: Record<string, ConfigSchema>;
};
export declare function apply(ctx: Context, config: Config): Promise<void>;
