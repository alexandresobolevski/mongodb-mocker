const mongoose = require('mongoose'); //eslint-disable-line

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
