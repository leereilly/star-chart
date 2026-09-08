// Preloaded before the bundled action to stub all network access.
// Any unexpected request fails loudly so tests never hit the real network.

const WEEK = 7 * 86400000;
const now = Date.UTC(2026, 8, 6);

// Per-repository fixtures; anything else falls back to the default repo.
const REPOS = {
  'octocat/hello-world': {
    stars: 4321,
    adds: [1, 2, 0, 3, 5, 4, 6, 8, 7, 9, 10, 12],
  },
  'octocat/spoon-knife': {
    stars: 1000,
    adds: [0, 1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89],
  },
};

function historyPage(adds) {
  const start = now - (adds.length - 1) * WEEK;
  return adds.map((total, i) => ({
    timestamp: new Date(start + i * WEEK).toISOString(),
    total,
    days: [total, 0, 0, 0, 0, 0, 0],
  }));
}

function json(data, headers = {}) {
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { 'content-type': 'application/json', ...headers },
  });
}

function lookup(url) {
  const match = /\/repos\/([^/?]+)\/([^/?]+)/.exec(url);
  const owner = match ? match[1] : 'octocat';
  const repo = match ? match[2] : 'hello-world';
  const fullName = `${owner}/${repo}`;
  const fixture = REPOS[fullName] ?? REPOS['octocat/hello-world'];
  return { owner, repo, fullName, fixture };
}

globalThis.fetch = async (input) => {
  const url = typeof input === 'string' ? input : input.url;
  if (/\/repos\/[^/]+\/[^/]+\/stargazers\/history/.test(url)) {
    return json(historyPage(lookup(url).fixture.adds));
  }
  if (/\/repos\/[^/?]+\/[^/?]+(\?|$)/.test(url)) {
    const { owner, repo, fullName, fixture } = lookup(url);
    return json({
      full_name: fullName,
      name: repo,
      owner: { login: owner },
      created_at: new Date(now - 60 * WEEK).toISOString(),
      stargazers_count: fixture.stars,
    });
  }
  throw new Error(`Unexpected network request in bundle smoke test: ${url}`);
};
