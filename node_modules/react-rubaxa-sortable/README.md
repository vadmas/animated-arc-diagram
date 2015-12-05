Sortable
---
[Sortable](https://github.com/RubaXa/Sortable) is a minimalist library for rearranging items in lists.
- [Sortable demo](http://rubaxa.github.io/Sortable/)

This library provides a Sortable React component (`ReactSortable`).
- [ReactSortable demo](https://mking.github.io/react-rubaxa-sortable/example/html/app.html)

What does `ReactSortable` do for you?
- It instantiates a Sortable object.
- It renders its children in the order specified by that Sortable object.
- It reuses DOM nodes where possible, based on child keys. While React normally does this, it does not allow
  the user to specify the order.
- This implementation is based on Pete Hunt's
  [React component for jQuery Sortable](https://gist.github.com/petehunt/7882164).

How do I use it?
---
```javascript
<ReactSortable
    // Vanilla Sortable options
    sortable={{
      // Specify the draggable cells.
      draggable: '.todoList-draggable',

      // Disable dragging on certain cells.
      filter: '.todoItem-ignore',

      // Limit the draggable area to a part of the cell.
      handle: '.todoItem-handle',

      // Receive the new order order.
      onSort: this.handleSort
    }}

    // Component name for Sortable container (optional, default "div")
    // This is instantiated as a virtual DOM node, so it can be an HTML element or
    // a React component.
    component="ul"

    // Element name for Sortable items (optional, default "div")
    // This is instantiated as an actual DOM element, so it must be an HTML element.
    childElement="div"

    // Other props are passed on to the Sortable container
    className="todoList">
  {_(this.state.todos).map(function (todo) {
    return (
      <TodoItem key={todo.id}
          className={React.addons.classSet({
            'todoItem-ignore': this.isTodoIgnored(todo)
          })}
          todo={todo}/>
    );
  }.bind(this)).value()}
</ReactSortable>
```

Callback Signature
---
- With vanilla Sortable, `this` is bound to the Sortable object, making it difficult to bind Sortable callbacks
  directly to component methods.
- With ReactSortable, `this` is bound to the React component.
```
var TodoList = React.createClass({
  handleSort: function (sortable, e) {
    // Prints child keys
    console.log('New todo order:', sortable.toArray());
  },

  render: function () {
    return (
      <ReactSortable
        sortable={{
          onSort: this.handleSort
        }}
        ...
      </ReactSortable>
    );
  }
});
```
