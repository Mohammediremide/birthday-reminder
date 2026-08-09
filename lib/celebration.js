/**
 * Builds the warm, community-style birthday announcement — the "Good
 * morning, Excel with Dikky family!" style message, instead of a plain list.
 *
 * If GEMINI_API_KEY is set (Google's free-tier Gemini API — no credit card
 * needed, get one at aistudio.google.com/apikey), this asks Gemini to write
 * a fresh, casual, human-sounding version each time. If the key isn't set,
 * or the call fails for any reason (rate limit, network issue, etc.), it
 * falls back to one of several built-in template variants, picked at random
 * each send — so even without AI, two birthdays in a row don't read
 * identically.
 */

/** Joins names+numbers with correct grammar: "A" / "A and B" / "A, B, and C" */
function formatMentions(people) {
  const mentions = people.map((p) => `${p.fullName} @${p.mobile}`);
  if (mentions.length === 1) return mentions[0];
  if (mentions.length === 2) return `${mentions[0]} and ${mentions[1]}`;
  return `${mentions.slice(0, -1).join(", ")}, and ${mentions[mentions.length - 1]}`;
}

/**
 * A few different phrasings so the fallback (no OpenAI key) still feels
 * like a different person wrote it each time, not a copy-pasted template.
 */
function templateVariants(mentions, isPlural) {
  const subject = isPlural ? "them" : "them";
  const are = isPlural ? "are" : "is";

  return [
`Good morning, Excel with Dikky family! 📊✨

Today we get to celebrate someone special — please join me in wishing ${mentions} a very happy birthday! 🎉🎂

${isPlural ? "They've" : "They've"} been such a valued part of this community, and ${are === "is" ? "it's" : "it's"} only right we take a moment to celebrate ${subject} today. Whatever the year ahead holds, we hope it's full of good health, new opportunities, and plenty of reasons to smile.

Go on and drop a message, a call, or just a quick "happy birthday" — it always means more than we think. 🥳🎈

Have a wonderful day!`,

`Happy birthday to ${mentions}! 🎂✨

On behalf of the whole Excel with Dikky family, we're celebrating you today. It's easy to get caught up in the day-to-day and forget to pause for moments like this, so — take today to enjoy yourself.

Here's to another year of growth, good health, and good things coming your way. We're grateful to have ${subject} in this community, and we hope today feels exactly as special as it should. 🎉

Wishing you a beautiful celebration! 🥳`,

`Good morning, everyone! 📊

A quick but important announcement: today is ${mentions}'s birthday! 🎉

If you've got a moment, reach out and wish ${subject} well — small gestures like that go a long way. On behalf of Excel with Dikky, we're wishing ${subject} a year ahead filled with good health, new opportunities, and plenty to celebrate.

Enjoy the day, and thank you for being part of this community. 🎂🥳`,

`Excel with Dikky family, gather round for a second — we've got a birthday to celebrate today! 🎉

Happy birthday to ${mentions}! Whatever today looks like for you, we hope it's filled with good company, good food, and a real reason to celebrate. You're a valued part of this community, and we just wanted to take a moment to say so.

Here's wishing you good health, new opportunities, and a genuinely great year ahead. 🎂✨ Enjoy every bit of today!`,
  ];
}

function templateMessage(people) {
  const mentions = formatMentions(people);
  const isPlural = people.length > 1;
  const variants = templateVariants(mentions, isPlural);
  return variants[Math.floor(Math.random() * variants.length)];
}

async function aiMessage(people) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const names = people.map((p) => `${p.fullName} (@${p.mobile})`).join(", ");
  const prompt = `Write a warm birthday announcement for a community called "Excel with Dikky", as if a real community member is casually writing it — not corporate, not stiff, not like a template. Vary your opening line, tone, and structure each time so it never reads like a repeated format.

Requirements:
- Sounds like a genuine person wrote it, with some warmth and personality, not generic corporate language
- Mention each birthday person by name, followed by their phone number written exactly as "@<number>"
- If there's more than one person, join them naturally ("and" for two, an Oxford-comma list for three or more)
- Somewhere between 100 and 160 words — longer than a one-liner, but not an essay
- Include a genuine, specific-feeling birthday wish (not just "happy birthday")
- A few celebratory emojis is fine, but don't overdo it
- Plain text only, no markdown asterisks or headers
- Vary sentence structure and rhythm so it doesn't feel machine-generated

People celebrating today: ${names}`;

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 1.0, maxOutputTokens: 400 },
        }),
      }
    );
    if (!res.ok) return null;

    const data = await res.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || null;
  } catch {
    return null; // any failure here just means we fall back to the template
  }
}

/** people: array of { fullName, mobile, ... } — today's birthdays. */
export async function buildCelebrationMessage(people) {
  const generated = await aiMessage(people);
  return generated || templateMessage(people);
}
