import xs from "xstream"
import isolate from "@cycle/isolate"

type Component<So, Pr, Si> = (sources: So, props: Pr) => Si
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

interface LotOptions<So, Pr, T> {
  component: Component<So, Pr, Si<T>>
  sources: So
  add$: xs<Pr | Pr[]>
  reset$?: xs<any>
  remove_prop?: keyof T
}

export function Lot<So, Pr, T>(options: LotOptions<So, Pr, T>): Lot<T> {
  let reset$ = options.reset$ || xs.empty()

  const component$_list$ = reset$
    .startWith(undefined)
    .map(() => {
      return options.add$
        .map((props) => (Array.isArray(props) ? props : [props]))
        .fold(
          (prev_sinks$_list, props_batch) => {
            const sinks_list = props_batch.map((props) => {
              return (isolate(options.component) as Component<So, Pr, Si<T>>)(
                options.sources,
                props
              )
            })

            const sinks$_list: xs<Si<T> | undefined>[] = sinks_list.map(
              (sinks) => {
                if (options.remove_prop) {
                  return xs
                    .merge(sinks[options.remove_prop].take(1), xs.never())
                    .mapTo(undefined as Si<T> | undefined)
                    .startWith(sinks)
                } else {
                  return xs.of(sinks)
                }
              }
            )

            return prev_sinks$_list.concat(sinks$_list)
          },
          [] as xs<Si<T> | undefined>[]
        )
    })
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
