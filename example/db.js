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
