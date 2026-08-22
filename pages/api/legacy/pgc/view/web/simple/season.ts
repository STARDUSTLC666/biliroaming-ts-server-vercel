import type { NextApiRequest, NextApiResponse } from "next";
import * as env from "../../../../../../../src/_config";
import * as data_parse from "../../../../../../../src/utils/player-data-handler/web";

// 2026 新版番剧页的 season 查询换成了 /pgc/view/web/simple/season。
// 大陆出口访问受限番剧时, 该接口的 SSR 数据里 episodes 为空数组(连 cid/aid 都不给),
// 页面因此直接渲染"地区限制"且不发起任何 playurl 请求;
// 油猴脚本需要在水合前用本路由(香港出口)拉取完整 season 数据注入 __NEXT_DATA__。
// 本路由做"薄转发": 查询参数原样带给官方接口, 响应原样回传。
const main = async (req: NextApiRequest, res: NextApiResponse) => {
  if (req.method === "OPTIONS") {
    res.status(200).end();
    return;
  }
  let PassWebOnCheck: 0 | 1 = 0; //当检测到请求来自B站时不受web_on开关影响
  res.setHeader("Access-Control-Allow-Credentials", "true");
  if (
    new RegExp("^https?://([a-z]+.bilibili.com|bilibili.com)$", "g").test(
      req.headers.origin
    ) ||
    (env.pass_web_on_check &&
      req.headers.referer === "https://www.bilibili.com")
  ) {
    res.setHeader("Access-Control-Allow-Origin", req.headers.origin as string);
    PassWebOnCheck = 1;
  }
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS,POST");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version"
  );
  const continue_execute = await data_parse.middleware(
    req.url as string,
    req.cookies,
    PassWebOnCheck,
    req.method
  );
  if (continue_execute[0] == false)
    res
      .setHeader(
        "Cache-Control",
        "max-age=30, s-maxage=30, stale-while-revalidate=30"
      )
      .json(env.block(continue_execute[1], continue_execute[2] || ""));
  else {
    // 只取查询串，路径硬编码，避免 Next 重写后的 req.url 路径混入上游地址
    const query = (req.url || "").split("?")[1] || "";
    const upstream = await fetch(
      "https://api.bilibili.com/pgc/view/web/simple/season?" + query,
      {
        headers: {
          "User-Agent": env.UA,
          Referer: "https://www.bilibili.com/",
        },
      }
    ).then((r) => r.text());
    res
      .setHeader(
        "Cache-Control",
        "max-age=600, s-maxage=600, stale-while-revalidate=600"
      )
      .setHeader("Content-Type", "application/json; charset=utf-8")
      .send(upstream);
  }
};

export default main;
