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

function createLot<T>(
  pickF: typeof pickMerge,
  sink_list$: xs<Si<T>[]>
): MergeAll<T>
function createLot<T>(
  pickF: typeof pickCombine,
  sink_list$: xs<Si<T>[]>
): CombineAll<T>
function createLot<T>(pickF: any, sink_list$: xs<Si<T>[]>) {
  return new Proxy(
    {},
    {
      get: (lot, prop) => {
        if (lot[prop]) {
          return lot[prop]
        }

        const sink$ = sink_list$
          .map((sink_list) => pickF(sink_list, prop as keyof T))
          .flatten()

        lot[prop] = sink$

        return sink$
      }
    }
  )
}

interface Lot<T> {
  merge: MergeAll<T>
  combine: CombineAll<T>
}

export function Collection<So, T>(
  Component: Component<So, Si<T>>,
  add$: xs<So | So[]>,
  remove_prop: keyof T
): Lot<T> {
  const component$_list$ = add$.fold(
    (prev_sinks$_list, sources) => {
      const sources_list = Array.isArray(sources) ? sources : [sources]

      const sinks_list = sources_list.map((sources) => {
        return Component(sources)
      })

      const sinks$_list = sinks_list.map((sinks) => {
        const component$ = sinks[remove_prop]
          .mapTo(undefined as Si<T> | undefined)
          .startWith(sinks)

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

  const merge = createLot(pickMerge, sink_list$)
  const combine = createLot(pickCombine, sink_list$)

  return {merge, combine}
}
