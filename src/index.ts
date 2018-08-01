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

interface CollectionOptions<So, T, M extends keyof T, C extends keyof T> {
  component: Component<So, Si<T> & {destroy$?: xs<undefined>}>
  create$: xs<So | So[]>
  merge: M[]
  combine: C[]
}

type Pluck<Si, Props extends keyof Si> = {[P in Props]: Si[P]}

type Merge<T, M extends keyof T> = Pluck<{[P in keyof T]: xs<T[P]>}, M>
type Combine<T, C extends keyof T> = Pluck<{[P in keyof T]: xs<T[P][]>}, C>

export function Collection<So, T, M extends keyof T, C extends keyof T>(
  options: CollectionOptions<So, T, M, C>
): Merge<T, M> & Combine<T, C> {
  const component$_list$ = options.create$.fold(
    (prev_sinks$_list, sources) => {
      const sources_list = Array.isArray(sources) ? sources : [sources]

      const sinks_list = sources_list.map((sources) => {
        return options.component(sources)
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

  const collection_sinks = {}

  for (let prop of options.merge) {
    const sink$ = sink_list$
      .map((sink_list) => pickMerge(sink_list, prop))
      .flatten()

    collection_sinks[prop as string] = sink$
  }

  for (let prop of options.combine) {
    const sink$ = sink_list$
      .map((sink_list) => pickCombine(sink_list, prop))
      .flatten()

    collection_sinks[prop as string] = sink$
  }

  return collection_sinks as any
}
