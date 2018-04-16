MONGODB-MOCKER
=======

![Build Status](https://circleci.com/gh/alexandresobolevski/mongodb-mocker.png?circle-token=ff90d6d8a7e87afb41dbbb4349231c1e97c9791e)

The package *mongodb-mocker* is a class that abstracts an in-memory mongodb database. It's purpose is to aid developing of tests that use the mongodb database without writing a mock or connecting to a real database.

Installation
===========

```bash
npm install --save-dev mongodb-mocker
```

Basic Usage
===========

```javascript
import MongodbMocker from 'mongodb-mocker';

const mongodbMocker = new MongodbMocker();
let dbConnection;
mongoDbServer
  .getConnection('some-database')
  .then((conn) => {
    dbConnection = conn;
    return new Promise((res, rej) => {
      dbConnection
        .collection('new-collection')
        .insertMany([{ foo: 'bar' }, { foo: 'biz' }], (err) => {
          if (err) { return rej(err); }
          return res();
        }));
  })
  .then(() => new Promise((res, rej) =>
    dbConnection
      .collection('new-collection')
      .find({}, { fields: { _id: 0 } })
      .toArray((err, docs) => {
        if (err) { return rej(err); }
        return res(docs);
      })))
  .then((docs) => {
    console.log(docs);
    // Prints
    // [{ foo: 'bar' }, { foo: 'biz' }]
  }));

```
