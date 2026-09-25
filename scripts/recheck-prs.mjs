import { appendFileSync } from "node:fs";
import { pages } from "./github-pr.mjs";
import { signedMarketPost } from "./market-client.mjs";

if (process.env.RECHECK_ACK) {
  const ids = JSON.parse(process.env.RECHECK_ACK);
  await signedMarketPost("/internal/market/rechecks-ack",{ ids });
} else {
  const { events } = await signedMarketPost("/internal/market/rechecks",{});
  const pulls = await pages("/pulls?state=open&base=main");
  // 全量复查避免丢失绑定变化影响的新包 PR；只有全部完成才确认本批事件。
  appendFileSync(process.env.GITHUB_OUTPUT,`prs=${JSON.stringify(pulls.map(p => String(p.number)))}\nids=${JSON.stringify(events.map(e => e.id))}\n`);
}
