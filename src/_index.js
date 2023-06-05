var node_pg = require('pg');
var sql = require('./sql/index.js');
var postgresql = require('./postgresql/index.js');

var Connector = require('./Connector');
var SqlBuilder = require('./SqlBuilder');

module.exports = {
    createTransactionBlock: function (context){
        return new postgresql.TransactionBlock(context);
    },
    createConnectionTransaction: function (config, events){
        return new postgresql.ConnectionTransaction(config, events);
    },
    createClient: function (config){
        return new node_pg.Client(config);
    },
    createSqlBuilder: function (session){
        return new SqlBuilder(session);
    },
    createConnector: function (config, events){
        return new Connector(config, events);
    },
    sql: sql,
    node_pg: node_pg,
    postgresql: postgresql
};