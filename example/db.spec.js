/* global describe it beforeEach afterEach */
process.env.NODE_ENV = 'test';
const chai = require('chai');
const Db = require('./db');
const Names = require('./Names');

const should = chai.should();
// const should = chai.should();
const db = new Db();

describe('Db class', () => {
  beforeEach(() => db.initialize());

  afterEach(() => db.shutDown());

  it('can save a Names record in test mode', () => Names
    .insertMany([{ name: 'MyName' }])
    .then(res => Names.findById(res[0]._id)) // eslint-disable-line
    .then((res) => {
      should.exist(res);
      res.should.be.an('object');
      res.name.should.equal('MyName');
    }));
});
