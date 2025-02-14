import fs from "fs";
import axios from "axios";
import { URL } from "url";
import { SocksProxyAgent } from "socks-proxy-agent";
import { HttpsProxyAgent } from "https-proxy-agent";
import { HttpProxyAgent } from "http-proxy-agent";
import consola from "consola";

// 常量
const Config = {
  REQUEST_TIMEOUT: 30000,
  PING_COOLDOWN: 10000,
  CLIENT_COOLDOWN: 30000,
  TASK_DELAY: 20000,
  CYCLE_INTERVAL: 10000,
  ACCOUNT_FILE: "cookies.json",
  PROXY_FILE: "proxies.txt",
};

const sleep = (ms) => {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
};

class NodeGoPinger {
  constructor(token, proxyUrl = null) {
    this.apiBaseUrl = "https://nodego.ai/api";
    this.bearerToken = token;
    this.agent = proxyUrl ? this.createProxyAgent(proxyUrl) : null;
    this.lastPingTimestamp = 0;
    this.tasksList = [
      { code: "T001", name: "验证邮箱" },
      { code: "T005", name: "在 X 上关注我们" },
      { code: "T006", name: "评分 Chrome 扩展" },
      { code: "T009", name: "加入 Discord 频道" },
      { code: "T011", name: "在 X 上分享推荐链接" },
      { code: "T012", name: "转发我们的推文" },
      { code: "T014", name: "评论并标记 3 个朋友" },
      //   { code: "T002", name: "加入 Telegram 频道" },
      //   { code: "T003", name: "加入 Telegram 群组" },
      //   { code: "T004", name: "提升 Telegram 频道" },
      //   { code: "T007", name: "加入 Telegram MiniApp" },
      //   { code: "T010", name: "在名称中添加 NodeGo.Ai" },
      //   { code: "T100", name: "邀请 1 个朋友" },
      //   { code: "T101", name: "邀请 3 个朋友" },
      //   { code: "T102", name: "邀请 5 个朋友" },
      //   { code: "T103", name: "邀请 10 个朋友" },
    ];
    this.headers = {};
  }

  createProxyAgent(proxyUrl) {
    try {
      const PROXY_REGEX = /^(socks|http|https):\/\//;
      if (!PROXY_REGEX.test(proxyUrl)) {
        throw new Error(
          '代理 URL 必须以 "socks://", "http://", 或 "https://" 开头'
        );
      }

      const parsedUrl = new URL(proxyUrl);
      if (proxyUrl.startsWith("socks")) {
        return new SocksProxyAgent(parsedUrl);
      } else if (proxyUrl.startsWith("http")) {
        return {
          httpAgent: new HttpProxyAgent(parsedUrl),
          httpsAgent: new HttpsProxyAgent(parsedUrl),
        };
      } else {
        const httpUrl = `http://${proxyUrl}`;
        const httpParsedUrl = new URL(httpUrl);
        return {
          httpAgent: new HttpProxyAgent(httpParsedUrl),
          httpsAgent: new HttpsProxyAgent(httpParsedUrl),
        };
      }
    } catch (error) {
      consola.error("无效的代理 URL:", error.message);
      return null;
    }
  }

  async makeRequest(method, endpoint, data = null) {
    const config = {
      method,
      url: `${this.apiBaseUrl}${endpoint}`,
      headers: {
        ...this.headers,
        Authorization: `Bearer ${this.bearerToken}`,
        "Content-Type": "application/json",
        Accept: "*/*",
      },
      ...(data && { data }),
      timeout: Config.REQUEST_TIMEOUT,
    };

    if (this.agent) {
      if (this.agent.httpAgent) {
        config.httpAgent = this.agent.httpAgent;
        config.httpsAgent = this.agent.httpsAgent;
      } else {
        config.httpAgent = this.agent;
        config.httpsAgent = this.agent;
      }
    }

    try {
      return await axios(config);
    } catch (error) {
      if (error.code === "ECONNREFUSED" || error.code === "ETIMEDOUT") {
        throw new Error(`代理连接失败: ${error.message}`);
      }
      throw error;
    }
  }

  async getUserInfo() {
    try {
      const response = await this.makeRequest("GET", "/user/me");
      const metadata = response.data.metadata;
      return {
        username: metadata.username,
        email: metadata.email,
        totalPoint: metadata.rewardPoint,
        socialTasks: metadata.socialTask || [],
        nodes: metadata.nodes.map((node) => ({
          id: node.id,
          totalPoint: node.totalPoint,
          todayPoint: node.todayPoint,
          isActive: node.isActive,
        })),
      };
    } catch (error) {
      consola.error("获取用户信息失败:", error.message);
      throw error;
    }
  }

  async ping() {
    try {
      const currentTime = Date.now();
      if (currentTime - this.lastPingTimestamp < Config.PING_COOLDOWN) {
        await sleep(
          Config.PING_COOLDOWN - (currentTime - this.lastPingTimestamp)
        );
      }

      const response = await this.makeRequest("POST", "/user/nodes/ping", {
        type: "extension",
      });
      this.lastPingTimestamp = Date.now();

      return {
        statusCode: response.data.statusCode,
        message: response.data.message,
        metadataId: response.data.metadata.id,
      };
    } catch (error) {
      consola.error(`Ping 失败: ${error.message}`);
      throw error;
    }
  }

  async clientIP() {
    try {
      const config = {
        url: "https://api.bigdatacloud.net/data/client-ip",
        method: "GET",
        headers: {
          ...this.headers,
        },
        timeout: Config.REQUEST_TIMEOUT,
      };
      if (this.agent) {
        if (this.agent.httpAgent) {
          config.httpAgent = this.agent.httpAgent;
          config.httpsAgent = this.agent.httpsAgent;
        } else {
          config.httpAgent = this.agent;
          config.httpsAgent = this.agent;
        }
      }
      const res = await axios(config);
      if (res && res.status == 200 && res.data) {
        const { ipString } = res.data || {};
        consola.success(`client ip成功 当前IP：${ipString}`);
      }
      this.pingTotal = 0;
    } catch (e) {
      consola.error(`client ip err ${e}`);
      this.pingTotal = 0;
    }
  }

  async dailyCheckin() {
    try {
      const response = await this.makeRequest("POST", "/user/checkin");
      return {
        statusCode: response.data.statusCode,
        message: response.data.message,
        userData: response.data.metadata.user,
      };
    } catch (error) {
      throw handleRequestError(error);
    }
  }

  async claimTask(taskId) {
    try {
      const response = await this.makeRequest("POST", "/user/task", { taskId });
      return {
        statusCode: response.data.statusCode,
        message: response.data.message,
        userData: response.data.metadata?.user,
      };
    } catch (error) {
      throw handleRequestError(error);
    }
  }

  async processTasks(completedTasks) {
    const results = [];
    for (const task of this.tasksList) {
      if (!completedTasks.includes(task.code)) {
        try {
          await new Promise((resolve) =>
            setTimeout(resolve, Config.TASK_DELAY)
          );
          const result = await this.claimTask(task.code);
          results.push({
            code: task.code,
            name: task.name,
            status: "成功",
            statusCode: result.statusCode,
            message: result.message,
          });
          consola.success(
            `任务 ${task.code} (${task.name}): ${result.message}`
          );
        } catch (error) {
          results.push({
            code: task.code,
            name: task.name,
            status: "失败",
            statusCode: error.statusCode,
            message: error.message,
          });
          consola.error(`任务 ${task.code} (${task.name}): ${error.message}`);
        }
      } else {
        results.push({
          code: task.code,
          name: task.name,
          status: "跳过",
        });
        consola.info(`任务 ${task.code} (${task.name}): 已完成`);
      }
    }
    return results;
  }

  destroy() {
    if (this.agent?.httpAgent) this.agent.httpAgent.destroy();
    if (this.agent?.httpsAgent) this.agent.httpsAgent.destroy();
  }
}

class MultiAccountPinger {
  constructor() {
    this.accounts = this.loadAccounts();
    this.isRunning = true;
    this.pingTotal = 1;
  }

  loadAccounts() {
    try {
      const accountData = JSON.parse(
        fs.readFileSync(Config.ACCOUNT_FILE, "utf8")
      );

      const proxyData = fs.existsSync(Config.PROXY_FILE)
        ? fs
            .readFileSync(Config.PROXY_FILE, "utf8")
            .split("\n")
            .filter((line) => line.trim())
        : [];

      return accountData.map((token, index) => ({
        token: token.trim(),
        proxy: proxyData[index] || null,
      }));
    } catch (error) {
      consola.error("读取账户时出错:", error);
      process.exit(1);
    }
  }

  async processAccountInitialTasks(account) {
    const pinger = new NodeGoPinger(account.token, account.proxy);
    try {
      consola.info("=".repeat(50));
      const userInfo = await pinger.getUserInfo();
      consola.info(`账户初始设置: ${userInfo.username} (${userInfo.email})`);

      try {
        const checkinResponse = await pinger.dailyCheckin();
        consola.success(`每日签到: ${checkinResponse.message}`);
      } catch (error) {
        consola.warn(`每日签到: ${error.message}`);
      }

      consola.info("处理初始任务...");
      await pinger.processTasks(userInfo.socialTasks || []);
      consola.success("初始任务完成");
      consola.info("=".repeat(50));
    } catch (error) {
      consola.error(`处理初始任务时出错: ${error.message}`);
      consola.info("=".repeat(50));
    } finally {
      pinger.destroy();
    }
  }

  async processPing(account, pingTotal) {
    const pinger = new NodeGoPinger(account.token, account.proxy);
    try {
      const userInfo = await pinger.getUserInfo();
      consola.info(`正在为账户 Ping: ${userInfo.username}`);
      const pingResponse = await pinger.ping();
      consola.success(`Ping 状态: ${pingResponse.message}`);
      if (pingTotal == 3) {
        await pinger.clientIP();
      }

      const updatedUserInfo = await pinger.getUserInfo();
      if (updatedUserInfo.nodes.length > 0) {
        consola.info("节点状态:");
        updatedUserInfo.nodes.forEach((node, index) => {
          consola.info(`  节点 ${index + 1}: 今日获得 ${node.todayPoint} 点`);
        });
      }
    } catch (error) {
      consola.error(`Ping 账户时出错: ${error.message}`);
    } finally {
      pinger.destroy();
    }
  }

  async runPinger() {
    process.on("SIGINT", () => {
      consola.warn("正在优雅地关闭...");
      this.isRunning = false;
      setTimeout(() => process.exit(0), 1000);
    });

    // consola.info("🚀 正在执行初始设置和任务...");
    // await Promise.all(
    //   this.accounts.map((account) => this.processAccountInitialTasks(account))
    // );

    consola.info("⚡ 开始定期 Ping 循环...");
    while (this.isRunning) {
      consola.info(`⏰ Ping 循环于 ${new Date().toLocaleString()}`);

      await Promise.all(
        this.accounts.map((account) =>
          this.processPing(account, this.pingTotal)
        )
      );
      if (this.pingTotal === 3) {
        this.pingTotal = 1;
      } else this.pingTotal++;
      if (this.isRunning) {
        consola.info(
          `等待 ${Config.CYCLE_INTERVAL / 1000} 秒后进行下一个循环...`
        );
        await new Promise((resolve) =>
          setTimeout(resolve, Config.CYCLE_INTERVAL)
        );
      }
    }
  }
}

// 运行多账户 Pinger
const multiPinger = new MultiAccountPinger();
multiPinger.runPinger();
