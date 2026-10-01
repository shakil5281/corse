"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { CardSkeleton, SearchSkeletonGrid } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"
import { WeightSearchEngine, type WeightRecord } from "@/lib/search-engine"
import { useDebounce } from "@/hooks/use-debounce"

export type { WeightRecord }

// ——— highlight memoized helper ———
function highlight(text: string, query: string) {
  if (!query) return text
  const q = query.trim().toLowerCase()
  if (!q) return text
  // highlight first token only for clean UX (multi-token highlights would be noisy)
  const firstToken = q.split(/[^a-z0-9]+/).filter(Boolean)[0] ?? q
  const idx = text.toLowerCase().indexOf(firstToken)
  if (idx === -1) return text
  const before = text.slice(0, idx)
  const match = text.slice(idx, idx + firstToken.length)
  const after = text.slice(idx + firstToken.length)
  return (
    <>
      {before}
      <mark className="bg-yellow-200 dark:bg-yellow-500/30 px-0.5 rounded text-inherit">{match}</mark>
      {after}
    </>
  )
}

// ——— memoized card — perf: prevents re-render when parent query unchanged for that item ———
const RecordCard = React.memo(function RecordCard({
  row,
  query,
  index,
}: {
  row: WeightRecord
  query: string
  index: number
}) {
  const qLower = query.trim().toLowerCase()
  return (
    <Card
      className="overflow-hidden hover:shadow-md hover:border-primary/20 transition-[transform,box-shadow,border-color] duration-[320ms] ease-[cubic-bezier(0.16,1,0.3,1)] group will-change-transform transform-gpu animate-[card-enter_560ms_cubic-bezier(0.16,1,0.3,1)_both]"
      style={{
        animationDelay: `${Math.min(index * 28, 280)}ms`,
      }}
    >
      <CardContent className="p-4 sm:p-5">
        <div className="flex items-start justify-between gap-2 mb-3">
          <Badge
            variant={qLower && row.Subtrate.toLowerCase().includes(qLower.split(/[^a-z0-9]+/)[0] ?? "") ? "default" : "secondary"}
            className="rounded-full text-[11px] font-mono"
          >
            {highlight(row.Subtrate, query) as React.ReactNode}
          </Badge>
          <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-1 text-[11px] font-mono font-medium">
            {highlight(row["Article Ticket"], query) as React.ReactNode}
          </span>
        </div>

        <div className="space-y-1">
          <div className="font-semibold text-sm leading-tight group-hover:text-primary transition-colors">
            {highlight(row.Brand, query) as React.ReactNode}
          </div>
          <div className="flex flex-wrap gap-1.5 pt-1">
            <Badge variant="outline" className="rounded-full font-mono text-[11px] font-normal">
              Count: {highlight(row.Count, query) as React.ReactNode}
            </Badge>
            <Badge variant="outline" className="rounded-full font-mono text-[11px] font-normal">
              {highlight(row.Meter, query) as React.ReactNode}
            </Badge>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 rounded-xl bg-muted/50 p-3">
          <div>
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-medium">Meter</div>
            <div className="text-sm font-semibold font-mono">{highlight(row.Meter, query) as React.ReactNode}</div>
          </div>
          <div className="text-right">
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-medium">Cone Weight</div>
            <div className="text-sm font-bold">
              {highlight(row["Cone Weight"], query) as React.ReactNode}
              <span className="text-xs font-normal text-muted-foreground"> g</span>
            </div>
          </div>
        </div>

        <details className="mt-3 group/details">
          <summary className="text-xs text-muted-foreground hover:text-foreground cursor-pointer list-none flex items-center gap-1">
            <svg className="transition-transform group-open/details:rotate-90" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="m9 18 6-6-6-6" />
            </svg>
            View all fields
          </summary>
          <div className="mt-2 grid grid-cols-2 gap-2 text-xs rounded-lg border bg-card p-3">
            <div>
              <span className="text-muted-foreground">Substrate:</span> <span className="font-medium">{row.Subtrate}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Brand:</span> <span className="font-medium">{row.Brand}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Ticket:</span> <span className="font-mono font-medium">{row["Article Ticket"]}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Count:</span> <span className="font-mono font-medium">{row.Count}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Meter:</span> <span className="font-medium">{row.Meter}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Weight:</span> <span className="font-medium">{row["Cone Weight"]}g</span>
            </div>
          </div>
        </details>
      </CardContent>
    </Card>
  )
})

const PAGE_SIZE = 18

export default function SearchExperience({ data }: { data: WeightRecord[] }) {
  const [isOpen, setIsOpen] = React.useState(false)
  const [query, setQuery] = React.useState("")
  const inputRef = React.useRef<HTMLInputElement>(null)

  // — perf: data loading smooth animation (initial mount shimmer) —
  const [isInitialLoading, setIsInitialLoading] = React.useState(true)
  const [mounted, setMounted] = React.useState(false)
  React.useEffect(() => {
    const id = setTimeout(() => setIsInitialLoading(false), 650)
    return () => clearTimeout(id)
  }, [])
  React.useEffect(() => setMounted(true), [])

  // — DSA engine: built once, O(N*T*L) — deferred buildMs display avoids hydration mismatch
  const engine = React.useMemo(() => new WeightSearchEngine(data), [data])

  // debounce + defer for non-blocking input (keeps 60fps while typing)
  const debouncedQuery = useDebounce(query, 180)
  const deferredQuery = React.useDeferredValue(debouncedQuery)
  const [isPending, startTransition] = React.useTransition()

  // focus when opened
  React.useEffect(() => {
    if (isOpen) {
      const t = setTimeout(() => inputRef.current?.focus(), 320)
      return () => clearTimeout(t)
    }
  }, [isOpen])

  const handleOpen = React.useCallback(() => {
    setIsOpen(true)
    window.scrollTo({ top: 0, behavior: "smooth" })
  }, [])
  const handleClose = React.useCallback(() => {
    setIsOpen(false)
    setQuery("")
  }, [])

  // — DSA search with cache & ranking —
  const [searchState, setSearchState] = React.useState<{
    indices: number[]
    durationMs: number
    cached: boolean
  }>({ indices: [], durationMs: 0, cached: false })

  React.useEffect(() => {
    if (!deferredQuery.trim()) {
      setSearchState({ indices: [], durationMs: 0, cached: false })
      return
    }
    startTransition(() => {
      const res = engine.search(deferredQuery)
      setSearchState(res)
    })
  }, [deferredQuery, engine])

  const filteredRecords = React.useMemo(
    () => searchState.indices.map((i) => data[i]),
    [searchState.indices, data]
  )

  // pagination / virtualized (incremental reveal) — avoids rendering 400 cards at once
  const [visibleCount, setVisibleCount] = React.useState(PAGE_SIZE)
  React.useEffect(() => {
    setVisibleCount(PAGE_SIZE)
  }, [deferredQuery])
  const visibleRecords = React.useMemo(
    () => filteredRecords.slice(0, visibleCount),
    [filteredRecords, visibleCount]
  )
  const canLoadMore = visibleCount < filteredRecords.length
  const sentinelRef = React.useRef<HTMLDivElement>(null)
  React.useEffect(() => {
    if (!canLoadMore || !sentinelRef.current) return
    const el = sentinelRef.current
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setVisibleCount((c) => Math.min(c + PAGE_SIZE, filteredRecords.length))
        }
      },
      { rootMargin: "200px" }
    )
    io.observe(el)
    return () => io.disconnect()
  }, [canLoadMore, filteredRecords.length])

  const qLower = query.trim().toLowerCase()
  const showResults = qLower.length > 0
  const isSearching = isPending || debouncedQuery !== deferredQuery

  // stats memoized
  const total = data.length
  const brands = React.useMemo(() => new Set(data.map((d) => d.Brand)).size, [data])
  const substrates = React.useMemo(() => new Set(data.map((d) => d.Subtrate)).size, [data])

  return (
    <div className="min-h-screen bg-background">
      {/* Top shimmer progress bar when indexing/searching */}
      <div className="fixed top-0 inset-x-0 h-[2px] z-50 pointer-events-none">
        <div
          className={cn(
            "h-full bg-gradient-to-r from-primary via-zinc-400 to-primary bg-[length:200%_100%] transition-opacity duration-300",
            isInitialLoading || isSearching ? "opacity-100 animate-[shimmer_1.2s_ease_infinite]" : "opacity-0"
          )}
        />
      </div>

      {/* Sticky Top Search Bar — ultra-smooth: transform+opacity only, spring easing, GPU accelerated */}
      <div
        className={cn(
          "sticky top-0 z-40 w-full border-b bg-background/80 backdrop-blur-xl supports-[backdrop-filter]:bg-background/60 will-change-transform transform-gpu",
          "transition-[transform,opacity] duration-[650ms] ease-[cubic-bezier(0.16,1,0.3,1)]",
          isOpen ? "translate-y-0 opacity-100 pointer-events-auto" : "translate-y-[-105%] opacity-0 pointer-events-none"
        )}
        aria-hidden={!isOpen}
      >
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3 py-3 sm:py-4">
            <div className="hidden sm:flex items-center gap-2 shrink-0">
              <div className="size-8 rounded-lg bg-primary text-primary-foreground grid place-items-center text-sm font-bold">W</div>
              <span className="text-sm font-semibold tracking-tight hidden lg:inline">Weight Chart 2026</span>
            </div>

            <div className="relative flex-1 max-w-3xl mx-auto w-full">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="8" />
                  <path d="m21 21-4.3-4.3" />
                </svg>
              </span>

              <Input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by Brand, Substrate, Ticket, Count, Meter, Weight…"
                className="pl-10 pr-10 h-11 sm:h-12 rounded-full bg-muted/50 border-muted text-[15px] shadow-sm focus-visible:ring-2 focus-visible:ring-primary/20 placeholder:text-muted-foreground/70"
              />
              {query ? (
                <button
                  onClick={() => setQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 size-7 grid place-items-center rounded-full bg-muted hover:bg-muted/80 text-muted-foreground transition-colors"
                  aria-label="Clear search"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M18 6 6 18" />
                    <path d="m6 6 12 12" />
                  </svg>
                </button>
              ) : isSearching ? (
                <span className="absolute right-3 top-1/2 -translate-y-1/2 size-7 grid place-items-center">
                  <span className="size-4 rounded-full border-2 border-muted-foreground/30 border-t-primary animate-spin" />
                </span>
              ) : null}
            </div>

            <Button variant="ghost" size="sm" onClick={handleClose} className="shrink-0 rounded-full hidden sm:inline-flex">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 6 6 18" />
                <path d="m6 6 12 12" />
              </svg>
              Close
            </Button>
            <Button variant="ghost" size="icon" onClick={handleClose} className="sm:hidden rounded-full shrink-0" aria-label="Close search">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 6 6 18" />
                <path d="m6 6 12 12" />
              </svg>
            </Button>
          </div>

          {showResults && (
            <div className="flex items-center gap-2 pb-3 text-xs text-muted-foreground overflow-x-auto scrollbar-none animate-in fade-in duration-300">
              <span className="whitespace-nowrap flex items-center gap-1.5">
                {isSearching ? (
                  <span className="inline-block size-3 rounded-full border-2 border-muted-foreground/30 border-t-primary animate-spin" />
                ) : (
                  <span className={cn("size-2 rounded-full", searchState.cached ? "bg-amber-500" : "bg-emerald-500")} />
                )}
                {filteredRecords.length} result{filteredRecords.length !== 1 ? "s" : ""} for{" "}
                <span className="font-medium text-foreground">&quot;{deferredQuery}&quot;</span>
                {searchState.cached ? (
                  <Badge variant="secondary" className="ml-1 rounded-full text-[10px] px-1.5 py-0">
                    cached
                  </Badge>
                ) : (
                  <span suppressHydrationWarning className="hidden sm:inline text-[11px]">• {mounted ? `${searchState.durationMs.toFixed(1)}ms` : "…"} DSA</span>
                )}
              </span>
              <span className="hidden sm:inline text-border">•</span>
              <span className="whitespace-nowrap hidden sm:inline">
                Trie + Inverted Index • {visibleRecords.length}/{filteredRecords.length} shown
              </span>
              {query && (
                <button onClick={() => setQuery("")} className="ml-auto sm:ml-2 shrink-0 text-xs underline decoration-dotted underline-offset-4 hover:text-foreground">
                  Clear
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      <div className={cn("transition-[padding] duration-[650ms] ease-[cubic-bezier(0.16,1,0.3,1)]", isOpen ? "pt-2 sm:pt-6" : "pt-0")}>
        {/* Hero — grid row animation for perfectly smooth height collapse (no max-h jank), transform+opacity only */}
        <div
          className={cn(
            "mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 grid will-change-transform transform-gpu transition-[grid-template-rows,opacity] duration-[750ms] ease-[cubic-bezier(0.16,1,0.3,1)]",
            isOpen ? "grid-rows-[0fr] opacity-0 pointer-events-none" : "grid-rows-[1fr] opacity-100"
          )}
          style={{ gridTemplateRows: isOpen ? "0fr" : "1fr" }}
        >
          <div className="overflow-hidden">
            <div
              className={cn(
                "will-change-transform transform-gpu transition-[transform,opacity] duration-[700ms] ease-[cubic-bezier(0.16,1,0.3,1)]",
                isOpen ? "-translate-y-8 scale-[0.98] opacity-0" : "translate-y-0 scale-100 opacity-100"
              )}
            >
          <div className="relative overflow-hidden rounded-[2rem] sm:rounded-[2.5rem] border bg-gradient-to-b from-muted/50 via-background to-background mt-6 sm:mt-10">
            <div className="absolute inset-0 bg-[linear-gradient(to_right,#8080800a_1px,transparent_1px),linear-gradient(to_bottom,#8080800a_1px,transparent_1px)] bg-[size:24px_24px] sm:bg-[size:32px_32px]" />
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-border to-transparent" />

            <div className="relative px-6 py-10 sm:px-10 sm:py-16 lg:px-16 lg:py-20 flex flex-col items-center text-center">
              <Badge suppressHydrationWarning variant="secondary" className="rounded-full px-3 py-1 text-xs font-medium gap-1.5">
                <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
                2026 • 400 records • JSON only • DSA indexed in {mounted ? `${engine.buildMs.toFixed(0)}ms` : "…"}
              </Badge>

              <h1 className="mt-6 text-[28px] sm:text-5xl lg:text-[56px] font-bold tracking-tight leading-[1.05] max-w-3xl">
                Weight Chart <span className="bg-gradient-to-r from-primary to-zinc-500 bg-clip-text text-transparent">Explorer</span>
              </h1>
              <p className="mt-4 max-w-2xl text-[14px] sm:text-base leading-6 sm:leading-7 text-muted-foreground">
                Instantly search every Article Ticket, Brand, Substrate, Count, Meter & Cone Weight. No database — powered by
                <code className="px-1.5 py-0.5 rounded bg-muted text-foreground text-xs">Weight_Chart_2026_ALL_DATA.json</code> with Trie + Inverted Index.
              </p>

              <div className="mt-8 sm:mt-10 flex flex-col items-center gap-4">
                <button
                  onClick={handleOpen}
                  className="group relative inline-flex items-center justify-center gap-3 rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/25 hover:bg-primary/90 active:scale-[0.97] hover:scale-[1.015] px-8 py-4 sm:px-10 sm:py-5 text-base sm:text-lg font-semibold will-change-transform transform-gpu transition-[transform,box-shadow,background] duration-[380ms] ease-[cubic-bezier(0.16,1,0.3,1)]"
                >
                  <span className="size-9 sm:size-10 rounded-full bg-white/15 grid place-items-center group-hover:bg-white/20 transition-colors duration-300">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="11" cy="11" r="7" />
                      <path d="m20 20-3.5-3.5" />
                    </svg>
                  </span>
                  Search Chart
                  <span className="hidden sm:inline-flex items-center gap-1 text-xs font-normal opacity-70 ml-1">↵</span>
                  <span className="absolute -right-1 -top-1 size-3 bg-emerald-500 rounded-full ring-4 ring-background animate-pulse hidden sm:block" />
                </button>
                <p className="text-xs sm:text-sm text-muted-foreground flex items-center gap-2">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8z" />
                    <path d="M12 8v-2" />
                    <path d="M12 18v-2" />
                  </svg>
                  Click to smoothly reveal DSA search at top
                </p>
              </div>

              <div className="mt-10 sm:mt-12 grid grid-cols-3 gap-3 sm:gap-4 w-full max-w-2xl">
                {[
                  { label: "Total Entries", value: total.toLocaleString() },
                  { label: "Brands", value: brands.toString() },
                  { label: "Substrates", value: substrates.toString() },
                ].map((s) => (
                  <div key={s.label} className="rounded-2xl border bg-card px-3 py-4 sm:px-6 sm:py-5 text-center shadow-sm">
                    <div className="text-xl sm:text-2xl font-bold tracking-tight">{s.value}</div>
                    <div className="text-[10px] sm:text-xs font-medium uppercase tracking-widest text-muted-foreground mt-1">{s.label}</div>
                  </div>
                ))}
              </div>

              <div className="mt-8 flex flex-wrap justify-center gap-2 max-w-2xl">
                <span className="text-xs text-muted-foreground w-full text-center mb-1">Try DSA prefix search:</span>
                {["Epic", "Tiger", "RPCA", "EV3H080", "0087X02", "5000M"].map((hint) => (
                  <button
                    key={hint}
                    onClick={() => {
                      handleOpen()
                      setTimeout(() => setQuery(hint), 350)
                    }}
                    className="rounded-full border bg-background px-3 py-1.5 text-xs font-medium hover:bg-muted transition-colors"
                  >
                    {hint}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* preview grid with smooth skeleton */}
          <div className="mt-6 sm:mt-8">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold tracking-tight">Preview — first 6 records</h2>
              <span className="text-xs text-muted-foreground">Indexed • Tap search to explore all</span>
            </div>
            {isInitialLoading ? (
              <SearchSkeletonGrid count={6} />
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {data.slice(0, 6).map((row, i) => (
                  <Card
                    key={i}
                    className="overflow-hidden hover:shadow-md will-change-transform transform-gpu transition-[transform,box-shadow] duration-[400ms] ease-[cubic-bezier(0.16,1,0.3,1)] animate-[card-enter_560ms_cubic-bezier(0.16,1,0.3,1)_both]"
                    style={{ animationDelay: `${i * 55}ms` }}
                  >
                    <CardContent className="p-4 sm:p-5 space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <Badge variant="secondary" className="rounded-full text-[11px]">
                          {row.Subtrate}
                        </Badge>
                        <span className="text-[11px] font-mono text-muted-foreground">{row["Article Ticket"]}</span>
                      </div>
                      <div>
                        <div className="font-semibold leading-tight text-sm">{row.Brand}</div>
                        <div className="text-xs text-muted-foreground font-mono mt-1">
                          {row.Count} • {row.Meter}
                        </div>
                      </div>
                      <div className="flex items-center justify-between pt-2 border-t">
                        <span className="text-xs text-muted-foreground">Cone Weight</span>
                        <span className="text-sm font-bold">{row["Cone Weight"]}g</span>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
            </div>
          </div>
        </div>

        {/* Results Section — ultra-smooth fade + lift, spring easing, GPU only */}
        <div
          className={cn(
            "will-change-transform transform-gpu transition-[opacity,transform] duration-[650ms] ease-[cubic-bezier(0.16,1,0.3,1)]",
            isOpen ? "opacity-100 translate-y-0" : "opacity-0 translate-y-3 pointer-events-none"
          )}
        >
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 pb-10 sm:pb-16">
          {!isOpen ? null : !showResults ? (
            <div className="mt-6 sm:mt-10 animate-in fade-in slide-in-from-top-2 duration-500">
              <Card className="border-dashed">
                <CardContent className="py-14 sm:py-20 text-center px-6">
                  <div className="mx-auto size-12 rounded-2xl bg-muted grid place-items-center mb-4 animate-pulse">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
                      <circle cx="11" cy="11" r="7" />
                      <path d="m20 20-3.5-3.5" />
                      <path d="M11 8v6" />
                      <path d="M8 11h6" />
                    </svg>
                  </div>
                  <h3 className="font-semibold">Start typing to search</h3>
                  <p className="text-sm text-muted-foreground mt-2 max-w-md mx-auto">
                    DSA engine: Trie prefix + Inverted Index + LRU cache. Search across every field — Substrate, Brand, Ticket, Count, Meter, Weight.
                  </p>
                  <div className="mt-6 flex flex-wrap justify-center gap-2">
                    {["Astra", "Gramax ECV", "3755120", "RMPA", "Dymax"].map((s) => (
                      <button
                        key={s}
                        onClick={() => setQuery(s)}
                        className="text-xs rounded-full bg-muted hover:bg-muted/80 px-3 py-1.5 font-medium transition-colors"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </CardContent>
              </Card>
              <div className="mt-6 flex items-center justify-between">
                <p className="text-xs text-muted-foreground">Type at least 1 character • 400 records indexed • O(K) search</p>
                <span className="text-xs text-muted-foreground hidden sm:inline">{total} total</span>
              </div>
            </div>
          ) : filteredRecords.length === 0 ? (
            <Card className="mt-6 sm:mt-8 animate-in fade-in duration-300">
              <CardContent className="py-12 text-center">
                <div className="mx-auto size-12 rounded-full bg-muted grid place-items-center mb-4 text-muted-foreground">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
                    <circle cx="11" cy="11" r="8" />
                    <path d="m21 21-4.3-4.3" />
                  </svg>
                </div>
                <h3 className="font-semibold">No results for &quot;{deferredQuery}&quot;</h3>
                <p className="text-sm text-muted-foreground mt-1">Try prefix search — e.g. &quot;Epi&quot; for Epic, &quot;EV3&quot; for tickets.</p>
                <Button variant="outline" size="sm" className="mt-4 rounded-full" onClick={() => setQuery("")}>
                  Clear search
                </Button>
              </CardContent>
            </Card>
          ) : (
            <>
              <div className="mt-4 sm:mt-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-in fade-in duration-300">
                <h2 className="text-sm font-semibold">
                  Showing <span className="text-primary">{visibleRecords.length}</span> of {filteredRecords.length} records
                  {isSearching && <span className="ml-2 text-xs font-normal text-muted-foreground">• searching…</span>}
                </h2>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="hidden sm:inline">DSA ranked • Responsive cards & table</span>
                  <Badge suppressHydrationWarning variant="outline" className="rounded-full font-mono text-[11px]">
                    {searchState.cached ? "cached" : mounted ? `${searchState.durationMs.toFixed(1)}ms` : "…"}
                  </Badge>
                </div>
              </div>

              {/* searching skeleton overlay */}
              {isSearching ? (
                <div className="mt-4">
                  <SearchSkeletonGrid count={6} />
                </div>
              ) : (
                <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                  {visibleRecords.map((row, idx) => (
                    <div key={`${row["Article Ticket"]}-${idx}`} className="animate-in fade-in slide-in-from-bottom-1 duration-400 will-change-transform">
                      <RecordCard row={row} query={deferredQuery} index={idx} />
                    </div>
                  ))}
                </div>
              )}

              {/* infinite scroll sentinel + load more */}
              {canLoadMore && !isSearching && (
                <>
                  <div ref={sentinelRef} className="h-4" />
                  <div className="mt-6 flex justify-center">
                    <Button
                      variant="outline"
                      onClick={() => setVisibleCount((c) => Math.min(c + PAGE_SIZE, filteredRecords.length))}
                      className="rounded-full"
                    >
                      Load more ({filteredRecords.length - visibleCount} remaining)
                    </Button>
                  </div>
                </>
              )}

              {/* Desktop Table — paginated same as cards, but cap at 100 for perf */}
              {!isSearching && (
                <div className="hidden lg:block mt-8 rounded-2xl border bg-card overflow-hidden animate-in fade-in duration-500">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-muted/50 border-b text-xs uppercase tracking-widest text-muted-foreground">
                        <tr>
                          <th className="text-left font-medium px-4 py-3">Substrate</th>
                          <th className="text-left font-medium px-4 py-3">Brand</th>
                          <th className="text-left font-medium px-4 py-3 font-mono normal-case tracking-normal">Article Ticket</th>
                          <th className="text-left font-medium px-4 py-3">Count</th>
                          <th className="text-left font-medium px-4 py-3">Meter</th>
                          <th className="text-right font-medium px-4 py-3">Cone Weight</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {visibleRecords.slice(0, 100).map((row, i) => (
                          <tr key={`tbl-${i}`} className="hover:bg-muted/30 transition-colors">
                            <td className="px-4 py-3 font-mono text-xs">
                              <Badge variant="secondary" className="rounded-full text-[11px]">
                                {row.Subtrate}
                              </Badge>
                            </td>
                            <td className="px-4 py-3 font-medium">{row.Brand}</td>
                            <td className="px-4 py-3 font-mono text-xs">{row["Article Ticket"]}</td>
                            <td className="px-4 py-3 font-mono text-xs">{row.Count}</td>
                            <td className="px-4 py-3 font-mono text-xs">{row.Meter}</td>
                            <td className="px-4 py-3 text-right font-semibold">{row["Cone Weight"]}g</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {filteredRecords.length > visibleRecords.length && (
                    <div className="px-4 py-3 text-xs text-center text-muted-foreground border-t bg-muted/30">
                      Table shows {Math.min(visibleRecords.length, 100)} • Scroll or Load more for rest
                    </div>
                  )}
                </div>
              )}

              <p suppressHydrationWarning className="mt-6 text-center text-xs text-muted-foreground">
                No database • DSA • Direct from <code className="bg-muted px-1 py-0.5 rounded">Weight_Chart_2026_ALL_DATA.json</code> • {filteredRecords.length} matches in{" "}
                {mounted ? `${searchState.durationMs.toFixed(1)}ms` : "…"} {searchState.cached ? "(cached)" : ""}
              </p>
            </>
          )}
        </div>
        </div>
      </div>

      <footer className="border-t mt-auto py-6">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-muted-foreground">
          <span>© 2026 Weight Chart Explorer • DSA Trie + Inverted Index • shadcn/ui</span>
          <span suppressHydrationWarning className="flex items-center gap-2">
            <span className="size-2 bg-emerald-500 rounded-full animate-pulse" /> {total} records • index {mounted ? `${engine.buildMs.toFixed(0)}ms` : "…"}
          </span>
        </div>
      </footer>
    </div>
  )
}
