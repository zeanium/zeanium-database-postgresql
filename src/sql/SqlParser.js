/**
 * Created by yangyxu on 8/20/14.
 */
var VALUES = {
    DEFAULTS: {
        table: '',
        fields: '*',
        values: '',
        updates: '',
        where: '',
        order: '',
        group: '',
        limit: ''
    }
};

module.exports = zn.Class({
    events: ['parse', 'parsed', 'parseTable', 'parsedTable', 'parseGroup', 'parsedGroup', 'parseOrder', 'parsedOrder', 'parseValues', 'parsedValues', 'parseUpdates', 'parsedUpdates', 'parseFields', 'parsedFields', 'parseWhere', 'parsedWhere'],
    properties: {
        sqlBuilder: null,
        context: null
    },
    methods: {
        init: {
            auto: true,
            value: function (sqlBuilder, context){
                this._sqlBuilder = sqlBuilder;
                this._context = context || this;
            }
        },
        __firstCharUpperCase: function (value){
            return value.replace(/\b(\w)(\w*)/g, function($0, $1, $2) {
                return $1.toUpperCase() + $2;
            });
        },
        __formatSqlValue: function (value){
            switch(zn.type(value)) {
                case 'string':
                    if(value!=='now()'){
                        if(value.indexOf('{{') === 0 && value.indexOf('}}') === (value.length-2)){
                            value = value.substring(2, value.length - 2);
                        }else {
                            value = "'" + value + "'";
                        }
                    }
                    break;
                case 'array': 
                    value = "'" + value.map(function (item){
                        return item.toString();
                    }.bind(this)).join(',') + "'";
                    break;
                case 'function':
                    value = value.call(this._context);
                    break;
                case 'object':
                    value = zn.overwrite(value, {
                        andOr: 'and',
                        opt: '='
                    });

                    var _val = value.value;
                    if(_val == null) {
                        _val = '';
                    }
                    switch (value.opt) {
                        case '=':
                        case '>':
                        case '<':
                        case '>=':
                        case '<=':
                        case '<>':
                            _val = this.__equal(_val);
                            break;
                        case '%':
                        case 'like':
                            value.opt = 'like';
                            _val = this.__like(_val);
                            break;
                        case 'in':
                        case 'not in':
                            _val = this.__in(_val);
                            if(!_val) return;
                            break;
                        case 'between':
                        case 'not between':
                            _val = this.__betweenAnd(_val);
                            break;
                        case 'time_range':
                            _val = this.__timeRange(value.key, _val);
                            value.key = '';
                            value.opt = '';
                            break;
                    }
                    value = [value.andOr, value.key, value.opt, _val].join(' ');
                    break;
            }

            return value;
            //return isNaN(value) ? ("'"+value+"'") : value;
        },
        parse: function (data, context){
            var _key = null,
                _value = '',
                _data = {};
            this._context = this._context || context;
            data = this.fire('parse', data, context) || data;
            zn.each(data || {}, function (value, key){
                key = key.toLowerCase();
                _key = this.__firstCharUpperCase(key);
                _value = (this["parse" + _key] && this["parse" + _key].call(this, value, data)) || '';
                if(_value){
                    _data[key] = " " + _value + " ";
                }
            }.bind(this));

            return zn.overwrite(_data, VALUES.DEFAULTS);
        },
        parseTable: function (table, data){
            var _table = '';
            table = this.fire('parseTable', table, data) || table;
            switch (zn.type(table)){
                case 'string':
                    _table = table;
                    break;
                case 'function':
                    _table = "(" + (table.call(this._context)||'') + ")";
                    break;
            }

            return this.fire('parsedTable', _table, data) || _table;
        },
        parseGroup: function (group, data){
            group = this.fire('parseGroup', group, data) || group;
            if(zn.is(group, 'function')){
                group = group.call(this._context);
            }
            var _val = '';
            switch (zn.type(group)){
                case 'string':
                    _val = group;
                    break;
                case 'array':
                    _val = group.join(',');
                    break;
            }

            if(_val){
                _val = 'group by ' + _val;
            }


            return this.fire('parsedGroup', _val, data) || _val;
        },
        parseOrder: function (order, data){
            order = this.fire('parseOrder', order, data) || order;
            if(zn.is(order, 'function')){
                order = order.call(this._context);
            }
            var _val = '';
            switch (zn.type(order)){
                case 'string':
                    _val = order;
                    break;
                case 'array':
                    _val = order.join(',');
                    break;
                case 'object':
                    var _temp = [];
                    zn.each(order, function (value, key){
                        _temp.push(key+' '+value);
                    });
                    _val = _temp.join(',');
                    break;
            }

            if(_val){
                _val = 'order by ' + _val;
            }

            return this.fire('parsedOrder', _val, data) || _val;
        },
        parseValues: function (values, data){
            values = this.fire('parseValues', values, data) || values;
            if(zn.is(values, 'function')){
                values = values.call(this._context);
            }
            var _prefix = data.prefix || '',
                _return = '';
            switch (zn.type(values)){
                case 'string':
                    _return = values;
                    break;
                case 'object':
                    var _keys = [],
                        _values = [];
                    zn.each(values, function (value, key){
                        if(value != null) {
                            var _value = this.__formatSqlValue(value);
                            if(_value !== null) {
                                _keys.push(_prefix + key);
                                _values.push(_value);
                            }
                        }
                    }.bind(this));

                    _return = "({0}) values ({1})".format(_keys.join(','), _values.join(','));
                    break;
            }

            return this.fire('parsedValues', _return, data) || _return;
        },
        parseSets: function (updates, data){
            return this.parseUpdates(updates, data);
        },
        parseUpdates: function (updates, data){
            updates = this.fire('parseUpdates', updates, data) || updates;
            if(zn.is(updates, 'function')){
                updates = updates.call(this._context);
            }
            var _prefix = data.prefix || '',
                _return = '';
            switch (zn.type(updates)){
                case 'string':
                    _return = updates;
                    break;
                case 'object':
                    var _updates = [];
                    zn.each(updates, function (value, key){
                        var _value = this.__formatSqlValue(value);
                        if(_value !== null) {
                            _updates.push(_prefix + key + ' = ' + _value);
                        }
                    }.bind(this));

                    _return = _updates.join(',');
                    break;
            }

            return this.fire('parsedUpdates', _return, data) || _return;
        },
        parseFields: function (fields, data){
            fields = this.fire('parseFields', fields, data) || fields;
            if(zn.is(fields, 'function')){
                fields = fields.call(this._context);
            }
            var _prefix = data.prefix || '',
                _return = '';
            switch (zn.type(fields)){
                case 'function':
                    _return = fields.call(this._context)||'';
                    break;
                case 'array':
                    fields.map(function (field){
                        switch(zn.type(field)){
                            case 'function':
                                return field.call(this._context)||'';
                            case 'array':
                            case 'object':
                                return this.parseFields(field, data);
                            default:
                                return field;
                        }
                    }.bind(this));
                    
                    _return = fields.join(',');
                    break;
                case 'object':
                    var _fields = [];
                    zn.each(fields, function (value, key){
                        if(value && key) {
                            _fields.push(_prefix + value + ' as ' + key);
                        }
                    });

                    _return = _fields.join(',');
                    break;
                default:
                    _return = fields;
                    break;
            }

            return this.fire('parsedFields', _return, data) || _return;
        },
        convertWhere: function (){
            var _toString = Object.prototype.toString,
                _argv = arguments,
                _where = [],
                _value = null;
            for(var i = 0, _len = _argv.length; i < _len; i++) {
                _value = _argv[i];
                if(!_value) continue;
                switch(_toString.call(_value)) {
                    case '[object String]':
                        _where.push(_value);
                        break;
                    case '[object Object]':
                        _value = this.parseWhere(_value, {}, false);
                        if(_value){
                            _where.push(_value);
                        }
                        break;
                    case '[object Array]':
                        _value = this.convertWhere.apply(this, _value);
                        if(_value){
                            _where.push(_value);
                        }
                        break;
                    case '[object Function]':
                        _value = _value(_where, this);
                        if(_value !== false){
                            _where.push(this.convertWhere.apply(this, [_value]));
                        }
                        break;
                }
            }

            return _where.join(' ');
        },
        convertWheres: function (){
            var _toString = Object.prototype.toString,
                _argvs = arguments,
                _argv = null,
                _operator = null,
                _value = null,
                _ands = [],
                _ors = [];
            for(var i = 0, _len = _argvs.length; i < _len; i++) {
                _argv = _argvs[i];
                if(!_argv) continue;
                _operator = 'and';
                switch(_toString.call(_argv)) {
                    case '[object String]':
                        _value = _argv;
                        break;
                    case '[object Object]':
                        if(!Object.keys(_argv).length) continue;
                        if(_argv.value && _argv.operator) {
                            _value = this.parseWhere(_argv.value, {}, false);
                            _operator = _argv.operator;
                        }else{
                            _value = this.parseWhere(_argv, {}, false);
                        }
                        break;
                    case '[object Array]':
                        _value = this.parseWhere(_argv, {}, false);
                        break;
                    case '[object Function]':
                        _argv = _argv(_argvs, this);
                        if(_argv !== false){
                            if(_toString.call(_argv) == '[object Object]'){
                                if(!Object.keys(_argv).length) continue;
                                if(_argv.value && _argv.operator) {
                                    _value = this.parseWhere(_argv.value, {}, false);
                                    _operator = _argv.operator;
                                }else{
                                    _value = this.parseWhere(_argv, {}, false);
                                }
                            }else{
                                _value = this.parseWhere(_argv, {}, false);
                            }
                        }
                        break;
                }
                
                
                if(_operator.indexOf('or') != -1){
                    _ors.push("(" + _value + ")");
                } else {
                    _ands.push("(" + _value + ")");
                }
            }

            var _where = '';
            if(_ands.length){
                _where = _ands.join(' and ');
            }

            if(_ors.length == 1){
                _where += ' or ' + _ors[0];
            }else if(_ors.length > 1){
                _where += ' or (' + _ors.join(' or ') + ')';
            }

            if(_where.slice(0, 4) == 'and '){
                _where = _where.substring(4);
            }
            if(_where.slice(0, 3) == 'or '){
                _where = _where.substring(3);
            }

            return _where;
        },
        parseWhere: function (where, data, addKeyWord){
            addKeyWord = addKeyWord !== false ? true : false;
            where = this.fire('parseWhere', where, data, addKeyWord) || where;
            if(zn.is(where, 'function')){
                where = where.call(this._context, where, data, addKeyWord);
            }
            var _values = [],
                _return = '';
            switch (zn.type(where)){
                case 'string':
                    _return = where;
                    break;
                case 'array':
                    where.forEach(function (value, index){
                        if(zn.is(value, 'function')){
                            value = value.call(this._context, index, where, data, addKeyWord);
                        }
                        switch (zn.type(value)) {
                            case 'number':
                            case 'string':
                                _values.push(value);
                                break;
                            case 'object':
                                if(value.sql){
                                    _values.push([
                                        value.andOr || 'and', 
                                        value.sql
                                    ].join(' '));
                                    break;
                                }

                                if(value.name && value.value) {
                                    zn.overwrite(value, {
                                        andOr: 'and',
                                        opt: '='
                                    });
                                    var _key = value.name;
                                    var _val = value.value;
                                    if(_val == null) {
                                        _val = '';
                                    }
                                    if(zn.is(_val, 'array') && value.valueAndOr){
                                        _values.push([
                                            value.andOr, 
                                            '(' + _val.map(function (item){
                                                return _key + " " + value.opt + " " + (zn.is(item, 'number')?item:"'" + item + "'"); 
                                            }).join(' ' + value.valueAndOr + ' ') + ')'
                                        ].join(' '));
                                        break;
                                    }

                                    switch (value.opt) {
                                        case '=':
                                        case '>':
                                        case '<':
                                        case '>=':
                                        case '<=':
                                        case '<>':
                                            _val = this.__equal(_val);
                                            break;
                                        case 'regexp^':
                                            value.opt = 'regexp';
                                            _val = "'^" + _val + "'";
                                            break;
                                        case 'regexp$':
                                            value.opt = 'regexp';
                                            _val = "'" + _val + "$'";
                                            break;
                                        case '%':
                                        case 'like':
                                            value.opt = 'like';
                                            _val = this.__like(_val);
                                            break;
                                        case 'left-like':
                                            value.opt = 'like';
                                            _val = "'%" + _val + "'";
                                            break;
                                        case 'right-like':
                                            value.opt = 'like';
                                            _val = "'" + _val + "%'";
                                            break;
                                        case 'in':
                                        case 'not in':
                                            _val = this.__in(_val);
                                            if(!_val) return;
                                            break;

                                        case 'between':
                                        case 'not between':
                                            _val = this.__betweenAnd(_val);
                                            break;
                                        case 'time_range':
                                            _val = this.__timeRange(value.name, _val);
                                            value.name = '';
                                            value.opt = '';
                                            break;
                                    }
                                    value = [value.andOr, value.name, value.opt, _val];
                                    _values.push(value.join(' '));
                                } else {
                                    for(var key in value) {
                                        var _field = value[key];
                                        zn.overwrite(_field, {
                                            andOr: 'and',
                                            opt: '='
                                        });
                                        var _key = key || _field.name;
                                        var _val = _field.value;
                                        if(_val == null) {
                                            _val = '';
                                        }
                                        if(zn.is(_val, 'array') && _field.valueAndOr){
                                            _values.push([
                                                _field.andOr, 
                                                '(' + _val.map(function (item){
                                                    return _key + " " + _field.opt + " " + (zn.is(item, 'number')?item:"'" + item + "'"); 
                                                }).join(' ' + _field.valueAndOr + ' ') + ')'
                                            ].join(' '));
                                            break;
                                        }

                                        switch (_field.opt) {
                                            case '=':
                                            case '>':
                                            case '<':
                                            case '>=':
                                            case '<=':
                                            case '<>':
                                                _val = this.__equal(_val);
                                                break;
                                            case 'regexp^':
                                                _field.opt = 'regexp';
                                                _val = "'^" + _val + "'";
                                                break;
                                            case 'regexp$':
                                                _field.opt = 'regexp';
                                                _val = "'" + _val + "$'";
                                                break;
                                            case '%':
                                            case 'like':
                                                _field.opt = 'like';
                                                _val = this.__like(_val);
                                                break;
                                            case 'left-like':
                                                _field.opt = 'like';
                                                _val = "'%" + _val + "'";
                                                break;
                                            case 'right-like':
                                                _field.opt = 'like';
                                                _val = "'" + _val + "%'";
                                                break;
                                            case 'in':
                                            case 'not in':
                                                _val = this.__in(_val);
                                                if(!_val) return;
                                                break;
                                            case 'between':
                                            case 'not between':
                                                _val = this.__betweenAnd(_val);
                                                break;
                                            case 'time_range':
                                                _val = this.__timeRange(_key, _val);
                                                _key = '';
                                                _field.opt = '';
                                                break;
                                        }
                                        _field = [_field.andOr, _key, _field.opt, _val];
                                        _values.push(_field.join(' '));
                                    }
                                }
                                break;
                            case 'array':
                                _values.push(value.join(' '));
                                break;
                        }
                    }.bind(this));

                    _return = _values.join(' ');
                    break;
                case 'object':
                    zn.each(where, function (value, key){
                        if(zn.is(value, 'function')){
                            value = value.call(this._context, key, where, data, addKeyWord);
                        }
                        if(value == null || key == null){
                            return -1;
                        }
                        switch(zn.type(value)){
                            case 'string':
                            case 'number':
                                if(key.indexOf('&') == -1 && key.indexOf('|') == -1){
                                    var _value = this.__formatSqlValue(value);
                                    if(_value !== null) {
                                        _values.push('and ' + key + ' = ' + _value);
                                    }
                                }else {
                                    var _piecs = key.indexOf('_'),
                                        _andOr = _piecs[0] || '&',
                                        _key = _piecs[1],
                                        _opt = _piecs[2];
                                    switch (_opt) {
                                        case '=':
                                        case '>':
                                        case '<':
                                        case '>=':
                                        case '<=':
                                        case '<>':
                                            value = this.__equal(value);
                                            break;
                                        case 'regexp^':
                                            _opt = 'regexp';
                                            value = "'^" + value + "'";
                                            break;
                                        case 'regexp$':
                                            _opt = 'regexp';
                                            value = "'" + value + "$'";
                                            break;
                                        case '%':
                                        case 'like':
                                            _opt = 'like';
                                            value = this.__like(value);
                                            break;
                                        case 'left-like':
                                            _opt = 'like';
                                            value = "'%" + value + "'";
                                            break;
                                        case 'right-like':
                                            _opt = 'like';
                                            value = "'" + value + "%'";
                                            break;
                                        case 'in':
                                        case 'not in':
                                            value = this.__in(value);
                                            if(!value) return;
                                            break;
                                        case 'between':
                                        case 'not between':
                                            value = this.__betweenAnd(value);
                                            break;
                                        case 'time_range':
                                            value = this.__timeRange(_key, value);
                                            _key = '';
                                            _opt = '';
                                            break;
                                    }
                                    _values.push([(_andOr=='&'?'and':'or'), _key, _opt, value].join(' '));
                                }
                                break;
                            case 'object':
                                if(value.sql){
                                    _values.push([
                                        value.andOr || 'and', 
                                        value.sql
                                    ].join(' '));
                                    break;
                                }
                                if(value.name || value.value || value.opt) {
                                    zn.overwrite(value, {
                                        andOr: 'and',
                                        opt: '='
                                    });
                                    var _key = value.name || key;
                                    var _val = value.value;
                                    if(_val == null) {
                                        _val = '';
                                    }
                                    if(zn.is(_val, 'array') && value.valueAndOr){
                                        _values.push([
                                            value.andOr, 
                                            '(' + _val.map(function (item){
                                                return _key + " " + value.opt + " " + (zn.is(item, 'number')?item:"'" + item + "'"); 
                                            }).join(' ' + value.valueAndOr + ' ') + ')'
                                        ].join(' '));
                                        break;
                                    }

                                    switch (value.opt) {
                                        case '=':
                                        case '>':
                                        case '<':
                                        case '>=':
                                        case '<=':
                                        case '<>':
                                            _val = this.__equal(_val);
                                            break;
                                        case 'regexp^':
                                            value.opt = 'regexp';
                                            _val = "'^" + _val + "'";
                                            break;
                                        case 'regexp$':
                                            value.opt = 'regexp';
                                            _val = "'" + _val + "$'";
                                            break;
                                        case '%':
                                        case 'like':
                                            value.opt = 'like';
                                            _val = this.__like(_val);
                                            break;
                                        case 'left-like':
                                            value.opt = 'like';
                                            _val = "'%" + _val + "'";
                                            break;
                                        case 'right-like':
                                            value.opt = 'like';
                                            _val = "'" + _val + "%'";
                                            break;
                                        case 'in':
                                        case 'not in':
                                            _val = this.__in(_val);
                                            if(!_val) return;
                                            break;
                                        case 'between':
                                        case 'not between':
                                            _val = this.__betweenAnd(_val);
                                            break;
                                        case 'time_range':
                                            _val = this.__timeRange(_key, _val);
                                            _key = '';
                                            value.opt = '';
                                            break;
                                    }
                                    value = [value.andOr, _key, value.opt, _val];
                                    _values.push(value.join(' '));
                                } else {
                                    for(var key in value) {
                                        var _field = value[key];
                                        var _key = _field.name || key;
                                        zn.overwrite(_field, {
                                            andOr: 'and',
                                            opt: '='
                                        });
                                        var _val = _field.value;
                                        if(_val == null) {
                                            _val = '';
                                        }
                                        if(zn.is(_val, 'array') && _field.valueAndOr){
                                            _values.push([
                                                _field.andOr, 
                                                '(' + _val.map(function (item){
                                                    return _key + " " + _field.opt + " " + (zn.is(item, 'number')?item:"'" + item + "'"); 
                                                }).join(' ' + _field.valueAndOr + ' ') + ')'
                                            ].join(' '));
                                            break;
                                        }

                                        switch (_field.opt) {
                                            case '=':
                                            case '>':
                                            case '<':
                                            case '>=':
                                            case '<=':
                                            case '<>':
                                                _val = this.__equal(_val);
                                                break;
                                            case 'regexp^':
                                                value.opt = 'regexp';
                                                _val = "'^" + _val + "'";
                                                break;
                                            case 'regexp$':
                                                value.opt = 'regexp';
                                                _val = "'" + _val + "$'";
                                                break;
                                            case '%':
                                            case 'like':
                                                _field.opt = 'like';
                                                _val = this.__like(_val);
                                                break;
                                            case 'left-like':
                                                _field.opt = 'like';
                                                _val = "'%" + _val + "'";
                                                break;
                                            case 'right-like':
                                                _field.opt = 'like';
                                                _val = "'" + _val + "%'";
                                                break;
                                            case 'in':
                                            case 'not in':
                                                _val = this.__in(_val);
                                                if(!_val) return;
                                                break;
                                            case 'between':
                                            case 'not between':
                                                _val = this.__betweenAnd(_val);
                                                break;
                                            case 'time_range':
                                                _val = this.__timeRange(_key, _val);
                                                _key = '';
                                                _field.opt = '';
                                                break;
                                        }
                                        _field = [_field.andOr, _key, _field.opt, _val];
                                        _values.push(_field.join(' '));
                                    }
                                }
                                break;
                            case 'array':
                                break;
                            case 'function':
                                break;
                        }
                    }.bind(this));

                    _return = _values.join(' ');
                    break;
            }

            if(_return.slice(0, 4) == 'and '){
                _return = _return.substring(4);
            }

            if(_return.slice(0, 3) == 'or '){
                _return = _return.substring(3);
            }

            _return = this.fire('parsedWhere', _return, data, addKeyWord) || _return;
            if(_return && addKeyWord !== false){
                _return = 'where ' + _return;
            }

            return _return;
        },
        __equal: function (value){
            switch(typeof value) {
                case 'string':
                    if(value.indexOf('{{') === 0 && value.indexOf('}}') === (value.length-2)){
                        value = value.substring(2, value.length - 2);
                    }else {
                        value = "'" + value + "'";
                    }
                    return value;
                case 'number':
                    return value;
                case 'array':
                    return "('" + value.join("','") + "')";
                case 'object':
                    return "'" + JSON.stringify(value) + "'";
                case 'function':
                    return value(this);
            }
        },
        __like: function (value){
            return "'%" + value + "%'";
        },
        __isNull: function (value){
            return "is null";
        },
        __isNotNull: function (value){
            return "is not null";
        },
        __timeRange: function (name, value){
            var _return = [];
            if(value[0]) {
                _return.push("UNIX_TIMESTAMP({0})>=UNIX_TIMESTAMP('{1}')".format(name, value[0]));
            }
            if(value[1]) {
                _return.push("UNIX_TIMESTAMP({0})<=UNIX_TIMESTAMP('{1}')".format(name, value[1]));
            }

            return "(" + _return.join(' and ') +  ")";
        },
        __in: function (ins){
            if(zn.is(ins, 'function')){
                ins = ins.call(this._context);
            }
            ins = ins || '0';
            if(zn.is(ins, 'array')){
                if(ins.length) {
                    if(typeof ins[0] == 'string'){
                        ins = "'" + ins.join("','") + "'";
                    }else if(typeof ins[0] == 'number'){
                        ins = ins.join(",");
                    }
                }else{
                    return null;
                }
            }

            return '(' + ins + ')';
        },
        __betweenAnd: function (between){
            if(zn.is(between, 'function')){
                between = between.call(this._context);
            }
            switch (zn.type(between)){
                case 'string':
                    return between;
                case 'array':
                    return between[0] + ' and ' + between[1];
            }
        }
    }
});
