# cycle-lot

Cycle.js utility to easily handle dynamic lists of components.

- Components can remove themselves
- Full typescript support
- Simpler API than `@cycle/collection`

### Install

`npm install cycle-lot`

### Create a collection

Let's assume we have a component named `Item` with following sinks:

```typescript
interface ItemSinks {
  dom: xs<VNode>
  http: xs<RequestOptions>
  destroy$: xs<undefined> // Remove me!
}
```

Using cycle-lot we can make a collection out of it.

```typescript
function MyComponent(sources) {
  // ...
  // ...
  // ...

  /** Add a new item every second */
  const item_sources$ = xs
    .periodic(1000) //
    .mapTo({
      // whatever sources Item requires
      dom: sources.dom,
      item: {}
    })

  const collection = Collection({
    // component to instantiate
    component: Item,

    // stream of sources
    create$: task_sources$,

    // merge http sinks of all items
    merge: ["http"],

    // combine dom sinks of all items
    combine: ["dom"]
  })

  collection.dom // xs<VNode[]>
  collection.http // xs<RequestOptions>

  // ...
  // ...
  // ...
}
```
