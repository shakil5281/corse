// DSA Search Engine: Trie + Inverted Index + LRU Cache + Relevance Ranking
// Complexity:
//  Build: O(N * T * L)  N=records, T=tokens per record, L=avg token length
//  Search: O(K + Q*P)  K=keys scan for substring, Q=query tokens, P=avg postings size
//  Cache hit: O(1)

export type WeightRecord = {
  Subtrate: string
  Brand: string
  "Article Ticket": string
  Count: string
  Meter: string
  "Cone Weight": string
}

type TrieNode = {
  children: Map<string, TrieNode>
  indices: Set<number>
  isEnd: boolean
}

function createTrieNode(): TrieNode {
  return { children: new Map(), indices: new Set(), isEnd: false }
}

function normalize(str: string): string {
  return str.trim().toLowerCase()
}

function tokenize(value: string): string[] {
  const n = normalize(value)
  if (!n) return []
  // split on non-alphanum, keep full token too for exact ticket like "ev30120"
  const parts = n.split(/[^a-z0-9]+/).filter(Boolean)
  // add bigrams for Count like 0125X02 -> 0125x02, 0125, 02 already covered, but add raw normalized without split
  const tokens = new Set<string>()
  tokens.add(n) // full field value as token (allows substring via includes fallback)
  for (const p of parts) tokens.add(p)
  // also add concatenated without spaces for Brand like "gramax ecv" -> "gramaxecv"
  if (parts.length > 1) tokens.add(parts.join(""))
  return Array.from(tokens)
}

export class WeightSearchEngine {
  private records: WeightRecord[]
  private inverted = new Map<string, Set<number>>()
  private trieRoot: TrieNode = createTrieNode()
  private cache = new Map<string, { result: number[]; time: number }>()
  private maxCache = 80
  private allKeys: string[] = []

  // performance metrics
  public buildMs = 0
  public lastSearchMs = 0

  constructor(records: WeightRecord[]) {
    const t0 = performance.now()
    this.records = records
    this.buildIndex()
    const t1 = performance.now()
    this.buildMs = t1 - t0
    this.allKeys = Array.from(this.inverted.keys())
  }

  private buildIndex() {
    this.records.forEach((rec, idx) => {
      const fields = Object.values(rec) as string[]
      const seen = new Set<string>() // dedup per record to avoid overweight
      for (const f of fields) {
        const toks = tokenize(String(f))
        for (const tok of toks) {
          if (seen.has(tok)) continue
          seen.add(tok)
          // inverted
          if (!this.inverted.has(tok)) this.inverted.set(tok, new Set())
          this.inverted.get(tok)!.add(idx)
          // trie insert
          this.insertTrie(tok, idx)
          // also insert substrings of length 2+ for short codes? limit to tokens >=3 to avoid blowup
          // generate n-grams for fast substring: e.g. "ev30120" -> index "301", "012" etc is heavy.
          // Instead rely on substring scan over keys at query time (cheaper build, acceptable query)
        }
      }
    })
  }

  private insertTrie(token: string, idx: number) {
    let node = this.trieRoot
    for (const ch of token) {
      if (!node.children.has(ch)) node.children.set(ch, createTrieNode())
      node = node.children.get(ch)!
      node.indices.add(idx)
    }
    node.isEnd = true
  }

  private searchTriePrefix(prefix: string): Set<number> {
    let node = this.trieRoot
    for (const ch of prefix) {
      const nxt = node.children.get(ch)
      if (!nxt) return new Set()
      node = nxt
    }
    // return all indices under this prefix node (already aggregated via insertion)
    return new Set(node.indices)
  }

  // collect postings for a single token via: exact -> prefix -> substring fallback
  private getPostings(token: string): Set<number> {
    const result = new Set<number>()

    // exact
    const exact = this.inverted.get(token)
    if (exact) for (const i of exact) result.add(i)

    // prefix via trie (covers autocomplete like "epi" -> "epic", "epic ecv")
    const pref = this.searchTriePrefix(token)
    for (const i of pref) result.add(i)

    // substring fallback: scan keys for includes (O(K)), only if result small or token length >=2
    // this enables "0125" to match "0125x02" via full token scan without building n-grams
    if (result.size < 8 && token.length >= 2) {
      for (const key of this.allKeys) {
        if (key.includes(token) && key !== token) {
          const s = this.inverted.get(key)
          if (s) for (const i of s) result.add(i)
        }
      }
    }

    return result
  }

  // Intersect sets: smallest first for performance (classic posting list intersection)
  private intersect(sets: Set<number>[]): Set<number> {
    if (sets.length === 0) return new Set()
    if (sets.length === 1) return new Set(sets[0])
    sets.sort((a, b) => a.size - b.size)
    let res = new Set(sets[0])
    for (let i = 1; i < sets.length; i++) {
      const nxt = sets[i]
      res = new Set([...res].filter((x) => nxt.has(x)))
      if (res.size === 0) break
    }
    return res
  }

  // Public search: supports multi-token AND semantics with relevance ranking
  search(rawQuery: string): { indices: number[]; durationMs: number; cached: boolean } {
    const t0 = performance.now()
    const q = normalize(rawQuery)
    if (!q) return { indices: [], durationMs: 0, cached: false }

    // cache check
    const cached = this.cache.get(q)
    if (cached) {
      return { indices: cached.result, durationMs: 0, cached: true }
    }

    const tokens = tokenize(q) // e.g. "Epic 5000M" -> ["epic 5000m","epic","5000m"]
    // filter out duplicate long combined token if already covered by split parts for better AND
    // keep tokens that are split parts plus maybe keep first combined only if single word query
    const queryTokens = q.split(/[^a-z0-9]+/).filter(Boolean).map(normalize)
    const effectiveTokens = queryTokens.length > 0 ? queryTokens : tokens

    const postingSets: Set<number>[] = []
    for (const tok of effectiveTokens) {
      const ps = this.getPostings(tok)
      if (ps.size === 0) {
        // if any token has zero postings, whole AND is empty -> early exit
        const dur = performance.now() - t0
        this.lastSearchMs = dur
        this.cacheSet(q, [])
        return { indices: [], durationMs: dur, cached: false }
      }
      postingSets.push(ps)
    }

    const intersected = this.intersect(postingSets)

    // relevance ranking: score by term frequency + exact bonus + prefix bonus
    const scored = [...intersected].map((idx) => {
      let score = 0
      const recStr = Object.values(this.records[idx]).join(" ").toLowerCase()
      for (const tok of effectiveTokens) {
        if (recStr.includes(tok)) score += 10
        // exact field match bonus
        for (const v of Object.values(this.records[idx])) {
          const nv = normalize(String(v))
          if (nv === tok) score += 20
          else if (nv.startsWith(tok)) score += 8
        }
      }
      // prefer shorter Brand matches? small boost for direct Brand hit
      if (normalize(this.records[idx].Brand).includes(effectiveTokens[0])) score += 5
      return { idx, score }
    })
    scored.sort((a, b) => b.score - a.score || a.idx - b.idx)
    const indices = scored.map((s) => s.idx)

    const dur = performance.now() - t0
    this.lastSearchMs = dur
    this.cacheSet(q, indices)
    return { indices, durationMs: dur, cached: false }
  }

  private cacheSet(q: string, result: number[]) {
    if (this.cache.size >= this.maxCache) {
      const first = this.cache.keys().next().value as string
      this.cache.delete(first)
    }
    this.cache.set(q, { result, time: Date.now() })
  }

  // helper to map indices -> records
  getRecords(indices: number[]): WeightRecord[] {
    return indices.map((i) => this.records[i])
  }

  get size() {
    return this.records.length
  }
}
