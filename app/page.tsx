import SearchExperience from "@/components/search-experience"
import rawData from "@/data/Weight_Chart_2026_ALL_DATA.json"
import type { WeightRecord } from "@/components/search-experience"

// Ensure type safety - JSON is directly imported, no DB, no fetch
const data = rawData as WeightRecord[]

export default function Home() {
  return <SearchExperience data={data} />
}
