/* global describe it before beforeEach afterEach */
process.env.NODE_ENV = 'test';
const chai = require('chai');
const Db = require('./db');
const Names = require('./Names');
const MongodbMocker = require('../index');

const should = chai.should();
const db = new Db();
process.env.MONGODB_URL = 'localhost:8000';

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
