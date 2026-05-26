# Supabase Setup

这个文件夹是给小钱本以后做云端同步用的。

现在的小钱本是先存在自己的手机或电脑里。接上 Supabase 后，就可以做：

- 换手机也能找回记录
- 手机和电脑同步
- 用 email 登录自己的账本
- 以后做 Pro 版账号

## 下一步

1. 去 Supabase 建一个新 project。
2. 打开 Supabase 的 SQL Editor。
3. 把 `schema.sql` 的内容贴进去运行。
4. 或者在 GitHub 连接 Supabase migration，用 `migrations/202605260001_initial_schema.sql`。
5. 到 Project Settings > API 复制 `anon public` key。
6. 把 key 加进小钱本的 `script.js` 里的 `supabaseAnonKey`。
7. 回到小钱本，用 email 登入后就会同步。

不要把 Supabase 的密码或 secret key 放进 GitHub。之后 app 只会用 public anon key。
