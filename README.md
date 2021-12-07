This is example code showing a method for storing the _bare minimum_ amount of data for a user to be able to always:
- prove membership of their leaves, _and_
- calculate the tree's root from the next batch (by storing a 'frontier' of minimal tree info).

It's been thrown together quickly in common JS (sorry!) :)

## Install
`cd path-updater`
`npm i`

## Testing

We test by adding batches of leaves repeatedly and testing that, for a user's owned set of leaves, the db always contains sufficient information to prove membership.

Set test parameters by editing the global `const` values in `./test/test.js`.

Edit tree height in `./src/config`.

To run:
`npm test`

## Viewing the DB data
_After_ running the test (so that the db is populated):

From a terminal
`cd path-updater`
`node -e 'require("./src/db/dump-to-json").run()'` runs function which extracts data from the leveldb and converts it to JSON (it's not quite json, because it's a faff, but it's legible to get an idea of how little data is being stored).


## Tour

```
./src/
      update-frontier.js        <-- Calculates and stores the frontier when a new batch is added

      update-sibling-paths.js   <-- Calculates the sibling path indices (for all nodes we own) 
                                    that will need updating each time a new batch comes in.

      ./db/       <-- db read/write/dump-to-json
      ./utils/    <-- utility functions for numbers / tree calcs / hashing
```

## How does this work

To be written if there's interest in pursuing this implementation's ideas.


