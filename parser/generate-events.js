const https = require('https');
const fs = require('fs');
const path = require('path');

const GEMINI_KEY = process.env.GEMINI_API_KEY;
if (!GEMINI_KEY) { console.error('GEMINI_API_KEY not set'); process.exit(1); }

const SOURCES_SUMMARY = "Україна: ukrinform.ua, suspilne.media, babel.ua, dw.com/uk, liveuamap.com, pravda.com.ua, unian.ua, tsn.ua, hromadske.ua, zn.ua, mfa.gov.ua. Німеччина: tagesschau.de, zeit.de, spiegel.de, faz.net, germany4ukraine.de, auswaertiges-amt.de, kmk.org. Австрія: orf.at, derstandard.at, diepresse.com, krone.at, bmeia.gv.at/ukraine, bmbwf.gv.at. Словаччина: sme.sk, aktuality.sk, pravda.sk, dennikn.sk, minedu.sk. Угорщина: index.hu, hvg.hu, telex.hu, 444.hu, oktatas.hu.";

function dateRange(n) {
  const out = [];
  const today = new Date();
  for (let i = 0; i < n; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() + i);
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

const dates = dateRange(45);
const from = dates[0], to = dates[dates.length - 1];

const prompt = `Ти аналітик подій для автобусного перевізника eclub.com.ua (маршрути Україна ↔ Німеччина/Австрія/Словаччина/Угорщина/Молдова).

Знайди актуальні події для періоду з ${from} по ${to} для країн: UA, DE, AT, SK, HU.
Орієнтуйся на тематику цих джерел: ${SOURCES_SUMMARY}

Знайди для кожної дати: державні свята, шкільні канікули (початок/кінець), великі фестивалі/концерти/спортивні події, новини для українців за кордоном.

Поверни ТІЛЬКИ JSON масив без жодного тексту:
[{"date":"YYYY-MM-DD","country":"UA|DE|AT|SK|HU","event_name":"string","event_type":"holiday|vacation_start|vacation_end|festival|news","relevance_for_bus_company":"high|medium|low"}]`;

const body = JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] });
const options = {
  hostname: 'generativelanguage.googleapis.com',
  path: `/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_KEY}`,
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
};

const req = https.request(options, res => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    try {
      const json = JSON.parse(data);
      if (json.error) throw new Error(json.error.message);
      const text = json.candidates?.[0]?.content?.parts?.[0]?.text || '';
      const cleaned = text.replace(/```json/g, '').replace(/```/g, '').trim();
      const events = JSON.parse(cleaned);
      const output = { generated_at: new Date().toISOString(), from, to, range: 45, events };
      const outPath = path.join(__dirname, 'output', 'events.json');
      fs.writeFileSync(outPath, JSON.stringify(output, null, 2));
      console.log(`✅ Збережено ${events.length} подій → ${outPath}`);
    } catch (e) {
      console.error('Помилка:', e.message);
      process.exit(1);
    }
  });
});
req.on('error', e => { console.error(e); process.exit(1); });
req.write(body);
req.end();
