/**
 * Created by yangyxu on 8/20/14.
 */
var Transaction = require('./Transaction');
module.exports = zn.Class(Transaction, {
    properties: {
        pool: null
    },
    methods: {
        init: function (pool, events){
            this.setPool(pool);
        },
        setPool: function (pool){
            if(!pool){
                return this.fire('error', new Error('setPool pool is not exist.')), this;
            }
            this._pool = pool;
            pool.on('error', function (err, client){
                zn.error('Unexpected error on idle client: ', err)
            });
        },
        begin: function (before, after){
            var _self = this, _pool = this._pool;
            this._queue.push((task)=>{
                _pool.connect(function (err, client, release){
                    if(err){
                        zn.error('Transaction connect error: ', err);
                        task.error(err);
                    } else {
                        var _before = before && before.call(_self, connection, _self);
                        if(_before === false){
                            task.stop(new Error('Transcation begin: before call return false.'));
                        } else {
                            _self._client = client;
                            _self.__initConnectionEvents__();
                            task.done(client, release);
                        }
                    }
                });
            }).push(function (task, client, release){
                zn.debug('Transaction start ...... ');
                client.query('START TRANSACTION', function (err, result) {
                    var _after = after && after.call(_self, err, result, _self);
                    _self.fire('begin', [err, result], { ownerFirst: true, method: 'apply' });
                    if(err){
                        zn.error('Transaction start error: ', err);
                        task.error(err);
                    } else {
                        if(_after === false){
                            task.stop(new Error('Transcation begin: after call return false.'));
                        } else {
                            task.done(client, _after || result, release);
                        }
                    }
                });
            });

            return this;
        },
        commit: function (before, after){
            var _self = this;
            this._queue.push(function (task, client, result, release){
                var _before = before && before.call(_self, result, release, _self);
                if(_before === false){
                    task.stop(new Error('Transcation commit: before call return false.'));
                }else{
                    zn.debug('Transaction: commit');
                    client.query('COMMIT', function (err, commitResult){
                        var _after = after && after.call(_self, err, commitResult, release, _self);
                        _self.fire('commit', [err, commitResult, release], { ownerFirst: true, method: 'apply' });
                        if(err){
                            zn.error('Transaction commit error: ', err);
                            task.error(err);
                        }else {
                            if(_after === false){
                                task.stop(new Error('Transcation commit: after call return false.'));
                            } else {
                                task.done(connection, (_after || result), release);
                                _self._defer.resolve((_after || result), release);
                                _self.destroy(release);
                            }
                        }
                    });
                }
            }).start();

            return  this._defer.promise;;
        },
        rollback: function (error, callback){
            zn.error('Transaction Rollback', error);
            if(this._client){
                this._client.query('ROLLBACK', function (err, rows, fields){
                    this.fire('rollback', [err, rows, fields], { ownerFirst: true, method: 'apply' });
                    var _callback = callback && callback.call(this, err, rows, fields);
                    if(_callback === false) return;
                    if(err){
                        zn.error('Transaction Rollback Excutive', err);
                        this.fire('error', err);
                    }
                    this._defer.reject(error || err);
                    this.destroy();
                }.bind(this));
            }else{
                this._defer.reject(error);
                this.destroy();
            }
            
            return this;
        },
        destroy: function (release){
            if(this._client){
                this._client.release();
                this._client.removeAllListeners();
                this._client = null;
                delete this._client;
            }
            if(this._defer){
                this._defer.destroy();
                this._defer = null;
                delete _defer;
            }
            if(this._queue){
                this._queue.destroy();
                this._queue = null;
                delete this._queue;
            }

            release && release();

            return this.dispose(), this;
        }
    }
});
