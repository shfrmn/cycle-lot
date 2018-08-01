import xs from "xstream"

type Component<So, Si> = (sources: So, ...rest: any[]) => Si
type Si<T> = {[P in keyof T]: xs<T[P]>}

export function pickMerge<T, P extends keyof T>(
  sink_list: Si<T>[],
  prop: P
): xs<T[P]> {
  return xs.merge(...sink_list.map((sinks) => sinks[prop]))
}

export function pickCombine<T, P extends keyof T>(
  sink_list: Si<T>[],
  prop: P
): xs<T[P][]> {
  return xs.combine(...sink_list.map((sinks) => sinks[prop]))
}

type MergeAll<T> = {[P in keyof T]: xs<T[P]>}
type CombineAll<T> = {[P in keyof T]: xs<T[P][]>}

interface Lot<T> {
  merge: MergeAll<T>
  combine: CombineAll<T>
}

export function Collection<So, T>(
  Component: Component<So, Si<T> & {destroy$?: xs<undefined>}>,
  add$: xs<So | So[]>
): Lot<T> {
  const component$_list$ = add$.fold(
    (prev_sinks$_list, sources) => {
      const sources_list = Array.isArray(sources) ? sources : [sources]

      const sinks_list = sources_list.map((sources) => {
        return Component(sources)
      })

      const sinks$_list = sinks_list.map((sinks) => {
        const component$ = sinks.destroy$
          ? xs.merge(xs.of(sinks), sinks.destroy$)
          : xs.of(sinks)

        return component$.remember()
      })

      return prev_sinks$_list.concat(sinks$_list)
    },
    [] as xs<Si<T> | undefined>[]
  )

  const sink_list$ = component$_list$
    .map((component$_list) => {
      const sink_list$ = xs
        .combine(...component$_list)
        .map((sink_list: (Si<T> | undefined)[]) => {
          return sink_list.filter((sinks) => sinks !== undefined) as Si<T>[]
        })

      return sink_list$
    })
    .flatten()

  const merge = new Proxy(
    {},
    {
      get: (lot, prop) => {
        if (lot[prop]) {
          return lot[prop]
        }

        const sink$ = sink_list$
          .map((sink_list) => pickMerge(sink_list, prop as keyof T))
          .flatten()

        lot[prop] = sink$

        return sink$
      }
    }
  ) as MergeAll<T>

  const combine = new Proxy(
    {},
    {
      get: (lot, prop) => {
        if (lot[prop]) {
          return lot[prop]
        }

        const sink$ = sink_list$
          .map((sink_list) => pickCombine(sink_list, prop as keyof T))
          .flatten()

        lot[prop] = sink$

        return sink$
      }
    }
  ) as CombineAll<T>

  return {merge, combine}
}
