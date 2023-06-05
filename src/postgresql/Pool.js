/**
 * Created by yangyxu on 8/20/14.
 */
var node_pg = require('pg');
var __slice = Array.prototype.slice;

module.exports = zn.Class({
    events: [
        'acquire', 
        'connection', 
        'enqueue', 
        'release', 
        'query',
        'queryError',
        'end', 
        'endError', 
        'poolNotExistError',
        'poolConnection',
        'poolConnectionError'
    ],
    properties: {
        config: null,
        pool: null
    },
    methods: {
        init: function (config, events){
            this.initPool(config);
            this.initEvents(events);
        },
        initPool: function (config){
            this._config = zn.extend({
                max: 20,
                allowExitOnIdle: true,
                idleTimeoutMillis: 30000,
                connectionTimeoutMillis: 2000
            }, config);
            this._pool = new node_pg.Pool(this._config);
            this._pool.on('error', function (err, client){
                zn.debug('Postgresql pool error: ', err);
                this.fire('error', err, client);
            }.bind(this));

            return this;
        },
        initEvents: function (events){
            if(events && typeof events == 'object'){
                for(var key in events){
                    this.on(key, events[key]);
                }
            }

            return this;
        },
        end: function (success, error){
            if(!this._pool){
                return this.fire('poolNotExistError', new Error('Mysql pool is not exist.')), this;
            }

            return this._pool.end((err)=>{
                if(err){
                    error && error(err, this);
                    this.fire('endError', err);
                }else{
                    success && success(this);
                    this.fire('end', this);
                }
            });
        },
        connect: function(success, error){
            if(!this._pool){
                return this.fire('poolNotExistError', new Error('Mysql pool is not exist.')), this;
            }

            return this._pool.connect(function (err, client, release){
                if(err){
                    error && error(err, this);
                    this.fire('poolConnectError', err);
                }else{
                    success && success(client, release, this);
                    this.fire('poolConnect', client, release);
                }
            }.bind(this)), this;
        },
        asyncConnect: async function(success, error){
            if(!this._pool){
                return this.fire('poolNotExistError', new Error('Mysql pool is not exist.')), this;
            }

            return await this._pool.connect((err, client, release) => {
                if(err){
                    error && error(err, this);
                    this.fire('poolConnectError', err);
                }else{
                    success && success(client, release, this);
                    this.fire('poolConnect', client, release);
                }
            });
        },
        query: function (success, error){
            if(!this._pool){
                return this.fire('poolNotExistError', new Error('Mysql pool is not exist.')), this;
            }
            var _argv = __slice.call(arguments),
                _sql = _argv.shift();
            if(typeof _sql == 'string' && _argv.length) _sql = _sql.format(_argv);

            return this._pool.query(_sql, (err, rows)=>{
                if(err){
                    error && error(err, this);
                    this.fire('queryError', err);
                }else {
                    success && success(rows, this);
                }
            });
        }
    }
});