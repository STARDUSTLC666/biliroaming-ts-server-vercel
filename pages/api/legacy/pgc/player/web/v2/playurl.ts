import type { NextApiRequest, NextApiResponse } from "next";
import * as env from "../../../../../../../src/_config";
import * as data_parse from "../../../../../../../src/utils/player-data-handler/web";

// 2026 新版 nano 播放器把番剧 playurl 请求从 /pgc/player/web/playurl(v1)
// 换成了 /pgc/player/web/v2/playurl(v2)。v2 响应结构完全不同：
// result 下只有 video_info / view_info / play_check / exp_info /
// play_view_business_info 五个键（v1 的 result 整体嵌进 video_info）。
// 若沿用 v1 的解锁数据注入，新版页面会因缺字段在渲染层崩溃
// （getManifest() 为 null 仍被无判空读取 .screenKind）。
// 因此本路由做"薄转发"：查询参数原样带给官方 v2 接口，靠服务器
// 出口地区（Vercel hkg1 = 香港）完成区域解锁，官方生成的完整 v2
// 结构（含 view_info / play_view_business_info）原样回传给页面。
const main = async (req: NextApiRequest, res: NextApiResponse) => {
  // 预检请求直接放行：播放器的跨域 XHR 若带自定义头会先发 OPTIONS，
  // 不提前返回会掉进中间件被当成普通请求处理
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
      "https://api.bilibili.com/pgc/player/web/v2/playurl?" + query,
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
