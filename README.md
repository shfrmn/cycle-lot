# cycle-lot

Handle dynamic lists of [Cycle.js](https://github.com/cyclejs/cyclejs) components with ease.

Differences from [@cycle/collection](https://github.com/cyclejs/collection):

- Full typescript support
- Simpler API

### Install

`npm install cycle-lot`

### Create a collection

Let's assume we have a component named `Item` with following sinks:

```typescript
interface ItemSinks {
  dom: xs<VNode>
  http: xs<RequestOptions>
  remove$: xs<any>
}
```

You can choose any stream in your sinks to trigger component's removal. Here we use a special `remove$` stream for clarity.

```typescript
import {Lot} from "cycle-lot"
```

Alternatively you can import `Collection` which is just an alias.

You can also import `pickMerge` and `pickCombine` functions, however you probably won't need them.

Here's how you use `cycle-lot`:

```typescript
function MyComponent(sources) {
  // ...

  /** Add a new item every second */
  const item_sources$ = xs
    .periodic(1000) //
    .mapTo({ // whatever sources Item requires=
      dom: sources.dom,
      item: {}
    })

  // item_sources$ could also emit arrays of sources
  // to simultaneously add multiple components

  const lot = Lot(Item, item_sources$, "remove$")

  lot.combine.dom // xs<VNode[]>
  lot.merge.http // xs<RequestOptions>

  // ...
}
```

In case it got you curious, `cycle-lot` doesn't merge and combine all available sink streams. Instead it uses [proxies](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Proxy) under the hood to provide getter-like functionality. In fact, nothing gets merged or combined unless you use it in your code. Repeated usage of the same getter will return the same stream object.
