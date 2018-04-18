const mongoose = require('mongoose'); //eslint-disable-line
const MongodbMocker = require('../');

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
