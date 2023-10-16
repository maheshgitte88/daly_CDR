// models/callData.js

const { Sequelize, DataTypes } = require('sequelize');
const sequelize = new Sequelize('cdrreport', 'root', 'root', {
  host: 'localhost',
  dialect: 'mysql',
});

const CallData = sequelize.define('CallData', {
  // Define your model fields here
  userFullName: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  date: {
    type: DataTypes.DATE,
    allowNull: false,
  },
  campaign: {
    type: DataTypes.STRING,
  },
  callType: {
    type: DataTypes.STRING,
  },
  callStatus: {
    type: DataTypes.STRING,
  },
  talkDuration: {
    type: DataTypes.INTEGER,
  },
}, {
  timestamps: false,
  tableName: 'mitcdrdely', // Adjust the table name as needed
});

module.exports = CallData;
