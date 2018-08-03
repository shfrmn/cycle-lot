import xs from "xstream"
import isolate from "@cycle/isolate"

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

export const Collection = Lot

export function Lot<So, T>(
  Component: Component<So, Si<T>>,
  add$: xs<So | So[]>
): Lot<T>
export function Lot<So, T>(
  Component: Component<So, Si<T>>,
  add$: xs<So | So[]>,
  reset$: xs<any>
): Lot<T>
export function Lot<So, T>(
  Component: Component<So, Si<T>>,
  add$: xs<So | So[]>,
  remove_prop: keyof T
): Lot<T>
export function Lot<So, T>(
  Component: Component<So, Si<T>>,
  add$: xs<So | So[]>,
  reset$: xs<any>,
  remove_prop: keyof T
): Lot<T>
export function Lot<So, T>(
  Component: Component<So, Si<T>>,
  add$: xs<So | So[]>,
  ...remove: (xs<any> | keyof T)[]
): Lot<T> {
  let reset$: xs<any>
  let remove_prop: (keyof T) | undefined = undefined

  if (typeof remove[0] === "object") {
    reset$ = remove[0] as xs<any>
  } else {
    reset$ = xs.empty()
    remove_prop = remove[0] as keyof T
  }

  if (remove[1]) {
    remove_prop = remove[1] as keyof T
  }

  const growing_component$_list$ = add$
    .map((sources) => (Array.isArray(sources) ? sources : [sources]))
    .fold(
      (prev_sinks$_list, sources) => {
        const sinks_list = sources.map((sources) => {
          return (isolate(Component) as Component<So, Si<T>>)(sources)
        })

        const sinks$_list: xs<Si<T> | undefined>[] = sinks_list.map((sinks) => {
          if (remove_prop) {
            return xs
              .merge(sinks[remove_prop].take(1), xs.never())
              .mapTo(undefined as Si<T> | undefined)
              .startWith(sinks)
          } else {
            return xs.of(sinks)
          }
        })

        return prev_sinks$_list.concat(sinks$_list)
      },
      [] as xs<Si<T> | undefined>[]
    )

  const component$_list$ = reset$
    .startWith(undefined)
    .mapTo(growing_component$_list$)
    .flatten()

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
