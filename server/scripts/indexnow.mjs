// Tells Bing (and through it ChatGPT search, Copilot, DuckDuckGo, Yandex) that pages
// on kellysdeli.co.uk are new or changed, so they're re-crawled in minutes not weeks.
//
// Run by hand after a deploy that changes public pages, and only once the site's
// "coming soon" password is off (a crawler hitting a 401 learns nothing):
//   node server/scripts/indexnow.mjs            -> every URL in the live sitemap
//   node server/scripts/indexnow.mjs --dry-run  -> list them, send nothing
//
// The key below is public by design: IndexNow proves ownership by fetching
// https://www.kellysdeli.co.uk/<key>.txt (client/public/<key>.txt).
const KEY = "f75dc6807de143df71cf00ed1e1584d3";
const HOST = "www.kellysdeli.co.uk";
const dryRun = process.argv.includes("--dry-run");

const sitemap = await fetch(`https://${HOST}/sitemap.xml`).then((r) => {
  if (!r.ok) throw new Error(`sitemap returned ${r.status}`);
  return r.text();
});
const urls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
if (!urls.length) throw new Error("no URLs found in the sitemap");

const gate = await fetch(`https://${HOST}/`);
if (gate.status === 401) {
  console.error("The site is still password-gated (401). Turn the gate off first, or crawlers will index nothing.");
  process.exit(1);
}

console.log(`${urls.length} URLs${dryRun ? " (dry run, nothing sent)" : ""}:`);
for (const u of urls) console.log("  " + u);
if (dryRun) process.exit(0);

const res = await fetch("https://api.indexnow.org/indexnow", {
  method: "POST",
  headers: { "Content-Type": "application/json; charset=utf-8" },
  body: JSON.stringify({ host: HOST, key: KEY, keyLocation: `https://${HOST}/${KEY}.txt`, urlList: urls }),
});
console.log(`IndexNow answered ${res.status} ${res.statusText} (200 or 202 = accepted)`);
process.exit(res.ok ? 0 : 1);
