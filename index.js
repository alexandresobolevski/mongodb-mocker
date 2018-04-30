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
    this.config = {
      host: localhost,
      dbPath: path.join(__dirname, './.data'),
      storageEngine: 'ephemeralForTest',
      autoShutdown: true,
      started: false,
      port: null,
      maxRetries: opts.maxRetries || 5,
    };
    this.mongoClient = opts.mongoClient || MongoClient;
    this.connectionsCache = {};
    this.serverEmitter = null;
    this.clients = [];
  }

  startMongoServer(retries = 0, cb) {
    Promise.resolve()
      .then(() => {
        if (this.config.port) {
          return Promise.resolve(this.config.port);
        }
        return getPort();
      })
      .then((port) => {
        this.config.port = port;
        const serverParams = {
          args: {
            storageEngine: this.config.storageEngine,
            bind_ip: this.config.host,
            port: this.config.port,
            dbpath: this.config.dbPath,
          },
          auto_shutdown: this.config.autoShutdown,
        };
        this.serverEmitter = mongodbPrebuilt.start_server(serverParams, (error) => {
          if (error === 'EADDRINUSE' && retries < this.config.maxRetries) {
            setTimeout(() => this.startMongoServer(retries + 1, cb), 200);
            return;
          }
          if (!error) {
            this.config.started = true;
          }
          cb(error);
        });
      })
      .catch(e => cb(e));
  }

  // Mainly a wrapper of startMongoServer
  start() {
    return new Promise((res, rej) => this.startMongoServer(0, (err) => {
      if (err) { return rej(err); }
      return res(this.config);
    }));
  }

  addConnection(dbName) {
    return new Promise((resolve, reject) => {
      if (!this.config.started) {
        reject(new Error('Can not add connection if server is not started'));
      }
      const { host, port } = this.config;
      const uri = `mongodb://${host}:${port}/${dbName}`;

      this.mongoClient.connect(uri, (error, client) => {
        if (error) { return reject(error); }
        this.clients.push(client);
        const conn = client.db(dbName);
        this.connectionsCache[dbName] = conn;
        return resolve(conn);
      });
    });
  }

  getConnection(dbName) {
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
        .then(() => this.addConnection(dbName))
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
        this.config.started = false;
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
          this.connectionsCache = {};
          return resolve();
        }).catch(e => reject(e));
      }, 100);
    });
  }
}

module.exports = mongoDbMockedServer;
