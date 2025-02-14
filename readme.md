# NodeGo 机器人

用于 NodeGo 平台的自动化机器人，支持多账户和代理配置（HTTP/SOCKS）。

## 功能
- 多账户支持
- HTTP 和 SOCKS 代理支持
- 自动定期 ping
- 自动完成部分任务
  
## 运行条件
- Node.js（v16 或更高版本）


## 安装
1. 克隆仓库：
```bash
git clone https://github.com/varown/nodego-bot.git
cd nodego-bot
```

2. 安依赖:
```bash
npm install
```

## 配置
1. 在项目根目录下创建 cookies.json：
- 每行添加一个 NodeGo 令牌
- 示例：
```bash
[
    'token1',
    'token2',
    ....
]   
```

2. （可选）在项目根目录下创建 proxies.txt：

- 每行添加一个代理
- 支持 HTTP 和 SOCKS 代理
- 示例：

```
     http://ip1:port1
     socks5://ip2:port2
     socks4://ip3:port3
```
## 使用
运行机器人：
```bash
node index.js
```

机器人将：

- 从 data.txt 加载所有账户
- 如果可用，关联 proxies.txt 中的代理
- 每 10 秒开始定期 ping
- 显示每个账户的详细状态信息

## 贡献
欢迎 fork 仓库并提交任何改进的拉取请求。

## 许可证
MIT 许可证

## 免责声明
此项目仅供教育用途。使用风险自负，并确保遵守 NodeGo 的服务条款。
