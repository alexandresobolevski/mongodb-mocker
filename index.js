const path = require('path');
const portfinder = require('portfinder');
const mongodbPrebuilt = require('mongodb-prebuilt');
const mongodb = require('mongodb');
const { promisify } = require('util');

const { MongoClient } = mongodb;
const getPort = promisify(portfinder.getPort);
const localhost = '127.0.0.1';

const defaultConfig = {
  host: localhost,
  dbPath: path.join(__dirname, './.data'),
  storageEngine: 'ephemeralForTest',
  autoShutdown: true,
  started: false,
  port: 8001,
  maxRetries: 5,
  shutDownWait: 100,
};

class mongoDbMockedServer {
  constructor(opts = {}) {
    this.config = Object.assign(defaultConfig, opts);
    this.mongoClient = opts.mongoClient || MongoClient;
    this.connectionsCache = {};
    this.serverEmitter = null;
    this.clients = [];
  }

  async startMongoServer(retries = 0, cb) {
    try {
      let { port } = this.config;
      if (!port) {
        port = await getPort();
      }

      this.config.port = port;
      const {
        storageEngine,
        host,
        dbPath,
        maxRetries,
        autoShutdown,
      } = this.config;

      const serverParams = {
        args: {
          storageEngine,
          bind_ip: host,
          port,
          dbpath: dbPath,
        },
        auto_shutdown: autoShutdown,
      };

      this.serverEmitter = mongodbPrebuilt.start_server(serverParams, (error) => {
        if (error === 'EADDRINUSE' && retries < maxRetries) {
          setTimeout(() => this.startMongoServer(retries + 1, cb), 200);
          return null;
        }
        if (error) {
          return cb(error);
        }
        this.config.started = true;
        return cb();
      });
    } catch (e) {
      cb(e);
    }
  }


  // Mainly a wrapper of startMongoServer that recursively tries to
  // start the server until a max nb of tries is reached
  start() {
    return new Promise((res, rej) => this.startMongoServer(0, (err) => {
      if (err) {
        return rej(err);
      }
      return res(this.config);
    }));
  }

  async addConnection(dbName) {
    try {
      if (!this.config.started) {
        throw new Error('can not add connection if server is not started');
      }
      const { host, port } = this.config;
      const uri = `mongodb://${host}:${port}/${dbName}`;
      const client = await this.mongoClient.connect(uri);
      this.clients.push(client);
      const conn = client.db(dbName);
      this.connectionsCache[dbName] = conn;
      return conn;
    } catch (e) {
      throw new Error(`failed to add connection ${e}`);
    }
  }

  async getConnection(dbName) {
    try {
      // Since mongodb 3+, database name is required
      // If connection to database is cached return it
      if (this.connectionsCache[dbName]) {
        return this.connectionsCache[dbName];
      }

      // If we do not have a configuration, start the server
      if (!this.config.started) {
        await this.start();
      }

      // Set new config if needed, add new connection and return
      const conn = await this.addConnection(dbName);
      return conn;
    } catch (e) {
      throw new Error(`failed to get connection ${e}`);
    }
  }

  // TODO:
  // reset() {}

  async shutDown() {
    try {
      if (this.serverEmitter) {
        this.serverEmitter.emit('mongoShutdown');
        this.config.started = false;
      }

      // Let the event propagate and close the server before deleting clients
      await new Promise(r => setTimeout(r, this.config.shutDownWait));
      const closePromises = [];
      const clients = this.clients.splice(0);
      clients.forEach((client) => {
        if (client.close) {
          closePromises.push(client.close());
        }
      });
      await Promise.all(closePromises);

      this.serverEmitter = null;
      this.connectionsCache = {};
      return null;
    } catch (e) {
      throw new Error(`failed to shutdown database ${e}`);
    }
  }
}

module.exports = mongoDbMockedServer;
