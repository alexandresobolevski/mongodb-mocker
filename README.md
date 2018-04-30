MONGODB-MOCKER
=======

![Build Status](https://circleci.com/gh/alexandresobolevski/mongodb-mocker.png?circle-token=ff90d6d8a7e87afb41dbbb4349231c1e97c9791e)

The package *mongodb-mocker* is a class that abstracts an in-memory mongodb database. Its purpose is to aid developing of tests that use the mongodb database without writing a mock or connecting to a real database.

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

Using with Mongoose
===========

in Names.js
```javascript
const mongoose = require('mongoose');

const schema = new mongoose.Schema({
  name: {
    type: String,
    max: [50, 'Name too long (>50)'],
    min: 1,
    required: true,
  },
});

const Names = mongoose.model('names', schema);

module.exports = Names;
```

in db.js
```javascript
const mongoose = require('mongoose');

class Db {
  constructor() {
    this.mongoose = mongoose;
    this.mockedServer = null;
  }

  shutDown() {
    return this.mongoose.disconnect((e) => {
      if (e) { Promise.reject(e); }
      return Promise.resolve();
    });
  }

  initialize(dbName) {
    const url = process.env.MONGODB_URL;
    this.uri = `mongodb://${url}/${dbName}`;
    return Promise.resolve()
      .then(() => this.mongoose.connect(this.uri, (err) => {
        if (err) { return Promise.reject(err); }
        return Promise.resolve(this.mongoose.createConnection(this.uri));
      }))
      .then(conn => Promise.resolve(conn.connections[0]));
  }
}

module.exports = Db;

```

in db.spec.js
```javascript
/* global describe it before beforeEach afterEach */
process.env.NODE_ENV = 'test';
process.env.MONGODB_URL = 'localhost:8000';

const chai = require('chai');
const Db = require('./db');
const Names = require('./Names');
const MongodbMocker = require('../index');

const should = chai.should();
const db = new Db();

describe('Db class', () => {
  before(() => {
    const mongodbMocker = new MongodbMocker({ port: '8000' });
    return mongodbMocker.start();
  });

  beforeEach(() => db.initialize());

  afterEach(() => db.shutDown());

  it('can save a Names record in test mode', () => Names
    .insertMany([{ name: 'MyName' }])
    .then(res => Names.findById(res[0]._id))
    .then((res) => {
      should.exist(res);
      res.should.be.an('object');
      res.name.should.equal('MyName');
    }));
});
```

Run this example from the root of this repository
```bash
npm i
mocha ./example/db.spec.js
```
