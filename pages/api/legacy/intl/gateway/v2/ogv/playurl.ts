import type { NextApiRequest, NextApiResponse } from "next";
import * as env from "../../../../../../../src/_config";
// import * as data_parse from "./_data";

const main = async (req: NextApiRequest, res: NextApiResponse) => {
  /* const continue_execute = await data_parse.middleware(
    req.url as string,
    req.headers
  );
  if (continue_execute[0] == false) res.json(env.block(continue_execute[1]));
  else res.json(await data_parse.main(req.url as string)); */
  // 修复：原实现带 Chrome 浏览器 UA（env.UA）转发，biliintl 的 APP 接口
  // 收到浏览器 UA 会返回 HTML 错误页，导致客户端拿到 <!DOCTYPE 而非 JSON。
  // 与同目录 season.ts（实测成功）保持一致：不带自定义 UA，使用默认 UA。
  fetch(env.api.intl.playurl + req.url, {
    method: req.method,
  })
    .then((response) => response.text())
    .then((response) => {
      res.send(response);
    });
};

export default main;
