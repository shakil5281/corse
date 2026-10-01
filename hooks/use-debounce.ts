import * as React from "react"

export function useDebounce<T>(value: T, delay = 220): T {
  const [debounced, setDebounced] = React.useState(value)
  React.useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(id)
  }, [value, delay])
  return debounced
}

export function useDebouncedCallback<T extends (...args: any[]) => void>(
  fn: T,
  delay = 220
): T {
  const ref = React.useRef(fn)
  React.useEffect(() => {
    ref.current = fn
  }, [fn])
  const timeout = React.useRef<number | null>(null)
  const cb = React.useCallback(
    (...args: Parameters<T>) => {
      if (timeout.current) window.clearTimeout(timeout.current)
      timeout.current = window.setTimeout(() => ref.current(...args), delay) as unknown as number
    },
    [delay]
  )
  return cb as T
}
