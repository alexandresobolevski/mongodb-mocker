/* global describe it before afterEach */
/* eslint no-unused-expressions: "off" */
const chai = require('chai');
const sinon = require('sinon');
const MongodbMocker = require('./');
const mongodbPrebuilt = require('mongodb-prebuilt');

const should = chai.should();
let mongodbMocker;
let dbConnection;
let stubbedMethod;

describe('MongodbMocker', () => {
  before(() => {
    mongodbMocker = new MongodbMocker();
  });

  afterEach(() => mongodbMocker.shutDown());

  afterEach(() => {
    if (stubbedMethod && stubbedMethod.restore) {
      stubbedMethod.restore();
    }
  });

  describe('.startMongoServer', () => {
    it('catches an error coming from obtainig a free port', () =>
      mongodbMocker.startMongoServer(0, (err) => {
        if (err) { throw new Error(err); }
        should.exist(mongodbMocker.config);
        mongodbMocker.config.started.should.be.true;
        return Promise.resolve();
      }));
  });

  describe('.start', () => {
    it('creates an in memory mongodb server and returns its config object', async () => {
      await mongodbMocker.start();
      mongodbMocker.config.started.should.be.true;
      mongodbMocker.config.should.be.an('object');
      mongodbMocker.config.should.have.property('port');
      mongodbMocker.config.should.have.property('host');
      mongodbMocker.config.host.should.equal('127.0.0.1');
    });

    it('retires to connect a default of 5 times if the server is in use, ' +
      'returns error if unsuccessful after 5 tries', async () => {
      stubbedMethod = sinon.stub(mongodbPrebuilt, 'start_server');
      stubbedMethod.yields('EADDRINUSE');
      try {
        await mongodbMocker.start();
      } catch (e) {
        e.should.equal('EADDRINUSE');
        mongodbMocker.config.started.should.be.false;
      }
    });

    it('retires to connect a default of 5 times if the server is in use', async () => {
      stubbedMethod = sinon.stub(mongodbPrebuilt, 'start_server');
      stubbedMethod.onCall(0).yields('EADDRINUSE');
      stubbedMethod.onCall(1).yields('EADDRINUSE');
      stubbedMethod.onCall(2).yields('EADDRINUSE');
      stubbedMethod.onCall(3).yields('EADDRINUSE');
      stubbedMethod.onCall(4).yields(null);
      await mongodbMocker.start();
      mongodbMocker.config.should.be.an('object');
      mongodbMocker.config.started.should.be.true;
      mongodbMocker.config.should.have.property('port');
      mongodbMocker.config.should.have.property('host');
      mongodbMocker.config.host.should.equal('127.0.0.1');
    });
  });


  describe('.getConnection', () => {
    it('starts an in memory mongodb server, and creates a connection ' +
        'to provided database, returns its connection which can be used ' +
        'to store documents', async () => {
      await mongodbMocker.start();
      const conn = await mongodbMocker.getConnection('some-database');
      should.exist(conn);
      should.exist(conn.s.databaseName);
      conn.s.databaseName.should.equal('some-database');
      dbConnection = conn;
      await conn.collection('new-collection').insertMany([{ foo: 'bar' }, { foo: 'biz' }]);
      const docs = await dbConnection.collection('new-collection').find({}, { fields: { _id: 0 } }).toArray();
      should.exist(docs);
      docs.length.should.equal(2);
      should.exist(mongodbMocker.connectionsCache['some-database']);
      docs.should.deep.equal([{ foo: 'bar' }, { foo: 'biz' }]);
    });

    it('does not start an in memory mongodb server if alredy started, ' +
        'simply creates a connection to provided database', async () => {
      await mongodbMocker.start();
      stubbedMethod = sinon.stub(mongodbMocker, 'start');
      const conn = await mongodbMocker.getConnection('some-database');
      should.exist(conn);
      should.exist(conn.s.databaseName);
      should.exist(mongodbMocker.connectionsCache['some-database']);
      conn.s.databaseName.should.equal('some-database');
      mongodbMocker.start.called.should.be.false;
    });

    it('does not start an in memory mongodb server if alredy started, ' +
        'if connection to provided database was already created, ' +
        'simply return it from the cache', async () => {
      await mongodbMocker.start();
      let conn = await mongodbMocker.getConnection('some-database');
      stubbedMethod = sinon.stub(mongodbMocker, 'start');
      mongodbMocker.addConnection = sinon.spy();
      conn = await mongodbMocker.getConnection('some-database');
      should.exist(conn);
      should.exist(conn.s.databaseName);
      conn.s.databaseName.should.equal('some-database');
      should.exist(mongodbMocker.connectionsCache['some-database']);
      mongodbMocker.start.called.should.be.false;
      mongodbMocker.addConnection.called.should.be.false;
    });
  });
});
