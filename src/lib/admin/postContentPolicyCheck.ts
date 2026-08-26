// Heuristic, rule-based scan for content patterns that commonly get flagged
// by Gmail/Google's spam and policy filters. Advisory only — this never
// blocks a send, it just gives the admin a heads-up to review before
// sending to real recipients. Not a substitute for actually reading the
// content; it can't catch anything context-dependent.

const SPAM_PHRASES = [
  "act now",
  "click here",
  "buy now",
  "call now",
  "order now",
  "100% free",
  "totally free",
  "risk free",
  "risk-free",
  "no obligation",
  "no cost",
  "limited time",
  "act immediately",
  "urgent",
  "winner",
  "you have been selected",
  "congratulations",
  "guaranteed",
  "cash bonus",
  "double your",
  "earn money",
  "work from home",
  "million dollars",
  "cash prize",
  "free gift",
  "special promotion",
  "this is not spam",
];

const SHORTENER_DOMAINS = ["bit.ly", "tinyurl.com", "goo.gl", "t.co", "ow.ly", "is.gd", "buff.ly"];

export type PolicyIssue = { message: string };

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function checkPostContent(subject: string, bodyHtml: string): PolicyIssue[] {
  const issues: PolicyIssue[] = [];
  const text = stripHtml(bodyHtml);
  const lowerSubject = subject.toLowerCase();
  const lowerText = text.toLowerCase();

  const subjectLetters = subject.replace(/[^a-zA-Z]/g, "");
  const subjectUpper = subject.replace(/[^A-Z]/g, "");
  if (subjectLetters.length > 6 && subjectUpper.length / subjectLetters.length > 0.7) {
    issues.push({ message: "Subject line is mostly ALL CAPS, which spam filters commonly flag." });
  }

  if ((subject.match(/!/g) || []).length >= 2) {
    issues.push({ message: "Subject line has multiple exclamation marks, a common spam signal." });
  }

  const foundPhrases = SPAM_PHRASES.filter((p) => lowerSubject.includes(p) || lowerText.includes(p));
  if (foundPhrases.length > 0) {
    issues.push({
      message: `Contains phrase(s) commonly flagged as spam: "${foundPhrases.slice(0, 4).join('", "')}".`,
    });
  }

  const hrefs = [...bodyHtml.matchAll(/href=["']([^"']+)["']/gi)].map((m) => m[1]);
  if (hrefs.some((h) => SHORTENER_DOMAINS.some((d) => h.includes(d)))) {
    issues.push({ message: "Contains a shortened link (e.g. bit.ly) — spam filters treat these with suspicion." });
  }
  if (hrefs.length > 8) {
    issues.push({ message: `Contains a lot of links (${hrefs.length}) — high link counts can trigger spam filters.` });
  }

  const imgCount = (bodyHtml.match(/<img/gi) || []).length;
  if (imgCount > 0 && text.length < 40) {
    issues.push({
      message: "Content is mostly image(s) with very little real text — a pattern spam filters watch for.",
    });
  }

  return issues;
}
