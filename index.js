const path = require('path');
const portfinder = require('portfinder');
const mongodbPrebuilt = require('mongodb-prebuilt');
const mongodb = require('mongodb');
const { promisify } = require('util');

const { MongoClient } = mongodb;
const getPort = promisify(portfinder.getPort);
const localhost = '127.0.0.1';

class mongoDbMockedServer {
  constructor(opts = {}) {
    this.config = opts.config || null;
    this.maxRetries = opts.maxRetries || 5;
    this.mongoClient = opts.mongoClient || MongoClient;
    this.connectionsCache = {};
    this.serverEmitter = null;
    this.clients = [];
  }

  getConfig() {
    if (!this.config) {
      return this.start();
    }
    return Promise.resolve(this.config);
  }

  startMongoServer(retries = 0, cb) {
    getPort()
      .then((port) => {
        const config = { host: localhost, port };
        const serverParams = {
          args: {
            storageEngine: 'ephemeralForTest',
            bind_ip: config.host,
            port: config.port,
            dbpath: path.join(__dirname, './.data'),
          },
          auto_shutdown: true,
        };
        this.serverEmitter = mongodbPrebuilt.start_server(serverParams, (error) => {
          if (error === 'EADDRINUSE' && retries < this.maxRetries) {
            setTimeout(() => this.startMongoServer(retries + 1, cb), 200);
            return;
          }
          this.config = config;
          cb(error, config);
        });
      })
      .catch(e => cb(e));
  }

  // Mainly a wrapper of startMongoServer
  start() {
    return new Promise((resolve, reject) => this.startMongoServer(0, (err, config) => {
      if (err) { return reject(err); }
      if (Object.keys(config).length < 1) {
        return reject(new Error('Received empty configuration object'));
      }
      return resolve(config);
    }));
  }

  addConnection(dbName) {
    return new Promise((resolve, reject) => {
      if (!this.config) {
        reject(new Error('Can not add connection if server is not started'));
      }
      const { host, port } = this.config;
      const uri = `mongodb://${host}:${port}/${dbName}`;

      this.mongoClient.connect(uri, (error, client) => {
        this.clients.push(client);
        const conn = client.db(dbName);
        if (error) { return reject(error); }
        this.connectionsCache[dbName] = conn;
        return resolve(conn);
      });
    });
  }

  getConnection(dbName = 'test') {
    // Since mongodb 3+, database name is required
    return new Promise((resolve, reject) => {
      // If connection to database is cached return it
      if (this.connectionsCache[dbName]) {
        return resolve(this.connectionsCache[dbName]);
      }

      return Promise.resolve()
        // If we do not have a configuration, start the server
        .then(() => {
          if (this.config) {
            return Promise.resolve();
          }
          return this.start();
        })
        // Set new config if needed, add new connection and return
        .then((newConfig) => {
          if (newConfig) {
            this.config = newConfig;
          }
          return this.addConnection(dbName);
        })
        .then(conn => resolve(conn))
        .catch(e => reject(e));
    });
  }

  // TODO:
  // Method to delete all collection records in the database dbName connection
  // If dbName = null, delete all collections in all connections in cache
  // reset(dbName = null) {
  // }

  shutDown() {
    return new Promise((resolve, reject) => {
      if (this.serverEmitter) {
        this.serverEmitter.emit('mongoShutdown');
      }

      // Let the event propagate and close the server before deleting
      setTimeout(() => {
        const closePromises = [];
        const clients = this.clients.splice(0);
        clients.forEach((client) => {
          if (client.close) { closePromises.push(client.close()); }
        });
        return Promise.all(closePromises).then(() => {
          this.serverEmitter = null;
          this.config = null;
          this.connectionsCache = {};
          return resolve();
        }).catch(e => reject(e));
      }, 100);
    });
  }
}

module.exports = mongoDbMockedServer;
