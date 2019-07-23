# corgi

**WIP**

xlsx templater implemented using streams and fully asynchronous logic

in particular supports asynchronous tag parsing, which allows us to avoid needing to store full data as a json object into memory and instead for example query our database as things are needed

***

### notes

- instead of just a single parser, perhaps split up into three separate actions as opening a block shouldn't necessarily return all the data straight away
  - identify: returns what type it is, a block open/close or just data
  - expand(?): how many elements of the block
  - evaluate(?): get value of a data-type tag
- expand/evaluate could probably be combined?
- does expand just return a number, or some information to identify each element of the block (so that their order is well-defined)?
- how should current scope information be passed since we aren't working from a single json object?