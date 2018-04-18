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
const MongodbMocker = require('mongodb-mocker');


// This is what your application's database class could look like
class Db {
  constructor() {
    if (process.env.NODE_ENV === 'test') {
      this.mockedServer = new MongodbMocker();
    }
  }

  shutDown() {
    return mongoose.disconnect((e) => {
      if (e) { Promise.reject(e); }
      if (process.env.NODE_ENV === 'test') {
        return this.mockedServer.shutDown();
      }
      return Promise.resolve();
    });
  }

  startMockDb(dbName) {
    return this.mockedServer
      .getConnection(dbName)
      .then(() => this.mockedServer.getConfig())
      .then((config) => {
        // The mocked db runs locally
        const uri = `mongodb://127.0.0.1:${config.port}/test`;
        return Promise.resolve(uri);
      });
  }

  buildUri(dbName) {
    if (process.env.NODE_ENV === 'test') {
      // If we're in test mode, start an in-memory mongo mock
      return this.startMockDb(dbName).then(uri => Promise.resolve(uri));
    }
    // Otherwise we will be connecting to a real database whose
    // credentials are stored in env variables
    const url = process.env.MONGODB_URL;
    const usr = process.env.MONGODB_USR;
    const psw = process.env.MONGODB_PSW;
    const uri = `mongodb://${usr}:${psw}@${url}/${dbName}`;
    return Promise.resolve(uri);
  }

  initialize(dbName) {
    return this.buildUri(dbName)
      .then(uri => mongoose.connect(uri, (err) => {
        if (err) { return Promise.reject(err); }
        return Promise.resolve(mongoose.createConnection(uri));
      }))
      .then(conn => Promise.resolve(conn.connections[0]));
  }
}

module.exports = Db;
```

in db.spec.js
```javascript
/* global describe it beforeEach afterEach */
process.env.NODE_ENV = 'test';
const chai = require('chai');
const Db = require('./db');
const Names = require('./Names');

const should = chai.should();
const db = new Db();

describe('Db class', () => {
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
